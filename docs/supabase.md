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
- **Alumno:** mientras no exista el inicio de sesión con la cuenta UAT, entra con una sesión
  anónima de Supabase y llena sus datos una vez. La sesión queda guardada en ese navegador.

## Ajustes en el panel de Supabase

En **Authentication**:

1. **Sign In / Providers → Allow anonymous sign-ins:** activado (para los alumnos).
2. **Sign In / Providers → Email → Confirm email:** desactivado mientras se prueba, para que
   el local entre en cuanto se registra. Si se deja activado, el local debe abrir el correo
   de confirmación antes de entrar.
3. **URL Configuration → Site URL:** `https://jefth1.github.io/Pick-Up-UAT/`, y en
   **Redirect URLs** agregar `https://jefth1.github.io/Pick-Up-UAT/**` (y
   `http://localhost:8000/**` para probar en la computadora).

## Pendiente

- Inicio de sesión con la cuenta institucional UAT para alumnos.
- Fotos de productos y logo del local (Supabase Storage).
- Pago en línea; por ahora se paga al recoger.
