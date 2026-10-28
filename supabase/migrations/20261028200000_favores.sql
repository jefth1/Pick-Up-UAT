-- Favores: un alumno recoge el pedido de otro y se lo lleva a un punto de entrega
-- de la UAT, a cambio de una tarifa según la distancia entre el local y el punto.
-- Queda apagado (ajustes.favores_activos = false) hasta que exista el pago con
-- tarjeta por adelantado: así quien hace el favor nunca adelanta dinero.
-- El local no hace nada nuevo: al marcar el pedido como entregado, el favor pasa a
-- "recogido"; el favor se cierra cuando el repartidor escribe el código del cliente.

-- Ajustes de la app (una sola fila). Se cambian desde el panel de Supabase.
create table public.ajustes (
  id boolean primary key default true check (id),
  favores_activos boolean not null default false
);
insert into public.ajustes default values;

-- Coordenadas del local (las guarda el local con el GPS desde su perfil).
alter table public.locales
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add check ((lat is null) = (lng is null));

-- El alumno decide si quiere ver la lista de favores.
alter table public.alumnos add column disponible_favores boolean not null default false;

-- Lugares de la UAT donde se entregan los favores. Se cargan desde el panel.
create table public.puntos_entrega (
  id bigint generated always as identity primary key,
  nombre text not null check (length(nombre) between 1 and 80),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  activo boolean not null default true
);

create type public.estado_favor as enum ('buscando', 'asignado', 'recogido', 'entregado', 'cancelado');

create table public.favores (
  id bigint generated always as identity primary key,
  pedido_id bigint not null unique references public.pedidos on delete cascade,
  cliente_id uuid not null references public.alumnos on delete cascade,
  repartidor_id uuid references public.alumnos on delete set null,
  punto_id bigint not null references public.puntos_entrega,
  referencia text check (length(referencia) <= 120),
  distancia_m integer not null check (distancia_m >= 0),
  tarifa numeric(8, 2) not null check (tarifa >= 0),
  estado public.estado_favor not null default 'buscando',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (repartidor_id is distinct from cliente_id)
);
create index on public.favores (estado);
create index on public.favores (cliente_id);
create index on public.favores (repartidor_id);
create index on public.favores (punto_id);

-- El código de entrega va aparte para que solo lo vea el cliente.
create table public.favor_codigos (
  favor_id bigint primary key references public.favores on delete cascade,
  codigo char(4) not null
);

-- Distancia y tarifa ---------------------------------------------------------------

-- Distancia en línea recta, en metros (Haversine).
create function privado.distancia_m(lat1 double precision, lng1 double precision,
                                    lat2 double precision, lng2 double precision)
returns integer language sql immutable set search_path = '' as $$
  select round(2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::integer;
$$;

-- $10 + $8 por km de camino (línea recta × 1.3), hacia arriba a múltiplos de $5,
-- entre $15 y $50.
create function privado.tarifa_favor(p_distancia_m integer)
returns numeric language sql immutable set search_path = '' as $$
  select least(50, greatest(15, ceil((10 + 8 * 1.3 * p_distancia_m / 1000.0) / 5) * 5))::numeric(8, 2);
$$;

-- Lo que costaría el favor de un local a un punto; el carrito lo muestra antes de pedir.
create function public.cotizar_favor(p_local_id bigint, p_punto_id bigint)
returns table (distancia_m integer, tarifa numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_local public.locales;
  v_punto public.puntos_entrega;
begin
  select * into v_local from public.locales where id = p_local_id;
  select * into v_punto from public.puntos_entrega where id = p_punto_id and activo;
  if v_local.lat is null or v_punto.id is null then
    raise exception 'Este local todavía no tiene entregas por favor';
  end if;
  distancia_m := privado.distancia_m(v_local.lat, v_local.lng, v_punto.lat, v_punto.lng);
  tarifa := privado.tarifa_favor(distancia_m);
  return next;
end;
$$;

-- Ayudantes de las políticas (security definer para no encadenar políticas) -----------

create function privado.favores_activos() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select favores_activos from public.ajustes), false);
$$;

