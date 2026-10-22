// Lógica del perfil de alumnos: explorar locales, armar el pedido y seguir su estado.
// El carrito vive en el navegador hasta que se envía el pedido.
const carrito = {
  leer: () => JSON.parse(localStorage.getItem("carrito") || "null") || { localId: null, items: [] },
  guardar: (c) => localStorage.setItem("carrito", JSON.stringify(c)),
  vaciar: () => localStorage.removeItem("carrito"),
};
const totalDe = (c) => c.items.reduce((s, x) => s + x.precio * x.cantidad, 0);

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("lista-locales")) explorarLocales();
  if (document.getElementById("menu-local")) menuLocal();
  if (document.getElementById("nombre-producto")) producto();
  if (document.getElementById("carrito")) verCarrito();
  if (document.getElementById("enviar-pedido")) pago();
  if (document.getElementById("mis-pedidos")) misPedidos();
  if (document.getElementById("barra-carrito")) barraCarrito();
});

const aMinutos = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const aTexto = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const corta = (t) => t.slice(0, 5).replace(/^0/, "");

function horarioHoy(local) {
  return local.horarios.find((h) => h.dia === ahoraEnTamaulipas().dia);
}

function abiertoAhora(local) {
  const { minutos } = ahoraEnTamaulipas();
  const hoy = horarioHoy(local);
  return local.abierto && !!hoy && minutos >= aMinutos(hoy.abre) && minutos <= aMinutos(hoy.cierra);
}

function textoHoy(local) {
  const hoy = horarioHoy(local);
  return hoy ? `Hoy ${corta(hoy.abre)}–${corta(hoy.cierra)}` : "Hoy cerrado";
}

const textoUbicacion = (l) => [l.ubicacion === "dentro" ? "Dentro UAT" : "Fuera UAT", l.direccion].filter(Boolean).join(" · ");

function barraCarrito() {
  const c = carrito.leer();
  const cantidad = c.items.reduce((s, x) => s + x.cantidad, 0);
  if (!cantidad) return;
  document.getElementById("cantidad-carrito").textContent = cantidad;
  document.getElementById("total-barra").textContent = dinero(totalDe(c));
  document.getElementById("barra-carrito").hidden = false;
}

async function explorarLocales() {
  const alumno = await alumnoActual();
  if (alumno) document.getElementById("hola").textContent = `Hola, ${alumno.nombre.split(" ")[0]}`;

  const lista = document.getElementById("lista-locales");
  const { data: locales, error } = await db.from("locales").select("*, horarios(*), productos(nombre)").order("nombre");
  if (error) return mostrarError(error);

  let filtro = "todos";
  const buscar = document.getElementById("buscar");
  const pintar = () => {
    const texto = buscar.value.trim().toLowerCase();
    const visibles = locales
      .filter((l) => filtro === "todos" || l.ubicacion === filtro)
      .filter((l) => !texto || l.nombre.toLowerCase().includes(texto) ||
        l.productos.some((p) => p.nombre.toLowerCase().includes(texto)))
      .sort((a, b) => abiertoAhora(b) - abiertoAhora(a));
    lista.innerHTML = visibles.map((l) => {
      const abierto = abiertoAhora(l);
      return `<li><a class="tarjeta-local ${abierto ? "" : "cerrado"}" href="menu-local.html?local=${l.id}">
        <div class="foto" ${fondoFoto(l.logo_url)}>${l.logo_url ? "" : icono("imagen")}</div>
        <div class="cuerpo">
          <div class="fila-titulo"><strong>${esc(l.nombre)}</strong>
            <span class="estado ${abierto ? "abierto" : ""}">${abierto ? "Abierto" : "Cerrado"}</span></div>
          <p class="meta texto-suave"><span>${icono("ubicacion")}${esc(textoUbicacion(l))}</span><span>${icono("reloj")}${textoHoy(l)}</span></p>
        </div></a></li>`;
    }).join("") || `<li class="tarjeta vacio"><strong>${locales.length ? "Sin resultados" : "Todavía no hay locales"}</strong>
      <span>${locales.length ? "Prueba con otro nombre o platillo." : "Cuando un local se registre aparecerá aquí."}</span></li>`;
  };
  document.querySelectorAll("[data-filtro]").forEach((chip) =>
    chip.addEventListener("click", () => {
      document.querySelectorAll("[data-filtro]").forEach((c) => c.classList.remove("activo"));
      chip.classList.add("activo");
      filtro = chip.dataset.filtro;
      pintar();
    })
  );
  buscar.addEventListener("input", pintar);
  pintar();
}

