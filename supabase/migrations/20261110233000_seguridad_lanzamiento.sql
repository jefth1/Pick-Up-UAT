-- Seguridad para abrir Pick Up UAT con cuentas reales (10 de noviembre de 2026).
--
-- 1. Fotos y logos: solo imágenes del bucket "fotos" de este proyecto o un dibujo de la
--    app. Antes se podía guardar cualquier texto como dirección de la imagen y, con unas
--    comillas, meter estilos que tapaban la pantalla de los alumnos o cargaban imágenes
--    de otro sitio.
-- 2. Los locales nuevos esperan aprobación (locales.aprobado). Mientras, solo los ve su
--    dueño y nadie les puede pedir. Se aprueban en el panel de Supabase:
--    Table Editor → locales → aprobado = true. El dueño no puede aprobarse a sí mismo.
-- 3. Pedidos: hasta 3 esperando respuesta y 10 por hora por alumno, y hasta 30 renglones
--    por pedido, para que nadie llene de pedidos falsos a un local.
-- 4. Código de entrega de los favores: tras 5 intentos fallidos hay que esperar 10 minutos
--    (antes se podían probar los 10 000 códigos seguidos).

-- 1. Fotos y logos --------------------------------------------------------------------

alter table public.productos add constraint foto_url_segura check (
  foto_url ~ '^dibujo:[a-z-]{1,30}$'
  or foto_url ~ '^https://gdexcnbivhxqkfryoygf\.supabase\.co/storage/v1/object/public/fotos/[0-9]{1,18}/[A-Za-z0-9._-]{1,100}$'
);
alter table public.locales add constraint logo_url_segura check (
  logo_url ~ '^https://gdexcnbivhxqkfryoygf\.supabase\.co/storage/v1/object/public/fotos/[0-9]{1,18}/[A-Za-z0-9._-]{1,100}$'
);

-- 2. Aprobación de locales ------------------------------------------------------------

alter table public.locales add column aprobado boolean not null default false;
-- Los locales que ya existían al aplicar esto ya estaban a la vista: se quedan aprobados.
update public.locales set aprobado = true where not aprobado;

-- Un local se ve si está aprobado, si es tuyo o si tienes un pedido suyo (así un pedido
-- viejo sigue mostrando el nombre del local aunque el local se haya dado de baja).
alter policy "locales visibles" on public.locales
  using (aprobado
    or propietario = (select auth.uid())
    or exists (select 1 from public.pedidos p where p.local_id = locales.id));

-- El menú y el horario se ven solo si se ve el local.
alter policy "productos visibles" on public.productos
  using (exists (select 1 from public.locales l where l.id = local_id));
alter policy "horarios visibles" on public.horarios
  using (exists (select 1 from public.locales l where l.id = local_id));

-- El dueño cambia los datos de su local, pero no "aprobado" ni de quién es.
revoke insert, update on public.locales from anon, authenticated;
grant insert (nombre, encargado, ubicacion, direccion, abierto, logo_url, lat, lng)
  on public.locales to authenticated;
grant update (nombre, encargado, ubicacion, direccion, abierto, logo_url, lat, lng)
  on public.locales to authenticated;

-- 3 y 2. Crear pedido: solo a locales aprobados, con límites por alumno -----------------

create or replace function public.crear_pedido(
  p_local_id bigint,
  p_hora_recogida timestamptz,
  p_productos jsonb,
  p_instrucciones text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_alumno uuid := auth.uid();
  v_hora timestamp := p_hora_recogida at time zone 'America/Monterrey';
  v_pedido bigint;
  v_item jsonb;
  v_producto public.productos;
  v_total numeric(10, 2) := 0;
begin
  if v_alumno is null or not exists (select 1 from public.alumnos where id = v_alumno) then
    raise exception 'Primero confirma tus datos de alumno';
  end if;
  if not exists (select 1 from public.locales where id = p_local_id and abierto and aprobado) then
    raise exception 'El local no está recibiendo pedidos';
  end if;
  if (select count(*) from public.pedidos where alumno_id = v_alumno and estado = 'nuevo') >= 3 then
    raise exception 'Ya tienes 3 pedidos esperando respuesta. Espera a que el local los acepte o rechace.';
  end if;
  if (select count(*) from public.pedidos
      where alumno_id = v_alumno and creado_en > now() - interval '1 hour') >= 10 then
    raise exception 'Hiciste muchos pedidos en poco tiempo. Intenta de nuevo más tarde.';
  end if;
  if p_hora_recogida < now() + interval '10 minutes' or p_hora_recogida > now() + interval '1 day' then
    raise exception 'Elige una hora de recogida de al menos 10 minutos a partir de ahora';
  end if;
  if not exists (
    select 1 from public.horarios
    where local_id = p_local_id and dia = extract(dow from v_hora)
      and v_hora::time between abre and cierra
  ) then
    raise exception 'El local está cerrado a esa hora';
  end if;
  if jsonb_typeof(p_productos) is distinct from 'array' or jsonb_array_length(p_productos) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;
  if jsonb_array_length(p_productos) > 30 then
    raise exception 'Un pedido puede tener hasta 30 productos distintos';
  end if;

  insert into public.pedidos (local_id, alumno_id, hora_recogida, instrucciones)
  values (p_local_id, v_alumno, p_hora_recogida, nullif(trim(p_instrucciones), ''))
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_productos) loop
    select * into v_producto from public.productos
    where id = (v_item ->> 'producto_id')::bigint and local_id = p_local_id and disponible;
    if not found then
      raise exception 'Un producto ya no está disponible';
    end if;
    insert into public.pedido_productos (pedido_id, producto_id, nombre, precio_unitario, cantidad, nota)
    values (v_pedido, v_producto.id, v_producto.nombre, v_producto.precio,
            (v_item ->> 'cantidad')::smallint, nullif(trim(v_item ->> 'nota'), ''));
    v_total := v_total + v_producto.precio * (v_item ->> 'cantidad')::smallint;
  end loop;

  update public.pedidos set total = v_total where id = v_pedido;
  return v_pedido;
end;
$$;

-- 4. Código de entrega con intentos limitados -------------------------------------------

alter table public.favor_codigos
  add column intentos smallint not null default 0,
  add column ultimo_intento timestamptz;

-- Ahora regresa si el código coincidió (true) o no (false), en lugar de dar error, para que
-- el intento fallido quede contado.
drop function public.confirmar_entrega(bigint, text);
create function public.confirmar_entrega(p_favor_id bigint, p_codigo text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo public.favor_codigos;
  v_reciente boolean;
begin
  if not exists (select 1 from public.favores
                 where id = p_favor_id and repartidor_id = auth.uid() and estado = 'recogido') then
    raise exception 'Este favor no está en camino contigo';
  end if;
  select * into v_codigo from public.favor_codigos where favor_id = p_favor_id for update;
  v_reciente := v_codigo.ultimo_intento > now() - interval '10 minutes';
  if v_reciente and v_codigo.intentos >= 5 then
    raise exception 'Escribiste mal el código varias veces. Espera 10 minutos y pídele al alumno que te lo muestre otra vez.';
  end if;
  if v_codigo.codigo is distinct from trim(p_codigo) then
    update public.favor_codigos
    set intentos = case when v_reciente then intentos + 1 else 1 end, ultimo_intento = now()
    where favor_id = p_favor_id;
    return false;
  end if;
  update public.favores set estado = 'entregado', actualizado_en = now() where id = p_favor_id;
  return true;
end;
$$;

revoke execute on function public.confirmar_entrega(bigint, text) from public, anon;
grant execute on function public.confirmar_entrega(bigint, text) to authenticated;
