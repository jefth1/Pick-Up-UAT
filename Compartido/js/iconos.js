// Iconos de línea del diseño (24×24). En HTML: <i data-icono="atras"></i>.
// Desde JS: icono("reloj").
const ICONOS = {
  atras: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  birrete: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  tienda: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/><path d="M5 13v7h14v-7M10 20v-4h4v4"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  imagen: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  ubicacion: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alarma: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>',
  inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  bolsa: '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lista: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  pedidos: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  escanear: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
  ventas: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  tarjeta: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  efectivo: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  subir: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  mensaje: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  salir: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
};

function icono(nombre, clase = "") {
  return `<svg class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ""}</svg>`;
}

function pintarIconos(raiz = document) {
  raiz.querySelectorAll("i[data-icono]").forEach((i) => { i.outerHTML = icono(i.dataset.icono, i.className); });
}

document.addEventListener("DOMContentLoaded", () => pintarIconos());