async function menuLocal() {
  const { data: local, error } = await db.from("locales")
    .select("*, horarios(*), productos(*)").eq("id", param("local")).single();
  if (error) return mostrarError(error);
  document.title = `${local.nombre} · Pick Up UAT`;
  document.getElementById("nombre-local").textContent = local.nombre;
  document.getElementById("ubicacion-local").textContent = textoUbicacion(local);
  document.getElementById("horario-local").textContent = `${textoHoy(local)}${abiertoAhora(local) ? "" : " · Cerrado ahora"}`;
  if (local.logo_url) {
    const portada = document.getElementById("portada");
    portada.style.backgroundImage = `url('${local.logo_url}')`;
    portada.querySelector(":scope > .icono").remove();
  }

  const productos = local.productos.sort((a, b) => b.disponible - a.disponible || a.nombre.localeCompare(b.nombre));
  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort();
  let categoria = null;
  const chips = document.getElementById("categorias");
  chips.innerHTML = categorias.length
    ? [`<button class="chip activo" data-categoria="">Todo</button>`,
       ...categorias.map((c) => `<button class="chip" data-categoria="${esc(c)}">${esc(c)}</button>`)].join("")
    : "";
  chips.addEventListener("click", (e) => {
    if (!e.target.matches("[data-categoria]")) return;
    chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("activo", c === e.target));
    categoria = e.target.dataset.categoria || null;
    pintar();
  });

  const pintar = () => {
    document.getElementById("menu-local").innerHTML = productos
      .filter((p) => !categoria || p.categoria === categoria)
      .map((p) => {
        const contenido = `<div><strong>${esc(p.nombre)}</strong>
            ${p.descripcion ? `<span class="descripcion">${esc(p.descripcion)}</span>` : ""}
            ${p.disponible ? `<span class="precio">${dinero(p.precio)}</span>` : `<span class="estado">Agotado</span>`}</div>
          <div class="foto miniatura" ${fondoFoto(p.foto_url)}>${p.foto_url ? "" : icono("imagen")}</div>`;
        return p.disponible
          ? `<li><a class="tarjeta fila-menu" href="producto.html?producto=${p.id}">${contenido}</a></li>`
          : `<li class="tarjeta fila-menu agotado">${contenido}</li>`;
      })
      .join("") || `<li class="tarjeta vacio"><strong>Menú vacío</strong><span>Este local todavía no sube productos.</span></li>`;
  };
  pintar();
}

async function producto() {
  const { data: p, error } = await db.from("productos").select("*").eq("id", param("producto")).single();
  if (error) return mostrarError(error);
  document.getElementById("volver-menu").href = `menu-local.html?local=${p.local_id}`;
  document.getElementById("nombre-producto").textContent = p.nombre;
  document.getElementById("descripcion-producto").textContent = p.descripcion || "";
  if (p.foto_url) {
    const foto = document.getElementById("foto-producto");
    foto.style.backgroundImage = `url('${p.foto_url}')`;
    foto.querySelector(":scope > .icono").remove();
  }

  const campo = document.getElementById("cantidad");
  const boton = document.getElementById("agregar");
  const cantidad = () => Math.min(20, Math.max(1, Number(campo.value) || 1));
  const actualizar = () => {
    campo.value = cantidad();
    document.getElementById("precio-producto").textContent = dinero(p.precio);
    boton.textContent = `Agregar al pedido · ${dinero(p.precio * cantidad())}`;
  };
  document.getElementById("menos").addEventListener("click", () => { campo.value = cantidad() - 1; actualizar(); });
  document.getElementById("mas").addEventListener("click", () => { campo.value = cantidad() + 1; actualizar(); });
  campo.addEventListener("change", actualizar);
  actualizar();
  if (!p.disponible) {
    boton.disabled = true;
    boton.textContent = "Agotado";
  }

  boton.addEventListener("click", () => {
    let c = carrito.leer();
    if (c.localId && c.localId !== p.local_id) {
      if (!confirm("Tu carrito tiene productos de otro local. ¿Empezar un carrito nuevo?")) return;
      c = { localId: null, items: [] };
    }
    c.localId = p.local_id;
    c.items.push({ productoId: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: cantidad(),
      nota: document.getElementById("nota").value.trim() });
    carrito.guardar(c);
    location.href = "carrito.html";
  });
}

// Rango para la hora de recogida: desde 15 minutos a partir de ahora (o la apertura)
// hasta el cierre del local hoy, en minutos del día.
function rangoRecogida(local) {
  const { minutos } = ahoraEnTamaulipas();
  const hoy = horarioHoy(local);
  if (!local.abierto || !hoy) return null;
  const desde = Math.max(aMinutos(hoy.abre), Math.ceil((minutos + 15) / 5) * 5);
  const hasta = aMinutos(hoy.cierra);
  return desde <= hasta ? { desde, hasta, ahora: minutos } : null;
}

