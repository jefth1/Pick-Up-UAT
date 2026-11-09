// Editor de lugares del mapa (solo administradores; ver docs/supabase.md): coloca las
// facultades y zonas de la UAT tocando el mapa, las mueve arrastrándolas, las renombra
// y las quita. Los alumnos las ven en su mapa y las eligen como punto de entrega.
// Las cafeterías y comercios no van aquí: cada local se coloca desde su perfil.

// Lugares del Centro Universitario Tampico-Madero (Campus Sur) que faltan por colocar.
// Revisa el nombre antes de guardarlo; "Otro lugar" agrega cualquiera.
const LUGARES_SUGERIDOS = [
  { nombre: "Facultad de Medicina Dr. Alberto Romo Caballero", abreviatura: "Medicina", tipo: "facultad", icono: "birrete" },
  { nombre: "Facultad de Enfermería Tampico", abreviatura: "Enfermería", tipo: "facultad", icono: "birrete" },
  { nombre: "Facultad de Odontología", abreviatura: "Odontología", tipo: "facultad", icono: "birrete" },
  { nombre: "Facultad de Derecho y Ciencias Sociales", abreviatura: "FADYCS", tipo: "facultad", icono: "birrete" },
  { nombre: "Facultad de Comercio y Administración Tampico", abreviatura: "FCAT", tipo: "facultad", icono: "birrete" },
  { nombre: "Facultad de Ingeniería Arturo Narro Siller", abreviatura: "FIANS", tipo: "facultad", icono: "birrete" },
  { nombre: "Facultad de Arquitectura, Diseño y Urbanismo", abreviatura: "FADU", tipo: "facultad", icono: "birrete" },
  { nombre: "Facultad de Música y Artes", abreviatura: "Música", tipo: "facultad", icono: "birrete" },
  { nombre: "Biblioteca", tipo: "zona", icono: "libro" },
  { nombre: "Librería Educal", tipo: "zona", icono: "libro" },
  { nombre: "Servicios Escolares", tipo: "zona", icono: "edificio" },
  { nombre: "Centro de Idiomas", tipo: "zona", icono: "edificio" },
  { nombre: "Gimnasio", tipo: "zona", icono: "deportes" },
  { nombre: "Canchas", tipo: "zona", icono: "deportes" },
  { nombre: "Auditorio", tipo: "zona", icono: "edificio" },
  { nombre: "Explanada", tipo: "zona", icono: "arbol" },
  { nombre: "Estacionamiento", tipo: "zona", icono: "estacionamiento" },
  { nombre: "Entrada principal", tipo: "zona", icono: "puerta" },
];

const sinAcentos = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = await usuarioActual();
  if (!usuario) return pedirSesion();
  mostrarSalir();
  const { data: admin } = await db.from("administradores").select("usuario").eq("usuario", usuario.id).maybeSingle();
  if (!admin) return (document.getElementById("sin-permiso").hidden = false);
  editor();
});

function pedirSesion() {
  const form = document.getElementById("form-admin");
  form.hidden = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { correo, contrasena } = Object.fromEntries(new FormData(form));
    const { error } = await db.auth.signInWithPassword({ email: correo, password: contrasena });
    if (error) return mostrarError(error);
    location.reload();
  });
}

function mostrarSalir() {
  const salir = document.getElementById("salir");
  salir.hidden = false;
  salir.addEventListener("click", async (e) => {
    e.preventDefault();
    await db.auth.signOut();
    location.reload();
  });
}

