# Datos del mapa de la UAT

El mapa de la app (`Compartido/js/mapa.js`) dibuja el Campus Tampico de la UAT (Centro
Universitario Tampico-Madero) con estos archivos, en la paleta de la app y sin pedir mapas
a otros servidores. Los tres salen de OpenStreetMap, a partir del contorno del campus
([way 200606345](https://www.openstreetmap.org/way/200606345)), y se descargaron el
2026-11-11.

| Archivo | Qué tiene |
| --- | --- |
| `uat-campus.geojson` | El campus, las 8 facultades, edificios, canchas, pista, áreas verdes, estacionamientos y la biblioteca. Es el `data/uat-campus.geojson` del proyecto `mapa_uat` de Emiliano, sin cambios. |
| `uat-caminos.geojson` | Calles, andadores, escalones, puertas, árboles y arbustos dentro del campus. |
| `uat-alrededores.geojson` | Calles, manzanas, edificios y comercios con nombre (OXXO, súper, gasolinera…) en una caja de unos 300 m alrededor del campus, para ubicarse. |

Formato de las propiedades:

- `uat-campus.geojson`: `kind` (campus, area, green, sport, parking, building, poi),
  `category` (facultad, biblioteca, clinica, deporte, area_verde, estacionamiento, edificio),
  `name`, `center` ([lng, lat]), `zone` (la facultad donde está) y otros datos de OSM.
- Los otros dos: `h` (tipo de calle, el `highway` de OSM) y `n` (nombre), o `t`
  (`clave=valor` de OSM, por ejemplo `amenity=restaurant`) y `n`.

El mapa no deja alejarse más que el campus completo ni moverse más de unos 150 m fuera
de él (`CAJA_UAT` y `MARGEN_UAT` en `mapa.js`). Lo que quede más lejos en estos archivos
no se ve.

## Licencia

Los datos son © colaboradores de OpenStreetMap, con licencia
[ODbL](https://www.openstreetmap.org/copyright). Por eso el mapa dice «© OpenStreetMap»
en la esquina.

## Cómo actualizarlos

1. `uat-campus.geojson`: correr `node tools/build-data.js` en el proyecto `mapa_uat` y
   copiar aquí su `data/uat-campus.geojson`. Esa misma descarga deja `data/raw/inside.json`
   (todo lo que hay dentro del campus), que sirve para el paso 3.
2. Descargar lo de alrededor en [Overpass](https://overpass-turbo.eu/) (exportar como
   JSON «raw») y guardarlo como `alrededor.json`:

   ```
   [out:json][timeout:90];
   (
     way[highway](22.2700,-97.8710,22.2812,-97.8545);
     way[building](22.2700,-97.8710,22.2812,-97.8545);
     way[landuse](22.2700,-97.8710,22.2812,-97.8545);
     way[leisure](22.2700,-97.8710,22.2812,-97.8545);
     way[natural](22.2700,-97.8710,22.2812,-97.8545);
     way[waterway](22.2700,-97.8710,22.2812,-97.8545);
     nwr[amenity][name](22.2700,-97.8710,22.2812,-97.8545);
     nwr[shop][name](22.2700,-97.8710,22.2812,-97.8545);
   );
   out geom;
   ```

3. Armar los otros dos archivos:

   ```
   node Compartido/datos/herramientas/caminos-y-alrededores.js inside.json alrededor.json Compartido/datos
   ```

Si cambian los nombres o los centros de las facultades, revisa también `LUGARES_SUGERIDOS`
en `PerfilAdmin/js/admin.js` (el editor de lugares los usa para colocarlas con un toque).