// "13:20" de hoy en Tamaulipas → fecha ISO.
function fechaDeHoy(texto, ahora) {
  const fecha = new Date(Date.now() + (aMinutos(texto) - ahora) * 60000);
  fecha.setSeconds(0, 0);
  return fecha.toISOString();
}

async function verCarrito() {
  const c = carrito.leer();
  const lista = document.getElementById("carrito");
  const boton = document.getElementById("continuar-pago");
  const pintar = () => {
    lista.innerHTML = c.items.map((x, i) => `<li class="fila-carrito">
      <span class="cant">${x.cantidad}×</span>
      <div><strong>${esc(x.nombre)}</strong>${x.nota ? `<span class="nota">“${esc(x.nota)}”</span>` : ""}
        <button class="quitar" data-quitar="${i}">Quitar</button></div>
      <span>${dinero(x.precio * x.cantidad)}</span></li>`)
      .join("") || `<li class="vacio"><strong>Tu carrito está vacío</strong>
        <span>Elige un local y agrega lo que quieras pedir.</span>
        <a class="boton boton-secundario" href="explorar-locales.html">Ver locales</a></li>`;
    const total = dinero(totalDe(c));
    document.getElementById("subtotal-carrito").textContent = total;
    document.getElementById("total-carrito").textContent = total;
    boton.textContent = `Ir a pagar · ${total}`;
    const vacio = !c.items.length;
    document.getElementById("totales").hidden = vacio;
    if (vacio) {
      document.getElementById("seccion-hora").hidden = true;
      boton.hidden = true;
    }
  };
  lista.addEventListener("click", (e) => {
    if (!e.target.dataset.quitar) return;
    c.items.splice(Number(e.target.dataset.quitar), 1);
    if (!c.items.length) c.localId = null;
    carrito.guardar(c);
    pintar();
  });
  pintar();
  if (!c.localId) return;

  const { data: local, error } = await db.from("locales").select("*, horarios(*)").eq("id", c.localId).single();
  if (error) return mostrarError(error);
  document.getElementById("local-carrito").textContent = local.nombre;
  document.getElementById("volver-carrito").href = `menu-local.html?local=${local.id}`;
  document.getElementById("seccion-hora").hidden = false;

  const rango = rangoRecogida(local);
  const campo = document.getElementById("hora");
  const barra = document.getElementById("rango");
  const aviso = document.getElementById("rango-hora");
  const hoy = horarioHoy(local);
  document.getElementById("hora-ahora").textContent = aTexto(ahoraEnTamaulipas().minutos);
  document.getElementById("hora-cierre").textContent = hoy ? hoy.cierra.slice(0, 5) : "Cerrado";
  if (!rango) {
    campo.disabled = barra.disabled = true;
    aviso.textContent = "El local ya no recibe pedidos hoy.";
    return (boton.hidden = true);
  }
  campo.min = aTexto(rango.desde);
  campo.max = aTexto(rango.hasta);
  barra.min = rango.desde;
  barra.max = rango.hasta;
  const guardada = c.hora?.texto;
  campo.value = guardada >= campo.min && guardada <= campo.max ? guardada : campo.min;
  barra.value = aMinutos(campo.value);
  aviso.textContent = `Solo puedes elegir una hora entre las ${campo.min} y el cierre del local (${campo.max}).`;
  barra.addEventListener("input", () => (campo.value = aTexto(Number(barra.value))));
  campo.addEventListener("input", () => campo.value && (barra.value = aMinutos(campo.value)));
  boton.hidden = false;

  boton.addEventListener("click", (e) => {
    if (!campo.value || campo.value < campo.min || campo.value > campo.max) {
      e.preventDefault();
      return alert(`Elige una hora entre ${campo.min} y ${campo.max}.`);
    }
    c.hora = { texto: campo.value, fecha: fechaDeHoy(campo.value, ahoraEnTamaulipas().minutos) };
    carrito.guardar(c);
  });
}

async function exigirAlumno() {
  const alumno = await alumnoActual();
  if (!alumno) location.href = "../Acceso/alumno-iniciar-sesion.html";
  return alumno;
}

