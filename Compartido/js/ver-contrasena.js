// Botón de ojo en cada campo de contraseña: muestra lo que se escribió para
// revisarlo y corregirlo, y lo vuelve a ocultar. Necesita iconos.js antes.
function agregarVerContrasena(raiz = document) {
  // Con un iconos.js viejo (sin el ojo) no se pone nada, en vez de un botón vacío.
  if (typeof ICONOS === "undefined" || !ICONOS.ojo) return;
  raiz.querySelectorAll('input[type="password"]:not([data-con-ojo])').forEach((campo) => {
    campo.dataset.conOjo = "";
    const caja = document.createElement("span");
    caja.className = "campo-contrasena";
    campo.replaceWith(caja);
    caja.append(campo);

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "ver-contrasena";
    caja.append(boton);

    const pintar = () => {
      const visible = campo.type === "text";
      boton.innerHTML = icono(visible ? "ojo-tachado" : "ojo");
      boton.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
      boton.title = boton.getAttribute("aria-label");
      boton.setAttribute("aria-pressed", String(visible));
    };
    // Si el teclado está abierto, que siga abierto al tocar el ojo.
    boton.addEventListener("mousedown", (e) => e.preventDefault());
    boton.addEventListener("click", () => {
      campo.type = campo.type === "password" ? "text" : "password";
      pintar();
    });
    pintar();
  });
}

document.addEventListener("DOMContentLoaded", () => agregarVerContrasena());
