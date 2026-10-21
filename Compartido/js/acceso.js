// Entrada: datos del alumno, inicio de sesión y registro del local.
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("datos-alumno")) entradaAlumno();
  if (document.getElementById("form-entrar")) entrarLocal();
  if (document.getElementById("form-registro")) registrarLocal();
});

// Mientras no haya inicio de sesión UAT, el alumno usa una sesión anónima de
// Supabase que queda guardada en su navegador.
async function entradaAlumno() {
  const usuario = await usuarioActual();
  if (!usuario?.is_anonymous) {
    if (usuario) await db.auth.signOut();
    const { error } = await db.auth.signInAnonymously();
    if (error) {
      document.getElementById("aviso-datos").textContent =
        "No se pudo entrar. Revisa que los inicios de sesión anónimos estén activos en Supabase.";
      return mostrarError(error);
    }
  }

  const alumno = await alumnoActual();
  const aviso = document.getElementById("aviso-datos");
  if (alumno) {
    document.getElementById("saludo").textContent = `¡Hola, ${alumno.nombre.split(" ")[0]}!`;
    aviso.textContent = "Revisa que tus datos sean correctos.";
    const datos = document.getElementById("datos-alumno");
    datos.innerHTML = [["Nombre", alumno.nombre], ["Matrícula", alumno.matricula], ["Correo", alumno.correo],
      ["Facultad", alumno.facultad], ["Carrera", alumno.carrera]]
      .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || "—")}</dd>`).join("");
    datos.hidden = false;
    document.getElementById("continuar").hidden = false;
    return;
  }

  aviso.textContent = "Mientras conectamos la cuenta UAT, llena tus datos una sola vez.";
  const form = document.getElementById("form-alumno");
  form.hidden = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    const { error } = await db.from("alumnos").insert(datos);
    if (error) return mostrarError(error);
    location.href = "../PerfilAlumnos/explorar-locales.html";
  });
}

async function entrarLocal() {
  const form = document.getElementById("form-entrar");
  const mensaje = document.getElementById("mensaje");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { correo, contrasena } = Object.fromEntries(new FormData(form));
    const { error } = await db.auth.signInWithPassword({ email: correo, password: contrasena });
    if (error) return mostrarError(error);
    await crearLocalPendiente();
    location.href = "../PerfilLocal/pedidos.html";
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

// El registro guarda los datos del local en la cuenta; el local se crea al tener
// sesión (de inmediato, o al primer inicio de sesión si Supabase pide confirmar el correo).
async function registrarLocal() {
  const form = document.getElementById("form-registro");
  document.getElementById("dias").innerHTML = DIAS
    .map((d, i) => `<label class="chip"><input type="checkbox" name="dia" value="${i}" ${i >= 1 && i <= 5 ? "checked" : ""}>${d}</label>`)
    .join("");

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
      await crearLocalPendiente();
      location.href = "../PerfilLocal/pedidos.html";
    } else {
      form.hidden = true;
      const mensaje = document.getElementById("mensaje");
      mensaje.textContent = "Te enviamos un correo para confirmar tu cuenta. Después entra con tu correo y contraseña.";
      mensaje.hidden = false;
    }
  });
}

async function crearLocalPendiente() {
  if (await localActual()) return;
  const usuario = await usuarioActual();
  const registro = usuario?.user_metadata?.registro_local;
  if (!registro) return;
  const { horarios, ...local } = registro;
  const { data, error } = await db.from("locales").insert(local).select("id").single();
  if (error) return mostrarError(error);
  const { error: errorHorarios } = await db.from("horarios")
    .insert(horarios.map((h) => ({ ...h, local_id: data.id })));
  if (errorHorarios) mostrarError(errorHorarios);
}