async function pago() {
  const c = carrito.leer();
  if (!c.items.length || !c.hora) return (location.href = "carrito.html");
  if (!(await exigirAlumno())) return;
  document.getElementById("total-pago").textContent = dinero(totalDe(c));
  document.getElementById("hora-pago").textContent = c.hora.texto;
  const { data: local } = await db.from("locales").select("nombre").eq("id", c.localId).single();
  if (local) document.getElementById("local-pago").textContent = local.nombre;

  const boton = document.getElementById("enviar-pedido");
  boton.addEventListener("click", async () => {
    boton.disabled = true;
    const { data: id, error } = await db.rpc("crear_pedido", {
      p_local_id: c.localId,
      p_hora_recogida: c.hora.fecha,
      p_productos: c.items.map((x) => ({ producto_id: x.productoId, cantidad: x.cantidad, nota: x.nota })),
    });
    boton.disabled = false;
    if (error) return mostrarError(error);
    carrito.vaciar();
    location.href = `confirmacion.html?pedido=${id}`;
  });
}

// Pasos que ve el alumno; "nuevo" se muestra como "Enviado".
const PASOS = [["nuevo", "Enviado"], ["aceptado", "Aceptado por el local"], ["preparando", "En preparación"],
  ["listo", "Listo para recoger"], ["entregado", "Entregado"]];

function pintarPasos(p) {
  const pasos = document.getElementById("pasos");
  if (p.estado === "rechazado") {
    pasos.innerHTML = `<li class="hecho">Enviado <time>${hora(p.creado_en)}</time></li>
      <li class="rechazado">El local rechazó tu pedido <time>${hora(p.actualizado_en)}</time></li>`;
    return;
  }
  const estado = p.estado === "no_recogido" ? "listo" : p.estado;
  const actual = PASOS.findIndex(([e]) => e === estado);
  pasos.innerHTML = PASOS.map(([, texto], i) => `<li class="${i < actual ? "hecho" : i === actual ? "actual" : ""}">${texto}
    ${i === 0 ? `<time>${hora(p.creado_en)}</time>` : i === actual ? `<time>${hora(p.actualizado_en)}</time>` : ""}</li>`).join("")
    + (p.estado === "no_recogido" ? `<li class="rechazado">No se recogió</li>` : "");
}

function pintarQr(id) {
  const destino = document.getElementById("codigo-pedido");
  if (typeof qrcode === "undefined") return (destino.textContent = `#${id}`);
  const qr = qrcode(0, "M");
  qr.addData(`PICKUP-${id}`);
  qr.make();
  destino.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
}

async function misPedidos() {
  const alumno = await exigirAlumno();
  if (!alumno) return;
  const lista = document.getElementById("mis-pedidos");
  const elegido = param("pedido");
  const cargar = async () => {
    const { data: pedidos, error } = await db.from("pedidos")
      .select("*, locales(nombre)").order("creado_en", { ascending: false }).limit(20);
    if (error) return mostrarError(error);

    const actual = pedidos.find((p) => String(p.id) === elegido);
    if (actual) {
      document.getElementById("pedido-actual").hidden = false;
      document.getElementById("titulo-confirmacion").textContent =
        { nuevo: "¡Pedido enviado!", listo: "¡Tu pedido está listo!", entregado: "Pedido entregado",
          rechazado: "Pedido rechazado" }[actual.estado] || "Tu pedido va en camino";
      if (!document.querySelector("#codigo-pedido svg")) pintarQr(actual.id);
      document.getElementById("numero-pedido").textContent = `Pedido #${actual.id}`;
      document.getElementById("local-pedido").textContent = actual.locales.nombre;
      document.getElementById("hora-recogida").textContent = hora(actual.hora_recogida);
      const estado = document.getElementById("estado-pedido");
      estado.textContent = actual.estado === "nuevo" ? "Esperando al local" : ESTADOS_PEDIDO[actual.estado].texto;
      pintarPasos(actual);
      document.getElementById("titulo-lista").textContent = "Otros pedidos";
    }
    const otros = pedidos.filter((p) => p !== actual);
    lista.innerHTML = otros.map((p) => `<li><a class="tarjeta fila-pedido" href="confirmacion.html?pedido=${p.id}">
      <div><strong>#${p.id} · ${esc(p.locales.nombre)}</strong>
        <span class="texto-suave">Recoge ${hora(p.hora_recogida)} · ${dinero(p.total)}</span></div>
      <span class="estado ${p.estado === "listo" ? "listo" : p.estado === "rechazado" ? "urgente" : ""}">${ESTADOS_PEDIDO[p.estado].texto}</span></a></li>`)
      .join("") || (actual ? "" : `<li class="tarjeta vacio"><strong>Todavía no haces pedidos</strong>
        <span>Cuando pidas algo aquí verás su estado.</span></li>`);
    document.getElementById("titulo-lista").hidden = !!actual && !otros.length;
  };
  await cargar();
  // Se actualiza solo cuando el local cambia el estado.
  db.channel("mis-pedidos")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `alumno_id=eq.${alumno.id}` }, cargar)
    .subscribe();
}
