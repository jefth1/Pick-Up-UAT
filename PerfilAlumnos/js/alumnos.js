// Lógica del perfil de alumnos: explorar locales y armar el pedido.
document.addEventListener("DOMContentLoaded", () => {
  const lista = document.getElementById("lista-locales");
  if (!lista) return;

  const pintar = (filtro) => {
    lista.innerHTML = DATOS_DEMO.locales
      .filter((l) => filtro === "todos" || l.ubicacion === filtro)
      .map((l) => `<li class="tarjeta"><a href="menu-local.html?local=${l.id}">${l.nombre}</a>
        <p class="texto-suave">${l.horario}</p></li>`)
      .join("");
  };

  document.querySelectorAll("[data-filtro]").forEach((chip) =>
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-filtro]").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      pintar(chip.dataset.filtro);
    })
  );
  pintar("todos");
});
