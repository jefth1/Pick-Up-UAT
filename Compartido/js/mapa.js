// Mapa propio de la app: el Centro Universitario Tampico-Madero (Campus Sur de la UAT)
// dibujado con la paleta del diseño, sin mapas de afuera. Lo usan el mapa de los alumnos,
// la ruta A → B del favor en el carrito, el favor en curso, el perfil del local (para
// colocar su cafetería o comercio) y el editor de lugares del administrador.
// Necesita leaflet.js (solo para dibujar), supabase.js e iconos.js antes que este archivo.

// El dibujo del campus, en coordenadas reales (lat, lng) para que la distancia, la cuota y
// la hora de llegada salgan bien. Cada parte es una lista de polígonos o líneas.
const CAMPUS = {
  nombre: "Centro Universitario Tampico-Madero",
  centro: [22.2763, -97.8609],
  // Calcado de una captura de Google Maps (norte arriba, ~1.05 m por pixel), con el
  // edificio central (pin "UAT CU SUR") en 22.2768, -97.8622. Si todo sale corrido,
  // basta con mover esa ancla en el calco y volver a generar estas listas.
  terreno: [[22.278271,-97.866043],[22.278951,-97.864565],[22.279667,-97.860386],[22.279309,-97.859927],[22.278083,-97.857888],[22.277045,-97.856563],[22.276668,-97.856156],[22.27563,-97.856156],[22.274216,-97.856614],[22.273037,-97.85692],[22.273037,-97.86324],[22.274216,-97.864055],[22.275442,-97.864565],[22.275517,-97.865635],[22.276762,-97.866247]],
  calles: [
    { nombre: "Circuito Universitario", puntos: [[22.278894,-97.864514],[22.279234,-97.862577],[22.279649,-97.860386]] },
    { nombre: "", puntos: [[22.279649,-97.860386],[22.277215,-97.860386]] },
    { nombre: "", puntos: [[22.278894,-97.864514],[22.275866,-97.864514],[22.275715,-97.86433],[22.275715,-97.861945],[22.275857,-97.861802],[22.277083,-97.861802],[22.277215,-97.86166],[22.277215,-97.86008],[22.277045,-97.859907],[22.276517,-97.859907]] },
    { nombre: "Circuito Universitario", puntos: [[22.276517,-97.861802],[22.276517,-97.856461]] },
    { nombre: "", puntos: [[22.276894,-97.859907],[22.276894,-97.856105]] },
    { nombre: "Blvd. Tampico-Mante", puntos: [[22.279875,-97.860131],[22.278177,-97.857888],[22.277064,-97.856461],[22.276762,-97.85588]] },
    { nombre: "Av. Universidad", puntos: [[22.275819,-97.85588],[22.274593,-97.85641],[22.272952,-97.85692]] },
    { nombre: "", puntos: [[22.275715,-97.862373],[22.272952,-97.862373]] },
    { nombre: "Universidad de Veracruz", puntos: [[22.278224,-97.866654],[22.278668,-97.865533],[22.278894,-97.864514]] },
    { nombre: "", puntos: [[22.275715,-97.864514],[22.275442,-97.865533],[22.274829,-97.866654]] },
  ],
  andadores: [
    [[22.276196,-97.861802],[22.276196,-97.859621]],
    [[22.275715,-97.862373],[22.27497,-97.861864],[22.274876,-97.861558]],
    [[22.275442,-97.860742],[22.275725,-97.859927],[22.275017,-97.858296],[22.274593,-97.856461]],
  ],
  verdes: [
    [[22.274942,-97.858663],[22.274753,-97.858677],[22.274574,-97.858718],[22.274413,-97.858783],[22.274278,-97.85887],[22.274177,-97.858975],[22.274114,-97.859091],[22.274093,-97.859213],[22.274114,-97.859336],[22.274177,-97.859452],[22.274278,-97.859557],[22.274413,-97.859644],[22.274574,-97.859709],[22.274753,-97.85975],[22.274942,-97.859764],[22.275131,-97.85975],[22.27531,-97.859709],[22.275471,-97.859644],[22.275606,-97.859557],[22.275707,-97.859452],[22.275769,-97.859336],[22.275791,-97.859213],[22.275769,-97.859091],[22.275707,-97.858975],[22.275606,-97.85887],[22.275471,-97.858783],[22.27531,-97.858718],[22.275131,-97.858677]],
    [[22.274574,-97.86169],[22.274574,-97.861089],[22.273735,-97.861089],[22.273735,-97.86169]],
    [[22.274178,-97.863291],[22.274178,-97.862547],[22.273169,-97.862547],[22.273169,-97.863291]],
    [[22.275753,-97.860691],[22.275753,-97.860539],[22.275206,-97.860539],[22.275206,-97.860691]],
    [[22.275753,-97.860457],[22.275753,-97.860294],[22.275206,-97.860294],[22.275206,-97.860457]],
    [[22.274951,-97.858316],[22.275017,-97.857684],[22.274121,-97.857766],[22.274168,-97.858347]],
    [[22.274895,-97.857705],[22.27464,-97.856614],[22.273838,-97.856767],[22.273951,-97.857807]],
    [[22.274027,-97.858938],[22.273838,-97.85799],[22.273272,-97.858113],[22.273367,-97.85901]],
    [[22.273763,-97.857909],[22.273631,-97.856818],[22.273065,-97.856971],[22.273159,-97.857939]],
    [[22.275272,-97.858092],[22.275272,-97.857766],[22.275017,-97.857766],[22.275017,-97.858092]],
    [[22.275678,-97.863902],[22.275678,-97.863413],[22.275442,-97.863413],[22.275442,-97.863902]],
    [[22.277045,-97.865615],[22.276982,-97.865625],[22.276922,-97.865655],[22.276869,-97.865704],[22.276824,-97.865768],[22.27679,-97.865845],[22.276769,-97.865932],[22.276762,-97.866022],[22.276769,-97.866113],[22.27679,-97.866199],[22.276824,-97.866277],[22.276869,-97.866341],[22.276922,-97.86639],[22.276982,-97.86642],[22.277045,-97.86643],[22.277108,-97.86642],[22.277168,-97.86639],[22.277222,-97.866341],[22.277266,-97.866277],[22.2773,-97.866199],[22.277321,-97.866113],[22.277328,-97.866022],[22.277321,-97.865932],[22.2773,-97.865845],[22.277266,-97.865768],[22.277222,-97.865704],[22.277168,-97.865655],[22.277108,-97.865625]],
  ],
  estacionamientos: [
    [[22.27646,-97.861762],[22.27646,-97.859621],[22.276215,-97.859621],[22.276215,-97.861762]],
    [[22.277158,-97.861741],[22.277158,-97.861069],[22.276555,-97.861069],[22.276555,-97.861741]],
    [[22.278885,-97.86064],[22.278885,-97.860131],[22.277611,-97.860131],[22.277611,-97.86064]],
    [[22.276243,-97.865329],[22.276243,-97.864973],[22.275725,-97.864973],[22.275725,-97.865329]],
    [[22.278036,-97.865023],[22.278036,-97.864565],[22.277234,-97.864565],[22.277234,-97.865023]],
    [[22.277724,-97.864361],[22.277724,-97.8638],[22.277309,-97.8638],[22.277309,-97.864361]],
    [[22.279026,-97.861915],[22.279026,-97.861609],[22.278602,-97.861609],[22.278602,-97.861915]],
    [[22.276366,-97.858531],[22.276366,-97.857022],[22.275913,-97.857022],[22.275913,-97.858531]],
    [[22.275866,-97.864208],[22.275866,-97.863291],[22.275725,-97.863291],[22.275725,-97.864208]],
  ],
  edificios: [
    { puntos: [[22.27747,-97.862496],[22.27747,-97.862047],[22.275989,-97.862047],[22.275989,-97.862496]] },
    { puntos: [[22.27846,-97.861456],[22.27846,-97.860691],[22.278102,-97.860691],[22.278102,-97.861456]] },
    { puntos: [[22.278026,-97.861609],[22.278026,-97.86064],[22.277819,-97.86064],[22.277819,-97.861609]] },
    { puntos: [[22.27846,-97.863596],[22.27846,-97.863189],[22.278083,-97.863189],[22.278083,-97.863596]] },
    { puntos: [[22.277894,-97.863087],[22.277894,-97.862832],[22.277611,-97.862832],[22.277611,-97.863087]] },
    { puntos: [[22.276668,-97.864055],[22.276668,-97.863413],[22.276177,-97.863413],[22.276177,-97.864055]] },
    { puntos: [[22.276621,-97.863189],[22.276621,-97.862832],[22.276291,-97.862832],[22.276291,-97.863189]] },
    { puntos: [[22.277158,-97.864157],[22.277158,-97.862934],[22.277026,-97.862934],[22.277026,-97.864157]] },
    { puntos: [[22.276913,-97.864208],[22.276913,-97.863138],[22.276762,-97.863138],[22.276762,-97.864208]] },
    { puntos: [[22.276857,-97.865125],[22.276857,-97.864667],[22.276574,-97.864667],[22.276574,-97.865125]] },
    { puntos: [[22.275159,-97.863342],[22.275159,-97.863138],[22.274687,-97.863138],[22.274687,-97.863342]] },
    { puntos: [[22.27464,-97.863902],[22.27464,-97.863495],[22.274404,-97.863495],[22.274404,-97.863902]] },
    { puntos: [[22.276055,-97.86166],[22.276055,-97.860742],[22.275913,-97.860742],[22.275913,-97.86166]] },
    { puntos: [[22.275866,-97.861558],[22.275866,-97.860946],[22.275678,-97.860946],[22.275678,-97.861558]] },
    { puntos: [[22.27563,-97.861711],[22.27563,-97.861099],[22.275112,-97.861099],[22.275112,-97.861711]] },
    { puntos: [[22.27912,-97.860233],[22.27912,-97.859774],[22.278554,-97.859774],[22.278554,-97.860233]] },
    { puntos: [[22.277913,-97.860131],[22.277913,-97.859519],[22.277705,-97.859519],[22.277705,-97.860131]] },
    { puntos: [[22.277913,-97.859315],[22.277913,-97.858704],[22.277705,-97.858704],[22.277705,-97.859315]] },
    { puntos: [[22.278036,-97.8585],[22.278036,-97.858194],[22.277705,-97.858194],[22.277705,-97.8585]] },
    { puntos: [[22.277611,-97.858194],[22.277611,-97.857888],[22.277375,-97.857888],[22.277375,-97.858194]] },
    { puntos: [[22.275725,-97.858194],[22.275725,-97.857684],[22.275366,-97.857684],[22.275366,-97.858194]] },
    { puntos: [[22.275555,-97.856869],[22.275492,-97.856877],[22.275432,-97.856899],[22.275379,-97.856936],[22.275334,-97.856984],[22.2753,-97.857042],[22.275279,-97.857107],[22.275272,-97.857175],[22.275279,-97.857243],[22.2753,-97.857308],[22.275334,-97.857365],[22.275379,-97.857414],[22.275432,-97.85745],[22.275492,-97.857473],[22.275555,-97.857481],[22.275618,-97.857473],[22.275678,-97.85745],[22.275731,-97.857414],[22.275776,-97.857365],[22.27581,-97.857308],[22.275831,-97.857243],[22.275838,-97.857175],[22.275831,-97.857107],[22.27581,-97.857042],[22.275776,-97.856984],[22.275731,-97.856936],[22.275678,-97.856899],[22.275618,-97.856877]] },
    { puntos: [[22.276762,-97.860946],[22.276998,-97.860742],[22.277092,-97.860437],[22.277045,-97.860131],[22.276857,-97.859927],[22.276762,-97.860131],[22.276838,-97.860437],[22.276781,-97.860691]] },
    { puntos: [[22.278979,-97.862475],[22.278979,-97.862118],[22.278743,-97.862118],[22.278743,-97.862475]] },
    { puntos: [[22.278837,-97.861405],[22.278837,-97.860742],[22.278649,-97.860742],[22.278649,-97.861405]] },
    { puntos: [[22.277375,-97.863393],[22.277375,-97.863138],[22.277187,-97.863138],[22.277187,-97.863393]] },
    { puntos: [[22.278366,-97.86482],[22.278366,-97.864565],[22.27813,-97.864565],[22.27813,-97.86482]] },
  ],
};

