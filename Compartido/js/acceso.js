// Entrada: registro, verificación del correo e inicio de sesión de alumnos y locales.
// Con «Confirm email» activo en Supabase, una cuenta nueva no tiene sesión hasta que
// escribe el código que le llega al correo (o abre el enlace de ese mismo correo).
document.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector(".bienvenida")) bienvenida();
  if (document.getElementById("form-registro-alumno")) registrarAlumno();
  if (document.getElementById("form-entrar-alumno")) entrarAlumno();
  if (document.getElementById("form-verificar")) verificarCorreo();
  if (document.getElementById("form-nueva-contrasena")) nuevaContrasena();
  if (document.getElementById("datos-alumno")) entradaAlumno();
  if (document.getElementById("form-entrar")) entrarLocal();
  if (document.getElementById("form-registro")) registrarLocal();
});

// Dominios aceptados mientras la base no tenga ajustes.dominios_alumnos.
const DOMINIOS_ALUMNOS = ["alumnos.uat.edu.mx"];
const ENTRAR = { alumno: "alumno-iniciar-sesion.html", local: "local-iniciar-sesion.html" };
const REGISTRO = { alumno: "alumno-registro.html", local: "local-registro.html" };
const ESPERA_CORREO = 60; // segundos que Supabase pide entre un correo y otro

const aqui = (pagina) => new URL(pagina, location.href).href;
const perfilDeLaPagina = () => (param("perfil") === "local" ? "local" : "alumno");
const paginaVerificar = (perfil, correo, reenviar) =>
  `verificar-correo.html?${new URLSearchParams({ perfil, ...(correo && { correo }), ...(reenviar && { reenviar: 1 }) })}`;

// Mensaje bajo el formulario: verde si salió bien, rojo si hay que corregir algo.
function avisar(texto, tipo = "ok", enlace) {
  const mensaje = document.getElementById("mensaje");
  mensaje.textContent = texto;
  if (enlace) {
    const a = document.createElement("a");
    [a.href, a.textContent] = enlace;
    mensaje.append(" ", a);
  }
  mensaje.classList.toggle("error", tipo === "error");
  mensaje.hidden = !texto;
}

// Desactiva el botón mientras se espera la respuesta de Supabase.
async function esperando(boton, tarea) {
  boton.disabled = true;
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
  }
}

// Si este celular ya tiene la sesión guardada, entra directo a su apartado.
async function bienvenida() {
  const usuario = await usuarioActual();
  if (usuario && !usuario.is_anonymous) await continuar({ primeraVez: false });
}

// Con sesión: crea el perfil que quedó pendiente al registrarse y entra al apartado de la
// cuenta. Si la cuenta no tiene perfil, regresa el motivo para mostrarlo.
async function continuar({ primeraVez = true } = {}) {
  const problema = await crearPerfilPendiente();
  if (await localActual()) return void location.replace("../PerfilLocal/pedidos.html");
  if (await alumnoActual()) {
    return void location.replace(primeraVez ? "alumno-datos-uat.html" : "../PerfilAlumnos/explorar-locales.html");
  }
  return problema || "Esta cuenta todavía no tiene perfil de alumno ni de local.";
}

async function dominiosAlumnos() {
  const { data, error } = await db.from("ajustes").select("dominios_alumnos").maybeSingle();
  return !error && Array.isArray(data?.dominios_alumnos) ? data.dominios_alumnos : DOMINIOS_ALUMNOS;
}

// Las dos contraseñas del registro deben coincidir. Regresa el aviso, o nada si están bien.
function revisarContrasenas(form) {
  const { contrasena, confirmar } = form;
  if (contrasena.value.length < 6) return contrasena.focus(), "La contraseña debe tener al menos 6 caracteres.";
  if (contrasena.value !== confirmar.value) return confirmar.focus(), "Las contraseñas no coinciden. Escríbelas otra vez.";
}

