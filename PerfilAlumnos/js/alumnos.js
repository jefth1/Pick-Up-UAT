// Lógica del perfil de alumnos: explorar locales y armar el pedido.
document.addEventListener("DOMContentLoaded", () => {
  const alumno = perfilActual("alumno");
  const params = new URLSearchParams(location.search);
  document.querySelectorAll(".barra-inferior a").forEach((a) => (a.search = `?alumno=${alumno.id}`));

  const lista = document.getElementById("lista-locales");
  if (lista) {
    const pintar = (filtro) => {
      lista.innerHTML = DATOS_DEMO.locales
        .filter((l) => filtro === "todos" || l.ubicacion === filtro)
        .map((l) => `<li><a class="tarjeta perfil-ejemplo" href="menu-local.html?alumno=${alumno.id}&local=${l.id}">
          <strong>${l.nombre}</strong><span class="texto-suave">${l.horario}</span></a></li>`)
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
  }

  const menu = document.getElementById("menu-local");
  if (menu) {
    const local = perfilActual("local");
    document.getElementById("nombre-local").textContent = local.nombre;
    document.getElementById("horario-local").textContent = local.horario;
    menu.innerHTML = DATOS_DEMO.productos
      .filter((p) => p.localId === local.id)
      .map((p) => p.disponible
        ? `<li><a class="tarjeta perfil-ejemplo" href="producto.html?alumno=${alumno.id}&producto=${p.id}">
            <strong>${p.nombre}</strong><span class="precio">$${p.precio}</span></a></li>`
        : `<li class="tarjeta perfil-ejemplo agotado"><strong>${p.nombre}</strong><span>Agotado</span></li>`)
      .join("");
  }

  const nombreProducto = document.getElementById("nombre-producto");
  if (nombreProducto) {
    const p = DATOS_DEMO.productos.find((x) => x.id === Number(params.get("producto"))) || DATOS_DEMO.productos[0];
    nombreProducto.textContent = p.nombre;
    document.getElementById("precio-producto").textContent = `$${p.precio}`;
  }

  const horarios = document.getElementById("horarios");
  if (horarios) {
    horarios.innerHTML = ["12:30", "12:45", "13:00", "13:15"]
      .map((h, i) => `<button class="chip ${i === 0 ? "activo" : ""}">${h}</button>`).join("");
  }
});
