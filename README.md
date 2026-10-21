# Pick-Up-UAT
PICK UP UAT sera una pagina web para los estudiantes de la uat que quiera pre ordenar su comida en los locales dentro y fuera cerca de la uat.

El alumno deja su pedido y pasa a recogerlo a la hora elegida; el local lo acepta o lo rechaza.


## Estructura

```
Pick-Up-UAT/
├── index.html            → redirige a Acceso/bienvenida.html
├── Acceso/               → entrada: alumno con cuenta UAT, local con correo
├── PerfilAlumnos/        → explorar locales, menú, producto, carrito, pago, confirmación
│   ├── css/alumnos.css
│   └── js/alumnos.js
├── PerfilLocal/          → pedidos, detalle (aceptar/rechazar), QR, mi menú, agregar producto
│   ├── css/local.css
│   └── js/local.js
├── Compartido/           → lo que usan los dos perfiles
│   ├── css/estilos.css   → paleta y componentes del diseño
│   ├── js/supabase.js    → conexión a la base de datos y utilidades
│   ├── js/estados-pedido.js
│   └── img/
├── supabase/migrations/ → esquema de la base de datos y reglas de seguridad (RLS)
└── docs/
    ├── diagrama.md       → flujo de pantallas y su relación con Figma
    └── supabase.md       → tablas, quién puede ver qué y ajustes del panel
```

## Base de datos

Los datos viven en Supabase. Ver [docs/supabase.md](docs/supabase.md).

## Cómo verlo

En línea: https://jefth1.github.io/Pick-Up-UAT/

En tu computadora, sirve la carpeta (abrir `index.html` directo no sirve para iniciar sesión):

```
python3 -m http.server 8000
```

y entra a http://localhost:8000.

## Diseño

Figma: https://www.figma.com/design/3ku3u2aHkv109klsyMFXXv (página "Pick Up UAT"). Paleta: fondo `#FAFAF8`, tinta `#141414`, azul `#1B3A6B` (acción), oro `#E8A317` (avisos).
