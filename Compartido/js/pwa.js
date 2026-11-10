// Registra el service worker (sw.js, en la raíz del sitio) para que Pick Up UAT
// se pueda instalar como app en Android e iPhone.
if ("serviceWorker" in navigator) {
  const sw = new URL("../../sw.js", document.currentScript.src);
  window.addEventListener("load", () => navigator.serviceWorker.register(sw));
}

// Si otra página mete la app en un marco (iframe) para engañar con clics, no se muestra.
if (window.top !== window.self) document.documentElement.style.visibility = "hidden";