// Lista vacía = cualquier correo (para probar con uno personal).
const correoDeAlumno = (correo, dominios) => !dominios.length || dominios.includes(correo.split("@").pop());

// Registro temporal de alumnos con correo y contraseña; se reemplazará por la API de la UAT.
// Los datos viajan en la cuenta y la fila de alumnos se crea al tener sesión, es decir,
// en cuanto el alumno verifica su correo.
function registrarAlumno() {
  const form = document.getElementById("form-registro-alumno");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { contrasena, confirmar, ...alumno } = Object.fromEntries(new FormData(form));
    alumno.correo = alumno.correo.trim().toLowerCase();
    const aviso = revisarContrasenas(form);
    if (aviso) return avisar(aviso, "error");
    await esperando(form.querySelector("button"), async () => {
      const dominios = await dominiosAlumnos();
      if (!correoDeAlumno(alumno.correo, dominios)) {
        return avisar(`Usa tu correo institucional, el que termina en @${dominios[0]}.`, "error");
      }
      const { data, error } = await db.auth.signUp({
        email: alumno.correo, password: contrasena,
        options: {
          data: { registro_alumno: alumno },
          emailRedirectTo: aqui("verificar-correo.html?perfil=alumno"),
        },
      });
      if (error) return avisarErrorRegistro(error, "alumno");
      await despuesDeRegistrarse(data, "alumno", alumno.correo);
    });
  });
}

function avisarErrorRegistro(error, perfil) {
  if (["user_already_exists", "email_exists"].includes(error.code)) {
    return avisar("Ya hay una cuenta con este correo.", "error", [ENTRAR[perfil], "Inicia sesión"]);
  }
  avisar(mensajeError(error), "error");
}

// Sin «Confirm email» la cuenta nueva ya trae sesión; con él, falta verificar el correo.
async function despuesDeRegistrarse(data, perfil, correo) {
  if (data.session) {
    const problema = await continuar();
    if (problema) avisar(problema, "error");
    return;
  }
  // Supabase no avisa si el correo ya tenía cuenta: lo delata que llegue sin identidades.
  if (!data.user?.identities?.length) {
    return avisar("Ya hay una cuenta con este correo.", "error", [ENTRAR[perfil], "Inicia sesión"]);
  }
  location.href = paginaVerificar(perfil, correo);
}

