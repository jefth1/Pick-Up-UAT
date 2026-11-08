// Mapa de la UAT con Leaflet (CDN) y el mapa de OpenStreetMap. Lo usan el mapa de los
// alumnos, la ruta A → B del favor en el carrito, el favor en curso, el perfil del local
// (para colocar su cafetería o comercio) y el editor de lugares del administrador.
// Necesita leaflet.js, supabase.js e iconos.js antes que este archivo.

const CENTRO_UAT = [23.72094, -99.15136]; // Centro Universitario Victoria, Cd. Victoria
const ZOOM_UAT = 16;
// Margen al encuadrar puntos: a la derecha están los botones del mapa (zoom y "mi ubicación").
const ENCUADRE = { paddingTopLeft: [36, 36], paddingBottomRight: [72, 36], maxZoom: 17 };

// Iconos que puede tener una facultad o zona (todos existen en iconos.js).
const ICONOS_LUGAR = {
  birrete: "Facultad", edificio: "Edificio", libro: "Biblioteca", deportes: "Deportes",
  estacionamiento: "Estacionamiento", arbol: "Área verde", puerta: "Entrada", ubicacion: "Otro",
};
const TIPOS_LUGAR = { facultad: "Facultad", zona: "Zona de la UAT", local: "Dónde comer" };

// Crea el mapa en el contenedor, centrado en la UAT. Sin conexión (o sin Leaflet)
// deja un aviso y regresa null: la página sigue funcionando sin mapa.
function crearMapa(contenedor, { centro = CENTRO_UAT, zoom = ZOOM_UAT, ...opciones } = {}) {
  if (typeof L === "undefined") {
    contenedor.classList.add("sin-mapa");
    contenedor.textContent = "No se pudo cargar el mapa. Revisa tu conexión.";
    return null;
  }
  const mapa = L.map(contenedor, { zoomControl: false, ...opciones }).setView(centro, zoom);
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(mapa);
  // Si el contenedor cambia de tamaño (por ejemplo, estaba oculto) el mapa se reacomoda.
  new ResizeObserver(() => mapa.invalidateSize()).observe(contenedor);
  return mapa;
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

// Etiqueta fija junto al marcador (nombres de facultades).
function etiquetar(marcador, texto) {
  return marcador.bindTooltip(esc(texto), { permanent: true, direction: "right", offset: [16, 0], className: "etiqueta-mapa" });
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
