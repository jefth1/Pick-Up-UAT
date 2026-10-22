// Lógica del perfil de locales: ver pedidos, aceptarlos o rechazarlos, avanzar su
// estado, entregar con el QR del alumno y administrar el menú y el perfil del local.
const ACCIONES = {
  aceptado: "Aceptar", rechazado: "Rechazar", preparando: "Empezar",
  listo: "Marcar listo", entregado: "Entregado", no_recogido: "No lo recogieron",
};
const ACCIONES_DETALLE = {
  aceptado: "Aceptar pedido", rechazado: "Rechazar pedido", preparando: "Empezar a preparar",
  listo: "Marcar como listo", entregado: "Marcar como entregado", no_recogido: "El alumno no lo recogió",
};
const NAVEGACION = [
  ["pedidos", "pedidos.html", "pedidos", "Pedidos"],
  ["menu", "mi-menu.html", "lista", "Menú"],
  ["qr", "escanear-qr.html", "escanear", "Escanear QR"],
  ["ventas", "ventas.html", "ventas", "Ventas"],
  ["perfil", "perfil.html", "usuario", "Perfil"],
];

document.addEventListener("DOMContentLoaded", async () => {
  const local = await localActual();
  if (!local) return (location.href = "../Acceso/local-iniciar-sesion.html");

  pintarNavegacion(local);
  document.querySelectorAll(".nombre-local").forEach((n) => (n.textContent = local.nombre));
  if (document.getElementById("lista-nuevo")) pedidos(local);
  if (document.getElementById("titulo-pedido")) detallePedido(local);
  if (document.getElementById("entregar")) escaner(local);
  if (document.getElementById("lista-menu")) miMenu(local);
  if (document.getElementById("form-producto")) agregarProducto(local);
  if (document.getElementById("lista-ventas")) ventas(local);
  if (document.getElementById("form-perfil")) perfil(local);
});

// Barra inferior en celular; barra lateral con el nombre del local en computadora.
async function pintarNavegacion(local) {
  const nav = document.querySelector(".navegacion-local");
  if (!nav) return;
  nav.innerHTML = `<div class="marca-lateral"><span class="logo" ${fondoFoto(local.logo_url)}>${local.logo_url ? "" : "PU"}</span>
      <div>${esc(local.nombre)}<small>Panel del local</small></div></div>` +
    NAVEGACION.map(([clave, href, ico, texto]) => clave === "qr"
      ? `<a href="${href}" class="boton-central ${nav.dataset.actual === clave ? "actual" : ""}" aria-label="${texto}">${icono(ico)}<span class="texto-qr">${texto}</span></a>`
      : `<a href="${href}" class="${nav.dataset.actual === clave ? "actual" : ""}">${icono(ico)}${texto}${clave === "pedidos" ? `<span class="contador" id="nuevos-nav" hidden>0</span>` : ""}</a>`)
      .join("");
  const { count } = await db.from("pedidos").select("id", { count: "exact", head: true })
    .eq("local_id", local.id).eq("estado", "nuevo");
  const contador = document.getElementById("nuevos-nav");
  contador.textContent = count || 0;
  contador.hidden = !count;
}

async function cambiarEstado(id, estado) {
  const { data, error } = await db.from("pedidos").update({ estado }).eq("id", id).select("id");
  if (error) return mostrarError(error), false;
  if (!data.length) return alert("No se encontró ese pedido en tu local."), false;
  return true;
}

// Minutos que faltan para la hora de recogida y el color que le toca.
function cuentaRegresiva(p) {
  if (p.estado === "listo") return { nivel: "listo", corto: "Esperando", largo: "Listo · esperando al alumno" };
  const m = Math.round((new Date(p.hora_recogida) - Date.now()) / 60000);
  const nivel = m <= 10 ? "urgente" : m <= 20 ? "pronto" : "";
  if (m < 0) return { nivel, corto: `hace ${-m} min`, largo: `Se pasó la hora por ${-m} min` };
  if (m === 0) return { nivel, corto: "ahora", largo: "Recoge ahora" };
  return { nivel, corto: `en ${m} min`, largo: `Recoge en ${m} min` };
}

