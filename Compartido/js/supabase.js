// Conexión a Supabase y utilidades que usan los dos perfiles.
// La anon key es pública por diseño: lo que cada quien puede ver o cambiar lo
// deciden las políticas RLS de supabase/migrations/.
const SUPABASE_URL = "https://gdexcnbivhxqkfryoygf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZXhjbmJpdmh4cWtmcnlveWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MjEzNTQsImV4cCI6MjEwODE5NzM1NH0.XoKfFhX0-Qq-rTkFeiRjMYbamcPPn5bN_9HM3gNmXmc";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ZONA = "America/Monterrey";

// Escapa texto de la base antes de meterlo en innerHTML.
function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function dinero(n) {
  return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function hora(fecha) {
  return new Date(fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
}

function param(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}

function mostrarError(error) {
  console.error(error);
  alert(error?.message || String(error));
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
