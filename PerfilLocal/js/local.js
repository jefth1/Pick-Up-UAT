// Lógica del perfil de locales: ver pedidos, aceptarlos o rechazarlos y avanzar su estado.
const ACCIONES = {
  aceptado: "Aceptar", rechazado: "Rechazar", preparando: "Empezar a preparar",
  listo: "Marcar listo", entregado: "Entregado", no_recogido: "No lo recogieron",
};

document.addEventListener("DOMContentLoaded", async () => {
  const local = await localActual();
  if (!local) return (location.href = "../Acceso/local-iniciar-sesion.html");

  if (document.getElementById("lista-pedidos")) pedidos(local);
  if (document.getElementById("titulo-pedido")) detallePedido();
  if (document.getElementById("entregar")) entregar();
  if (document.getElementById("lista-menu")) miMenu(local);
  if (document.getElementById("form-producto")) agregarProducto(local);
});

async function cambiarEstado(id, estado) {
  const { data, error } = await db.from("pedidos").update({ estado }).eq("id", id).select("id");
  if (error) return mostrarError(error), false;
  if (!data.length) return alert("No se encontró ese pedido en tu local."), false;
  return true;
}

async function pedidos(local) {
  document.querySelector(".encabezado h1").textContent = local.nombre;
  const abierto = document.getElementById("abierto");
  abierto.checked = local.abierto;
  abierto.addEventListener("change", async () => {
    const { error } = await db.from("locales").update({ abierto: abierto.checked }).eq("id", local.id);
    if (error) mostrarError(error);
  });

  const lista = document.getElementById("lista-pedidos");
  let estados = ["nuevo"];
  const pintar = async () => {
    const { data, error } = await db.from("pedidos").select("*, alumnos(nombre)")
      .eq("local_id", local.id).in("estado", estados).order("hora_recogida");
    if (error) return mostrarError(error);
    lista.innerHTML = data
      .map((p) => `<li><a class="tarjeta tarjeta-enlace" href="detalle-pedido.html?pedido=${p.id}">
        <strong>Pedido #${p.id} · ${esc(p.alumnos?.nombre)}</strong>
        <span class="estado">Recoge ${hora(p.hora_recogida)} · ${dinero(p.total)}</span></a></li>`)
      .join("") || `<li class="texto-suave">Sin pedidos</li>`;
  };
  document.querySelectorAll("[data-estado]").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll("[data-estado]").forEach((t) => t.classList.remove("activa"));
      tab.classList.add("activa");
      estados = tab.dataset.estado.split(",");
      pintar();
    })
  );
  await pintar();
  // Los pedidos nuevos aparecen sin recargar la página.
  db.channel("pedidos-local")
    .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `local_id=eq.${local.id}` }, pintar)
    .subscribe();
}

async function detallePedido() {
  const id = param("pedido");
  const { data: p, error } = await db.from("pedidos")
    .select("*, alumnos(nombre, matricula), pedido_productos(*)").eq("id", id).single();
  if (error) return mostrarError(error);

  document.getElementById("titulo-pedido").textContent = `Pedido #${p.id} · ${p.alumnos?.nombre ?? ""}`;
  document.getElementById("tiempo-restante").textContent = `Recoge ${hora(p.hora_recogida)}`;
  document.getElementById("productos-pedido").innerHTML = p.pedido_productos
    .map((x) => `<li class="tarjeta">${x.cantidad} × ${esc(x.nombre)}${x.nota ? `<br><span class="texto-suave">${esc(x.nota)}</span>` : ""}</li>`)
    .join("");
  const instrucciones = document.getElementById("instrucciones");
  instrucciones.textContent = p.instrucciones ? `Instrucciones: ${p.instrucciones}` : "";
  instrucciones.hidden = !p.instrucciones;
  document.getElementById("total-pedido").textContent = `Total ${dinero(p.total)}`;
  document.getElementById("estado-pedido").textContent = ESTADOS_PEDIDO[p.estado].texto;

  const acciones = document.getElementById("acciones");
  acciones.innerHTML = ESTADOS_PEDIDO[p.estado].siguientes
    .map((s, i) => `<button class="boton ${i === 0 ? "boton-primario" : "boton-secundario"}" data-estado="${s}">${ACCIONES[s]}</button>`)
    .join("");
  acciones.addEventListener("click", async (e) => {
    const estado = e.target.dataset.estado;
    if (!estado) return;
    if (estado === "rechazado" && !confirm("¿Rechazar este pedido?")) return;
    if (await cambiarEstado(p.id, estado)) location.href = "pedidos.html";
  });
}

function entregar() {
  const mensaje = document.getElementById("mensaje");
  document.getElementById("entregar").addEventListener("click", async () => {
    const codigo = document.getElementById("codigo").value.trim();
    if (!codigo) return;
    if (await cambiarEstado(codigo, "entregado")) {
      mensaje.textContent = `Pedido #${codigo} entregado.`;
      mensaje.hidden = false;
      document.getElementById("codigo").value = "";
    }
  });
}

async function miMenu(local) {
  document.getElementById("datos-local").textContent =
    `${local.nombre} · ${local.ubicacion === "dentro" ? "Dentro" : "Fuera"} de la UAT · ${textoHorario(local.horarios)}`;
  document.getElementById("salir").addEventListener("click", async (e) => {
    e.preventDefault();
    await db.auth.signOut();
    location.href = "../Acceso/bienvenida.html";
  });

  const menu = document.getElementById("lista-menu");
  const { data, error } = await db.from("productos").select("*").eq("local_id", local.id).order("nombre");
  if (error) return mostrarError(error);
  menu.innerHTML = data
    .map((p) => `<li class="tarjeta fila-producto"><span><strong>${esc(p.nombre)}</strong><br>${dinero(p.precio)}</span>
      <label class="interruptor"><input type="checkbox" data-producto="${p.id}" ${p.disponible ? "checked" : ""}> Disponible</label></li>`)
    .join("") || `<li class="texto-suave">Agrega tu primer producto.</li>`;
  menu.addEventListener("change", async (e) => {
    const { error } = await db.from("productos")
      .update({ disponible: e.target.checked }).eq("id", e.target.dataset.producto);
    if (error) mostrarError(error);
  });
}

function agregarProducto(local) {
  const form = document.getElementById("form-producto");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    const { error } = await db.from("productos").insert({
      ...datos, local_id: local.id, precio: Number(datos.precio), disponible: form.disponible.checked,
    });
    if (error) return mostrarError(error);
    location.href = "mi-menu.html";
  });
}