function notasDe(p) {
  return [p.instrucciones, ...p.pedido_productos.filter((x) => x.nota).map((x) => `${x.nombre}: ${x.nota}`)]
    .filter(Boolean);
}

const inicioDeHoy = () => new Date(Date.now() - ahoraEnTamaulipas().minutos * 60000).toISOString();

function tarjetaPedido(p) {
  const cuenta = cuentaRegresiva(p);
  const notas = notasDe(p);
  const botones = p.estado === "nuevo"
    ? `<button class="boton boton-secundario boton-chico" data-pedido="${p.id}" data-estado="rechazado">Rechazar</button>
       <button class="boton boton-primario boton-chico" data-pedido="${p.id}" data-estado="aceptado">Aceptar</button>`
    : `<button class="boton boton-primario boton-chico" data-pedido="${p.id}" data-estado="${ESTADOS_PEDIDO[p.estado].siguientes[0]}">${ACCIONES[ESTADOS_PEDIDO[p.estado].siguientes[0]]}</button>`;
  return `<li class="tarjeta pedido">
    <a class="cabeza" href="detalle-pedido.html?pedido=${p.id}">
      <div><strong>#${p.id}</strong><span class="texto-suave">${esc(p.alumnos?.nombre)}</span></div>
      <span class="cuenta ${cuenta.nivel}"><b>${cuenta.corto}</b>Recoge ${hora(p.hora_recogida)}</span>
    </a>
    <ul class="productos-pedido">${p.pedido_productos.map((x) => `<li>${x.cantidad}× ${esc(x.nombre)}</li>`).join("")}</ul>
    ${notas.length ? `<p class="nota-pedido">${notas.map((n) => `“${esc(n)}”`).join("<br>")}</p>` : ""}
    <div class="pie-pedido"><span class="cobro">${dinero(p.total)} · Por cobrar</span><div class="botones">${botones}</div></div>
  </li>`;
}

async function pedidos(local) {
  const abierto = document.getElementById("abierto");
  const textoAbierto = document.getElementById("texto-abierto");
  const pintarAbierto = () => (textoAbierto.textContent = abierto.checked ? "Abierto" : "Cerrado");
  abierto.checked = local.abierto;
  pintarAbierto();
  abierto.addEventListener("change", async () => {
    pintarAbierto();
    const { error } = await db.from("locales").update({ abierto: abierto.checked }).eq("id", local.id);
    if (error) mostrarError(error);
  });

  document.querySelectorAll("[data-pestana]").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll("[data-pestana]").forEach((t) => t.classList.toggle("activa", t === tab));
      document.querySelectorAll("[data-columna]").forEach((c) => c.classList.toggle("activa", c.dataset.columna === tab.dataset.pestana));
    })
  );

  const VACIOS = {
    nuevo: ["Aún no tienes pedidos nuevos", "Cuando un alumno haga un pedido aparecerá aquí, ordenado por hora de recogida."],
    preparando: ["Nada en preparación", "Los pedidos que aceptes aparecerán aquí."],
    listo: ["Nada listo para recoger", "Cuando marques un pedido como listo, el alumno recibe el aviso."],
  };
  let ultimos = [];
  const pintarListas = () => {
    const grupos = {
      nuevo: ultimos.filter((p) => p.estado === "nuevo"),
      preparando: ultimos.filter((p) => p.estado === "aceptado" || p.estado === "preparando"),
      listo: ultimos.filter((p) => p.estado === "listo"),
    };
    for (const [clave, lista] of Object.entries(grupos)) {
      document.getElementById(`lista-${clave}`).innerHTML = lista.map(tarjetaPedido).join("") ||
        `<li class="tarjeta vacio"><strong>${VACIOS[clave][0]}</strong><span>${VACIOS[clave][1]}</span></li>`;
      document.querySelectorAll(`[data-contador="${clave}"]`).forEach((n) => (n.textContent = lista.length));
    }
  };
  const cargar = async () => {
    const { data, error } = await db.from("pedidos").select("*, alumnos(nombre), pedido_productos(*)")
      .eq("local_id", local.id).in("estado", ["nuevo", "aceptado", "preparando", "listo"]).order("hora_recogida");
    if (error) return mostrarError(error);
    ultimos = data;
    pintarListas();
    const { data: vendidos } = await db.from("pedidos").select("total")
      .eq("local_id", local.id).eq("estado", "entregado").gte("actualizado_en", inicioDeHoy());
    document.getElementById("ventas-hoy").textContent = dinero((vendidos || []).reduce((s, p) => s + Number(p.total), 0));
  };

  document.querySelector(".columnas").addEventListener("click", async (e) => {
    const boton = e.target.closest("[data-estado]");
    if (!boton) return;
    if (boton.dataset.estado === "rechazado" && !confirm(`¿Rechazar el pedido #${boton.dataset.pedido}?`)) return;
    boton.disabled = true;
    if (await cambiarEstado(boton.dataset.pedido, boton.dataset.estado)) await cargar();
    boton.disabled = false;
  });

  await cargar();
  setInterval(pintarListas, 30000); // la cuenta regresiva avanza sola
  // Los pedidos nuevos aparecen sin recargar la página.
  db.channel("pedidos-local")
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `local_id=eq.${local.id}` }, cargar)
    .subscribe();
}