create function privado.soy_repartidor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.alumnos where id = (select auth.uid()) and disponible_favores);
$$;

-- ¿El usuario puede ver este pedido como repartidor? (lo tomó, o está libre y él reparte)
create function privado.pedido_de_favor(p_pedido_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.favores f
    where f.pedido_id = p_pedido_id
      and (f.repartidor_id = (select auth.uid())
        or (f.estado = 'buscando' and privado.favores_activos() and privado.soy_repartidor()))
  );
$$;

-- ¿Este alumno es cliente o repartidor de un favor que el usuario puede ver por su papel?
create function privado.alumno_de_mis_favores(p_alumno_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.favores f join public.pedidos p on p.id = f.pedido_id
    where p_alumno_id in (f.cliente_id, f.repartidor_id)
      and ((select auth.uid()) in (f.cliente_id, f.repartidor_id) or privado.es_dueno(p.local_id))
  );
$$;

-- Seguridad (RLS) ------------------------------------------------------------------

alter table public.ajustes enable row level security;
alter table public.puntos_entrega enable row level security;
alter table public.favores enable row level security;
alter table public.favor_codigos enable row level security;

create policy "ajustes visibles" on public.ajustes for select to anon, authenticated using (true);
create policy "puntos visibles" on public.puntos_entrega for select to anon, authenticated using (true);

-- El favor lo ven el cliente, su repartidor, el local del pedido y, mientras nadie
-- lo toma, los alumnos que reparten.
create policy "ver favores" on public.favores for select to authenticated
  using (cliente_id = (select auth.uid())
    or repartidor_id = (select auth.uid())
    or exists (select 1 from public.pedidos p where p.id = pedido_id and privado.es_dueno(p.local_id))
    or (estado = 'buscando' and privado.favores_activos() and privado.soy_repartidor()));

create policy "mi código" on public.favor_codigos for select to authenticated
  using (exists (select 1 from public.favores f where f.id = favor_id and f.cliente_id = (select auth.uid())));

create policy "pedido de mi favor" on public.pedidos for select to authenticated
  using (privado.pedido_de_favor(id));
create policy "productos de mi favor" on public.pedido_productos for select to authenticated
  using (privado.pedido_de_favor(pedido_id));
create policy "personas de mis favores" on public.alumnos for select to authenticated
  using (privado.alumno_de_mis_favores(id));

-- Todo se escribe con las funciones de abajo.
revoke insert, update, delete on public.ajustes, public.puntos_entrega, public.favores, public.favor_codigos
  from anon, authenticated;

-- Pedir, tomar y entregar ---------------------------------------------------------

