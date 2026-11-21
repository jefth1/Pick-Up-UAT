-- Cuota del favor que sube con la distancia.
-- Antes: $10 + $8 por km de camino, en múltiplos de $5, entre $15 y $50. Dentro del campus
-- casi todos los puntos salían en $15. Ahora: $10 + $1 por cada 50 m en línea recta entre
-- el local (A) y el punto de entrega (B), entre $12 y $50. Así 210 m son $15, 350 m $17,
-- 600 m $22 y 1 km $30. Solo cambia la cuota de los favores nuevos: cada favor guarda la suya.
-- Los puntos a menos de 200 m del local ya no se ofrecen en el carrito (ahí pasa uno mismo).
create or replace function privado.tarifa_favor(p_distancia_m integer)
returns numeric language sql immutable set search_path = '' as $$
  select least(50, greatest(12, 10 + ceil(coalesce(p_distancia_m, 0) / 50.0)))::numeric(8, 2);
$$;
