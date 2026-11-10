// Conexión a Supabase y utilidades que usan los dos perfiles.
// La anon key es pública por diseño: lo que cada quien puede ver o cambiar lo
// deciden las políticas RLS de supabase/migrations/.
const SUPABASE_URL = "https://gdexcnbivhxqkfryoygf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZXhjbmJpdmh4cWtmcnlveWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MjEzNTQsImV4cCI6MjEwODE5NzM1NH0.XoKfFhX0-Qq-rTkFeiRjMYbamcPPn5bN_9HM3gNmXmc";

// Lo que trae la URL al llegar desde un enlace del correo (verificar la cuenta o cambiar
// la contraseña). Se lee antes de crear el cliente porque él la borra al tomar la sesión.
const LLEGADA = new URLSearchParams(location.hash.slice(1));

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ZONA = "America/Monterrey";

// Solo se muestran fotos del bucket "fotos" de este proyecto (la base tampoco acepta otras
// direcciones): así nadie puede meter estilos con comillas ni cargar imágenes de otro sitio.
const CARPETA_FOTOS = `${SUPABASE_URL}/storage/v1/object/public/fotos/`;
function fotoSegura(url) {
  return typeof url === "string" && url.startsWith(CARPETA_FOTOS) && /^[\w.\/:-]+$/.test(url) ? url : null;
}

// Escapa texto de la base antes de meterlo en innerHTML.
function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function dinero(n) {
  return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function hora(fecha) {
  return new Date(fecha).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hourCycle: "h23", timeZone: ZONA });
}

function param(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}

// Errores de Supabase Auth en español (por su código); los de la base ya vienen en español.
const ERRORES_CUENTA = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Primero verifica tu correo con el código que te enviamos.",
  user_already_exists: "Ya hay una cuenta con este correo. Inicia sesión.",
  email_exists: "Ya hay una cuenta con este correo. Inicia sesión.",
  weak_password: "La contraseña debe tener al menos 8 caracteres, con letras y números.",
  same_password: "La contraseña nueva debe ser distinta a la anterior.",
  otp_expired: "El código no es correcto o ya venció. Revisa el último correo o pide otro código.",
  over_request_rate_limit: "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
  email_address_invalid: "Ese correo no es válido.",
  validation_failed: "Revisa que el correo esté bien escrito.",
  email_address_not_authorized: "Por ahora no podemos enviar correos a esa dirección. Avísale al administrador de Pick Up UAT.",
  signup_disabled: "El registro está cerrado por ahora.",
  session_not_found: "Tu sesión terminó. Vuelve a iniciar sesión.",
  refresh_token_not_found: "Tu sesión terminó. Vuelve a iniciar sesión.",
};

function mensajeError(error) {
  if (error?.code === "over_email_send_rate_limit") {
    const segundos = /(\d+) seconds?/.exec(error.message)?.[1];
    return segundos
      ? `Espera ${segundos} segundos para pedir otro correo.`
      : "Ya enviamos varios correos en poco tiempo. Espera unos minutos y vuelve a intentarlo.";
  }
  if (ERRORES_CUENTA[error?.code]) return ERRORES_CUENTA[error.code];
  if (/error sending .*email/i.test(error?.message)) {
    return "No pudimos enviarte el correo. Intenta de nuevo en unos minutos.";
  }
  if (error?.status >= 500) return "Algo falló en el servidor. Intenta de nuevo en unos minutos.";
  if (error?.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(error?.message)) {
    return "No hay conexión. Revisa tu internet y vuelve a intentarlo.";
  }
  return error?.message || String(error);
}

function mostrarError(error) {
  console.error(error);
  alert(mensajeError(error));
}

// "Lun–Vie 8:00–18:00" a partir de las filas de horarios.
function textoHorario(horarios) {
  if (!horarios?.length) return "Sin horario";
  const corto = (t) => t.slice(0, 5).replace(/^0/, "");
  const grupos = new Map();
  [...horarios].sort((a, b) => a.dia - b.dia).forEach((h) => {
    const clave = `${corto(h.abre)}–${corto(h.cierra)}`;
    grupos.set(clave, [...(grupos.get(clave) || []), h.dia]);
  });
  return [...grupos].map(([horas, dias]) => {
    const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
    const nombres = seguidos && dias.length > 2
      ? `${DIAS[dias[0]]}–${DIAS[dias.at(-1)]}`
      : dias.map((d) => DIAS[d]).join(", ");
    return `${nombres} ${horas}`;
  }).join(" · ");
}

// Hora y día de la semana actuales en Tamaulipas, sin depender de la zona del teléfono.
function ahoraEnTamaulipas() {
  const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.weekday);
  return { dia, minutos: Number(partes.hour) * 60 + Number(partes.minute) };
}

// Sube una imagen a fotos/<local_id>/ y regresa su URL pública (o null si falla).
// Las fotos grandes del celular se achican antes: el bucket acepta hasta 5 MB.
async function subirFoto(localId, archivo, { avisar = true } = {}) {
  try {
    archivo = await achicarFoto(archivo);
    const extension = { "image/png": "png", "image/webp": "webp" }[archivo.type] || "jpg";
    const ruta = `${localId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await db.storage.from("fotos").upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw error;
    return db.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
  } catch (error) {
    if (avisar) mostrarError(error);
    else console.warn("No se pudo subir la foto", error);
    return null;
  }
}

// Deja la foto en máximo 1200 px por lado si pesa más de 1 MB. Si algo falla, usa la original.
async function achicarFoto(archivo, lado = 1200) {
  if (archivo.size <= 1024 * 1024) return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
    const lienzo = Object.assign(document.createElement("canvas"), {
      width: Math.round(imagen.width * escala), height: Math.round(imagen.height * escala),
    });
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#fff"; // los PNG transparentes quedan sobre blanco
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise((listo) => lienzo.toBlob(listo, "image/jpeg", 0.85));
    return blob && blob.size < archivo.size ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : archivo;
  } catch {
    return archivo;
  }
}

// Fondo de imagen para las fotos de productos y logos; sin foto se ve el icono.
function fondoFoto(url) {
  const segura = fotoSegura(url);
  return segura ? `style="background-image:url('${segura}')"` : "";
}

async function usuarioActual() {
  const { data } = await db.auth.getSession();
  return data.session?.user ?? null;
}

async function alumnoActual() {
  const usuario = await usuarioActual();
  if (!usuario) return null;
  const { data } = await db.from("alumnos").select("*").eq("id", usuario.id).maybeSingle();
  return data;
}

async function localActual() {
  const usuario = await usuarioActual();
  if (!usuario || usuario.is_anonymous) return null;
  const { data } = await db.from("locales").select("*, horarios(*)").eq("propietario", usuario.id).maybeSingle();
  return data;
}

// Favores (un alumno le lleva el pedido a otro): apagados hasta que exista el pago con
// tarjeta. Se encienden con ajustes.favores_activos en Supabase.
async function favoresActivos() {
  const { data } = await db.from("ajustes").select("favores_activos").maybeSingle();
  return !!data?.favores_activos;
}
