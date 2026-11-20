// Aceptar un local nuevo desde el enlace del correo de aviso
// (supabase/functions/locales-nuevos). El enlace trae el id del local y una firma; la
// función revisa la firma, así que no hace falta iniciar sesión.
// Abrir la página no acepta nada (Outlook abre solo los enlaces de los correos): se acepta
// con el botón.

const parametros = new URLSearchParams(location.search);
const LOCAL = parametros.get("local");
const FIRMA = parametros.get("firma");

async function llamar(accion) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/locales-nuevos`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accion, local: LOCAL, firma: FIRMA }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(cuerpo.error || "No se pudo cargar el local. Intenta otra vez.");
  return cuerpo.local;
}

function mostrarMensaje(texto, tipo = "") {
  const mensaje = document.getElementById("mensaje");
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`.trim();
  mensaje.hidden = false;
}

function pintar(local) {
  document.getElementById("cargando").hidden = true;
  document.getElementById("local").hidden = false;
  document.getElementById("nombre").textContent = local.nombre;
  const logo = fotoSegura(local.logo_url);
  if (logo) document.getElementById("logo").innerHTML = `<img src="${esc(logo)}" alt="">`;

  const estado = document.getElementById("estado");
  estado.textContent = local.aprobado ? "Aceptado" : "Esperando aprobación";
  estado.className = `estado ${local.aprobado ? "abierto" : "pronto"}`;

  const registrado = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, dateStyle: "long", timeStyle: "short" })
    .format(new Date(local.creado_en));
  const mapa = local.lat != null
    ? `<a href="https://www.google.com/maps?q=${Number(local.lat)},${Number(local.lng)}" target="_blank" rel="noopener">Ver en el mapa</a>`
    : "";
  const datos = [
    ["Encargado", esc(local.encargado || "—")],
    ["Ubicación", local.ubicacion === "fuera" ? "Fuera de la UAT" : "Dentro de la UAT"],
    ["Dirección", `${esc(local.direccion || "—")} ${mapa}`],
    ["Horario", esc(textoHorario(local.horarios))],
    ["Correo del local", esc(local.correo || "—")],
    ["Se registró", esc(registrado)],
  ];
  document.getElementById("datos").innerHTML = datos
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");

  const boton = document.getElementById("aprobar");
  boton.hidden = local.aprobado;
  if (local.aprobado) mostrarMensaje("Este local ya está aceptado: los alumnos ya lo ven y le pueden pedir.");
}

async function iniciar() {
  if (!LOCAL || !FIRMA) {
    document.getElementById("cargando").hidden = true;
    return mostrarMensaje("Este enlace está incompleto. Ábrelo desde el correo de aviso.", "error");
  }
  try {
    pintar(await llamar("ver"));
  } catch (error) {
    document.getElementById("cargando").hidden = true;
    mostrarMensaje(error.message, "error");
  }

  const boton = document.getElementById("aprobar");
  boton.addEventListener("click", async () => {
    boton.disabled = true;
    boton.textContent = "Aceptando…";
    try {
      pintar(await llamar("aprobar"));
    } catch (error) {
      mostrarMensaje(error.message, "error");
      boton.disabled = false;
      boton.textContent = "Aceptar local";
    }
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
