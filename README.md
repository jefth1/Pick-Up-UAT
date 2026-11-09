# Pick-Up-UAT
PICK UP UAT sera una pagina web para los estudiantes de la uat que quiera pre ordenar su comida en los locales dentro y fuera cerca de la uat.

El alumno deja su pedido y pasa a recogerlo a la hora elegida; el local lo acepta o lo rechaza.


## Estructura

```
Pick-Up-UAT/
├── index.html            → redirige a Acceso/bienvenida.html
├── manifest.webmanifest  → datos para instalarla como app (nombre, colores, íconos)
├── sw.js                 → service worker: guarda el sitio, nunca las llamadas a Supabase
├── Acceso/               → entrada, registro con verificación del correo y cambio de contraseña
├── PerfilAlumnos/        → explorar locales, menú, producto, carrito, pago, confirmación
│   ├── css/alumnos.css
│   └── js/alumnos.js
├── PerfilLocal/          → pedidos, detalle (aceptar/rechazar), QR, mi menú, agregar producto
│   ├── css/local.css
│   └── js/local.js
├── PerfilFavores/        → favores entre alumnos: favores libres, el favor en curso, ganancias
├── PerfilAdmin/mapa.html → editor de facultades y zonas del mapa (solo administradores)
├── Compartido/           → lo que usan los dos perfiles
│   ├── css/estilos.css   → paleta y componentes del diseño
│   ├── css/mapa.css      → mapa de la UAT: marcadores, ruta A → B, hora de llegada
│   ├── js/mapa.js        → mapa propio del campus Tampico (dibujo + Leaflet), distancias y tiempos a pie
│   ├── js/supabase.js    → conexión a la base de datos y utilidades
│   ├── js/estados-pedido.js
│   ├── js/pwa.js         → registra sw.js
│   ├── js/dibujos.js     → qué dibujo le toca a cada producto o local sin foto
│   ├── img/iconos/       → ícono de la app
│   └── img/menu/         → dibujos de referencia para los menús (SVG)
├── supabase/
│   ├── migrations/       → esquema de la base de datos y reglas de seguridad (RLS)
│   └── plantillas-correo/ → correos de Supabase en español (código de verificación, contraseña)
└── docs/
    ├── diagrama.md       → flujo de pantallas y su relación con Figma
    └── supabase.md       → tablas, quién puede ver qué y ajustes del panel
```

## Base de datos

Los datos viven en Supabase. Ver [docs/supabase.md](docs/supabase.md).

## Mapa de la UAT

- **Alumnos** (`PerfilAlumnos/mapa.html`, botón *Mapa* de la barra): facultades (azul), zonas
  (gris) y dónde comer (oro, cerrado en blanco). Al tocar un lugar se ve qué hay cerca; al
  tocar un local, su horario y *Ver menú*.
- **Facultades y zonas:** las coloca un administrador en `PerfilAdmin/mapa.html` tocando el
  mapa o con su ubicación; las puede mover, renombrar y quitar.
- **Cafeterías y comercios:** cada local se coloca solo, desde su perfil. Solo la cuenta del
  dueño puede mover su local.
- **Cuota del favor:** sale de la distancia entre **A** (el local, donde se recoge) y **B** (la
  facultad o zona donde se entrega). El carrito muestra la ruta, los minutos a pie y la cuota,
  que gana quien lo lleva.
- **Hora de llegada:** mientras alguien lleva un favor, su celular manda su posición a la base,
  que solo guarda la hora estimada. Quien pidió ve "Llega en ~N min" y nunca ve dónde va.

El mapa es un dibujo propio del Centro Universitario Tampico-Madero (Campus Sur), con la
paleta de la app y sin mapas de afuera: terreno, calles, estacionamientos, áreas verdes y
edificios están en `CAMPUS`, al inicio de `Compartido/js/mapa.js`, con coordenadas reales
(se calcó de una captura de Google Maps). [Leaflet](https://leafletjs.com/) solo lo dibuja y
permite acercar y mover. Sin conexión, las páginas siguen funcionando sin el mapa.

## Cómo verlo

En línea: https://jefth1.github.io/Pick-Up-UAT/

En tu computadora, sirve la carpeta (abrir `index.html` directo no sirve para iniciar sesión):

```
python3 -m http.server 8000
```

y entra a http://localhost:8000.

## Instalarla en el celular (PWA)

Abre https://jefth1.github.io/Pick-Up-UAT/ y:

- **Android (Chrome):** menú ⋮ → *Instalar app* (o *Agregar a pantalla principal*).
- **iPhone (Safari):** botón Compartir → *Agregar a inicio*.

Con conexión la app siempre carga lo último que esté publicado; la copia guardada solo se usa sin internet.

## Diseño

Figma: https://www.figma.com/design/3ku3u2aHkv109klsyMFXXv (página "Pick Up UAT"). Paleta: fondo `#FAFAF8`, tinta `#141414`, azul `#1B3A6B` (acción), oro `#E8A317` (avisos).

### Dibujos de referencia de los menús

`Compartido/img/menu/` tiene 35 dibujos con la misma paleta (tacos, torta, gordita, tamal, café, agua fresca, postre, etc.). Se usan cuando no hay foto:

- **Producto sin foto:** se ve el dibujo que le queda por su nombre, categoría o descripción ("Tacos de pastor" → tacos, "Agua de horchata" → agua fresca). Si no se parece a ninguno, se ve un platillo tapado.
- **El local puede elegir otro** en *Agregar producto* (fila "O usa un dibujo"); si después sube una foto, la foto manda.
- **Local sin logo:** se ve el dibujo de su nombre ("Cafetería Central" → café) o el de un local.

Para que un nombre nuevo encuentre su dibujo, agrega la palabra en `DIBUJOS` de `Compartido/js/dibujos.js`.
