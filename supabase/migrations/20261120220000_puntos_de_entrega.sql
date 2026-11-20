-- Puntos de entrega de los favores (va después de 20261108220000_mapa_uat.sql).
-- Hasta ahora cualquier facultad o zona del mapa servía como punto de entrega, con el
-- marcador en medio de su terreno. Ahora hay un tipo propio, «entrega»: lugares concretos
-- donde se encuentran quien lleva el favor y quien lo pidió (frente a cada facultad, en la
-- biblioteca, junto al gimnasio y la pista, y cerca de donde se junta más gente).
-- Las facultades y zonas se siguen viendo en el mapa para ubicarse. En el carrito solo se
-- eligen puntos de entrega; si un día no hubiera ninguno, la app vuelve a ofrecer las
-- facultades y zonas, y por eso la base sigue aceptando cualquier lugar activo.
-- El administrador los mueve, renombra o quita desde PerfilAdmin/mapa.html.

alter table public.puntos_entrega drop constraint if exists puntos_entrega_tipo_check;
alter table public.puntos_entrega add constraint puntos_entrega_tipo_check
  check (tipo in ('facultad', 'zona', 'entrega'));

-- Coordenadas sobre el dibujo del mapa (OpenStreetMap, ver Compartido/datos/LEEME.md):
-- en la orilla de cada facultad que da a una calle o andador del campus, no en medio del
-- terreno. El del gimnasio va junto al edificio redondo al este de la pista
-- (way 584518769), que en OpenStreetMap no tiene nombre.
insert into public.puntos_entrega (nombre, abreviatura, tipo, icono, lat, lng) values
  ('Frente a Ingeniería', 'Ingeniería', 'entrega', 'bolsa', 22.27658, -97.86531),
  ('Frente a Derecho y Ciencias Sociales', 'Derecho', 'entrega', 'bolsa', 22.27586, -97.86542),
  ('Frente a Comercio', 'Comercio', 'entrega', 'bolsa', 22.27546, -97.86209),
  ('Frente a Arquitectura', 'Arquitectura', 'entrega', 'bolsa', 22.27501, -97.86348),
  ('Frente a Medicina', 'Medicina', 'entrega', 'bolsa', 22.27685, -97.86129),
  ('Frente a Odontología', 'Odontología', 'entrega', 'bolsa', 22.2769, -97.86037),
  ('Frente a Enfermería', 'Enfermería', 'entrega', 'bolsa', 22.27846, -97.86128),
  ('Frente a Música y Artes', 'Música', 'entrega', 'bolsa', 22.27809, -97.86263),
  ('Explanada de la Biblioteca', 'Biblioteca', 'entrega', 'bolsa', 22.27645, -97.86075),
  ('Junto al gimnasio', 'Gimnasio', 'entrega', 'bolsa', 22.27494, -97.85823),
  ('Junto a la pista de atletismo', 'Pista', 'entrega', 'bolsa', 22.27511, -97.85994),
  ('Junto a la Cafetería de Ingeniería', 'Cafetería', 'entrega', 'bolsa', 22.27670, -97.86362),
  ('Entrada norte (Av. Universidad)', 'Entrada N', 'entrega', 'bolsa', 22.27912, -97.8613);
