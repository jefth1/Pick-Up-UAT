// Entrada: registro e inicio de sesión de alumnos y locales.
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("form-registro-alumno")) registrarAlumno();
  if (document.getElementById("form-entrar-alumno")) entrarAlumno();
  if (document.getElementById("datos-alumno")) entradaAlumno();
  if (document.getElementById("form-entrar")) entrarLocal();
  if (document.getElementById("form-registro")) registrarLocal();
});

// Registro temporal de alumnos con correo y contraseña; se reemplazará por la API de la UAT.
// Los datos viajan en la cuenta y la fila de alumnos se crea al tener sesión.
function registrarAlumno() {
  const form = document.getElementById("form-registro-alumno");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { contrasena, ...alumno } = Object.fromEntries(new FormData(form));
    form.querySelector("button").disabled = true;
    const { data, error } = await db.auth.signUp({
      email: alumno.correo, password: contrasena,
      options: {
        data: { registro_alumno: alumno },
        emailRedirectTo: new URL("alumno-iniciar-sesion.html", location.href).href,
      },
    });
    form.querySelector("button").disabled = false;
    if (error) return mostrarError(error);
    if (data.session) {
      await crearPerfilPendiente();
      location.href = "alumno-datos-uat.html";
    } else {
      avisarConfirmacion(form);
    }
  });
}

function entrarAlumno() {
  iniciarSesion(document.getElementById("form-entrar-alumno"), "alumno-datos-uat.html");
}

async function entradaAlumno() {
  const alumno = await alumnoActual();
  if (!alumno) return (location.href = "alumno-iniciar-sesion.html");
  document.getElementById("saludo").textContent = `¡Hola, ${alumno.nombre.split(" ")[0]}!`;
  document.getElementById("aviso-datos").textContent = "Revisa que tus datos sean correctos.";
  const datos = document.getElementById("datos-alumno");
  datos.innerHTML = [["Nombre", alumno.nombre], ["Matrícula", alumno.matricula], ["Correo", alumno.correo],
    ["Facultad", alumno.facultad], ["Carrera", alumno.carrera]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || "—")}</dd></div>`).join("");
  datos.hidden = false;
  document.getElementById("continuar").hidden = false;
  document.getElementById("salir").addEventListener("click", async (e) => {
    e.preventDefault();
    await db.auth.signOut();
    location.href = "bienvenida.html";
  });
}

// Inicio de sesión con correo y contraseña, igual para alumnos y locales.
function iniciarSesion(form, destino) {
  const mensaje = document.getElementById("mensaje");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { correo, contrasena } = Object.fromEntries(new FormData(form));
    const { error } = await db.auth.signInWithPassword({ email: correo, password: contrasena });
    if (error) return mostrarError(error);
    await crearPerfilPendiente();
    location.href = destino;
  });

  document.getElementById("olvide").addEventListener("click", async (e) => {
    e.preventDefault();
    const correo = form.correo.value;
    if (!correo) return alert("Escribe tu correo primero.");
    const { error } = await db.auth.resetPasswordForEmail(correo, { redirectTo: location.href });
    if (error) return mostrarError(error);
    mensaje.textContent = "Te enviamos un correo para cambiar tu contraseña.";
    mensaje.hidden = false;
  });
}

function avisarConfirmacion(form) {
  form.hidden = true;
  const mensaje = document.getElementById("mensaje");
  mensaje.textContent = "Te enviamos un correo para confirmar tu cuenta. Después entra con tu correo y contraseña.";
  mensaje.hidden = false;
}

function entrarLocal() {
  iniciarSesion(document.getElementById("form-entrar"), "../PerfilLocal/pedidos.html");
}

// El registro guarda los datos del local en la cuenta; el local se crea al tener
// sesión (de inmediato, o al primer inicio de sesión si Supabase pide confirmar el correo).
async function registrarLocal() {
  const form = document.getElementById("form-registro");
  document.getElementById("dias").innerHTML = DIAS
    .map((d, i) => `<label class="chip"><input type="checkbox" name="dia" value="${i}" ${i >= 1 && i <= 5 ? "checked" : ""}>${d}</label>`)
    .join("");
  const logo = form.logo;
  logo.addEventListener("change", () => {
    document.getElementById("texto-logo").textContent = logo.files[0]?.name || "Subir logo del local";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = new FormData(form);
    const dias = datos.getAll("dia").map(Number);
    if (!dias.length) return alert("Elige al menos un día de atención.");
    if (datos.get("cierra") <= datos.get("abre")) return alert("La hora de cierre debe ser después de la de apertura.");

    const registro = {
      nombre: datos.get("nombre"), encargado: datos.get("encargado"),
      ubicacion: datos.get("ubicacion"), direccion: datos.get("direccion"),
      horarios: dias.map((dia) => ({ dia, abre: datos.get("abre"), cierra: datos.get("cierra") })),
    };
    form.querySelector("button").disabled = true;
    const { data, error } = await db.auth.signUp({
      email: datos.get("correo"), password: datos.get("contrasena"),
      options: {
        data: { registro_local: registro },
        emailRedirectTo: new URL("local-iniciar-sesion.html", location.href).href,
      },
    });
    form.querySelector("button").disabled = false;
    if (error) return mostrarError(error);

    if (data.session) {
      await crearPerfilPendiente();
      if (logo.files[0]) await guardarLogo(logo.files[0]);
      location.href = "../PerfilLocal/pedidos.html";
    } else {
      avisarConfirmacion(form);
    }
  });
}

// Crea la fila de alumno o de local con los datos que se guardaron al registrarse.
async function crearPerfilPendiente() {
  const usuario = await usuarioActual();
  const { registro_alumno: alumno, registro_local: registro } = usuario?.user_metadata || {};
  if (alumno && !(await alumnoActual())) {
    const { error } = await db.from("alumnos").insert(alumno);
    if (error) mostrarError(error);
  }
  if (registro && !(await localActual())) {
    const { horarios, ...local } = registro;
    const { data, error } = await db.from("locales").insert(local).select("id").single();
    if (error) return mostrarError(error);
    const { error: errorHorarios } = await db.from("horarios")
      .insert(horarios.map((h) => ({ ...h, local_id: data.id })));
    if (errorHorarios) mostrarError(errorHorarios);
  }
}

async function guardarLogo(archivo) {
  const local = await localActual();
  if (!local) return;
  const url = await subirFoto(local.id, archivo);
  if (!url) return;
  const { error } = await db.from("locales").update({ logo_url: url }).eq("id", local.id);
  if (error) mostrarError(error);
}
