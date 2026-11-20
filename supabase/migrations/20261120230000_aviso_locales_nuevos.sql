-- Aviso por correo de locales nuevos (20 de noviembre de 2026).
--
-- Cuando se registra un local (al verificar su correo se crea su fila en "locales"), la
-- base llama a la Edge Function "locales-nuevos" (supabase/functions/locales-nuevos/), que
-- manda un correo al administrador con los datos del local y un botón «Revisar y aceptar».
-- El botón abre PerfilAdmin/aprobar-local.html, que acepta el local con un toque.
--
-- Las funciones de abajo solo las puede llamar la Edge Function (rol service_role): ni los
-- alumnos ni los locales pueden leer correos ajenos ni aprobarse.

create extension if not exists pg_net with schema extensions;

-- Cuándo se mandó el aviso. Sirve para no mandarlo dos veces aunque llamen a la función
-- varias veces con el mismo local. El dueño no lo puede cambiar (permisos por columna).
-- Los locales ya aprobados nunca reciben aviso.
alter table public.locales add column aviso_enviado_en timestamptz;

-- Datos del local para el correo y para la pantalla de aprobar.
create or replace function privado.datos_local_para_admin(p_local_id bigint)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id,
    'nombre', l.nombre,
    'encargado', l.encargado,
    'ubicacion', l.ubicacion,
    'direccion', l.direccion,
    'logo_url', l.logo_url,
    'lat', l.lat,
    'lng', l.lng,
    'aprobado', l.aprobado,
    'creado_en', l.creado_en,
    'correo', u.email,
    'horarios', coalesce((
      select jsonb_agg(jsonb_build_object('dia', h.dia, 'abre', h.abre, 'cierra', h.cierra) order by h.dia)
      from public.horarios h where h.local_id = l.id), '[]'::jsonb)
  )
  from public.locales l
  left join auth.users u on u.id = l.propietario
  where l.id = p_local_id;
$$;

-- Marca el aviso como enviado y regresa los datos del local. Si ya se avisó o el local ya
-- está aprobado (o no existe), regresa null y la función no manda nada.
create or replace function public.tomar_aviso_local(p_local_id bigint)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.locales set aviso_enviado_en = now()
    where id = p_local_id and aviso_enviado_en is null and not aprobado;
  if not found then
    return null;
  end if;
  return privado.datos_local_para_admin(p_local_id);
end;
$$;

-- Si el correo no se pudo mandar, se quita la marca para poder intentarlo otra vez.
create or replace function public.soltar_aviso_local(p_local_id bigint)
returns void
language sql security definer set search_path = '' as $$
  update public.locales set aviso_enviado_en = null where id = p_local_id and not aprobado;
$$;

create or replace function public.ver_local_para_aprobar(p_local_id bigint)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select privado.datos_local_para_admin(p_local_id);
$$;

-- Regresa true si el local existe (quede recién aprobado o ya lo estuviera).
create or replace function public.aprobar_local(p_local_id bigint)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.locales set aprobado = true where id = p_local_id;
  return found;
end;
$$;

revoke all on function privado.datos_local_para_admin(bigint) from public, anon, authenticated;
revoke all on function public.tomar_aviso_local(bigint) from public, anon, authenticated;
revoke all on function public.soltar_aviso_local(bigint) from public, anon, authenticated;
revoke all on function public.ver_local_para_aprobar(bigint) from public, anon, authenticated;
revoke all on function public.aprobar_local(bigint) from public, anon, authenticated;
grant execute on function public.tomar_aviso_local(bigint) to service_role;
grant execute on function public.soltar_aviso_local(bigint) to service_role;
grant execute on function public.ver_local_para_aprobar(bigint) to service_role;
grant execute on function public.aprobar_local(bigint) to service_role;

-- Al crearse un local, se llama a la Edge Function con su id (en segundo plano: pg_net
-- manda la llamada después de guardar). Si algo falla, el registro del local sigue igual.
create or replace function privado.avisar_local_nuevo()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.aprobado then
    begin
      perform net.http_post(
        url := 'https://gdexcnbivhxqkfryoygf.supabase.co/functions/v1/locales-nuevos',
        body := jsonb_build_object('accion', 'avisar', 'local', new.id),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 10000
      );
    exception when others then
      raise warning 'No se pudo pedir el aviso del local %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke all on function privado.avisar_local_nuevo() from public, anon, authenticated;

create trigger avisar_local_nuevo
  after insert on public.locales
  for each row execute function privado.avisar_local_nuevo();