const CENTRO_UAT = CAMPUS.centro;
const ZOOM_UAT = 16.5;
// Margen al encuadrar puntos: a la derecha están los botones del mapa (zoom y "mi ubicación").
const ENCUADRE = { paddingTopLeft: [36, 36], paddingBottomRight: [72, 36], maxZoom: 18 };

// Iconos que puede tener una facultad o zona (todos existen en iconos.js).
const ICONOS_LUGAR = {
  birrete: "Facultad", edificio: "Edificio", libro: "Biblioteca", deportes: "Deportes",
  estacionamiento: "Estacionamiento", arbol: "Área verde", puerta: "Entrada", ubicacion: "Otro",
};
const TIPOS_LUGAR = { facultad: "Facultad", zona: "Zona de la UAT", local: "Dónde comer" };

// Crea el mapa en el contenedor, centrado en el campus. Sin conexión (o sin Leaflet)
// deja un aviso y regresa null: la página sigue funcionando sin mapa.
function crearMapa(contenedor, { centro = CENTRO_UAT, zoom = ZOOM_UAT, ...opciones } = {}) {
  if (typeof L === "undefined") {
    contenedor.classList.add("sin-mapa");
    contenedor.textContent = "No se pudo cargar el mapa. Revisa tu conexión.";
    return null;
  }
  // Se puede alejar hasta ~3 km del campus, para ver los locales de los alrededores.
  const limites = L.latLngBounds(CAMPUS.terreno).pad(4);
  const mapa = L.map(contenedor, {
    zoomControl: false, attributionControl: false, minZoom: 14, maxZoom: 19, zoomSnap: 0.25, zoomDelta: 0.5,
    maxBounds: limites, maxBoundsViscosity: 0.8, ...opciones,
  }).setView(centro, zoom);
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  dibujarCampus(mapa);
  // Si el contenedor cambia de tamaño (por ejemplo, estaba oculto) el mapa se reacomoda.
  new ResizeObserver(() => mapa.invalidateSize()).observe(contenedor);
  return mapa;
}

