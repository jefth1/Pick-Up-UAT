// Apartado de favores: el alumno que reparte ve los favores libres, toma uno, va al
// local (paga el pedido en efectivo), lo lleva al punto y cobra todo al entregarlo.
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("lista-favores")) inicio();
  if (document.getElementById("pasos-favor")) miFavor();
  if (document.getElementById("historial")) historial();
});

const EN_CURSO = ["asignado", "recogido"];
const cobro = (f) => Number(f.pedidos.total) + Number(f.tarifa);
const km = (m) => `${(m / 1000).toFixed(1)} km`;
const fecha = (f) => new Date(f).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: ZONA });

// Indicaciones a pie en Google Maps hasta unas coordenadas.
function comoLlegar(lugar) {
  if (lugar?.lat == null) return "";
  return `<a class="boton boton-secundario boton-chico" target="_blank" rel="noopener"
    href="https://www.google.com/maps/dir/?api=1&destination=${lugar.lat},${lugar.lng}&travelmode=walking">${icono("ubicacion")}Cómo llegar</a>`;
}

async function alumnoOSalir() {
  const alumno = await alumnoActual();
  if (!alumno) location.href = "../Acceso/alumno-iniciar-sesion.html";
  return alumno;
}

// Favores que el alumno ya tomó: dan las ganancias, el conteo y el favor en curso.
async function misFavores(alumno) {
  const { data, error } = await db.from("favores")
    .select("id, estado, tarifa, actualizado_en, puntos_entrega(nombre), pedidos(total, locales(nombre))")
    .eq("repartidor_id", alumno.id).order("actualizado_en", { ascending: false });
  if (error) return mostrarError(error), [];
  return data;
}

async function inicio() {
  const alumno = await alumnoOSalir();
  if (!alumno) return;
  const lista = document.getElementById("lista-favores");
  const activos = await favoresActivos();
  const disponible = document.getElementById("disponible");
  disponible.checked = alumno.disponible_favores;
  document.getElementById("caja-disponible").hidden = !activos;
  disponible.addEventListener("change", async () => {
    const { error } = await db.from("alumnos").update({ disponible_favores: disponible.checked }).eq("id", alumno.id);
    if (error) return (disponible.checked = !disponible.checked), mostrarError(error);
    alumno.disponible_favores = disponible.checked;
    cargar();
  });

  const cargar = async () => {
    const mios = await misFavores(alumno);
    const entregados = mios.filter((f) => f.estado === "entregado");
    document.getElementById("ganancias").textContent = dinero(entregados.reduce((s, f) => s + Number(f.tarifa), 0));
    document.getElementById("hechos").textContent = entregados.length;

    const actual = mios.find((f) => EN_CURSO.includes(f.estado));
    const enCurso = document.getElementById("en-curso");
    enCurso.hidden = !actual;
    if (actual) {
      enCurso.href = `favor.html?favor=${actual.id}`;
      enCurso.innerHTML = `<div><span class="etiqueta">Favor en curso</span>
        <strong>${esc(actual.pedidos.locales.nombre)} → ${esc(actual.puntos_entrega.nombre)}</strong>
        <span class="texto-suave">${actual.estado === "recogido" ? "Llévalo al punto y cobra" : "Pasa al local por el pedido"}</span></div>
        <span class="estado listo">Ver</span>`;
    }

    if (!activos) {
      lista.innerHTML = `<li class="tarjeta vacio"><strong>Todavía no hay favores</strong><span>Pronto podrás hacer favores desde aquí.</span></li>`;
      return;
    }
    if (!alumno.disponible_favores) {
      lista.innerHTML = `<li class="tarjeta vacio"><strong>Activa “Disponible para favores”</strong>
        <span>Así verás los pedidos que alguien quiere que le lleven.</span></li>`;
      return;
    }
    const { data: libres, error } = await db.from("favores")
      .select("id, tarifa, distancia_m, puntos_entrega(nombre), pedidos(total, hora_recogida, locales(nombre, direccion))")
      .eq("estado", "buscando").neq("cliente_id", alumno.id).order("creado_en");
    if (error) return mostrarError(error);
    lista.innerHTML = libres.map((f) => `<li class="tarjeta favor-libre">
        <div class="ruta">
          <span>${icono("tienda")}<b>${esc(f.pedidos.locales.nombre)}</b>${f.pedidos.locales.direccion ? ` · ${esc(f.pedidos.locales.direccion)}` : ""}</span>
          <span>${icono("ubicacion")}<b>${esc(f.puntos_entrega.nombre)}</b> · ${km(f.distancia_m)}</span>
          <span class="texto-suave">${icono("reloj")}Listo a las ${hora(f.pedidos.hora_recogida)}</span>
        </div>
        <div class="cifras">
          <span>Adelantas <b>${dinero(f.pedidos.total)}</b></span>
          <span>Te pagan <b>${dinero(cobro(f))}</b></span>
        </div>
        <button class="boton boton-primario" data-tomar="${f.id}" ${actual ? "disabled" : ""}>Tomar · ganas ${dinero(f.tarifa)}</button>
      </li>`).join("")
      || `<li class="tarjeta vacio"><strong>No hay favores por ahora</strong><span>Cuando alguien pida que le lleven su pedido aparecerá aquí.</span></li>`;
  };

  lista.addEventListener("click", async (e) => {
    const id = e.target.dataset.tomar;
    if (!id) return;
    e.target.disabled = true;
    const { error } = await db.rpc("tomar_favor", { p_favor_id: Number(id) });
    if (error) return (e.target.disabled = false), mostrarError(error), cargar();
    location.href = `favor.html?favor=${id}`;
  });
  await cargar();
  db.channel("favores").on("postgres_changes", { event: "*", schema: "public", table: "favores" }, cargar).subscribe();
}

