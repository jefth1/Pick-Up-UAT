// Registra el service worker (sw.js, en la raíz del sitio) para que Pick Up UAT
// se pueda instalar como app en Android e iPhone.
if ("serviceWorker" in navigator) {
  const sw = new URL("../../sw.js", document.currentScript.src);
  window.addEventListener("load", () => navigator.serviceWorker.register(sw));
}
