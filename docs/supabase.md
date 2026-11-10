# Base de datos (Supabase)

Proyecto de Supabase: **Pick-Up-UAT** (`gdexcnbivhxqkfryoygf`). El sitio en GitHub Pages
habla directo con Supabase usando `supabase-js` (copiado en `Compartido/vendor/`). En el navegador solo va la
**anon key**, que es pública: lo que cada quien puede ver o cambiar lo deciden las
políticas RLS.

## Tablas

| Tabla | Qué guarda | Quién la ve | Quién la cambia |
|---|---|---|---|
| `locales` | nombre, encargado, dentro/fuera de la UAT, dirección, si está recibiendo pedidos, si ya está **aprobado** | todos, si está aprobado; si no, solo su dueño | el dueño del local (menos `aprobado`, que solo cambia el administrador) |
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

El registro de alumnos y de locales (y «Nueva contraseña») pide la contraseña dos veces y no
deja seguir si no coinciden.

**Por qué hacen falta las plantillas del repo:** el correo de fábrica de Supabase trae solo un
botón, sin código, y ese botón verifica la cuenta en cuanto se abre. El correo de la UAT
(Outlook) abre los enlaces de cada correo segundos después de que llega, para revisarlos, y
con eso verifica la cuenta por el alumno y gasta el enlace (pasó el 10 de noviembre). El botón
de las plantillas del repo lleva a `verificar-correo.html` con `token_hash` y la cuenta se
verifica hasta que la persona toca «Confirmar mi correo»; el código de 6 dígitos sigue
sirviendo aunque Outlook ya haya abierto el enlace. Lo mismo hace la plantilla de cambiar la
contraseña con `nueva-contrasena.html`. El logo del local nunca
detiene la entrada: si no se puede subir, el local entra sin él y lo sube después en «Perfil».

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
   `supabase/plantillas-correo/cambiar-contrasena.html`. El botón usa `{{ .RedirectTo }}`, así
   que el paso 7 (Redirect URLs) tiene que estar hecho o el botón no llevará al sitio.
4. **Sign In / Providers → Email → Confirm email:** **activado**. Es lo que obliga a verificar
   el correo. Si se apaga, las cuentas entran sin código (el sitio sigue funcionando igual,
   pero sin verificación).
5. **Sign In / Providers → Allow anonymous sign-ins:** ya no se usa; se puede desactivar.
6. **Sign In / Providers → Email → Minimum password length:** `8`, y en **Password
   Requirements** «Letters and digits» (la app ya lo pide así al registrarse). Si tu plan lo
   tiene, activa también **Prevent use of leaked passwords**.
7. **URL Configuration → Site URL:** `https://jefth1.github.io/Pick-Up-UAT/`, y en
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

Si el local prefiere un dibujo de referencia en vez de foto, `productos.foto_url` guarda
`dibujo:<clave>` (por ejemplo `dibujo:tacos`, uno de los archivos de `Compartido/img/menu/`).
Con `foto_url` vacío la app elige el dibujo por el nombre del producto; no hace falta migración.

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
| `ajustes` | `favores_activos`, `tope_efectivo` y `dominios_alumnos` (una sola fila) | todos |
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
- La migración apaga los puntos de prueba («Prueba · …»), borra las coordenadas de Cd. Victoria
  de los locales de prueba (cada local se vuelve a colocar desde su perfil) y agrega los
  lugares del campus Tampico que se ven en el mapa: Música y Artes, Medicina, Derecho y Ciencias
  Sociales, Arquitectura (FADU), el edificio central, CELLAP, el Estadio Olímpico, el Gimnasio
  Multidisciplinario y el Lago Lain. Ingeniería, Comercio, Odontología, Enfermería y demás zonas
  se colocan con el editor, que las sugiere.

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

## Seguridad para el lanzamiento

Migración `20261110233000_seguridad_lanzamiento.sql` (10 de noviembre de 2026):

- **Locales nuevos esperan aprobación.** Al registrarse, `locales.aprobado` queda en `false`:
  el local entra a su panel (con un aviso de que está en revisión) y puede armar su menú, pero
  los alumnos no lo ven ni le pueden pedir. Para aprobarlo, en **Table Editor → locales** pon
  `aprobado` en `true`, o en el **SQL Editor**:

  ```sql
  update public.locales set aprobado = true where nombre = 'Nombre del local';
  -- Ver los que esperan:  select id, nombre, encargado, direccion, creado_en from public.locales where not aprobado;
  ```

  Ponerlo otra vez en `false` lo esconde (quien ya le pidió sigue viendo sus pedidos). El
  dueño no puede aprobarse solo: desde la app solo puede cambiar nombre, encargado,
  ubicación, dirección, abierto, logo y su punto en el mapa.
- **Fotos y logos:** la base solo acepta imágenes del bucket `fotos` de este proyecto o
  `dibujo:<clave>`, y el sitio tampoco pinta otra cosa (`fotoSegura()` en
  `Compartido/js/supabase.js`). Antes, una dirección con comillas podía meter estilos que
  tapaban la pantalla de los alumnos o cargaban imágenes de otro sitio.
- **Pedidos:** cada alumno puede tener hasta 3 pedidos esperando respuesta y hacer hasta 10
  por hora; un pedido lleva hasta 30 productos distintos (y hasta 20 de cada uno).
- **Código de entrega de los favores:** tras 5 intentos equivocados hay que esperar 10 minutos.
  `confirmar_entrega` ahora regresa `true` o `false` en lugar de dar error.
- **Páginas:** todas llevan una política de seguridad (`Content-Security-Policy`) que solo deja
  correr scripts del propio sitio y conectarse a este Supabase, y las bibliotecas
  (supabase-js, Leaflet, jsQR, qrcode-generator) se sirven desde `Compartido/vendor/` en lugar
  de un CDN. Si la app se abre dentro de un marco de otra página, no se muestra.

Revisado también: RLS activo en todas las tablas, en el navegador solo va la anon key (nunca la
service_role, tampoco en el historial del repo), todo lo que viene de la base pasa por `esc()`
antes de entrar a la página y el bucket de fotos solo acepta JPG, PNG y WebP de hasta 5 MB en
la carpeta del propio local.

## Pendiente

- Cambiar el registro temporal de alumnos por la API de la base de datos de la UAT.
- Pago en línea; por ahora se paga al recoger (y los favores, en efectivo a quien lo lleva).
- Colocar Ingeniería, Comercio, Odontología, Enfermería y demás zonas en `PerfilAdmin/mapa.html`.