async function detallePedido(local) {
  const { data: p, error } = await db.from("pedidos")
    .select("*, alumnos(nombre, matricula), pedido_productos(*)").eq("id", param("pedido")).eq("local_id", local.id).single();
  if (error) return mostrarError(error);

  document.getElementById("titulo-pedido").textContent = `Pedido #${p.id}`;
  document.getElementById("alumno-pedido").textContent =
    [p.alumnos?.nombre, p.alumnos?.matricula, "Pago al recoger"].filter(Boolean).join(" · ");
  const pintarTiempo = () => {
    const cuenta = cuentaRegresiva(p);
    document.getElementById("caja-tiempo").className = `cuenta-grande ${cuenta.nivel}`;
    document.getElementById("tiempo-restante").textContent = ["entregado", "rechazado", "no_recogido"].includes(p.estado)
      ? ESTADOS_PEDIDO[p.estado].texto : cuenta.largo;
  };
  pintarTiempo();
  setInterval(pintarTiempo, 30000);
  document.getElementById("hora-acordada").textContent = `Hora acordada: ${hora(p.hora_recogida)}`;
  document.getElementById("productos-pedido").innerHTML = p.pedido_productos
    .map((x) => `<li><span class="cant">${x.cantidad}×</span><span>${esc(x.nombre)}</span><span>${dinero(x.precio_unitario * x.cantidad)}</span></li>`)
    .join("");
  document.getElementById("total-pedido").textContent = dinero(p.total);
  const notas = notasDe(p);
  document.getElementById("instrucciones").hidden = !notas.length;
  document.getElementById("texto-instrucciones").innerHTML = notas.map(esc).join("<br>");
  document.getElementById("estado-pedido").textContent = ESTADOS_PEDIDO[p.estado].texto;

  const acciones = document.getElementById("acciones");
  acciones.innerHTML = ESTADOS_PEDIDO[p.estado].siguientes
    .map((s, i) => `<button class="boton ${i === 0 ? "boton-primario" : s === "rechazado" ? "boton-peligro" : "boton-secundario"}" data-estado="${s}">${ACCIONES_DETALLE[s]}</button>`)
    .join("");
  acciones.addEventListener("click", async (e) => {
    const estado = e.target.dataset.estado;
    if (!estado) return;
    if (estado === "rechazado" && !confirm("¿Rechazar este pedido?")) return;
    if (await cambiarEstado(p.id, estado)) location.href = "pedidos.html";
  });
}