async function editor() {
  document.getElementById("editor").hidden = false;
  const contenedor = document.getElementById("mapa-admin");
  const mapa = crearMapa(contenedor, { zoom: 17 });
  const instruccion = document.getElementById("instruccion");
  const form = document.getElementById("form-lugar");
  form.icono.innerHTML = Object.entries(ICONOS_LUGAR).map(([clave, texto]) => `<option value="${clave}">${texto}</option>`).join("");
  let lugares = [];
  let elegido = null; // lugar abierto en el formulario
  let colocando = null; // lugar nuevo que se coloca con el siguiente toque al mapa
  let primeraVez = true;
  const capa = mapa && L.layerGroup().addTo(mapa);
  const decir = (html) => (instruccion.innerHTML = html);
  const buscar = (id) => lugares.find((l) => String(l.id) === String(id));

  const pintar = () => {
    const activos = lugares.filter((l) => l.activo && l.lat != null);
    if (capa) {
      capa.clearLayers();
      activos.forEach((l) => {
        const m = marcadorLugar(l, { draggable: true, clase: `arrastrable ${elegido?.id === l.id ? "elegido" : ""}` })
          .on("click", () => abrir(l))
          .on("dragend", () => mover(l, m.getLatLng()));
        if (l.tipo === "facultad") etiquetar(m, nombreCorto(l));
        m.addTo(capa);
      });
      if (primeraVez && activos.length > 1) mapa.fitBounds(activos.map((l) => [l.lat, l.lng]), ENCUADRE);
      primeraVez = false;
    }
    // Una sugerencia ya está colocada si algún lugar se llama así (aunque luego se le haya
    // agregado algo al nombre, como "Explanada central").
    const usados = lugares.map((l) => sinAcentos(l.nombre));
    document.getElementById("por-colocar").innerHTML = LUGARES_SUGERIDOS.filter((s) => !usados.some((u) => u.startsWith(sinAcentos(s.nombre))))
      .map((s) => `<button type="button" class="chip ${colocando?.nombre === s.nombre ? "activo" : ""}" data-sugerido="${esc(s.nombre)}">${esc(s.abreviatura || s.nombre)}</button>`)
      .join("") + `<button type="button" class="chip" data-sugerido="">+ Otro lugar</button>`;
    document.getElementById("lista-admin").innerHTML = activos.map((l) => `<li><button type="button" class="fila-lugar" data-lugar="${l.id}">
        <span class="marcador marcador-${l.tipo || "zona"}"><span>${iconoDeLugar(l)}</span></span>
        <span class="info"><strong>${esc(l.nombre)}</strong><span>${TIPOS_LUGAR[l.tipo] || TIPOS_LUGAR.zona}${l.abreviatura ? ` · ${esc(l.abreviatura)}` : ""}</span></span></button></li>`)
      .join("") || `<li class="texto-suave">Todavía no hay lugares en el mapa.</li>`;
    document.getElementById("lista-quitados").innerHTML = lugares.filter((l) => !l.activo).map((l) => `<li class="fila-quitado">
        <span>${esc(l.nombre)}</span><button type="button" class="boton boton-secundario boton-chico" data-reactivar="${l.id}">Volver a mostrar</button></li>`)
      .join("") || `<li class="texto-suave">Nada por aquí.</li>`;
    contenedor.classList.toggle("colocando", !!colocando);
    decir(colocando
      ? `Toca el mapa donde está <b>${esc(colocando.nombre)}</b>, o <button type="button" class="enlace" id="colocar-aqui">usa tu ubicación</button> si estás ahí. <button type="button" class="enlace" id="cancelar-colocar">Cancelar</button>`
      : "Toca un lugar del mapa para editarlo o arrástralo para moverlo. Para agregar uno, elígelo en «Por colocar».");
  };

  const cargar = async () => {
    const { data, error } = await db.from("puntos_entrega").select("*").order("nombre");
    if (error) return mostrarError(error);
    lugares = data;
    if (elegido) elegido = buscar(elegido.id) || null;
    pintar();
  };

  const abrir = (l) => {
    elegido = l;
    colocando = null;
    form.hidden = false;
    form.nombre.value = l.nombre;
    form.abreviatura.value = l.abreviatura || "";
    form.tipo.value = l.tipo || "zona";
    form.icono.value = ICONOS_LUGAR[l.icono] ? l.icono : "ubicacion";
    document.getElementById("coordenadas-lugar").textContent =
      `Está en ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}. Arrástralo en el mapa para moverlo.`;
    pintar();
    mapa?.panTo([l.lat, l.lng]);
  };

  const mover = async (l, { lat, lng }) => {
    const { error } = await db.from("puntos_entrega").update({ lat, lng }).eq("id", l.id);
    if (error) mostrarError(error);
    await cargar();
    if (buscar(l.id)) abrir(buscar(l.id));
  };

  const colocar = async ({ lat, lng }) => {
    const datos = colocando;
    colocando = null;
    const { data, error } = await db.from("puntos_entrega").insert({ ...datos, lat, lng }).select().single();
    if (error) return mostrarError(error), pintar();
    await cargar();
    abrir(buscar(data.id));
    decir(`Listo, <b>${esc(data.nombre)}</b> ya aparece en el mapa de los alumnos. Revisa sus datos abajo.`);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!elegido) return;
    const cambios = { nombre: form.nombre.value.trim(), abreviatura: form.abreviatura.value.trim() || null,
      tipo: form.tipo.value, icono: form.icono.value };
    const { error } = await db.from("puntos_entrega").update(cambios).eq("id", elegido.id);
    if (error) return mostrarError(error);
    await cargar();
    abrir(elegido);
    decir("Listo, guardamos los cambios.");
  });

  document.getElementById("quitar-lugar").addEventListener("click", async () => {
    if (!elegido || !confirm(`¿Quitar «${elegido.nombre}» del mapa? Los alumnos ya no lo verán ni podrán elegirlo para entregas.`)) return;
    const { error } = await db.from("puntos_entrega").update({ activo: false }).eq("id", elegido.id);
    if (error) return mostrarError(error);
    elegido = null;
    form.hidden = true;
    cargar();
  });

  document.getElementById("aqui-lugar").addEventListener("click", async () => {
    const pos = await miUbicacion();
    if (!pos) return alert("No pudimos leer tu ubicación. Permite el acceso e intenta de nuevo.");
    if (elegido) mover(elegido, pos);
  });

  document.getElementById("por-colocar").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-sugerido]");
    if (!chip) return;
    let datos = LUGARES_SUGERIDOS.find((s) => s.nombre === chip.dataset.sugerido);
    if (!datos) {
      const nombre = prompt("Nombre de la facultad o zona:")?.trim();
      if (!nombre) return;
      datos = { nombre: nombre.slice(0, 80), tipo: "zona", icono: "ubicacion" };
    }
    colocando = colocando?.nombre === datos.nombre ? null : datos;
    elegido = null;
    form.hidden = true;
    pintar();
    contenedor.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  instruccion.addEventListener("click", async (e) => {
    if (e.target.id === "cancelar-colocar") return (colocando = null), pintar();
    if (e.target.id !== "colocar-aqui") return;
    const pos = await miUbicacion();
    if (!pos) return alert("No pudimos leer tu ubicación. Permite el acceso e intenta de nuevo.");
    colocar(pos);
  });

  document.getElementById("lista-admin").addEventListener("click", (e) => {
    const fila = e.target.closest("[data-lugar]");
    if (fila) abrir(buscar(fila.dataset.lugar));
  });

  document.getElementById("lista-quitados").addEventListener("click", async (e) => {
    const id = e.target.dataset.reactivar;
    if (!id) return;
    const { error } = await db.from("puntos_entrega").update({ activo: true }).eq("id", id);
    if (error) return mostrarError(error);
    cargar();
  });

  if (mapa) {
    mapa.on("click", (e) => colocando && colocar(e.latlng));
    // Los locales se ven de referencia; los mueve cada dueño desde su perfil.
    db.from("locales").select("id, nombre, lat, lng").not("lat", "is", null).then(({ data }) =>
      (data || []).forEach((l) => marcadorLugar({ ...l, tipo: "local" }, { clase: "chico", interactive: false, keyboard: false }).addTo(mapa)));
    const botonYo = document.getElementById("mi-ubicacion");
    L.DomEvent.disableClickPropagation(botonYo);
    let yo = null;
    botonYo.addEventListener("click", async () => {
      const pos = await miUbicacion();
      if (!pos) return alert("No pudimos leer tu ubicación.");
      yo?.remove();
      yo = marcadorYo(pos).addTo(mapa);
      mapa.flyTo([pos.lat, pos.lng], 18);
    });
  }
  await cargar();
}
