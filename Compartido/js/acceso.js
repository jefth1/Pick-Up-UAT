// Entrada: lista los perfiles de ejemplo y llena los datos del alumno.
document.addEventListener("DOMContentLoaded", () => {
  const alumnos = document.getElementById("ejemplo-alumnos");
  const locales = document.getElementById("ejemplo-locales");
  if (alumnos) {
    alumnos.innerHTML = DATOS_DEMO.alumnos
      .map((a) => `<li><a class="tarjeta perfil-ejemplo" href="alumno-datos-uat.html?alumno=${a.id}">
        <strong>${a.nombre}</strong><span class="texto-suave">Alumno · ${a.facultad}</span></a></li>`)
      .join("");
    locales.innerHTML = DATOS_DEMO.locales
      .map((l) => `<li><a class="tarjeta perfil-ejemplo" href="../PerfilLocal/pedidos.html?local=${l.id}">
        <strong>${l.nombre}</strong><span class="texto-suave">Local · ${l.ubicacion === "dentro" ? "Dentro" : "Fuera"} de la UAT</span></a></li>`)
      .join("");
  }

  const datos = document.getElementById("datos-alumno");
  if (datos) {
    const a = perfilActual("alumno");
    document.getElementById("saludo").textContent = `¡Hola, ${a.nombre.split(" ")[0]}!`;
    datos.innerHTML = [["Nombre", a.nombre], ["Matrícula", a.matricula], ["Correo", a.correo],
      ["Facultad", a.facultad], ["Carrera", a.carrera]]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    document.getElementById("continuar").href = `../PerfilAlumnos/explorar-locales.html?alumno=${a.id}`;
  }
});
