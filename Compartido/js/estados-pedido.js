// Flujo del pedido: el local acepta o rechaza; luego lo prepara y lo entrega.
const ESTADOS_PEDIDO = {
  nuevo:      { texto: "Nuevo",          siguientes: ["aceptado", "rechazado"] },
  aceptado:   { texto: "Aceptado",       siguientes: ["preparando"] },
  preparando: { texto: "En preparación", siguientes: ["listo"] },
  listo:      { texto: "Listo",          siguientes: ["entregado", "no_recogido"] },
  entregado:  { texto: "Entregado",      siguientes: [] },
  rechazado:  { texto: "Rechazado",      siguientes: [] },
  no_recogido:{ texto: "No recogido",    siguientes: [] },
};