// Lee el QR del alumno con la cámara ("PICKUP-123") o el folio escrito a mano.
function escaner(local) {
  const video = document.getElementById("camara");
  const aviso = document.getElementById("aviso-camara");
  const hoja = document.getElementById("hoja");
  const mensaje = document.getElementById("mensaje");
  const entregar = document.getElementById("entregar");
  let actual = null;
  let pausa = false;

  const avisar = (texto) => { aviso.textContent = texto; aviso.hidden = false; };
  const mostrarPedido = async (id) => {
    pausa = true;
    mensaje.hidden = true;
    const { data: p } = await db.from("pedidos").select("*, alumnos(nombre), pedido_productos(nombre, cantidad)")
      .eq("id", id).eq("local_id", local.id).maybeSingle();
    if (!p) {
      mensaje.textContent = `El pedido #${id} no es de tu local.`;
      mensaje.hidden = false;
      setTimeout(() => (pausa = false), 1500);
      return;
    }
    actual = p;
    document.getElementById("titulo-escaneado").textContent = `#${p.id} · ${p.alumnos?.nombre ?? ""}`;
    document.getElementById("productos-escaneado").textContent = p.pedido_productos.map((x) => `${x.cantidad}× ${x.nombre}`).join(", ");
    const estado = document.getElementById("estado-escaneado");
    estado.textContent = ESTADOS_PEDIDO[p.estado].texto;
    estado.className = `estado ${p.estado === "listo" ? "listo" : ""}`;
    entregar.disabled = p.estado !== "listo";
    entregar.textContent = p.estado === "listo" ? "Confirmar entrega"
      : p.estado === "entregado" ? "Ya se entregó" : "Márcalo como listo primero";
    hoja.hidden = false;
  };

  entregar.addEventListener("click", async () => {
    if (!actual || !(await cambiarEstado(actual.id, "entregado"))) return;
    hoja.hidden = true;
    mensaje.textContent = `Pedido #${actual.id} entregado.`;
    mensaje.hidden = false;
    actual = null;
    setTimeout(() => (pausa = false), 1500);
  });

  document.getElementById("mostrar-folio").addEventListener("click", () => {
    document.getElementById("campo-folio").hidden = false;
    document.getElementById("codigo").focus();
  });
  document.getElementById("form-folio").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("codigo").value.match(/\d+/)?.[0];
    if (id) mostrarPedido(id);
  });

  if (!navigator.mediaDevices?.getUserMedia || typeof jsQR === "undefined") {
    return avisar("Este navegador no puede usar la cámara. Escribe el folio del pedido.");
  }
  const lienzo = document.createElement("canvas");
  const contexto = lienzo.getContext("2d", { willReadFrequently: true });
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (stream) => {
    video.srcObject = stream;
    await video.play();
    const leer = () => {
      if (!pausa && video.readyState === video.HAVE_ENOUGH_DATA) {
        lienzo.width = video.videoWidth;
        lienzo.height = video.videoHeight;
        contexto.drawImage(video, 0, 0);
        const codigo = jsQR(contexto.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height);
        const id = codigo?.data.match(/^PICKUP-(\d+)$/)?.[1] || codigo?.data.match(/^\d+$/)?.[0];
        if (id) mostrarPedido(id);
      }
      requestAnimationFrame(leer);
    };
    leer();
  }).catch(() => avisar("No se pudo abrir la cámara. Da permiso o escribe el folio del pedido."));
}

async function miMenu(local) {
  const menu = document.getElementById("lista-menu");
  const { data: productos, error } = await db.from("productos").select("*").eq("local_id", local.id).order("nombre");
  if (error) return mostrarError(error);
  document.getElementById("cuenta-productos").textContent =
    `${productos.length} producto${productos.length === 1 ? "" : "s"} publicado${productos.length === 1 ? "" : "s"}`;

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();
  const chips = document.getElementById("categorias-menu");
  chips.innerHTML = productos.length
    ? [`<button class="chip activo" data-categoria="">Todos (${productos.length})</button>`,
       ...categorias.map((c) => `<button class="chip" data-categoria="${esc(c)}">${esc(c)}</button>`)].join("")
    : "";
  let categoria = null;
  const buscar = document.getElementById("buscar-menu");

  const pintar = () => {
    const texto = buscar.value.trim().toLowerCase();
    menu.innerHTML = productos
      .filter((p) => (!categoria || p.categoria === categoria) && (!texto || p.nombre.toLowerCase().includes(texto)))
      .map((p) => `<li class="${p.disponible ? "" : "agotado"}">
        <a class="foto miniatura-chica" href="agregar-producto.html?producto=${p.id}" ${fondoFoto(p.foto_url)}>${p.foto_url ? "" : icono("imagen")}</a>
        <a class="info" href="agregar-producto.html?producto=${p.id}"><strong>${esc(p.nombre)}</strong>
          <span class="${p.disponible ? "" : "agotado-texto"}">${dinero(p.precio)}${p.disponible ? "" : " · Agotado"}</span></a>
        <label class="interruptor" aria-label="Disponible"><input type="checkbox" data-producto="${p.id}" ${p.disponible ? "checked" : ""}></label></li>`)
      .join("") || (productos.length
        ? `<li class="vacio"><strong>Sin resultados</strong><span>Prueba con otro nombre.</span></li>`
        : `<li class="vacio"><strong>Tu menú está vacío</strong><span>Toca + para agregar tu primer producto con foto y precio.</span></li>`);
  };
  chips.addEventListener("click", (e) => {
    if (!e.target.matches("[data-categoria]")) return;
    chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("activo", c === e.target));
    categoria = e.target.dataset.categoria || null;
    pintar();
  });
  buscar.addEventListener("input", pintar);
  menu.addEventListener("change", async (e) => {
    const producto = productos.find((p) => String(p.id) === e.target.dataset.producto);
    const { error } = await db.from("productos").update({ disponible: e.target.checked }).eq("id", producto.id);
    if (error) return mostrarError(error);
    producto.disponible = e.target.checked;
    pintar();
  });
  pintar();
}

