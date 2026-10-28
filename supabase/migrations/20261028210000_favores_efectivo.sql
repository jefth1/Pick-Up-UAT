-- Favores pagados en efectivo: quien hace el favor paga el pedido en el local y
-- quien lo pidió le paga todo (pedido + tarifa) al recibirlo, y entonces le da su
-- código. Para que nadie adelante mucho dinero, el pedido no puede pasar de
-- ajustes.tope_efectivo. El pago con tarjeta queda para cuando exista.

create type public.pago_favor as enum ('efectivo', 'tarjeta');
alter table public.favores add column pago public.pago_favor not null default 'efectivo';
alter table public.ajustes add column tope_efectivo numeric(8, 2) not null default 250 check (tope_efectivo >= 0);

create or replace function public.crear_pedido_con_favor(
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
  v_tope numeric := (select tope_efectivo from public.ajustes);
begin
  if not privado.favores_activos() then
    raise exception 'Los favores todavía no están disponibles';
  end if;
  select * into v_cotizacion from public.cotizar_favor(p_local_id, p_punto_id);
  v_pedido := public.crear_pedido(p_local_id, p_hora_recogida, p_productos, p_instrucciones);
  if (select total from public.pedidos where id = v_pedido) > v_tope then
    raise exception 'Para que te lo lleven en efectivo, el pedido no puede pasar de $%', v_tope::integer;
  end if;

  insert into public.favores (pedido_id, cliente_id, punto_id, referencia, distancia_m, tarifa, pago)
  values (v_pedido, auth.uid(), p_punto_id, nullif(trim(p_referencia), ''),
          v_cotizacion.distancia_m, v_cotizacion.tarifa, 'efectivo')
  returning id into v_favor;
  insert into public.favor_codigos (favor_id, codigo)
  values (v_favor, lpad(floor(random() * 10000)::text, 4, '0'));
  return v_pedido;
end;
$$;