// Verifica el correo con el código. El enlace del mismo correo también trae aquí, ya con
// la sesión creada por Supabase.
async function verificarCorreo() {
  const form = document.getElementById("form-verificar");
  const perfil = perfilDeLaPagina();
  const reenviar = document.getElementById("reenviar");
  document.getElementById("atras").href = REGISTRO[perfil];
  document.getElementById("ir-entrar").href = ENTRAR[perfil];
  let correo = (param("correo") || "").trim().toLowerCase();
  const verificando = document.getElementById("verificando");

  // Entra una sola vez aunque lo pidan el formulario y otra pestaña al mismo tiempo.
  let entrada = null;
  const entrar = () => (entrada ??= (async () => {
    form.hidden = true;
    verificando.hidden = false;
    const problema = await continuar();
    if (!problema) return true;
    verificando.hidden = true;
    form.hidden = false;
    avisar(problema, "error");
    entrada = null;
    return false;
  })());

  if (LLEGADA.has("access_token") && (await usuarioActual())) {
    // Tocó el botón del correo: Supabase ya verificó la cuenta y dejó la sesión en la URL.
    if (await entrar()) return;
  } else if (LLEGADA.get("error_code")) {
    // El enlace ya se usó (por ejemplo, lo tocó dos veces). Si este navegador ya tiene la
    // sesión de la primera vez, entra con ella.
    const usuario = await usuarioActual();
    const reciente = Date.now() - new Date(usuario?.email_confirmed_at ?? 0) < 30 * 60 * 1000;
    if (usuario && reciente && (!correo || usuario.email === correo) && (await entrar())) return;
    avisar("Ese enlace ya venció o ya se usó. Si ya verificaste tu correo, inicia sesión; si no, escribe el código o pide uno nuevo.", "error");
  }

  // Si verifica con el enlace en otra pestaña de este navegador, esta también entra.
  db.auth.onAuthStateChange((evento, sesion) => {
    if (evento === "SIGNED_IN" && correo && sesion?.user?.email === correo) setTimeout(entrar);
  });

  const pintarCorreo = () => {
    document.getElementById("correo-destino").textContent = correo || "tu correo";
    document.getElementById("grupo-correo").hidden = !!correo;
  };
  const leerCorreo = () => (correo = correo || form.correo.value.trim().toLowerCase());
  pintarCorreo();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!leerCorreo()) return avisar("Escribe el correo con el que te registraste.", "error");
    const token = form.codigo.value.replace(/\D/g, "");
    if (token.length < 6) return avisar("Escribe el código completo que te llegó al correo.", "error");
    await esperando(form.querySelector("button"), async () => {
      const { error } = await db.auth.verifyOtp({ email: correo, token, type: "email" });
      if (error) return avisar(mensajeError(error), "error");
      await entrar();
    });
  });

  reenviar.addEventListener("click", pedirCodigo);
  if (param("reenviar")) pedirCodigo(); // intentó entrar sin haber verificado
  else if (correo) cuentaRegresiva(reenviar); // el código acaba de salir al registrarse

  async function pedirCodigo() {
    if (!leerCorreo()) return avisar("Escribe el correo con el que te registraste.", "error");
    pintarCorreo();
    reenviar.disabled = true;
    const { error } = await db.auth.resend({
      type: "signup", email: correo,
      options: { emailRedirectTo: aqui(`verificar-correo.html?perfil=${perfil}`) },
    });
    if (error) {
      const espera = /(\d+) seconds?/.exec(error.message)?.[1];
      if (error.code === "over_email_send_rate_limit" && espera) cuentaRegresiva(reenviar, Number(espera));
      else reenviar.disabled = false;
      return avisar(mensajeError(error), "error");
    }
    avisar(`Te enviamos otro correo a ${correo}. Si no llega, quizá ya verificaste: inicia sesión.`);
    cuentaRegresiva(reenviar);
  }
}

function cuentaRegresiva(boton, segundos = ESPERA_CORREO) {
  boton.disabled = true;
  const paso = () => {
    if (segundos <= 0) {
      boton.disabled = false;
      boton.textContent = "Reenviar código";
      return;
    }
    boton.textContent = `Reenviar código en ${segundos--} s`;
    setTimeout(paso, 1000);
  };
  paso();
}

function entrarAlumno() {
  iniciarSesion(document.getElementById("form-entrar-alumno"), "alumno");
}

function entrarLocal() {
  iniciarSesion(document.getElementById("form-entrar"), "local");
}

// Inicio de sesión con correo y contraseña, igual para alumnos y locales.
async function iniciarSesion(form, perfil) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const correo = form.correo.value.trim().toLowerCase();
    await esperando(form.querySelector("button"), async () => {
      const { error } = await db.auth.signInWithPassword({ email: correo, password: form.contrasena.value });
      // Se registró pero no escribió el código: se le manda uno nuevo.
      if (error?.code === "email_not_confirmed") return void (location.href = paginaVerificar(perfil, correo, true));
      if (error) return avisar(mensajeError(error), "error");
      const problema = await continuar();
      if (problema) avisar(problema, "error");
    });
  });

  document.getElementById("olvide").addEventListener("click", async (e) => {
    e.preventDefault();
    const correo = form.correo.value.trim().toLowerCase();
    if (!correo) return avisar("Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?».", "error");
    const { error } = await db.auth.resetPasswordForEmail(correo, {
      redirectTo: aqui(`nueva-contrasena.html?perfil=${perfil}`),
    });
    if (error) return avisar(mensajeError(error), "error");
    avisar(`Si ${correo} tiene cuenta, te llegará un correo con un enlace para cambiar tu contraseña.`);
  });

  if (LLEGADA.get("error_code")) {
    return avisar("Ese enlace ya venció o ya se usó. Entra con tu correo y contraseña.", "error");
  }
  // Ya hay sesión guardada (o llegó del enlace de un correo): entra directo.
  const usuario = await usuarioActual();
  if (usuario && !usuario.is_anonymous) await continuar();
}

