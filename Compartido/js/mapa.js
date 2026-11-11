// Mapa propio de la app: el Campus Tampico de la UAT (Centro Universitario Tampico-Madero)
// dibujado con la paleta del diseño, sin mapas de afuera. Lo usan el mapa de los alumnos,
// la ruta A → B del favor en el carrito, el favor en curso, el perfil del local (para
// colocar su cafetería o comercio) y el editor de lugares del administrador.
// Necesita leaflet.js (solo para dibujar), supabase.js e iconos.js antes que este archivo.
//
// El dibujo sale de los datos de OpenStreetMap del campus (way 200606345), que están en
// Compartido/datos/ (ver el LEEME.md de esa carpeta para actualizarlos):
//   uat-campus.geojson      campus, facultades, edificios, canchas, estacionamientos…
//   uat-caminos.geojson     calles, andadores y árboles dentro del campus
//   uat-alrededores.geojson las calles y manzanas de junto, para ubicarse
// El mapa solo deja ver el campus y unos 150 m alrededor: no se puede alejar ni arrastrar
// más allá.

const DATOS_MAPA = new URL("../datos/", document.currentScript.src);
// Caja del campus (de su contorno en OpenStreetMap): sur-oeste y nor-este.
const CAJA_UAT = [[22.2719105, -97.868861], [22.2792049, -97.8564544]];
// Cuánto se ve alrededor del campus (fracción del tamaño de la caja: 0.12 ≈ 150 m).
const MARGEN_UAT = 0.12;
// Margen al encuadrar puntos: a la derecha están los botones del mapa (zoom y "mi ubicación").
const ENCUADRE = { paddingTopLeft: [36, 36], paddingBottomRight: [72, 36], maxZoom: 18 };

// Iconos que puede tener una facultad o zona (todos existen en iconos.js).
const ICONOS_LUGAR = {
  birrete: "Facultad", edificio: "Edificio", libro: "Biblioteca", deportes: "Deportes",
  estacionamiento: "Estacionamiento", arbol: "Área verde", puerta: "Entrada", ubicacion: "Otro",
};
const TIPOS_LUGAR = { facultad: "Facultad", zona: "Zona de la UAT", local: "Dónde comer" };

// Crea el mapa en el contenedor con todo el campus a la vista (o centrado en `centro`).
// Sin Leaflet deja un aviso y regresa null: la página sigue funcionando sin mapa.
function crearMapa(contenedor, { centro = null, zoom = 17, ...opciones } = {}) {
  if (typeof L === "undefined") {
    contenedor.classList.add("sin-mapa");
    contenedor.textContent = "No se pudo cargar el mapa. Revisa tu conexión.";
    return null;
  }
  const caja = L.latLngBounds(CAJA_UAT);
  const mapa = L.map(contenedor, {
    zoomControl: false, attributionControl: false, maxZoom: 19.5, zoomSnap: 0.25, zoomDelta: 0.5,
    maxBounds: caja.pad(MARGEN_UAT), maxBoundsViscosity: 1, ...opciones,
  });
  // Lo más lejos que se puede ver es el campus completo con un poco de alrededor.
  const zoomMinimo = () => {
    if (!contenedor.clientWidth || !contenedor.clientHeight) return;
    mapa.setMinZoom(Math.min(17, Math.floor(mapa.getBoundsZoom(caja.pad(MARGEN_UAT / 2)) * 4) / 4));
  };
  zoomMinimo();
  if (centro) mapa.setView(centro, zoom);
  else mapa.fitBounds(caja, { padding: [6, 6] });
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  // Los datos del dibujo son de OpenStreetMap (licencia ODbL): hay que decirlo en el mapa.
  L.control.attribution({ position: "bottomleft", prefix: false })
    .addAttribution('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>').addTo(mapa);
  // Los nombres de facultades y canchas y el grosor de las calles cambian con el zoom (mapa.css).
  const marcarZoom = () => {
    const z = mapa.getZoom();
    contenedor.classList.toggle("zoom-cerca", z >= 17);
    contenedor.classList.toggle("zoom-muy-cerca", z >= 18.25);
  };
  mapa.on("zoomend", marcarZoom);
  marcarZoom();
  dibujarCampus(mapa);
  // Si el contenedor cambia de tamaño (por ejemplo, estaba oculto) el mapa se reacomoda.
  new ResizeObserver(() => {
    mapa.invalidateSize();
    zoomMinimo();
  }).observe(contenedor);
  return mapa;
}