// Dibuja el campus debajo de los marcadores. Los colores están en mapa.css (.campus-*).
function dibujarCampus(mapa) {
  mapa.createPane("campus").style.zIndex = 250;
  const comun = { pane: "campus", interactive: false };
  const zona = (puntos, clase) => L.polygon(puntos, { ...comun, className: clase }).addTo(mapa);
  const linea = (puntos, clase) => L.polyline(puntos, { ...comun, className: clase }).addTo(mapa);
  zona(CAMPUS.terreno, "campus-terreno");
  CAMPUS.verdes.forEach((p) => zona(p, "campus-verde"));
  CAMPUS.estacionamientos.forEach((p) => zona(p, "campus-estacionamiento"));
  CAMPUS.calles.forEach(({ nombre, puntos }) => {
    linea(puntos, "campus-calle-borde");
    const calle = linea(puntos, "campus-calle");
    if (nombre) calle.bindTooltip(esc(nombre), { permanent: true, direction: "center", className: "etiqueta-calle" });
  });
  CAMPUS.andadores.forEach((p) => linea(p, "campus-andador"));
  CAMPUS.edificios.forEach(({ nombre, puntos }) => {
    const edificio = zona(puntos, "campus-edificio");
    if (nombre) edificio.bindTooltip(esc(nombre), { permanent: true, direction: "center", className: "etiqueta-edificio" });
  });
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
