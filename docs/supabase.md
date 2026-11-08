# Base de datos (Supabase)

Proyecto de Supabase: **Pick-Up-UAT** (`gdexcnbivhxqkfryoygf`). El sitio en GitHub Pages
habla directo con Supabase usando `supabase-js` desde el CDN. En el navegador solo va la
**anon key**, que es pública: lo que cada quien puede ver o cambiar lo deciden las
políticas RLS.

## Tablas

| Tabla | Qué guarda | Quién la ve | Quién la cambia |
|---|---|---|---|
| `locales` | nombre, encargado, dentro/fuera de la UAT, dirección, si está recibiendo pedidos | todos | el dueño del local |
| `horarios` | un renglón por día que abre el local (0 = domingo … 6 = sábado) | todos | el dueño del local |
| `productos` | menú del local: nombre, precio, categoría, descripción, disponible | todos | el dueño del local |
| `alumnos` | nombre, matrícula, correo, facultad, carrera | el propio alumno y los locales a los que les pidió | el propio alumno |
| `pedidos` | local, alumno, hora de recogida, estado, total | el alumno que pidió y el local | solo el **estado**, y solo el local |
| `pedido_productos` | productos del pedido, con el nombre y precio de ese momento | igual que el pedido | nadie (lo llena `crear_pedido`) |

Los pedidos se crean con la función `crear_pedido` (`db.rpc("crear_pedido", …)`), que revisa
que el local esté abierto, que la hora caiga dentro de su horario, que los productos sean
del local y estén disponibles, y calcula el total con los precios de la base.

El estado sigue los pasos de `Compartido/js/estados-pedido.js`, y la base rechaza cualquier
salto que no esté ahí:

```
nuevo → aceptado → preparando → listo → entregado
  └→ rechazado                      └→ no_recogido
```

El SQL completo está en `supabase/migrations/`.

## Quién entra y cómo

- **Local:** se registra con correo y contraseña (`Acceso/local-registro.html`).
- **Alumno:** se registra con correo y contraseña (`Acceso/alumno-registro.html`). Es un
  registro temporal: se quitará cuando se conecte la API de la base de datos de la UAT.

Una misma cuenta es alumno o local, no las dos.

## Ajustes en el panel de Supabase

En **Authentication**:

1. **Sign In / Providers → Allow anonymous sign-ins:** ya no se usa; se puede desactivar.
2. **Sign In / Providers → Email → Confirm email:** desactivado mientras se prueba, para que
   alumnos y locales entren en cuanto se registran. Si se deja activado, deben abrir el correo
   de confirmación antes de entrar.
3. **URL Configuration → Site URL:** `https://jefth1.github.io/Pick-Up-UAT/`, y en
   **Redirect URLs** agregar `https://jefth1.github.io/Pick-Up-UAT/**` (y
   `http://localhost:8000/**` para probar en la computadora).

## Fotos

Las fotos de productos y el logo del local se guardan en el bucket público `fotos` de
Supabase Storage, en la carpeta del local (`fotos/<local_id>/…`). Cualquiera las ve; solo el
dueño del local puede subirlas o borrarlas. La URL queda en `productos.foto_url` y
`locales.logo_url` (migración `20261022020000_fotos.sql`).

## Favores