function pintarQr(destino, id) {
  if (typeof qrcode === "undefined") return (destino.textContent = `#${id}`);
  const qr = qrcode(0, "M");
  qr.addData(`PICKUP-${id}`);
  qr.make();
  destino.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
}

async function miFavor() {
  const alumno = await alumnoOSalir();
  if (!alumno) return;
  const pasos = document.getElementById("pasos-favor");
  const cargar = async () => {
    const { data: f, error } = await db.from("favores")
      .select("*, puntos_entrega(nombre, lat, lng), pedidos(id, total, hora_recogida, locales(nombre, direccion, lat, lng)), cliente:alumnos!favores_cliente_id_fkey(nombre)")
      .eq("id", param("favor")).eq("repartidor_id", alumno.id).maybeSingle();
    if (error) return mostrarError(error);
    if (!f) return (location.href = "inicio.html");
    const local = f.pedidos.locales;
    document.getElementById("resumen-favor").textContent =
      `${local.nombre} → ${f.puntos_entrega.nombre} · ganas ${dinero(f.tarifa)}`;

    if (f.estado === "entregado" || f.estado === "cancelado") {
      pasos.innerHTML = f.estado === "entregado"
        ? `<li class="tarjeta paso hecho final"><span class="icono-exito">${icono("check")}</span>
            <strong>¡Favor entregado!</strong><span>Ganaste ${dinero(f.tarifa)}.</span>
            <a class="boton boton-primario" href="inicio.html">Ver más favores</a></li>`
        : `<li class="tarjeta paso final"><strong>Este favor se canceló</strong>
            <span class="texto-suave">El local rechazó el pedido o el alumno lo recogió.</span>
            <a class="boton boton-secundario" href="inicio.html">Volver</a></li>`;
      return;
    }
    const recogido = f.estado === "recogido";
    pasos.innerHTML = `
      <li class="tarjeta paso ${recogido ? "hecho" : "actual"}">
        <span class="numero">${recogido ? icono("check") : "1"}</span>
        <div class="cuerpo">
          <strong>Ve al local</strong>
          <span>${esc(local.nombre)}${local.direccion ? ` · ${esc(local.direccion)}` : ""}</span>
          <span class="texto-suave">Listo a las ${hora(f.pedidos.hora_recogida)} · Pedido #${f.pedidos.id}</span>
          <div class="fila-cifra"><span>Pagas en el local</span><b>${dinero(f.pedidos.total)}</b></div>
          ${recogido ? "" : `${comoLlegar(local)}
            <p class="texto-suave">Muestra este código en el local:</p>
            <div class="qr"><div id="codigo-pedido"></div></div>`}
        </div>
      </li>
      <li class="tarjeta paso ${recogido ? "actual" : ""}">
        <span class="numero">2</span>
        <div class="cuerpo">
          <strong>Llévalo a ${esc(f.puntos_entrega.nombre)}</strong>
          <span>Entrégalo a ${esc(f.cliente?.nombre)}</span>
          ${f.referencia ? `<span class="texto-suave">“${esc(f.referencia)}”</span>` : ""}
          <div class="fila-cifra"><span>Te paga en efectivo</span><b>${dinero(cobro(f))}</b></div>
          ${recogido ? `${comoLlegar(f.puntos_entrega)}
            <form class="formulario" id="form-entregar">
              <label class="campo-grupo">Código que te da al pagarte
                <input class="campo" name="codigo" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label>
              <button class="boton boton-primario">Lo entregué</button>
            </form>`
          : `<span class="texto-suave">Cuando el local te entregue el pedido, aquí escribes el código del alumno.</span>`}
        </div>
      </li>`;
    if (!recogido) pintarQr(document.getElementById("codigo-pedido"), f.pedidos.id);
    document.getElementById("form-entregar")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const boton = e.target.querySelector("button");
      boton.disabled = true;
      const { error } = await db.rpc("confirmar_entrega", { p_favor_id: f.id, p_codigo: e.target.codigo.value });
      boton.disabled = false;
      if (error) return mostrarError(error);
      cargar();
    });
  };
  await cargar();
  // Avanza solo cuando el local marca el pedido como entregado.
  db.channel("mi-favor")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "favores", filter: `id=eq.${param("favor")}` }, cargar)
    .subscribe();
}

async function historial() {
  const alumno = await alumnoOSalir();
  if (!alumno) return;
  const entregados = (await misFavores(alumno)).filter((f) => f.estado === "entregado");
  const total = entregados.reduce((s, f) => s + Number(f.tarifa), 0);
  document.getElementById("total-historial").textContent = entregados.length
    ? `${entregados.length} ${entregados.length === 1 ? "favor" : "favores"} · ganaste ${dinero(total)}`
    : "Favores que ya entregaste.";
  document.getElementById("historial").innerHTML = entregados.map((f) => `<li class="tarjeta fila-historial">
      <div><strong>${esc(f.pedidos.locales.nombre)} → ${esc(f.puntos_entrega.nombre)}</strong>
        <span class="texto-suave">${fecha(f.actualizado_en)}</span></div>
      <span class="ganado">+${dinero(f.tarifa)}</span></li>`).join("")
    || `<li class="tarjeta vacio"><strong>Todavía no haces favores</strong>
      <span>Cuando entregues uno aparecerá aquí con lo que ganaste.</span>
      <a class="boton boton-secundario" href="inicio.html">Ver favores</a></li>`;
}
