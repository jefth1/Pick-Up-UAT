// Lógica del perfil de alumnos: explorar locales, armar el pedido y seguir su estado.
// El carrito vive en el navegador hasta que se envía el pedido.
const carrito = {
  leer: () => JSON.parse(localStorage.getItem("carrito") || "null") || { localId: null, items: [] },
  guardar: (c) => localStorage.setItem("carrito", JSON.stringify(c)),
  vaciar: () => localStorage.removeItem("carrito"),
};

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("lista-locales")) explorarLocales();
  if (document.getElementById("menu-local")) menuLocal();
  if (document.getElementById("nombre-producto")) producto();
  if (document.getElementById("carrito")) verCarrito();
  if (document.getElementById("enviar-pedido")) pago();
  if (document.getElementById("mis-pedidos")) misPedidos();
});

function abiertoAhora(local) {
  const { dia, minutos } = ahoraEnTamaulipas();
  const aMinutos = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return local.abierto && local.horarios.some((h) =>
    h.dia === dia && minutos >= aMinutos(h.abre) && minutos <= aMinutos(h.cierra));
}

async function explorarLocales() {
  const lista = document.getElementById("lista-locales");
  const { data: locales, error } = await db.from("locales").select("*, horarios(*)").order("nombre");
  if (error) return mostrarError(error);

  const pintar = (filtro) => {
    lista.innerHTML = locales
      .filter((l) => filtro === "todos" || l.ubicacion === filtro)
      .map((l) => `<li><a class="tarjeta perfil-ejemplo" href="menu-local.html?local=${l.id}">
        <strong>${esc(l.nombre)}</strong><span class="texto-suave">${esc(textoHorario(l.horarios))}</span>
        <span class="estado ${abiertoAhora(l) ? "listo" : ""}">${abiertoAhora(l) ? "Abierto" : "Cerrado"}</span></a></li>`)
      .join("") || `<li class="texto-suave">Todavía no hay locales registrados.</li>`;
  };
  document.querySelectorAll("[data-filtro]").forEach((chip) =>
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-filtro]").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      pintar(chip.dataset.filtro);
    })
  );
  pintar("todos");
}

async function menuLocal() {
  const { data: local, error } = await db.from("locales")
    .select("*, horarios(*), productos(*)").eq("id", param("local")).single();
  if (error) return mostrarError(error);
  document.getElementById("nombre-local").textContent = local.nombre;
  document.getElementById("horario-local").textContent =
    `${textoHorario(local.horarios)}${abiertoAhora(local) ? "" : " · Cerrado ahora"}`;
  document.getElementById("menu-local").innerHTML = local.productos
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((p) => p.disponible
      ? `<li><a class="tarjeta perfil-ejemplo" href="producto.html?producto=${p.id}">
          <strong>${esc(p.nombre)}</strong><span class="precio">${dinero(p.precio)}</span></a></li>`
      : `<li class="tarjeta perfil-ejemplo agotado"><strong>${esc(p.nombre)}</strong><span>Agotado</span></li>`)
    .join("") || `<li class="texto-suave">Este local todavía no sube su menú.</li>`;
}

async function producto() {
  const { data: p, error } = await db.from("productos").select("*").eq("id", param("producto")).single();
  if (error) return mostrarError(error);
  document.getElementById("nombre-producto").textContent = p.nombre;
  document.getElementById("precio-producto").textContent = dinero(p.precio);
  document.getElementById("descripcion-producto").textContent = p.descripcion || "";

  document.getElementById("agregar").addEventListener("click", () => {
    let c = carrito.leer();
    if (c.localId && c.localId !== p.local_id) {
      if (!confirm("Tu carrito tiene productos de otro local. ¿Empezar un carrito nuevo?")) return;
      c = { localId: null, items: [] };
    }
    const cantidad = Math.min(20, Math.max(1, Number(document.getElementById("cantidad").value) || 1));
    c.localId = p.local_id;
    c.items.push({ productoId: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad,
      nota: document.getElementById("nota").value.trim() });
    carrito.guardar(c);
    location.href = "carrito.html";
  });
}