// Cambiar la contraseña: se llega desde el enlace del correo de «¿Olvidaste tu contraseña?».
async function nuevaContrasena() {
  const form = document.getElementById("form-nueva-contrasena");
  const perfil = perfilDeLaPagina();
  document.getElementById("atras").href = ENTRAR[perfil];
  document.getElementById("pedir-otro").href = ENTRAR[perfil];
  if (LLEGADA.get("error_code") || !(await usuarioActual())) {
    document.getElementById("sin-enlace").hidden = false;
    return;
  }
  form.hidden = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await esperando(form.querySelector("button"), async () => {
      const { error } = await db.auth.updateUser({ password: form.contrasena.value });
      if (error) return avisar(mensajeError(error), "error");
      const problema = await continuar();
      if (problema) avisar(problema, "error");
    });
  });
}

async function entradaAlumno() {
  const alumno = await alumnoActual();
  if (!alumno) return (location.href = "alumno-iniciar-sesion.html");
  // Verificado = Supabase le mandó el código y lo confirmó (sin «Confirm email» no se manda).
  const usuario = await usuarioActual();
  const verificado = !!(usuario?.email_confirmed_at && usuario?.confirmation_sent_at);
  document.getElementById("saludo").textContent = `¡Hola, ${alumno.nombre.split(" ")[0]}!`;
  document.getElementById("aviso-datos").textContent = "Revisa que tus datos sean correctos.";
  const datos = document.getElementById("datos-alumno");
  datos.innerHTML = [["Nombre", alumno.nombre], ["Matrícula", alumno.matricula], ["Correo", alumno.correo, verificado],
    ["Facultad", alumno.facultad], ["Carrera", alumno.carrera]]
    .map(([k, v, ok]) => `<div><dt>${k}</dt><dd>${esc(v || "—")}${ok ? ' <span class="estado listo">Verificado</span>' : ""}</dd></div>`)
    .join("");
  datos.hidden = false;
  document.getElementById("continuar").hidden = false;
  document.getElementById("salir").addEventListener("click", async (e) => {
    e.preventDefault();
    await db.auth.signOut();
    location.href = "bienvenida.html";
  });
}

// El registro guarda los datos del local en la cuenta; el local se crea al tener
// sesión (de inmediato, o al verificar el correo si Supabase lo pide).
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
    if (!dias.length) return avisar("Elige al menos un día de atención.", "error");
    if (datos.get("cierra") <= datos.get("abre")) return avisar("La hora de cierre debe ser después de la de apertura.", "error");
    const aviso = revisarContrasenas(form);
    if (aviso) return avisar(aviso, "error");

    const correo = datos.get("correo").trim().toLowerCase();
    const registro = {
      nombre: datos.get("nombre"), encargado: datos.get("encargado"),
      ubicacion: datos.get("ubicacion"), direccion: datos.get("direccion"),
      horarios: dias.map((dia) => ({ dia, abre: datos.get("abre"), cierra: datos.get("cierra") })),
    };
    await esperando(form.querySelector("button"), async () => {
      const { data, error } = await db.auth.signUp({
        email: correo, password: datos.get("contrasena"),
        options: {
          data: { registro_local: registro },
          emailRedirectTo: aqui("verificar-correo.html?perfil=local"),
        },
      });
      if (error) return avisarErrorRegistro(error, "local");
      const cuentaNueva = data.session || data.user?.identities?.length;
      if (cuentaNueva && logo.files[0]) await logoPendiente.guardar(correo, logo.files[0]);
      await despuesDeRegistrarse(data, "local", correo);
    });
  });
}

