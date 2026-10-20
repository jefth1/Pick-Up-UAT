// Datos de ejemplo mientras no hay backend. Se reemplazan por llamadas a la API.
const DATOS_DEMO = {
  locales: [
    { id: 1, nombre: "Cafetería Ingeniería", ubicacion: "dentro", horario: "Lun–Vie 7:00–17:00" },
    { id: 2, nombre: "Tortas Don Pepe", ubicacion: "fuera", horario: "Lun–Sáb 9:00–19:00" },
  ],
  productos: [
    { id: 1, localId: 1, nombre: "Café americano", precio: 25, disponible: true },
    { id: 2, localId: 1, nombre: "Sándwich de pavo", precio: 55, disponible: true },
    { id: 3, localId: 2, nombre: "Torta de milanesa", precio: 70, disponible: false },
  ],
  pedidos: [
    { id: 101, localId: 1, alumno: "Alumno demo", horaRecogida: "12:30", estado: "nuevo",
      productos: [{ productoId: 1, cantidad: 2 }], instrucciones: "Uno sin azúcar" },
  ],
};
