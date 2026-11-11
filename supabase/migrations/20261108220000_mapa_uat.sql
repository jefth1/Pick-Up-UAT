-- Mapa de la UAT (Campus Tampico: Centro Universitario Tampico-Madero).
-- 1. puntos_entrega pasa a ser los lugares del mapa: facultades y zonas. Todos sirven
--    como punto de entrega de los favores. Los coloca un administrador desde
--    PerfilAdmin/mapa.html, tocando el mapa (solo se guardan lugares con coordenadas reales).
-- 2. Las cafeterías y comercios son los locales: cada dueño coloca el suyo desde su
--    perfil (locales.lat/lng, que ya solo puede cambiar el dueño). Nadie más agrega puntos.
-- 3. Tiempo estimado de llegada de los favores: quien hace el favor manda su posición a
--    compartir_avance(), que solo guarda la hora estimada. La posición no se guarda ni la
--    ve nadie: quien pidió el favor solo ve en cuánto tiempo llega.

-- Lugares de la UAT -------------------------------------------------------------------

alter table public.puntos_entrega
  add column tipo text not null default 'zona' check (tipo in ('facultad', 'zona')),
  add column abreviatura text check (length(abreviatura) between 1 and 12),
  add column icono text not null default 'ubicacion' check (length(icono) between 1 and 20);

-- Los dos puntos de prueba tenían coordenadas inventadas: se apagan (los favores que ya
-- existen los siguen usando).
update public.puntos_entrega set activo = false where nombre like 'Prueba · %';

-- Facultades y zonas con nombre en el dibujo del mapa (OpenStreetMap, ver
-- Compartido/datos/LEEME.md), en el centro de su terreno. Los mismos nombres que sugiere
-- el editor del administrador, que puede moverlos, renombrarlos o quitarlos.
insert into public.puntos_entrega (nombre, abreviatura, tipo, icono, lat, lng) values
  ('Facultad de Ingeniería Arturo Narro Siller', 'FIANS', 'facultad', 'birrete', 22.2767041, -97.8643157),
  ('Facultad de Derecho y Ciencias Sociales', 'FADYCS', 'facultad', 'birrete', 22.2756944, -97.8646432),
  ('Facultad de Comercio y Administración Tampico', 'FCAT', 'facultad', 'birrete', 22.2748209, -97.8619641),
  ('Facultad de Arquitectura, Diseño y Urbanismo', 'FADU', 'facultad', 'birrete', 22.2742137, -97.8641401),
  ('Facultad de Medicina Dr. Alberto Romo Caballero', 'Medicina', 'facultad', 'birrete', 22.277154, -97.8615878),
  ('Facultad de Odontología', 'Odontología', 'facultad', 'birrete', 22.2774206, -97.8603006),
  ('Facultad de Enfermería Tampico', 'Enfermería', 'facultad', 'birrete', 22.2785538, -97.861668),
  ('Facultad de Música y Artes', 'Música', 'facultad', 'birrete', 22.2782288, -97.8631979),
  ('Biblioteca', null, 'zona', 'libro', 22.2761477, -97.8611594),
  ('Clínica Dental', null, 'zona', 'edificio', 22.2776341, -97.8604611),
  ('Pista de atletismo', null, 'zona', 'deportes', 22.274278, -97.8598592),
  ('Cancha de fútbol', null, 'zona', 'deportes', 22.2753349, -97.8637384);

-- Los locales de prueba tenían coordenadas aproximadas de Cd. Victoria: se borran para que
-- cada local se coloque en el mapa del campus Tampico desde su perfil.
update public.locales set lat = null, lng = null where lat between 23.5 and 24;

-- Administradores del mapa (se agregan desde el panel de Supabase).
create table public.administradores (
  usuario uuid primary key references auth.users on delete cascade
);
alter table public.administradores enable row level security;
create policy "saber si administro" on public.administradores for select to authenticated
  using (usuario = (select auth.uid()));
revoke insert, update, delete on public.administradores from anon, authenticated;

create function privado.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.administradores where usuario = (select auth.uid()));
$$;

-- Solo un administrador agrega, mueve o renombra lugares. Quitar uno del mapa es
-- apagarlo (activo = false): los favores viejos lo siguen usando.
grant insert, update on public.puntos_entrega to authenticated;
create policy "administrador agrega lugares" on public.puntos_entrega for insert to authenticated
  with check (privado.es_admin());
create policy "administrador edita lugares" on public.puntos_entrega for update to authenticated
  using (privado.es_admin()) with check (privado.es_admin());