// Crea la fila de alumno o de local con los datos que se guardaron al registrarse.
// Si no se puede, regresa el motivo.
async function crearPerfilPendiente() {
  const usuario = await usuarioActual();
  const { registro_alumno: alumno, registro_local: registro } = usuario?.user_metadata || {};
  if (alumno && !(await alumnoActual()) && !(await localActual())) {
    const { error } = await db.from("alumnos").insert(alumno);
    if (error?.code === "23505") return; // otra pestaña ya lo creó
    if (error?.code === "42501") return "Para tener cuenta de alumno necesitas tu correo institucional (@alumnos.uat.edu.mx).";
    if (error) return mensajeError(error);
  }
  if (registro && !(await localActual()) && !(await alumnoActual())) {
    const { horarios, ...local } = registro;
    const { data, error } = await db.from("locales").insert(local).select("id").single();
    if (error?.code === "23505") return; // otra pestaña ya lo creó
    if (error) return mensajeError(error);
    const { error: errorHorarios } = await db.from("horarios")
      .insert(horarios.map((h) => ({ ...h, local_id: data.id })));
    if (errorHorarios) return mensajeError(errorHorarios);
    const archivo = await logoPendiente.sacar(usuario.email);
    if (archivo) await guardarLogo(data.id, archivo);
  }
}

// El logo es opcional: si no se puede subir, el local entra igual y lo sube después
// desde «Perfil». Nunca espera más de 20 segundos.
async function guardarLogo(localId, archivo) {
  const subir = async () => {
    const url = await subirFoto(localId, archivo, { avisar: false });
    if (url) await db.from("locales").update({ logo_url: url }).eq("id", localId);
  };
  const limite = new Promise((listo) => setTimeout(listo, 20000));
  try {
    await Promise.race([subir(), limite]);
  } catch (error) {
    console.warn("No se pudo subir el logo", error);
  }
}

// El logo que el local eligió al registrarse espera en este navegador (IndexedDB) hasta
// que tenga sesión, o sea, hasta que verifique su correo; entonces se sube.
const logoPendiente = {
  async usar(modo, accion) {
    try {
      const base = await new Promise((listo, falla) => {
        const apertura = indexedDB.open("pickup-uat", 1);
        apertura.onupgradeneeded = () => apertura.result.createObjectStore("logos");
        apertura.onsuccess = () => listo(apertura.result);
        apertura.onerror = () => falla(apertura.error);
      });
      return await new Promise((listo, falla) => {
        const tx = base.transaction("logos", modo);
        const pedido = accion(tx.objectStore("logos"));
        tx.oncomplete = () => listo(pedido.result);
        tx.onerror = () => falla(tx.error);
      });
    } catch (error) {
      console.warn("No se pudo guardar el logo en este navegador", error);
      return null;
    }
  },
  // Se guardan los bytes y no el archivo: en Android el archivo elegido de la galería
  // puede dejar de leerse cuando se abre otra pestaña.
  async guardar(correo, archivo) {
    try {
      const datos = await archivo.arrayBuffer();
      return this.usar("readwrite", (logos) => logos.put({ datos, tipo: archivo.type, nombre: archivo.name }, correo));
    } catch (error) {
      console.warn("No se pudo leer el logo", error);
    }
  },
  async sacar(correo) {
    if (!correo) return null;
    const guardado = await this.usar("readonly", (logos) => logos.get(correo));
    if (!guardado) return null;
    await this.usar("readwrite", (logos) => logos.delete(correo));
    if (guardado instanceof Blob) return guardado; // guardado por la versión anterior
    return new File([guardado.datos], guardado.nombre || "logo", { type: guardado.tipo });
  },
};
