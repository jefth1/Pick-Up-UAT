// Service worker de Pick Up UAT: guarda las páginas, estilos, scripts e íconos del
// propio sitio para que la app abra rápido y se pueda instalar. Nunca toca las
// peticiones a otros dominios (Supabase, CDN, fuentes): esas siempre van a la red,
// así los pedidos, menús y sesiones nunca salen de una copia vieja.
// Al cambiar archivos del sitio, sube la versión para descartar la caché anterior.
const VERSION = "pickup-v1";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSION).then((cache) => cache.add("Acceso/bienvenida.html")).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Primero la red (para ver siempre la versión publicada); la caché solo sin conexión.
  evento.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copia));
        }
        return respuesta;
      })
      .catch(async () => {
        const guardada = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
        if (guardada) return guardada;
        if (request.mode === "navigate") return caches.match("Acceso/bienvenida.html");
        return Response.error();
      })
  );
});