Un alumno puede pedir que otro le lleve su pedido a un punto de la UAT, por una tarifa
según la distancia entre el local y el punto ($10 + $8 por km de camino, en múltiplos de $5,
entre $15 y $50). Se pagan en **efectivo**: quien hace el favor paga el pedido en el local y quien lo pidió le
paga todo (pedido + tarifa) al recibirlo, y entonces le da su código. Para que nadie adelante
mucho dinero, el pedido no puede pasar de `ajustes.tope_efectivo` ($250). Se
encienden y apagan con `ajustes.favores_activos` (migraciones `20261028200000_favores.sql` y
`20261028210000_favores_efectivo.sql`); el pago con tarjeta queda para después. Desde el
28 de octubre están **encendidos para pruebas**, con coordenadas aproximadas en los dos locales
de prueba (cada local corrige la suya desde su perfil). Propuesta completa:
[Entregas entre alumnos](https://claude.ai/artifact/NiCM6usFrUn6VCLkrjtn4g).

| Tabla | Qué guarda | Quién la ve |
|---|---|---|
| `ajustes` | `favores_activos` y `tope_efectivo` (una sola fila) | todos |
| `puntos_entrega` | lugares de la UAT con sus coordenadas | todos |
| `favores` | pedido, cliente, repartidor, punto, distancia, tarifa, estado | cliente, repartidor, local; los libres, quien está disponible |
| `favor_codigos` | código de 4 dígitos de cada favor | solo el cliente |

Además, `locales.lat`/`lng` (cada local se coloca en el mapa desde su perfil) y
`alumnos.disponible_favores`.

Estados: `buscando → asignado → recogido → entregado`, o `cancelado`. Funciones:
`cotizar_favor`, `crear_pedido_con_favor`, `tomar_favor`, `cancelar_favor` y
`confirmar_entrega`. El local no hace nada nuevo: al marcar el pedido como entregado, el
favor pasa a recogido; si lo rechaza o nadie lo recoge, el favor se cancela.

Los puntos de entrega son las facultades y zonas del mapa (ver [Mapa de la UAT](#mapa-de-la-uat)).
Para encender o apagar los favores, en el **SQL Editor**:

```sql
update public.ajustes set favores_activos = true where id;  -- false para apagarlos
```

Con eso aparece la opción "Que me lo lleven" en el carrito (si el local guardó su
ubicación) y hay favores en el apartado de favores de los alumnos (`PerfilFavores/`: favores
libres, el favor en curso paso a paso, ganancias y favores hechos).

## Mapa de la UAT

Migración `20261108220000_mapa_uat.sql`.

- `puntos_entrega` ahora tiene `tipo` (`facultad` o `zona`), `abreviatura` (FIC, FCAV…) e
  `icono`. Los ve cualquiera; solo un **administrador** los agrega, mueve, renombra o quita
  desde `PerfilAdmin/mapa.html`. Quitar es `activo = false` (no se borran, los favores viejos
  los usan).
- `administradores`: las cuentas que editan el mapa. Cada cuenta solo puede ver si ella es
  administradora, y nadie se puede agregar desde la app. Se agregan en el **SQL Editor**:

  ```sql
  insert into public.administradores (usuario)
  select id from auth.users where email = 'correo-del-administrador@ejemplo.com';
  ```

- Las cafeterías y comercios son los `locales`: cada uno se coloca desde su perfil y RLS solo
  deja moverlo a su dueño. Una cuenta de alumno no puede crear locales.
- La migración apaga los puntos de prueba («Prueba · …») y agrega el Estadio Universitario
  Eugenio Alvizo Porras con sus coordenadas. Las facultades y demás zonas se colocan con el
  editor, que sugiere las que faltan (FIC, FCAV, UAMCEH, Derecho, Trabajo Social, Enfermería,
  biblioteca, gimnasio, canchas, CAUCE, explanada, estacionamiento, entrada principal).

**Cuota del favor:** `cotizar_favor` usa la distancia en línea recta entre **A** (el local,
donde se recoge) y **B** (la facultad o zona donde se entrega): $10 + $8 por km de camino
(recta × 1.3), en múltiplos de $5, entre $15 y $50. Los $10 de base cubren llegar al local.
Dentro del campus casi todo sale en $15 (hasta unos 480 m); 850 m son $20 y 1.5 km, $30.

**Hora estimada de llegada** (`favores.llegada_estimada`):

- Al tomar el favor, la base pone una primera hora: cuando esté listo el pedido más los
  minutos a pie de A a B. Al recogerlo: ahora más los minutos de A a B.
- Mientras el favor va en curso, el celular de quien lo lleva llama a
  `compartir_avance(favor, lat, lng)` cada ~20 segundos. La función recalcula la hora con esa
  posición y **solo guarda la hora**: la posición no queda en ninguna tabla. Solo el
  repartidor de ese favor puede llamarla, a lo mucho una vez cada 15 segundos.
- Quien pidió ve "Llega en ~N min" por realtime y nunca ve dónde va quien se lo lleva.
- Minutos a pie = distancia × 1.3 ÷ 75 m por minuto (lo mismo en `Compartido/js/mapa.js`).

## Pendiente

- Cambiar el registro temporal de alumnos por la API de la base de datos de la UAT.
- Pago en línea; por ahora se paga al recoger (y los favores, en efectivo a quien lo lleva).
- Colocar las facultades y zonas en `PerfilAdmin/mapa.html` (por ahora solo está el Estadio).