// Los datos del dibujo se piden una vez por página (el service worker los guarda para
// abrir sin conexión). Si alguno falta, se dibuja lo demás.
let datosCampus = null;
// Facultades del campus (polígonos), para decir en qué facultad queda un punto.
let facultadesCampus = [];
function cargarDatosCampus() {
  datosCampus ??= Promise.all(["uat-campus", "uat-caminos", "uat-alrededores"].map((nombre) =>
    fetch(new URL(`${nombre}.geojson`, DATOS_MAPA)).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
    .then((datos) => {
      facultadesCampus = (datos[0]?.features || []).filter((f) => f.properties.category === "facultad" && f.geometry.type === "Polygon")
        .map((f) => ({ nombre: f.properties.name, anillo: f.geometry.coordinates[0] }));
      return datos;
    });
  return datosCampus;
}

// Dibuja el campus debajo de los marcadores. Los colores están en mapa.css (.campus-*,
// .afuera-*): afuera va apagado para que destaque la UAT.
async function dibujarCampus(mapa) {
  mapa.createPane("campus").style.zIndex = 200;
  mapa.createPane("nombres").style.zIndex = 450; // encima del dibujo, debajo de los marcadores
  mapa.getPane("nombres").style.pointerEvents = "none";
  const [campus, caminos, alrededores] = await cargarDatosCampus();
  const comun = { pane: "campus", interactive: false };
  const dibujar = (datos, filtro, clase) => {
    if (!datos) return;
    L.geoJSON(datos, {
      ...comun, filter: filtro,
      style: (f) => ({ className: typeof clase === "function" ? clase(f.properties) : clase }),
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { ...comun, radius: 3.5, className: typeof clase === "function" ? clase(f.properties) : clase }),
    }).addTo(mapa);
  };
  const tipo = (f) => f.geometry.type;
  const esPoligono = (f) => tipo(f) === "Polygon" || tipo(f) === "MultiPolygon";
  const p = (f) => f.properties || {};

  // Alrededores: manzanas, agua, edificios y calles de junto.
  const CALLES_GRANDES = ["motorway", "trunk", "primary", "secondary", "motorway_link", "trunk_link", "primary_link", "secondary_link"];
  const CALLES = [...CALLES_GRANDES, "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "service", "road"];
  const ANDADORES = ["footway", "path", "pedestrian", "steps", "cycleway", "track", "corridor"];
  const esAgua = (t = "") => /^(natural=water|waterway=|landuse=basin|landuse=reservoir|natural=wetland)/.test(t);
  const esVerdeAfuera = (t = "") => /^(leisure=(park|garden|pitch|playground|sports_centre)|landuse=(grass|forest|meadow|recreation_ground|cemetery)|natural=(wood|scrub|grassland))/.test(t);
  dibujar(alrededores, (f) => esPoligono(f) && p(f).t && !esAgua(p(f).t) && !esVerdeAfuera(p(f).t), "afuera-manzana");
  dibujar(alrededores, (f) => esPoligono(f) && esVerdeAfuera(p(f).t), "afuera-verde");
  dibujar(alrededores, (f) => esAgua(p(f).t), (q) => (/^waterway=/.test(q.t) ? "afuera-rio" : "afuera-agua"));
  dibujar(alrededores, (f) => esPoligono(f) && !p(f).t && !p(f).h, "afuera-edificio");
  const calleAfuera = (f) => tipo(f) === "LineString" && CALLES.includes(p(f).h);
  const claseCalle = (base) => (q) => `${base}${CALLES_GRANDES.includes(q.h) ? " grande" : ""}`;
  dibujar(alrededores, calleAfuera, claseCalle("afuera-calle-borde"));
  dibujar(alrededores, calleAfuera, claseCalle("afuera-calle"));
  // El mapa termina a unos 150 m del campus: más allá se va desvaneciendo (tres capas
  // encimadas), igual que la máscara de tu mapa original.
  const mundo = [[-85, -180], [-85, 180], [85, 180], [85, -180]];
  for (const margen of [MARGEN_UAT * 0.6, MARGEN_UAT, MARGEN_UAT * 1.5]) {
    const b = L.latLngBounds(CAJA_UAT).pad(margen);
    L.polygon([mundo, [b.getSouthWest(), b.getNorthWest(), b.getNorthEast(), b.getSouthEast()]],
      { ...comun, className: "afuera-tapa" }).addTo(mapa);
  }

  if (campus) {
    const k = (...kinds) => (f) => kinds.includes(p(f).kind);
    dibujar(campus, k("campus"), "campus-terreno");
    dibujar(campus, k("green"), "campus-verde");
    dibujar(campus, k("sport"), (q) => (/pista|track/i.test(q.name) ? "campus-pista" : "campus-cancha"));
    dibujar(campus, k("parking"), "campus-estacionamiento");
    dibujar(campus, (f) => p(f).kind === "area" && !p(f).building, "campus-facultad");
  }
  if (caminos) {
    dibujar(caminos, (f) => esPoligono(f) && p(f).h, "campus-plaza");
    dibujar(caminos, (f) => esPoligono(f) && /^natural=(shrub|scrub)/.test(p(f).t || ""), "campus-verde");
    const calle = (f) => tipo(f) === "LineString" && !ANDADORES.includes(p(f).h) && p(f).h;
    dibujar(caminos, calle, "campus-calle-borde");
    dibujar(caminos, calle, "campus-calle");
    dibujar(caminos, (f) => tipo(f) === "LineString" && ANDADORES.includes(p(f).h) && !p(f).a, "campus-andador");
  }
  if (campus) {
    // Edificios: los que están dentro de una facultad (o son la facultad) van en azul claro.
    dibujar(campus, (f) => p(f).kind === "building" || (p(f).kind === "area" && p(f).building),
      (q) => `campus-edificio${q.zone || q.kind === "area" || q.category === "clinica" ? " de-facultad" : ""}`);
  }
  if (caminos) dibujar(caminos, (f) => tipo(f) === "Point" && /^natural=tree/.test(p(f).t || ""), "campus-arbol");

  // Nombres: calles con nombre (uno por calle, en su tramo más largo) y lugares del campus.
  const nombre = (texto, latlng, clase, giro = 0) => L.marker(latlng, {
    pane: "nombres", interactive: false, keyboard: false,
    icon: L.divIcon({ className: `nombre-mapa ${clase}`, iconSize: null,
      html: `<span style="--giro:${giro}deg">${esc(texto)}</span>` }),
  }).addTo(mapa);
  const tramos = new Map();
  for (const f of [...(alrededores?.features || []), ...(caminos?.features || [])]) {
    if (tipo(f) !== "LineString" || !p(f).n || ANDADORES.includes(p(f).h)) continue;
    const c = f.geometry.coordinates;
    for (let i = 1; i < c.length; i++) {
      const largo = distanciaM({ lat: c[i - 1][1], lng: c[i - 1][0] }, { lat: c[i][1], lng: c[i][0] });
      if (largo > (tramos.get(p(f).n)?.largo || 60)) tramos.set(p(f).n, { largo, a: c[i - 1], b: c[i] });
    }
  }
  tramos.forEach(({ a, b }, texto) => {
    // Ángulo en pantalla (y crece hacia abajo); el texto nunca queda de cabeza.
    let giro = (-Math.atan2(b[1] - a[1], (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180)) * 180) / Math.PI;
    if (giro > 90) giro -= 180;
    if (giro < -90) giro += 180;
    nombre(texto.replace(/^Calle /, ""), [(a[1] + b[1]) / 2, (a[0] + b[0]) / 2], "nombre-calle", giro.toFixed(1));
  });
  // Lugares conocidos de junto (OXXO, súper, gasolinera…), solo para ubicarse: en gris y de
  // cerca. No son locales de la app; esos los pone cada dueño y van en oro.
  for (const f of alrededores?.features || []) {
    if (tipo(f) !== "Point" || !p(f).n || /^shop=car/.test(p(f).t || "")) continue;
    nombre(p(f).n, [f.geometry.coordinates[1], f.geometry.coordinates[0]], "nombre-afuera");
  }
  if (campus) {
    for (const f of campus.features) {
      const q = p(f);
      if (!["facultad", "biblioteca", "clinica", "deporte"].includes(q.category)) continue;
      if (q.category === "deporte" && /fútbol/i.test(q.name) && campus.features.some((g) => /pista/i.test(p(g).name) && distanciaM(
        { lat: p(g).center[1], lng: p(g).center[0] }, { lat: q.center[1], lng: q.center[0] }) < 20)) continue; // la cancha dentro de la pista
      const [lng, lat] = q.center || f.geometry.coordinates;
      nombre(q.category === "facultad" ? nombreFacultad(q.name) : q.name.replace(/^UAT /, ""), [lat, lng], `nombre-lugar ${q.category}`);
    }
  }
}

// "Facultad de Medicina de Tampico "Dr. Alberto Romo Caballero"" → "Medicina".
const nombreFacultad = (nombre) => nombre.replace(/^Facultad de /i, "").replace(/\s*"[^"]*"/g, "")
  .replace(/\s+(de\s+)?Tampico$/i, "").replace(/ y Administración$/, "").replace(/, Diseño y Urbanismo$/, "").trim();

// Para buscar sin fijarse en mayúsculas ni acentos ("ingenieria" encuentra "Ingeniería").
const sinAcentos = (texto) => String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Facultad del campus donde queda un punto (por ejemplo, un local), o null.
function facultadDe({ lat, lng }) {
  const dentro = (anillo) => {
    let c = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  return facultadesCampus.find((f) => dentro(f.anillo))?.nombre || null;
}

// Icono de un lugar: cubiertos para dónde comer; para facultades y zonas, el suyo.
const iconoDeLugar = (lugar) => icono(lugar.tipo === "local" ? "cubiertos" : ICONOS_LUGAR[lugar.icono] ? lugar.icono : "ubicacion");

// Marcador redondo con el icono del lugar. tipo: "facultad", "zona" o "local".
function marcadorLugar(lugar, { tipo = lugar.tipo || "zona", clase = "", ...opciones } = {}) {
  return L.marker([lugar.lat, lugar.lng], {
    icon: L.divIcon({
      className: `marcador marcador-${tipo} ${clase}`.trim(),
      html: `<span>${iconoDeLugar({ ...lugar, tipo })}</span>`,
      iconSize: [30, 30], iconAnchor: [15, 15],
    }),
    title: lugar.nombre, alt: lugar.nombre, riseOnHover: true, ...opciones,
  });
}

// Letra de un punto de la ruta del favor: A = donde se recoge, B = donde se entrega.
function marcadorLetra(punto, letra) {
  return L.marker([punto.lat, punto.lng], {
    icon: L.divIcon({ className: `marcador marcador-letra ${letra.toLowerCase()}`, html: `<span>${letra}</span>`,
      iconSize: [32, 32], iconAnchor: [16, 16] }),
    title: `${letra} · ${punto.nombre}`, zIndexOffset: 1000, keyboard: false,
  });
}

// "Tú": la ubicación del propio celular. Solo se dibuja en tu pantalla, no se manda a nadie.
function marcadorYo({ lat, lng }) {
  return L.marker([lat, lng], {
    icon: L.divIcon({ className: "marcador-yo", iconSize: [18, 18], iconAnchor: [9, 9] }),
    title: "Tú", zIndexOffset: 900, keyboard: false, interactive: false,
  });
}

function lineaRuta(puntos) {
  return L.polyline(puntos.map((p) => [p.lat, p.lng]),
    { color: "#1B3A6B", weight: 3, dashArray: "1 8", lineCap: "round", interactive: false });
}

// Etiqueta fija junto al marcador (nombres de facultades). Con clase "solo-cerca" solo se
// ve con el mapa acercado (nombres de los locales).
function etiquetar(marcador, texto, clase = "") {
  return marcador.bindTooltip(esc(texto), { permanent: true, direction: "right", offset: [16, 0], className: `etiqueta-mapa ${clase}`.trim() });
}

// Una facultad que cae dentro de su dibujo en el mapa ya tiene su nombre escrito ahí; las
// demás (por ejemplo, una que el administrador puso en otro lado) llevan etiqueta propia.
function etiquetarFacultad(marcador, lugar) {
  cargarDatosCampus().then(() => { if (!facultadDe(lugar)) etiquetar(marcador, nombreCorto(lugar)); });
  return marcador;
}

// Nombre corto para etiquetas y listas: la abreviatura o el nombre sin "Facultad de…".
function nombreCorto(lugar) {
  return lugar.abreviatura || lugar.nombre.replace(/^(Facultad|Unidad Académica( Multidisciplinaria)?) de /, "").split(" y ")[0];
}

// Distancia en línea recta, en metros (igual que privado.distancia_m en la base).
function distanciaM(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

// Minutos a pie, igual que privado.minutos_caminando (camino ≈ recta × 1.3, 75 m por minuto).
const minutosCaminando = (m) => Math.max(1, Math.ceil((m * 1.3) / 75));
const textoDistancia = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);

// "Llega en ~6 min" a partir de la hora estimada que calcula la base de datos.
function textoLlegada(fecha) {
  const minutos = Math.ceil((new Date(fecha) - Date.now()) / 60000);
  return minutos <= 1 ? "Está por llegar" : `Llega en ~${minutos} min`;
}

// Facultades y zonas que ya están en el mapa (activas y con coordenadas).
async function lugaresUat() {
  const { data, error } = await db.from("puntos_entrega").select("*").eq("activo", true).order("nombre");
  if (error) return mostrarError(error), [];
  return data.filter((l) => l.lat != null).map((l) => ({ ...l, tipo: l.tipo || "zona" }));
}

// Ubicación del celular, una vez (para dibujar "Tú"). null si no hay permiso o GPS.
function miUbicacion() {
  return new Promise((listo) => {
    if (!navigator.geolocation) return listo(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => listo({ lat: coords.latitude, lng: coords.longitude }),
      () => listo(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}