// Horas de recogida cada 15 minutos, desde 15 minutos a partir de ahora hasta el
// cierre del local hoy.
function horasDisponibles(local) {
  const { dia, minutos } = ahoraEnTamaulipas();
  const hoy = local.horarios.find((h) => h.dia === dia);
  if (!local.abierto || !hoy) return [];
  const aMinutos = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const desde = Math.max(aMinutos(hoy.abre), Math.ceil((minutos + 15) / 15) * 15);
  const horas = [];
  for (let m = desde; m <= aMinutos(hoy.cierra); m += 15) horas.push(m);
  return horas.map((m) => {
    const fecha = new Date(Date.now() + (m - minutos) * 60000);
    fecha.setSeconds(0, 0);
    return { texto: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`, fecha: fecha.toISOString() };
  });
}

async function verCarrito() {
  const c = carrito.leer();
  const lista = document.getElementById("carrito");
  const boton = document.getElementById("continuar-pago");
  const pintar = () => {
    lista.innerHTML = c.items.map((x, i) => `<li class="tarjeta fila-carrito">
      <span>${x.cantidad} × ${esc(x.nombre)}${x.nota ? `<br><span class="texto-suave">${esc(x.nota)}</span>` : ""}</span>
      <span>${dinero(x.precio * x.cantidad)} <button class="quitar" data-quitar="${i}">Quitar</button></span></li>`)
      .join("") || `<li class="texto-suave">Tu carrito está vacío.</li>`;
    document.getElementById("total-carrito").textContent =
      dinero(c.items.reduce((s, x) => s + x.precio * x.cantidad, 0));
  };
  lista.addEventListener("click", (e) => {
    if (!e.target.dataset.quitar) return;
    c.items.splice(Number(e.target.dataset.quitar), 1);
    if (!c.items.length) c.localId = null;
    carrito.guardar(c);
    pintar();
  });
  pintar();
  if (!c.localId) return boton.hidden = true;

  const { data: local, error } = await db.from("locales").select("*, horarios(*)").eq("id", c.localId).single();
  if (error) return mostrarError(error);
  document.getElementById("local-carrito").textContent = local.nombre;
  const horas = horasDisponibles(local);
  const contenedor = document.getElementById("horarios");
  if (!horas.length) {
    contenedor.innerHTML = `<p class="texto-suave">El local ya no recibe pedidos hoy.</p>`;
    return boton.hidden = true;
  }
  c.hora = horas.find((h) => h.fecha === c.hora?.fecha) || horas[0];
  carrito.guardar(c);
  contenedor.innerHTML = horas.map((h, i) =>
    `<button class="chip ${h.fecha === c.hora.fecha ? "activo" : ""}" data-hora="${i}">${h.texto}</button>`).join("");
  contenedor.addEventListener("click", (e) => {
    const i = e.target.dataset.hora;
    if (i === undefined) return;
    contenedor.querySelectorAll(".chip").forEach((b) => b.classList.remove("activo"));
    e.target.classList.add("activo");
    c.hora = horas[i];
    carrito.guardar(c);
  });
}

async function exigirAlumno() {
  const alumno = await alumnoActual();
  if (!alumno) location.href = "../Acceso/alumno-datos-uat.html";
  return alumno;
}

async function pago() {
  const c = carrito.leer();
  if (!c.items.length || !c.hora) return (location.href = "carrito.html");
  if (!(await exigirAlumno())) return;
  document.getElementById("total-pago").textContent = dinero(c.items.reduce((s, x) => s + x.precio * x.cantidad, 0));
  document.getElementById("hora-pago").textContent = c.hora.texto;

  const boton = document.getElementById("enviar-pedido");
  boton.addEventListener("click", async () => {
    boton.disabled = true;
    const { data: id, error } = await db.rpc("crear_pedido", {
      p_local_id: c.localId,
      p_hora_recogida: c.hora.fecha,
      p_productos: c.items.map((x) => ({ producto_id: x.productoId, cantidad: x.cantidad, nota: x.nota })),
    });
    boton.disabled = false;
    if (error) return mostrarError(error);
    carrito.vaciar();
    location.href = `confirmacion.html?pedido=${id}`;
  });
}

async function misPedidos() {
  const alumno = await exigirAlumno();
  if (!alumno) return;
  const lista = document.getElementById("mis-pedidos");
  const cargar = async () => {
    const { data: pedidos, error } = await db.from("pedidos")
      .select("*, locales(nombre)").order("creado_en", { ascending: false }).limit(20);
    if (error) return mostrarError(error);

    const actual = pedidos.find((p) => String(p.id) === param("pedido"));
    if (actual) {
      document.getElementById("pedido-actual").hidden = false;
      document.getElementById("codigo-pedido").textContent = actual.id;
      document.getElementById("numero-pedido").textContent = `#${actual.id}`;
      document.getElementById("local-pedido").textContent = actual.locales.nombre;
      document.getElementById("hora-recogida").textContent = hora(actual.hora_recogida);
      const estado = document.getElementById("estado-pedido");
      estado.textContent = actual.estado === "nuevo" ? "Esperando al local" : ESTADOS_PEDIDO[actual.estado].texto;
      estado.className = `estado ${actual.estado === "listo" ? "listo" : actual.estado === "rechazado" ? "urgente" : ""}`;
    }
    lista.innerHTML = pedidos.map((p) => `<li class="tarjeta perfil-ejemplo">
      <strong>#${p.id} · ${esc(p.locales.nombre)}</strong>
      <span class="texto-suave">Recoge ${hora(p.hora_recogida)} · ${dinero(p.total)}</span>
      <span class="estado ${p.estado === "listo" ? "listo" : ""}">${ESTADOS_PEDIDO[p.estado].texto}</span></li>`)
      .join("") || `<li class="texto-suave">Todavía no haces pedidos.</li>`;
  };
  await cargar();
  // Se actualiza solo cuando el local cambia el estado.
  db.channel("mis-pedidos")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `alumno_id=eq.${alumno.id}` }, cargar)
    .subscribe();
}
