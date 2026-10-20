// Lógica del perfil de locales: ver pedidos y aceptarlos o rechazarlos.
document.addEventListener("DOMContentLoaded", () => {
  const local = perfilActual("local");
  // Conserva el local elegido al navegar entre pantallas.
  document.querySelectorAll(".barra-inferior a, .encabezado a").forEach((a) => (a.search = `?local=${local.id}`));

  const lista = document.getElementById("lista-pedidos");
  if (lista) {
    document.querySelector(".encabezado h1").textContent = local.nombre;
    const pintar = (estado) => {
      lista.innerHTML = DATOS_DEMO.pedidos
        .filter((p) => p.localId === local.id && p.estado === estado)
        .map((p) => `<li><a class="tarjeta perfil-ejemplo" href="detalle-pedido.html?local=${local.id}&pedido=${p.id}">
          <strong>Pedido #${p.id} · ${p.alumno}</strong><span class="estado">Recoge ${p.horaRecogida}</span></a></li>`)
        .join("") || `<li class="texto-suave">Sin pedidos</li>`;
    };
    document.querySelectorAll("[data-estado]").forEach((tab) =>
      tab.addEventListener("click", () => {
        document.querySelectorAll("[data-estado]").forEach((t) => t.classList.remove("activa"));
        tab.classList.add("activa");
        pintar(tab.dataset.estado);
      })
    );
    pintar("nuevo");
  }

  const titulo = document.getElementById("titulo-pedido");
  if (titulo) {
    const id = Number(new URLSearchParams(location.search).get("pedido"));
    const p = DATOS_DEMO.pedidos.find((x) => x.id === id) || DATOS_DEMO.pedidos[0];
    titulo.textContent = `Pedido #${p.id} · ${p.alumno}`;
    document.getElementById("tiempo-restante").textContent = `Recoge ${p.horaRecogida}`;
    document.getElementById("productos-pedido").innerHTML = p.productos
      .map((x) => `<li class="tarjeta">${x.cantidad} × ${DATOS_DEMO.productos.find((d) => d.id === x.productoId).nombre}</li>`)
      .join("");
    document.getElementById("instrucciones").textContent = `Instrucciones: ${p.instrucciones}`;
  }

  const menu = document.getElementById("lista-menu");
  if (menu) {
    menu.innerHTML = DATOS_DEMO.productos
      .filter((p) => p.localId === local.id)
      .map((p) => `<li class="tarjeta fila-producto"><span><strong>${p.nombre}</strong><br>$${p.precio}</span>
        <label class="interruptor"><input type="checkbox" ${p.disponible ? "checked" : ""}> Disponible</label></li>`)
      .join("");
  }
});
