// Edge Function "locales-nuevos": avisa por correo cuando se registra un local y deja
// aceptarlo desde el enlace del correo.
//
// Recibe POST con JSON:
//   { accion: "avisar", local }        → lo manda la base al crearse un local (trigger con
//                                        pg_net). Manda el correo una sola vez por local.
//   { accion: "ver", local, firma }    → datos del local para PerfilAdmin/aprobar-local.html
//   { accion: "aprobar", local, firma } → acepta el local
//
// "firma" va en el enlace del correo: es un HMAC del id del local, así que solo quien tiene
// el correo puede ver y aceptar ese local, sin iniciar sesión.
//
// Secretos (Edge Functions → Secrets en el panel de Supabase):
//   CORREO_AVISOS     a quién le llega el aviso (puede ser una lista separada por comas)
//   GMAIL_USUARIO     el Gmail que manda el aviso
//   GMAIL_CONTRASENA  su contraseña de aplicación de Google (la misma del SMTP de Auth sirve)
//   SITIO             dirección del sitio (opcional; por omisión GitHub Pages)

import nodemailer from "npm:nodemailer@6.9.16";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const CLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITIO = (Deno.env.get("SITIO") ?? "https://jefth1.github.io/Pick-Up-UAT").replace(/\/$/, "");
// Tiempo para que el registro termine de guardar el horario y el logo antes de leerlos.
const ESPERA_MS = Number(Deno.env.get("ESPERA_MS") ?? 6000);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Horario = { dia: number; abre: string; cierra: string };
type Local = {
  id: number; nombre: string; encargado: string | null; ubicacion: "dentro" | "fuera";
  direccion: string | null; logo_url: string | null; lat: number | null; lng: number | null;
  aprobado: boolean; creado_en: string; correo: string | null; horarios: Horario[];
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Llama una función de la base con el rol service_role.
async function rpc<T>(funcion: string, local: number): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: "POST",
    headers: {
      apikey: CLAVE_SERVICIO,
      Authorization: `Bearer ${CLAVE_SERVICIO}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_local_id: local }),
  });
  if (!r.ok) throw new Error(`${funcion}: ${r.status} ${await r.text()}`);
  return await r.json() as T;
}

// --- Firma del enlace -------------------------------------------------------------------

async function firmar(local: number) {
  const secreto = Deno.env.get("APROBAR_SECRETO") ?? CLAVE_SERVICIO;
  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(`aprobar-local:${local}`)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function firmaValida(local: number, firma: unknown) {
  if (typeof firma !== "string" || firma.length > 100) return false;
  const esperada = await firmar(local);
  if (firma.length !== esperada.length) return false;
  let diferencia = 0;
  for (let i = 0; i < firma.length; i++) diferencia |= firma.charCodeAt(i) ^ esperada.charCodeAt(i);
  return diferencia === 0;
}

// --- Texto del correo -------------------------------------------------------------------

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function esc(texto: unknown) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// "Lun–Vie 8:00–18:00", igual que en la app (Compartido/js/supabase.js).
function textoHorario(horarios: Horario[]) {
  if (!horarios?.length) return "Sin horario";
  const corto = (t: string) => t.slice(0, 5).replace(/^0/, "");
  const grupos = new Map<string, number[]>();
  [...horarios].sort((a, b) => a.dia - b.dia).forEach((h) => {
    const clave = `${corto(h.abre)}–${corto(h.cierra)}`;
    grupos.set(clave, [...(grupos.get(clave) || []), h.dia]);
  });
  return [...grupos].map(([horas, dias]) => {
    const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
    const nombres = seguidos && dias.length > 2
      ? `${DIAS[dias[0]]}–${DIAS[dias.at(-1)!]}`
      : dias.map((d) => DIAS[d]).join(", ");
    return `${nombres} ${horas}`;
  }).join(" · ");
}

function fecha(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Monterrey", dateStyle: "long", timeStyle: "short",
  }).format(new Date(iso));
}

function renglones(local: Local) {
  return [
    ["Local", local.nombre],
    ["Encargado", local.encargado || "—"],
    ["Ubicación", local.ubicacion === "fuera" ? "Fuera de la UAT" : "Dentro de la UAT"],
    ["Dirección", local.direccion || "—"],
    ["Horario", textoHorario(local.horarios)],
    ["Correo del local", local.correo || "—"],
    ["Se registró", fecha(local.creado_en)],
  ];
}

function correoAviso(local: Local, enlace: string) {
  const filas = renglones(local);
  const asunto = `Nuevo local por aprobar: ${local.nombre}`;
  const texto = [
    "Se registró un local nuevo en Pick Up UAT y espera tu aprobación.", "",
    ...filas.map(([k, v]) => `${k}: ${v}`), "",
    `Revisar y aceptar: ${enlace}`, "",
    "Mientras no lo aceptes, los alumnos no lo ven ni le pueden pedir.",
  ].join("\n");
  const logo = local.logo_url
    ? `<img src="${esc(local.logo_url)}" alt="" width="64" height="64" style="border-radius:12px;object-fit:cover;display:block;margin:0 0 12px">`
    : "";
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1b2333">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:24px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#5b6475">Pick Up UAT</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#1B3A6B">Nuevo local por aprobar</h1>
${logo}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.4">
${filas.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6475;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`).join("\n")}
</table>
<p style="margin:24px 0 8px"><a href="${esc(enlace)}" style="display:inline-block;background:#1B3A6B;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Revisar y aceptar</a></p>
<p style="margin:16px 0 0;font-size:13px;color:#5b6475">Mientras no lo aceptes, los alumnos no lo ven ni le pueden pedir. Abrir el enlace no acepta nada: lo aceptas con el botón de la página.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { asunto, texto, html };
}