create function public.crear_pedido_con_favor(
  p_local_id bigint,
  p_hora_recogida timestamptz,
  p_productos jsonb,
  p_punto_id bigint,
  p_referencia text default null,
  p_instrucciones text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_pedido bigint;
  v_cotizacion record;
  v_favor bigint;
begin
  if not privado.favores_activos() then
    raise exception 'Los favores todavía no están disponibles';
  end if;
  select * into v_cotizacion from public.cotizar_favor(p_local_id, p_punto_id);
  v_pedido := public.crear_pedido(p_local_id, p_hora_recogida, p_productos, p_instrucciones);

  insert into public.favores (pedido_id, cliente_id, punto_id, referencia, distancia_m, tarifa)
  values (v_pedido, auth.uid(), p_punto_id, nullif(trim(p_referencia), ''),
          v_cotizacion.distancia_m, v_cotizacion.tarifa)
  returning id into v_favor;
  insert into public.favor_codigos (favor_id, codigo)
  values (v_favor, lpad(floor(random() * 10000)::text, 4, '0'));
  return v_pedido;
end;
$$;

-- Un repartidor toma un favor libre: nunca el suyo y solo uno a la vez.
create function public.tomar_favor(p_favor_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.favores_activos() then
    raise exception 'Los favores todavía no están disponibles';
  end if;
  if not privado.soy_repartidor() then
    raise exception 'Activa "Disponible para favores" para tomar uno';
  end if;
  if exists (select 1 from public.favores
             where repartidor_id = auth.uid() and estado in ('asignado', 'recogido')) then
    raise exception 'Termina el favor que ya tienes antes de tomar otro';
  end if;
  update public.favores set repartidor_id = auth.uid(), estado = 'asignado', actualizado_en = now()
  where id = p_favor_id and estado = 'buscando' and cliente_id <> auth.uid();
  if not found then
    raise exception 'Este favor ya no está disponible';
  end if;
end;
$$;

-- El cliente puede cancelar mientras nadie lo ha tomado; el pedido sigue y lo recoge él.
create function public.cancelar_favor(p_favor_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.favores set estado = 'cancelado', actualizado_en = now()
  where id = p_favor_id and cliente_id = auth.uid() and estado = 'buscando';
  if not found then
    raise exception 'Este favor ya no se puede cancelar';
  end if;
end;
$$;

-- El repartidor escribe el código que le da el cliente y el favor queda entregado.
create function public.confirmar_entrega(p_favor_id bigint, p_codigo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.favores
                 where id = p_favor_id and repartidor_id = auth.uid() and estado = 'recogido') then
    raise exception 'Este favor no está en camino contigo';
  end if;
  if not exists (select 1 from public.favor_codigos where favor_id = p_favor_id and codigo = trim(p_codigo)) then
    raise exception 'El código no coincide';
  end if;
  update public.favores set estado = 'entregado', actualizado_en = now() where id = p_favor_id;
end;
$$;

-- Cuando el local cambia el pedido, el favor lo sigue: entregado al repartidor
-- = recogido; rechazado o no recogido = cancelado; si el cliente pasó él mismo
-- antes de que alguien tomara el favor, también se cancela.
create function privado.seguir_pedido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'entregado' then
    update public.favores set estado = 'recogido', actualizado_en = now()
    where pedido_id = new.id and estado = 'asignado';
  end if;
  if new.estado in ('rechazado', 'no_recogido', 'entregado') then
    update public.favores set estado = 'cancelado', actualizado_en = now()
    where pedido_id = new.id and estado in ('buscando', 'asignado');
  end if;
  return null;
end;
$$;

create trigger seguir_pedido after update of estado on public.pedidos
  for each row when (new.estado is distinct from old.estado)
  execute function privado.seguir_pedido();

revoke execute on function public.cotizar_favor(bigint, bigint),
  public.crear_pedido_con_favor(bigint, timestamptz, jsonb, bigint, text, text),
  public.tomar_favor(bigint), public.cancelar_favor(bigint), public.confirmar_entrega(bigint, text)
  from public, anon;
grant execute on function public.cotizar_favor(bigint, bigint),
  public.crear_pedido_con_favor(bigint, timestamptz, jsonb, bigint, text, text),
  public.tomar_favor(bigint), public.cancelar_favor(bigint), public.confirmar_entrega(bigint, text)
  to authenticated;
revoke execute on function privado.distancia_m(double precision, double precision, double precision, double precision),
  privado.tarifa_favor(integer), privado.favores_activos(), privado.soy_repartidor(),
  privado.pedido_de_favor(bigint), privado.alumno_de_mis_favores(uuid), privado.seguir_pedido()
  from public, anon;
grant execute on function privado.favores_activos(), privado.soy_repartidor(),
  privado.pedido_de_favor(bigint), privado.alumno_de_mis_favores(uuid)
  to authenticated;

-- Cliente, repartidor y local ven el cambio de estado sin recargar.
alter publication supabase_realtime add table public.favores;
