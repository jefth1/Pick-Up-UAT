-- Esquema inicial de Pick Up UAT.
-- El alumno pide, el local acepta o rechaza y luego lo prepara y lo entrega.
-- Los estados y sus pasos son los de Compartido/js/estados-pedido.js.

create type public.ubicacion_local as enum ('dentro', 'fuera');
create type public.estado_pedido as enum
  ('nuevo', 'aceptado', 'rechazado', 'preparando', 'listo', 'entregado', 'no_recogido');

-- Locales: cada cuenta de local (correo y contraseña) tiene un solo local.
create table public.locales (
  id bigint generated always as identity primary key,
  propietario uuid not null unique default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(nombre) between 1 and 80),
  encargado text check (length(encargado) <= 80),
  ubicacion public.ubicacion_local not null default 'dentro',
  direccion text check (length(direccion) <= 160),
  abierto boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Horario por día de la semana (0 = domingo … 6 = sábado), hora local de Tamaulipas.
create table public.horarios (
  id bigint generated always as identity primary key,
  local_id bigint not null references public.locales on delete cascade,
  dia smallint not null check (dia between 0 and 6),
  abre time not null,
  cierra time not null,
  check (cierra > abre),
  unique (local_id, dia)
);

create table public.productos (
  id bigint generated always as identity primary key,
  local_id bigint not null references public.locales on delete cascade,
  nombre text not null check (length(nombre) between 1 and 80),
  precio numeric(8, 2) not null check (precio >= 0),
  categoria text check (length(categoria) <= 40),
  descripcion text check (length(descripcion) <= 300),
  disponible boolean not null default true,
  creado_en timestamptz not null default now()
);
create index on public.productos (local_id);

-- Alumnos: mientras no haya inicio de sesión UAT, el alumno entra con una sesión
-- anónima de Supabase y llena sus datos una vez.
create table public.alumnos (
  id uuid primary key default auth.uid() references auth.users on delete cascade,
  nombre text not null check (length(nombre) between 1 and 120),
  matricula text not null check (length(matricula) between 1 and 20),
  correo text check (length(correo) <= 120),
  facultad text check (length(facultad) <= 120),
  carrera text check (length(carrera) <= 120)
);

create table public.pedidos (
  id bigint generated always as identity primary key,
  local_id bigint not null references public.locales on delete cascade,
  alumno_id uuid not null references public.alumnos on delete cascade,
  hora_recogida timestamptz not null,
  estado public.estado_pedido not null default 'nuevo',
  instrucciones text check (length(instrucciones) <= 300),
  total numeric(10, 2) not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on public.pedidos (local_id, estado);
create index on public.pedidos (alumno_id);

-- Copia nombre y precio del producto al momento de pedir.
create table public.pedido_productos (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos on delete cascade,
  producto_id bigint references public.productos on delete set null,
  nombre text not null,
  precio_unitario numeric(8, 2) not null,
  cantidad smallint not null check (cantidad between 1 and 20),
  nota text check (length(nota) <= 200)
);
create index on public.pedido_productos (pedido_id);
create index on public.pedido_productos (producto_id);

-- Seguridad (RLS) ------------------------------------------------------------

alter table public.locales enable row level security;
alter table public.horarios enable row level security;
alter table public.productos enable row level security;
alter table public.alumnos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_productos enable row level security;

-- ¿El usuario de la sesión es dueño de este local?
create function public.es_dueno(p_local_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.locales
    where id = p_local_id and propietario = (select auth.uid())
  );
$$;

-- Locales, horarios y menú los ve cualquiera; solo el dueño los cambia.
create policy "locales visibles" on public.locales for select to anon, authenticated using (true);
create policy "registrar mi local" on public.locales for insert to authenticated
  with check (propietario = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
create policy "editar mi local" on public.locales for update to authenticated
  using (propietario = (select auth.uid())) with check (propietario = (select auth.uid()));

create policy "horarios visibles" on public.horarios for select to anon, authenticated using (true);
create policy "mis horarios" on public.horarios for all to authenticated
  using (public.es_dueno(local_id)) with check (public.es_dueno(local_id));

create policy "productos visibles" on public.productos for select to anon, authenticated using (true);
create policy "mis productos" on public.productos for all to authenticated
  using (public.es_dueno(local_id)) with check (public.es_dueno(local_id));

-- El alumno ve y edita solo sus datos; el local ve a quien le hizo un pedido.
create policy "mis datos" on public.alumnos for select to authenticated
  using (id = (select auth.uid()));
create policy "alumnos de mis pedidos" on public.alumnos for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.alumno_id = alumnos.id and public.es_dueno(p.local_id)
  ));
create policy "guardar mis datos" on public.alumnos for insert to authenticated
  with check (id = (select auth.uid()));
create policy "editar mis datos" on public.alumnos for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Pedidos: los crea crear_pedido(); los ven el alumno y el local; el local cambia el estado.
create policy "ver mis pedidos" on public.pedidos for select to authenticated
  using (alumno_id = (select auth.uid()) or public.es_dueno(local_id));
create policy "local cambia estado" on public.pedidos for update to authenticated
  using (public.es_dueno(local_id)) with check (public.es_dueno(local_id));

create policy "ver productos de mis pedidos" on public.pedido_productos for select to authenticated
  using (exists (
    select 1 from public.pedidos p
    where p.id = pedido_id and (p.alumno_id = (select auth.uid()) or public.es_dueno(p.local_id))
  ));

-- Desde el navegador solo se puede cambiar el estado de un pedido, nada más.
revoke insert, update, delete on public.pedidos from anon, authenticated;
grant update (estado) on public.pedidos to authenticated;
revoke insert, update, delete on public.pedido_productos from anon, authenticated;

-- Pasos permitidos, igual que Compartido/js/estados-pedido.js.
create function public.validar_estado_pedido() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado is distinct from old.estado then
    if not (
      (old.estado = 'nuevo' and new.estado in ('aceptado', 'rechazado')) or
      (old.estado = 'aceptado' and new.estado = 'preparando') or
      (old.estado = 'preparando' and new.estado = 'listo') or
      (old.estado = 'listo' and new.estado in ('entregado', 'no_recogido'))
    ) then
      raise exception 'No se puede pasar un pedido de % a %', old.estado, new.estado;
    end if;
    new.actualizado_en := now();
  end if;
  return new;
end;
$$;

create trigger validar_estado before update on public.pedidos
  for each row execute function public.validar_estado_pedido();

-- Crear pedido -----------------------------------------------------------------
-- p_productos: [{"producto_id": 1, "cantidad": 2, "nota": "sin cebolla"}, …]
-- Revisa que el local esté abierto, que la hora caiga en su horario de ese día y
-- que los productos sean del local y estén disponibles. Los precios salen de la base.
create function public.crear_pedido(
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
  if not exists (select 1 from public.locales where id = p_local_id and abierto) then
    raise exception 'El local no está recibiendo pedidos';
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
  if jsonb_typeof(p_productos) <> 'array' or jsonb_array_length(p_productos) = 0 then
    raise exception 'El pedido no tiene productos';
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

revoke execute on function public.crear_pedido(bigint, timestamptz, jsonb, text) from public, anon;
grant execute on function public.crear_pedido(bigint, timestamptz, jsonb, text) to authenticated;
revoke execute on function public.es_dueno(bigint) from public, anon;
grant execute on function public.es_dueno(bigint) to authenticated;

-- Avisos en vivo: el local ve llegar pedidos y el alumno ve el cambio de estado.
alter publication supabase_realtime add table public.pedidos;
