// Datos de ejemplo mientras no hay backend. Se reemplazan por llamadas a la API.
const DATOS_DEMO = {
  // Perfiles de ejemplo para navegar desde la entrada sin login real.
  alumnos: [
    { id: 1, nombre: "Ana Martínez López", matricula: "a2213450123", correo: "a2213450123@alumnos.uat.edu.mx",
      facultad: "Facultad de Ingeniería Tampico", carrera: "Ing. en Sistemas Computacionales" },
    { id: 2, nombre: "Luis Hernández Ruiz", matricula: "a2193320456", correo: "a2193320456@alumnos.uat.edu.mx",
      facultad: "Facultad de Comercio y Administración", carrera: "Lic. en Administración" },
  ],
  locales: [
    { id: 1, nombre: "Cafetería Ingeniería", ubicacion: "dentro", horario: "Lun–Vie 7:00–17:00",
      encargado: "Rosa Treviño", correo: "cafeteria.ing@ejemplo.com" },
    { id: 2, nombre: "Tortas Don Pepe", ubicacion: "fuera", horario: "Lun–Sáb 9:00–19:00",
      encargado: "José Salinas", correo: "tortasdonpepe@ejemplo.com" },
  ],
  productos: [
    { id: 1, localId: 1, nombre: "Café americano", precio: 25, disponible: true },
    { id: 2, localId: 1, nombre: "Sándwich de pavo", precio: 55, disponible: true },
    { id: 3, localId: 2, nombre: "Torta de milanesa", precio: 70, disponible: false },
  ],
  pedidos: [
    { id: 101, localId: 1, alumno: "Ana Martínez López", horaRecogida: "12:30", estado: "nuevo",
      productos: [{ productoId: 1, cantidad: 2 }], instrucciones: "Uno sin azúcar" },
    { id: 102, localId: 1, alumno: "Luis Hernández Ruiz", horaRecogida: "12:45", estado: "preparando",
      productos: [{ productoId: 2, cantidad: 1 }], instrucciones: "Sin mayonesa" },
    { id: 103, localId: 2, alumno: "Ana Martínez López", horaRecogida: "13:15", estado: "nuevo",
      productos: [{ productoId: 3, cantidad: 1 }], instrucciones: "Salsa aparte" },
  ],
};

// Perfil elegido en la entrada, leído de la URL (?alumno=1 o ?local=1).
function perfilActual(tipo) {
  const id = Number(new URLSearchParams(location.search).get(tipo));
  const lista = tipo === "alumno" ? DATOS_DEMO.alumnos : DATOS_DEMO.locales;
  return lista.find((p) => p.id === id) || lista[0];
}
