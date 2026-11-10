# Bibliotecas de terceros

Copias exactas de los paquetes de npm, servidas desde el propio sitio en lugar de un CDN.
Así ningún servidor ajeno puede cambiar el código que corre en la app, y la política de
seguridad de las páginas (`Content-Security-Policy`) solo deja correr scripts del sitio.

| Carpeta | Paquete de npm | Archivo original | Licencia |
|---|---|---|---|
| `supabase-js-2.117.0/` | `@supabase/supabase-js@2.117.0` | `dist/umd/supabase.js` | MIT |
| `leaflet-1.9.4/` | `leaflet@1.9.4` | `dist/leaflet.js`, `dist/leaflet.css`, `dist/images/` | BSD-2-Clause |
| `jsqr-1.4.0/` | `jsqr@1.4.0` | `dist/jsQR.js` | Apache-2.0 |
| `qrcode-generator-1.4.4/` | `qrcode-generator@1.4.4` | `qrcode.js` (licencia MIT en su encabezado) | MIT |

Para actualizar una: `npm pack <paquete>@<versión>`, copiar el archivo a una carpeta nueva con
la versión en el nombre y cambiar la ruta en las páginas que la usan.
