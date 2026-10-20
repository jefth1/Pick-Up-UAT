// Lógica del perfil de locales: ver pedidos y aceptarlos o rechazarlos.
document.addEventListener("DOMContentLoaded", () => {
  const lista = document.getElementById("lista-pedidos");
  if (!lista) return;

  const pintar = (estado) => {
    lista.innerHTML = DATOS_DEMO.pedidos
      .filter((p) => p.estado === estado)
      .map((p) => `<li class="tarjeta"><a href="detalle-pedido.html?pedido=${p.id}">Pedido #${p.id}</a>
        <span class="estado">Recoge ${p.horaRecogida}</span></li>`)
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
});
