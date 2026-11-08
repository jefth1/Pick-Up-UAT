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
| `alumnos` | nombre, matrícula, correo (el verificado de su cuenta), facultad, carrera | el propio alumno y los locales a los que les pidió | el propio alumno |
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

- **Alumno:** se registra con su correo institucional (`@alumnos.uat.edu.mx`) y una
  contraseña (`Acceso/alumno-registro.html`) y verifica el correo con el código que le llega
  (`Acceso/verificar-correo.html`). Es un registro temporal: se quitará cuando se conecte la
  API de la base de datos de la UAT.
- **Local:** se registra con correo y contraseña (`Acceso/local-registro.html`) y también
  verifica su correo con el código.
- **¿Olvidaste tu contraseña?** manda un enlace al correo que abre
  `Acceso/nueva-contrasena.html`.
- La sesión queda guardada en el celular: al abrir la app, quien ya entró pasa directo a su
  apartado (alumno: explorar locales; local: pedidos) hasta que cierre sesión.

Una misma cuenta es alumno o local, no las dos.

## Verificación de cuentas

Con **Confirm email** activo, Supabase no da sesión a una cuenta nueva hasta que escribe el
código de 6 dígitos que le llega al correo (o toca el botón del mismo correo). Si alguien se
registró y no verificó, al intentar entrar se le manda un código nuevo. Supabase deja pedir
otro correo cada 60 segundos y el código vence en una hora.

La base (migración `20261108230000_verificacion_alumnos.sql`) cuida que la verificación
sirva para saber que es alumno de la UAT:

- Solo un correo de los dominios de `ajustes.dominios_alumnos` (de inicio,
  `alumnos.uat.edu.mx`) puede crear perfil de alumno, aunque alguien se salte la pantalla.
- El correo guardado en `alumnos` siempre es el de la cuenta, el que se verificó.
- En «Mi perfil» el correo sale como **Verificado** cuando se confirmó con el código o el
  botón del correo (las cuentas de antes no lo tienen).

Para cambiar los dominios, en el **SQL Editor**:

```sql
update public.ajustes set dominios_alumnos = '{}' where id;                          -- cualquier correo (para probar)
update public.ajustes set dominios_alumnos = array['alumnos.uat.edu.mx'] where id;   -- solo alumnos UAT
```

## Ajustes en el panel de Supabase

En **Authentication**:

1. **Emails → SMTP Settings:** activa un SMTP propio. Sin él, el correo de Supabase solo
   llega a los miembros de tu equipo de Supabase y apenas unos pocos por hora, así que los
   alumnos no recibirían su código. La opción más sencilla es una cuenta de Gmail con una
   [contraseña de aplicación](https://myaccount.google.com/apppasswords) (necesita la
   verificación en dos pasos): host `smtp.gmail.com`, puerto `465`, usuario y correo del
   remitente = esa cuenta de Gmail, contraseña = la contraseña de aplicación, nombre del
   remitente `Pick Up UAT`. También sirven Brevo o Resend (Resend pide dominio propio).
2. **Rate Limits:** con SMTP propio Supabase empieza en 30 correos por hora; súbelo si se
   registran muchos alumnos a la vez.
3. **Emails → Templates:** en **Confirm signup** pon el asunto `{{ .Token }} es tu código de
   Pick Up UAT` y pega `supabase/plantillas-correo/confirmar-registro.html` (lleva el código
   y el botón). En **Reset password** pon el asunto `Cambia tu contraseña de Pick Up UAT` y pega
   `supabase/plantillas-correo/cambiar-contrasena.html`.
4. **Sign In / Providers → Email → Confirm email:** **activado**. Es lo que obliga a verificar
   el correo. Si se apaga, las cuentas entran sin código (el sitio sigue funcionando igual,
   pero sin verificación).
5. **Sign In / Providers → Allow anonymous sign-ins:** ya no se usa; se puede desactivar.
6. **URL Configuration → Site URL:** `https://jefth1.github.io/Pick-Up-UAT/`, y en
   **Redirect URLs** agregar `https://jefth1.github.io/Pick-Up-UAT/**` (y
   `http://localhost:8000/**` para probar en la computadora). El botón de los correos
   regresa a esas direcciones.

Para probar sin SMTP propio: deja `dominios_alumnos` vacío y regístrate con el correo de tu
cuenta de Supabase; a ese sí le llega el código.

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
28 de octubre están **encendidos para pruebas**, con dos puntos de prueba ("Prueba · …") y
coordenadas aproximadas en los dos locales de prueba: cámbialos por los reales. Propuesta completa:
[Entregas entre alumnos](https://claude.ai/artifact/NiCM6usFrUn6VCLkrjtn4g).

| Tabla | Qué guarda | Quién la ve |
|---|---|---|
| `ajustes` | `favores_activos`, `tope_efectivo` y `dominios_alumnos` (una sola fila) | todos |
| `puntos_entrega` | lugares de la UAT con sus coordenadas | todos |
| `favores` | pedido, cliente, repartidor, punto, distancia, tarifa, estado | cliente, repartidor, local; los libres, quien está disponible |
| `favor_codigos` | código de 4 dígitos de cada favor | solo el cliente |

Además, `locales.lat`/`lng` (el local la guarda con el GPS desde su perfil) y
`alumnos.disponible_favores`.

Estados: `buscando → asignado → recogido → entregado`, o `cancelado`. Funciones:
`cotizar_favor`, `crear_pedido_con_favor`, `tomar_favor`, `cancelar_favor` y
`confirmar_entrega`. El local no hace nada nuevo: al marcar el pedido como entregado, el
favor pasa a recogido; si lo rechaza o nadie lo recoge, el favor se cancela.

Para cargar puntos y encender o apagar, en el **SQL Editor**:

```sql
insert into public.puntos_entrega (nombre, lat, lng) values ('Biblioteca Central', 23.0000, -99.0000);
update public.ajustes set favores_activos = true where id;  -- false para apagarlos
```

Con eso aparece la opción "Que me lo lleven" en el carrito (si el local guardó su
ubicación) y hay favores en el apartado de favores de los alumnos (`PerfilFavores/`: favores
libres, el favor en curso paso a paso, ganancias y favores hechos).

## Pendiente

- Cambiar el registro temporal de alumnos por la API de la base de datos de la UAT.
- Pago en línea; por ahora se paga al recoger (y los favores, en efectivo a quien lo lleva).
- Cargar los puntos de entrega de la UAT con sus coordenadas.