// --- Envío --------------------------------------------------------------------------------

async function enviar(para: string[], asunto: string, texto: string, html: string) {
  const usuario = Deno.env.get("GMAIL_USUARIO");
  const contrasena = Deno.env.get("GMAIL_CONTRASENA")?.replace(/\s/g, "");
  if (!usuario || !contrasena) throw new Error("Faltan los secretos GMAIL_USUARIO y GMAIL_CONTRASENA");
  const transporte = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
    port: Number(Deno.env.get("SMTP_PUERTO") ?? 465),
    secure: true,
    auth: { user: usuario, pass: contrasena },
  });
  await transporte.sendMail({ from: `"Pick Up UAT" <${usuario}>`, to: para.join(", "), subject: asunto, text: texto, html });
}

async function avisar(local: number) {
  const para = (Deno.env.get("CORREO_AVISOS") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  if (!para.length) {
    console.error("Falta el secreto CORREO_AVISOS: no se avisó del local", local);
    return;
  }
  await new Promise((listo) => setTimeout(listo, ESPERA_MS));
  const datos = await rpc<Local | null>("tomar_aviso_local", local);
  if (!datos) return; // ya se avisó, ya está aprobado o no existe
  const enlace = `${SITIO}/PerfilAdmin/aprobar-local.html?local=${local}&firma=${await firmar(local)}`;
  const { asunto, texto, html } = correoAviso(datos, enlace);
  try {
    await enviar(para, asunto, texto, html);
    console.log("Aviso enviado del local", local);
  } catch (error) {
    console.error("No se pudo mandar el aviso del local", local, error);
    await rpc("soltar_aviso_local", local);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Solo POST" }, 405);

  let cuerpo: { accion?: string; local?: unknown; firma?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "JSON inválido" }, 400);
  }
  const local = Number(cuerpo.local);
  if (!Number.isSafeInteger(local) || local <= 0) return responder({ error: "Local inválido" }, 400);

  try {
    if (cuerpo.accion === "avisar") {
      // Contesta de inmediato y manda el correo en segundo plano.
      const tarea = avisar(local).catch((error) => console.error("Aviso del local", local, error));
      // @ts-ignore EdgeRuntime existe en Supabase; en local se espera la tarea.
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tarea);
      else await tarea;
      return responder({ ok: true });
    }

    if (cuerpo.accion === "ver" || cuerpo.accion === "aprobar") {
      if (!(await firmaValida(local, cuerpo.firma))) return responder({ error: "Enlace no válido" }, 403);
      if (cuerpo.accion === "aprobar" && !(await rpc<boolean>("aprobar_local", local))) {
        return responder({ error: "Ese local ya no existe" }, 404);
      }
      const datos = await rpc<Local | null>("ver_local_para_aprobar", local);
      if (!datos) return responder({ error: "Ese local ya no existe" }, 404);
      return responder({ local: datos });
    }

    return responder({ error: "Acción desconocida" }, 400);
  } catch (error) {
    console.error(error);
    return responder({ error: "No se pudo completar, intenta otra vez" }, 500);
  }
});