-- Un lugar sin coordenadas no se puede cotizar.
create or replace function public.cotizar_favor(p_local_id bigint, p_punto_id bigint)
returns table (distancia_m integer, tarifa numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_local public.locales;
  v_punto public.puntos_entrega;
begin
  select * into v_local from public.locales where id = p_local_id;
  select * into v_punto from public.puntos_entrega where id = p_punto_id and activo;
  if v_local.lat is null or v_punto.lat is null then
    raise exception 'Este local todavía no tiene entregas por favor';
  end if;
  distancia_m := privado.distancia_m(v_local.lat, v_local.lng, v_punto.lat, v_punto.lng);
  tarifa := privado.tarifa_favor(distancia_m);
  return next;
end;
$$;

-- Tiempo estimado de llegada ------------------------------------------------------------

alter table public.favores
  add column llegada_estimada timestamptz,
  add column llegada_actualizada timestamptz;

-- Minutos a pie: camino ≈ línea recta × 1.3, a 75 m por minuto (4.5 km/h).
create function privado.minutos_caminando(p_distancia_m integer) returns integer
language sql immutable set search_path = '' as $$
  select ceil(coalesce(p_distancia_m, 0) * 1.3 / 75.0)::integer;
$$;

-- Hora estimada, redondeada hacia arriba al minuto.
create function privado.llegada_en(p_desde timestamptz, p_minutos integer) returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('minute', p_desde + make_interval(mins => p_minutos)) + interval '1 minute';
$$;

-- Estimado inicial cada vez que el favor cambia de estado, por si quien lo hace no
-- comparte su avance: al tomarlo, ir al local (~5 min), esperar la hora de recogida y
-- caminar al punto; al recogerlo, solo caminar al punto.
create function privado.llegada_base() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_sale_del_local timestamptz;
begin
  if new.estado = 'asignado' then
    select greatest(now() + interval '5 minutes', p.hora_recogida) into v_sale_del_local
    from public.pedidos p where p.id = new.pedido_id;
    new.llegada_estimada := privado.llegada_en(v_sale_del_local, privado.minutos_caminando(new.distancia_m));
  elsif new.estado = 'recogido' then
    new.llegada_estimada := privado.llegada_en(now(), privado.minutos_caminando(new.distancia_m));
  else
    new.llegada_estimada := null;
  end if;
  new.llegada_actualizada := now();
  return new;
end;
$$;

create trigger llegada_base before update of estado on public.favores
  for each row when (new.estado is distinct from old.estado)
  execute function privado.llegada_base();

-- Quien hace el favor manda su posición (cada ~20 s mientras tiene la página abierta).
-- Solo se calcula la hora estimada de llegada al punto de entrega; la posición no se
-- guarda en ninguna tabla.
create function public.compartir_avance(p_favor_id bigint, p_lat double precision, p_lng double precision)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_favor public.favores;
  v_pedido public.pedidos;
  v_local public.locales;
  v_punto public.puntos_entrega;
  v_sale_del_local timestamptz;
  v_llegada timestamptz;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ubicación no válida';
  end if;
  select * into v_favor from public.favores
  where id = p_favor_id and repartidor_id = auth.uid() and estado in ('asignado', 'recogido');
  if not found then
    raise exception 'Este favor no está en camino contigo';
  end if;
  -- Como mucho una actualización cada 15 segundos.
  if v_favor.llegada_actualizada > now() - interval '15 seconds' then
    return v_favor.llegada_estimada;
  end if;

  select * into v_punto from public.puntos_entrega where id = v_favor.punto_id;
  if v_favor.estado = 'recogido' then
    v_llegada := privado.llegada_en(now(), privado.minutos_caminando(
      privado.distancia_m(p_lat, p_lng, v_punto.lat, v_punto.lng)));
  else
    select * into v_pedido from public.pedidos where id = v_favor.pedido_id;
    select * into v_local from public.locales where id = v_pedido.local_id;
    v_sale_del_local := now() + make_interval(mins => privado.minutos_caminando(
      privado.distancia_m(p_lat, p_lng, v_local.lat, v_local.lng)));
    if v_pedido.estado <> 'listo' then
      v_sale_del_local := greatest(v_sale_del_local, v_pedido.hora_recogida);
    end if;
    v_llegada := privado.llegada_en(v_sale_del_local, privado.minutos_caminando(v_favor.distancia_m));
  end if;

  update public.favores set llegada_estimada = v_llegada, llegada_actualizada = now()
  where id = p_favor_id;
  return v_llegada;
end;
$$;

revoke execute on function public.compartir_avance(bigint, double precision, double precision) from public, anon;
grant execute on function public.compartir_avance(bigint, double precision, double precision) to authenticated;
revoke execute on function privado.es_admin(), privado.minutos_caminando(integer),
  privado.llegada_en(timestamptz, integer), privado.llegada_base() from public, anon;
grant execute on function privado.es_admin() to authenticated;