function vistaPrevia(etiqueta, archivo) {
  etiqueta.style.backgroundImage = `url('${URL.createObjectURL(archivo)}')`;
  etiqueta.classList.add("con-foto");
}

async function agregarProducto(local) {
  const form = document.getElementById("form-producto");
  const etiquetaFoto = document.getElementById("subir-foto");
  const id = param("producto");
  let producto = null;

  const { data: categorias } = await db.from("productos").select("categoria").eq("local_id", local.id);
  document.getElementById("categorias").innerHTML = [...new Set((categorias || []).map((c) => c.categoria).filter(Boolean))]
    .map((c) => `<option value="${esc(c)}">`).join("");

  if (id) {
    const { data, error } = await db.from("productos").select("*").eq("id", id).eq("local_id", local.id).single();
    if (error) return mostrarError(error);
    producto = data;
    document.getElementById("titulo-producto").textContent = "Editar producto";
    for (const campo of ["nombre", "precio", "categoria", "descripcion"]) form[campo].value = producto[campo] ?? "";
    form.disponible.checked = producto.disponible;
    if (producto.foto_url) {
      etiquetaFoto.style.backgroundImage = `url('${producto.foto_url}')`;
      etiquetaFoto.classList.add("con-foto");
    }
    form.querySelector("button").textContent = "Guardar cambios";
    const eliminar = document.getElementById("eliminar");
    eliminar.hidden = false;
    eliminar.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar "${producto.nombre}" de tu menú?`)) return;
      const { error } = await db.from("productos").delete().eq("id", producto.id);
      if (error) return mostrarError(error);
      location.href = "mi-menu.html";
    });
  }

  form.foto.addEventListener("change", () => form.foto.files[0] && vistaPrevia(etiquetaFoto, form.foto.files[0]));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = form.querySelector("button");
    boton.disabled = true;
    const { foto, ...datos } = Object.fromEntries(new FormData(form));
    const cambios = { ...datos, precio: Number(datos.precio), disponible: form.disponible.checked };
    if (form.foto.files[0]) {
      const url = await subirFoto(local.id, form.foto.files[0]);
      if (!url) return (boton.disabled = false);
      cambios.foto_url = url;
    }
    const { error } = producto
      ? await db.from("productos").update(cambios).eq("id", producto.id)
      : await db.from("productos").insert({ ...cambios, local_id: local.id });
    boton.disabled = false;
    if (error) return mostrarError(error);
    location.href = "mi-menu.html";
  });
}

async function ventas(local) {
  const { data, error } = await db.from("pedidos").select("*, alumnos(nombre), pedido_productos(*)")
    .eq("local_id", local.id).in("estado", ["entregado", "rechazado", "no_recogido"])
    .gte("actualizado_en", inicioDeHoy()).order("actualizado_en", { ascending: false });
  if (error) return mostrarError(error);
  const entregados = data.filter((p) => p.estado === "entregado");
  const total = entregados.reduce((s, p) => s + Number(p.total), 0);
  document.getElementById("vendido").textContent = dinero(total);
  document.getElementById("entregados").textContent = entregados.length;
  document.getElementById("promedio").textContent = dinero(entregados.length ? total / entregados.length : 0);
  document.getElementById("perdidos").textContent = data.length - entregados.length;

  const conteo = new Map();
  entregados.flatMap((p) => p.pedido_productos).forEach((x) => conteo.set(x.nombre, (conteo.get(x.nombre) || 0) + x.cantidad));
  document.getElementById("mas-vendidos").innerHTML = [...conteo].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nombre, n]) => `<li><span class="info"><strong>${esc(nombre)}</strong></span><span class="cifra">${n} vendidos</span></li>`)
    .join("") || `<li class="vacio"><span>Todavía no hay ventas hoy.</span></li>`;
  document.getElementById("lista-ventas").innerHTML = entregados
    .map((p) => `<li><a class="info" href="detalle-pedido.html?pedido=${p.id}"><strong>#${p.id} · ${esc(p.alumnos?.nombre)}</strong>
      <span>${hora(p.actualizado_en)}</span></a><span class="cifra">${dinero(p.total)}</span></li>`)
    .join("") || `<li class="vacio"><span>Los pedidos que entregues hoy aparecerán aquí.</span></li>`;
}

async function perfil(local) {
  const form = document.getElementById("form-perfil");
  const etiquetaLogo = document.getElementById("subir-logo");
  for (const campo of ["nombre", "encargado", "direccion"]) form[campo].value = local[campo] ?? "";
  form.ubicacion.value = local.ubicacion;
  const dias = new Set(local.horarios.map((h) => h.dia));
  const primero = local.horarios[0];
  form.abre.value = primero?.abre.slice(0, 5) || "08:00";
  form.cierra.value = primero?.cierra.slice(0, 5) || "18:00";
  document.getElementById("dias").innerHTML = DIAS
    .map((d, i) => `<label class="chip"><input type="checkbox" name="dia" value="${i}" ${dias.has(i) ? "checked" : ""}>${d}</label>`)
    .join("");
  if (local.logo_url) {
    etiquetaLogo.style.backgroundImage = `url('${local.logo_url}')`;
    etiquetaLogo.classList.add("con-foto");
  }
  form.logo.addEventListener("change", () => form.logo.files[0] && vistaPrevia(etiquetaLogo, form.logo.files[0]));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = new FormData(form);
    const elegidos = datos.getAll("dia").map(Number);
    if (!elegidos.length) return alert("Elige al menos un día de atención.");
    if (datos.get("cierra") <= datos.get("abre")) return alert("La hora de cierre debe ser después de la de apertura.");
    const boton = form.querySelector("button");
    boton.disabled = true;
    const cambios = { nombre: datos.get("nombre"), encargado: datos.get("encargado"),
      ubicacion: datos.get("ubicacion"), direccion: datos.get("direccion") };
    if (form.logo.files[0]) {
      const url = await subirFoto(local.id, form.logo.files[0]);
      if (url) cambios.logo_url = url;
    }
    const { error } = await db.from("locales").update(cambios).eq("id", local.id);
    if (error) return (boton.disabled = false), mostrarError(error);
    // El horario se reemplaza completo: mismos horarios para los días elegidos.
    const { error: errorBorrar } = await db.from("horarios").delete().eq("local_id", local.id);
    if (errorBorrar) return (boton.disabled = false), mostrarError(errorBorrar);
    const { error: errorHorarios } = await db.from("horarios").insert(elegidos.map((dia) =>
      ({ local_id: local.id, dia, abre: datos.get("abre"), cierra: datos.get("cierra") })));
    boton.disabled = false;
    if (errorHorarios) return mostrarError(errorHorarios);
    const mensaje = document.getElementById("mensaje");
    mensaje.textContent = "Listo, guardamos los cambios.";
    mensaje.hidden = false;
  });

  document.getElementById("salir").addEventListener("click", async (e) => {
    e.preventDefault();
    await db.auth.signOut();
    location.href = "../Acceso/bienvenida.html";
  });
}
