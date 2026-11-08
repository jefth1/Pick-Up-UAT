// Lógica del perfil de alumnos: explorar locales, armar el pedido y seguir su estado.
// El carrito vive en el navegador hasta que se envía el pedido.
const carrito = {
  leer: () => JSON.parse(localStorage.getItem("carrito") || "null") || { localId: null, items: [] },
  guardar: (c) => localStorage.setItem("carrito", JSON.stringify(c)),
  vaciar: () => localStorage.removeItem("carrito"),
};
const totalDe = (c) => c.items.reduce((s, x) => s + x.precio * x.cantidad, 0);
const totalConFavor = (c) => totalDe(c) + (c.favor?.tarifa || 0);

// Agrega un producto al carrito; si ya está con la misma nota, suma la cantidad.
// El carrito es de un solo local: pedir de otro empieza uno nuevo.
function agregarAlCarrito(p, cantidad, nota = "") {
  let c = carrito.leer();
  if (c.localId && c.localId !== p.local_id) {
    if (!confirm("Tu carrito tiene productos de otro local. ¿Empezar un carrito nuevo?")) return false;
    c = { localId: null, items: [] };
  }
  c.localId = p.local_id;
  const igual = c.items.find((x) => x.productoId === p.id && (x.nota || "") === nota);
  if (igual) igual.cantidad = Math.min(20, igual.cantidad + cantidad);
  else c.items.push({ productoId: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad, nota });
  carrito.guardar(c);
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("lista-locales")) explorarLocales();
  if (document.getElementById("menu-local")) menuLocal();
  if (document.getElementById("nombre-producto")) producto();
  if (document.getElementById("carrito")) verCarrito();
  if (document.getElementById("enviar-pedido")) pago();
  if (document.getElementById("mis-pedidos")) misPedidos();
  if (document.getElementById("barra-carrito")) barraCarrito();
  if (document.getElementById("mapa-uat")) mapaUat();
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
  if (!cantidad) return (document.getElementById("barra-carrito").hidden = true);
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
        <div class="foto" ${atributosImagen(imagenLocal(l))}></div>
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
  ponerImagen(document.getElementById("portada"), imagenLocal(local));

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
          <div class="foto miniatura" ${atributosImagen(imagenProducto(p))}></div>`;
        return p.disponible
          ? `<li><a class="tarjeta fila-menu" href="producto.html?producto=${p.id}">${contenido}</a>
              <button class="agregar-rapido" data-agregar="${p.id}" aria-label="Agregar ${esc(p.nombre)}">${icono("mas")}</button></li>`
          : `<li class="tarjeta fila-menu agotado">${contenido}</li>`;
      })
      .join("") || `<li class="tarjeta vacio"><strong>Menú vacío</strong><span>Este local todavía no sube productos.</span></li>`;
  };
  pintar();

  // "+" agrega uno sin salir del menú; la barra del carrito se actualiza al momento.
  document.getElementById("menu-local").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-agregar]");
    if (!boton) return;
    const p = productos.find((x) => String(x.id) === boton.dataset.agregar);
    if (!agregarAlCarrito(p, 1)) return;
    barraCarrito();
    boton.classList.add("agregado");
    boton.innerHTML = icono("check");
    setTimeout(() => { boton.classList.remove("agregado"); boton.innerHTML = icono("mas"); }, 900);
  });
}

async function producto() {
  const { data: p, error } = await db.from("productos").select("*").eq("id", param("producto")).single();
  if (error) return mostrarError(error);
  document.getElementById("volver-menu").href = `menu-local.html?local=${p.local_id}`;
  document.getElementById("nombre-producto").textContent = p.nombre;
  document.getElementById("descripcion-producto").textContent = p.descripcion || "";
  ponerImagen(document.getElementById("foto-producto"), imagenProducto(p));

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

  // Regresa al menú para seguir armando el pedido; la barra lleva al carrito.
  boton.addEventListener("click", () => {
    if (agregarAlCarrito(p, cantidad(), document.getElementById("nota").value.trim()))
      location.href = `menu-local.html?local=${p.local_id}`;
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
        <span class="mini-cantidad"><button data-menos="${i}" aria-label="Uno menos">−</button>
          <button data-mas="${i}" aria-label="Uno más">+</button>
          <button class="quitar" data-quitar="${i}">Quitar</button></span></div>
      <span>${dinero(x.precio * x.cantidad)}</span></li>`)
      .join("") || `<li class="vacio"><strong>Tu carrito está vacío</strong>
        <span>Elige un local y agrega lo que quieras pedir.</span>
        <a class="boton boton-secundario" href="explorar-locales.html">Ver locales</a></li>`;
    const total = dinero(totalConFavor(c));
    document.getElementById("subtotal-carrito").textContent = dinero(totalDe(c));
    document.getElementById("fila-tarifa").hidden = !c.favor;
    document.getElementById("tarifa-carrito").textContent = dinero(c.favor?.tarifa || 0);
    document.getElementById("total-carrito").textContent = total;
    boton.textContent = `Ir a pagar · ${total}`;
    const vacio = !c.items.length;
    document.getElementById("totales").hidden = vacio;
    if (vacio) {
      document.getElementById("agregar-mas").hidden = true;
      document.getElementById("seccion-hora").hidden = true;
      document.getElementById("seccion-entrega").hidden = true;
      boton.hidden = true;
    }
  };
  lista.addEventListener("click", (e) => {
    const { quitar, menos, mas } = e.target.dataset;
    if (quitar === undefined && menos === undefined && mas === undefined) return;
    const i = Number(quitar ?? menos ?? mas);
    if (mas !== undefined) c.items[i].cantidad = Math.min(20, c.items[i].cantidad + 1);
    else if (menos !== undefined && c.items[i].cantidad > 1) c.items[i].cantidad--;
    else c.items.splice(i, 1);
    if (!c.items.length) c.localId = null;
    carrito.guardar(c);
    pintar();
    // Si va con favor, la tarifa y el tope se revisan otra vez con el nuevo total.
    const entrega = document.getElementById("seccion-entrega");
    if (!entrega.hidden) entrega.dispatchEvent(new Event("change"));
  });
  pintar();
  if (!c.localId) return;

  const { data: local, error } = await db.from("locales").select("*, horarios(*)").eq("id", c.localId).single();
  if (error) return mostrarError(error);
  document.getElementById("local-carrito").textContent = local.nombre;
  document.getElementById("volver-carrito").href = `menu-local.html?local=${local.id}`;
  const agregarMas = document.getElementById("agregar-mas");
  agregarMas.href = `menu-local.html?local=${local.id}`;
  agregarMas.hidden = !c.items.length;
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
  opcionesEntrega(c, local, pintar);
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

// Recoger en el local o que lo lleve otro alumno a un lugar de la UAT (facultad o zona).
// Solo aparece con los favores encendidos y si el local ya se colocó en el mapa. El mapa
// muestra la ruta A (el local, donde se recoge) → B (donde se entrega) y la cuota del
// favor sale de esa distancia; la gana quien lo lleva.
async function opcionesEntrega(c, local, pintar) {
  const quitarFavor = () => { delete c.favor; carrito.guardar(c); pintar(); };
  const seccion = document.getElementById("seccion-entrega");
  seccion.hidden = false;
  // Las dos opciones siempre se ven; si el favor no se puede, se dice por qué.
  let motivo = !(await favoresActivos()) ? "Pronto podrás pedir que otro alumno te lo lleve."
    : local.lat == null ? "Este local todavía no tiene entregas por favor." : null;
  let puntos = [];
  if (!motivo) {
    puntos = await lugaresUat();
    if (!puntos.length) motivo = "Todavía no hay puntos de entrega para favores.";
  }
  if (motivo) {
    const opcion = seccion.querySelector('[value="favor"]');
    opcion.disabled = true;
    opcion.closest("label").classList.add("deshabilitada");
    seccion.querySelector('[value="recojo"]').checked = true;
    const texto = document.getElementById("motivo-sin-favor");
    texto.textContent = motivo;
    texto.hidden = false;
    return c.favor && quitarFavor();
  }

  const datos = document.getElementById("datos-favor");
  const punto = document.getElementById("punto-entrega");
  const referencia = document.getElementById("referencia");
  const aviso = document.getElementById("aviso-favor");
  const resumen = document.getElementById("ruta-favor");
  const grupo = (tipo, titulo) => {
    const opciones = puntos.filter((p) => p.tipo === tipo).map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`);
    return opciones.length ? `<optgroup label="${titulo}">${opciones.join("")}</optgroup>` : "";
  };
  punto.innerHTML = grupo("facultad", "Facultades") + grupo("zona", "Zonas de la UAT");
  if (c.favor && puntos.some((p) => p.id === c.favor.puntoId)) {
    seccion.querySelector('[value="favor"]').checked = true;
    punto.value = c.favor.puntoId;
    referencia.value = c.favor.referencia || "";
  }
  const { data: ajustes } = await db.from("ajustes").select("tope_efectivo").maybeSingle();
  const tope = Number(ajustes?.tope_efectivo ?? 250);
  const conFavor = () => seccion.querySelector('[value="favor"]').checked;

  // Mapa de la ruta: se crea la primera vez que se elige "Que me lo lleven".
  // Tocar otra facultad o zona en el mapa la elige como punto de entrega.
  let ruta = null;
  const dibujarRuta = (elegido) => {
    if (!ruta) {
      const mapa = crearMapa(document.getElementById("mapa-favor"));
      if (!mapa) return;
      puntos.forEach((p) => marcadorLugar(p, { clase: "chico" })
        .on("click", () => { punto.value = p.id; cotizar(); }).addTo(mapa));
      ruta = { mapa, a: marcadorLetra(local, "A").addTo(mapa) };
    }
    ruta.b?.remove();
    ruta.linea?.remove();
    ruta.b = marcadorLetra(elegido, "B").addTo(ruta.mapa);
    ruta.linea = lineaRuta([local, elegido]).addTo(ruta.mapa);
    ruta.mapa.fitBounds([[local.lat, local.lng], [elegido.lat, elegido.lng]], ENCUADRE);
  };

  let cotizacion = null;
  const pintarRuta = () => {
    const { distancia_m: d, tarifa, elegido } = cotizacion;
    const minutos = minutosCaminando(d);
    resumen.innerHTML = `<span><i class="letra-ruta a">A</i><span><b>${esc(local.nombre)}</b> <span class="texto-tenue">· se recoge</span></span></span>
      <span><i class="letra-ruta">B</i><span><b>${esc(elegido.nombre)}</b> <span class="texto-tenue">· te lo entregan</span></span></span>
      <div class="cifras-ruta"><span><b>${textoDistancia(d)}</b> de A a B</span><span><b>~${minutos} min</b> a pie</span><span>Cuota <b>${dinero(tarifa)}</b></span></div>`;
    resumen.hidden = false;
    const hora = document.getElementById("hora").value;
    const llega = hora ? aTexto((aMinutos(hora) + minutos) % 1440) : null;
    aviso.textContent = "Otro alumno paga tu pedido en el local y te lo lleva. Al recibirlo le pagas en efectivo el pedido " +
      `más la cuota, que sale de la distancia de A a B.${llega ? ` Si alguien lo toma, te llegaría cerca de las ${llega}.` : ""}`;
  };

  const cotizar = async () => {
    if (!conFavor()) return (datos.hidden = true), c.favor && quitarFavor();
    datos.hidden = false;
    const elegido = puntos.find((p) => String(p.id) === punto.value);
    dibujarRuta(elegido);
    // Quien hace el favor paga el pedido en efectivo: hay un tope para no adelantar mucho.
    if (totalDe(c) > tope) {
      resumen.hidden = true;
      aviso.textContent = `Para que te lo lleven, el pedido no puede pasar de ${dinero(tope)}, porque quien te hace el favor lo paga en efectivo.`;
      return c.favor && quitarFavor();
    }
    const { data, error } = await db.rpc("cotizar_favor", { p_local_id: local.id, p_punto_id: elegido.id });
    if (error) return mostrarError(error);
    if (!conFavor() || String(elegido.id) !== punto.value) return; // mientras, eligió otra cosa
    const { distancia_m, tarifa } = data[0];
    c.favor = { puntoId: elegido.id, referencia: referencia.value.trim(), tarifa: Number(tarifa) };
    cotizacion = { distancia_m, tarifa: Number(tarifa), elegido };
    pintarRuta();
    carrito.guardar(c);
    pintar();
  };
  seccion.addEventListener("change", cotizar);
  referencia.addEventListener("input", () => c.favor && ((c.favor.referencia = referencia.value.trim()), carrito.guardar(c)));
  // La hora de llegada estimada sigue a la hora de recogida (campo o barra).
  const repintar = () => c.favor && cotizacion && conFavor() && pintarRuta();
  document.getElementById("hora").addEventListener("input", repintar);
  document.getElementById("rango").addEventListener("input", repintar);
  cotizar();
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
  document.getElementById("total-pago").textContent = dinero(totalConFavor(c));
  document.getElementById("hora-pago").textContent = c.hora.texto;
  if (c.favor) {
    const favor = document.getElementById("favor-pago");
    favor.textContent = `Incluye ${dinero(c.favor.tarifa)} de cuota del favor: te lo lleva otro alumno`;
    favor.hidden = false;
    document.getElementById("texto-pago").textContent = "Le pagas todo en efectivo a quien te lo lleve.";
    document.getElementById("pago-local").hidden = true;
    document.getElementById("pago-favor").hidden = false;
    document.querySelector("#pago-favor input").checked = true;
  }
  const { data: local } = await db.from("locales").select("nombre").eq("id", c.localId).single();
  if (local) document.getElementById("local-pago").textContent = local.nombre;

  const boton = document.getElementById("enviar-pedido");
  boton.addEventListener("click", async () => {
    boton.disabled = true;
    const pedido = {
      p_local_id: c.localId,
      p_hora_recogida: c.hora.fecha,
      p_productos: c.items.map((x) => ({ producto_id: x.productoId, cantidad: x.cantidad, nota: x.nota })),
    };
    const { data: id, error } = c.favor
      ? await db.rpc("crear_pedido_con_favor", { ...pedido, p_punto_id: c.favor.puntoId, p_referencia: c.favor.referencia })
      : await db.rpc("crear_pedido", pedido);
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

// Datos del favor que se piden junto con el pedido.
const CAMPOS_FAVOR = "favores(*, puntos_entrega(nombre), repartidor:alumnos!favores_repartidor_id_fkey(nombre), favor_codigos(codigo))";
const unoDe = (x) => (Array.isArray(x) ? x[0] : x) ?? null;

// Cuándo llega el favor. La hora la calcula la base con el avance de quien lo lleva
// (compartir_avance); a esta pantalla nunca llega su ubicación, solo la hora estimada.
let favorEnPantalla = null;
let pedidoEnPantalla = null;
function htmlLlegada(favor, p) {
  if (favor.estado === "buscando") {
    const sale = Math.max(new Date(p.hora_recogida).getTime(), Date.now());
    return `<p class="texto-tenue" id="llegada">Si alguien lo toma, llegaría cerca de las ${hora(sale + minutosCaminando(favor.distancia_m) * 60000)}.</p>`;
  }
  if (!["asignado", "recogido"].includes(favor.estado) || !favor.llegada_estimada) return "";
  const texto = textoLlegada(favor.llegada_estimada);
  return `<div class="llegada ${texto === "Está por llegar" ? "ya" : ""}" id="llegada">${icono("reloj")}
    <div><strong>${texto}</strong><span>Cerca de las ${hora(favor.llegada_estimada)} · se actualiza conforme se acerca</span></div></div>`;
}

function pintarLlegada() {
  const caja = document.getElementById("llegada");
  if (caja && favorEnPantalla) caja.outerHTML = htmlLlegada(favorEnPantalla, pedidoEnPantalla) || "<span id=\"llegada\"></span>";
}

// Lo que ve quien pidió el favor, según cómo va.
function pintarFavor(p) {
  const caja = document.getElementById("favor-pedido");
  const favor = unoDe(p.favores);
  favorEnPantalla = favor;
  pedidoEnPantalla = p;
  caja.hidden = !favor;
  // Con alguien ya encargado, el código QR es suyo: quien pidió solo espera la entrega.
  const loLleva = ["asignado", "recogido", "entregado"].includes(favor?.estado);
  document.getElementById("caja-qr").hidden = document.getElementById("texto-qr").hidden = loLleva;
  if (favor?.estado === "recogido") document.getElementById("titulo-confirmacion").textContent = "Tu pedido va en camino";
  if (!favor) return;
  const punto = esc(favor.puntos_entrega?.nombre);
  const quien = esc(favor.repartidor?.nombre?.split(" ")[0] || "Un alumno");
  const codigo = unoDe(favor.favor_codigos)?.codigo;
  const textos = {
    buscando: `Buscando quién te lo lleve a <b>${punto}</b> · ${dinero(favor.tarifa)}`,
    asignado: `<b>${quien}</b> pagará y recogerá tu pedido, y te lo llevará a <b>${punto}</b>.`,
    recogido: `<b>${quien}</b> ya lo recogió y va en camino a <b>${punto}</b>.`,
    entregado: `Recibiste tu pedido en <b>${punto}</b>.`,
    cancelado: p.estado === "rechazado" ? "El favor se canceló con el pedido." : "Nadie lo llevará: pasa tú por él al local.",
  };
  const cobro = ["buscando", "asignado", "recogido"].includes(favor.estado)
    ? `<div class="fila-favor"><span class="texto-suave">Págale en efectivo al recibirlo</span><strong>${dinero(Number(p.total) + Number(favor.tarifa))}</strong></div>` : "";
  caja.innerHTML = `<span class="etiqueta">Te lo llevan</span><p>${textos[favor.estado]}</p>${htmlLlegada(favor, p)}${cobro}
    ${["asignado", "recogido"].includes(favor.estado) && codigo
      ? `<div class="fila-favor"><span class="texto-suave">Dale este código cuando le pagues</span><span class="codigo">${esc(codigo)}</span></div>` : ""}
    ${favor.estado === "buscando" ? `<button class="boton boton-secundario" id="cancelar-favor">Mejor paso yo</button>` : ""}`;
  document.getElementById("cancelar-favor")?.addEventListener("click", async () => {
    if (!confirm("¿Cancelar el favor y recogerlo tú?")) return;
    const { error } = await db.rpc("cancelar_favor", { p_favor_id: favor.id });
    if (error) mostrarError(error);
  });
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
      .select(`*, locales(nombre), ${CAMPOS_FAVOR}`).eq("alumno_id", alumno.id)
      .order("creado_en", { ascending: false }).limit(20);
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
      pintarFavor(actual);
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
  // Se actualiza solo cuando el local cambia el estado o el favor avanza. Si del favor
  // solo cambió la hora estimada, se repinta esa línea sin recargar todo.
  db.channel("mis-pedidos")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `alumno_id=eq.${alumno.id}` }, cargar)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "favores", filter: `cliente_id=eq.${alumno.id}` }, ({ new: f }) => {
      if (f.id !== favorEnPantalla?.id) return; // la lista no muestra favores
      if (f.estado !== favorEnPantalla.estado) return cargar();
      favorEnPantalla.llegada_estimada = f.llegada_estimada;
      pintarLlegada();
    })
    .subscribe();
  setInterval(pintarLlegada, 15000); // "Llega en ~N min" baja solo con el tiempo
}

// Mapa de la UAT: facultades y zonas (las coloca el administrador) y dónde comer (cada
// local se coloca a sí mismo desde su perfil). "Tú" solo se dibuja en tu pantalla.
async function mapaUat() {
  const contenedor = document.getElementById("mapa-uat");
  const mapa = crearMapa(contenedor);
  const [lugares, { data: locales, error }] = await Promise.all([
    lugaresUat(),
    db.from("locales").select("*, horarios(*)").not("lat", "is", null).order("nombre"),
  ]);
  if (error) return mostrarError(error);
  const todos = [...lugares, ...locales.map((l) => ({ ...l, tipo: "local", abiertoYa: abiertoAhora(l) }))];
  const lista = document.getElementById("lista-lugares");
  const tarjeta = document.getElementById("lugar-elegido");
  const ORDEN = { facultad: 0, zona: 1, local: 2 };
  let filtro = "todo";
  let elegido = null;
  let yo = null;
  let marcadorTu = null;
  const visibles = () => todos.filter((l) => filtro === "todo" || l.tipo === filtro);
  const claseDe = (l) => (l.tipo === "local" && !l.abiertoYa ? "cerrado" : "");
  const detalle = (l) => (l.tipo === "local" ? `${l.abiertoYa ? "Abierto" : "Cerrado"} · ${textoHoy(l)}` : TIPOS_LUGAR[l.tipo]);

  const capa = mapa && L.layerGroup().addTo(mapa);
  const marcadores = new Map();
  if (mapa) {
    todos.forEach((l) => {
      // Dónde comer queda encima si se enciman con una facultad o zona.
      const m = marcadorLugar(l, { clase: claseDe(l), zIndexOffset: l.tipo === "local" ? 500 : 0 }).on("click", () => elegir(l));
      if (l.tipo === "facultad") etiquetar(m, nombreCorto(l));
      marcadores.set(l, m.addTo(capa));
    });
    // Encuadra lo que esté cerca de la UAT (un local con coordenadas raras no aleja el mapa).
    const centro = { lat: CENTRO_UAT[0], lng: CENTRO_UAT[1] };
    const cerca = todos.filter((l) => distanciaM(centro, l) < 5000);
    if (cerca.length > 1) mapa.fitBounds(cerca.map((l) => [l.lat, l.lng]), ENCUADRE);
    mapa.on("click", () => elegir(null));
  }

  const pintarTarjeta = () => {
    tarjeta.hidden = !elegido;
    if (!elegido) return;
    const l = elegido;
    const deTi = yo ? `<span>${icono("mira")}${textoDistancia(distanciaM(yo, l))} de ti · ~${minutosCaminando(distanciaM(yo, l))} min a pie</span>` : "";
    if (l.tipo === "local") {
      tarjeta.innerHTML = `<div class="fila-titulo"><strong>${esc(l.nombre)}</strong>
          <span class="estado ${l.abiertoYa ? "abierto" : ""}">${l.abiertoYa ? "Abierto" : "Cerrado"}</span></div>
        <p class="meta texto-suave"><span>${icono("ubicacion")}${esc(textoUbicacion(l))}</span><span>${icono("reloj")}${textoHoy(l)}</span>${deTi}</p>
        <a class="boton boton-primario" href="menu-local.html?local=${l.id}">Ver menú</a>`;
      return;
    }
    const comer = todos.filter((x) => x.tipo === "local").map((x) => [x, distanciaM(l, x)])
      .sort((a, b) => a[1] - b[1]).slice(0, 3);
    tarjeta.innerHTML = `<div class="fila-titulo"><strong>${esc(l.nombre)}</strong><span class="estado">${TIPOS_LUGAR[l.tipo]}</span></div>
      <p class="meta texto-suave"><span>${icono("bolsa")}Punto de entrega para favores</span>${deTi}</p>
      ${comer.length ? `<div class="cerca"><span class="etiqueta">Dónde comer cerca</span>${comer.map(([x, d]) =>
        `<a href="menu-local.html?local=${x.id}"><b>${esc(x.nombre)}</b><span>${textoDistancia(d)} · ${x.abiertoYa ? "Abierto" : "Cerrado"}</span></a>`).join("")}</div>` : ""}`;
  };

  const pintarLista = () => {
    const filas = visibles().map((l) => ({ l, d: yo ? distanciaM(yo, l) : null }))
      .sort((a, b) => (yo ? a.d - b.d : ORDEN[a.l.tipo] - ORDEN[b.l.tipo] || a.l.nombre.localeCompare(b.l.nombre)));
    lista.innerHTML = filas.map(({ l, d }) => `<li><button class="fila-lugar" data-lugar="${todos.indexOf(l)}">
        <span class="marcador marcador-${l.tipo} ${claseDe(l)}"><span>${iconoDeLugar(l)}</span></span>
        <span class="info"><strong>${esc(l.nombre)}</strong><span>${detalle(l)}</span></span>
        ${d == null ? "" : `<span class="distancia">${textoDistancia(d)}</span>`}</button></li>`).join("")
      || `<li class="tarjeta vacio"><strong>${filtro === "local" ? "Ningún local en el mapa todavía" : "Todavía no hay lugares aquí"}</strong>
        <span>${filtro === "local" ? "Los locales aparecen cuando su dueño los coloca desde su perfil." : "Las facultades y zonas aparecen cuando se colocan en el mapa."}</span></li>`;
  };

  const elegir = (l) => {
    if (elegido) marcadores.get(elegido)?.getElement()?.classList.remove("elegido");
    elegido = l;
    const m = l && marcadores.get(l);
    if (m) {
      m.getElement()?.classList.add("elegido");
      mapa.panTo(m.getLatLng());
    }
    pintarTarjeta();
  };

  document.getElementById("filtros-mapa").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-capa]");
    if (!chip) return;
    document.querySelectorAll("#filtros-mapa .chip").forEach((c) => c.classList.toggle("activo", c === chip));
    filtro = chip.dataset.capa;
    if (elegido && !visibles().includes(elegido)) elegir(null);
    marcadores.forEach((m, l) => (filtro === "todo" || l.tipo === filtro ? capa.addLayer(m) : capa.removeLayer(m)));
    pintarLista();
  });
  lista.addEventListener("click", (e) => {
    const fila = e.target.closest("[data-lugar]");
    if (!fila) return;
    elegir(todos[fila.dataset.lugar]);
    contenedor.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const botonYo = document.getElementById("mi-ubicacion");
  if (botonYo && mapa) {
    L.DomEvent.disableClickPropagation(botonYo);
    botonYo.addEventListener("click", async () => {
      botonYo.disabled = true;
      yo = await miUbicacion();
      botonYo.disabled = false;
      if (!yo) return alert("No pudimos ver dónde estás. Revisa el permiso de ubicación del navegador.");
      marcadorTu?.remove();
      marcadorTu = marcadorYo(yo).addTo(mapa);
      mapa.flyTo([yo.lat, yo.lng], 17);
      pintarLista();
      pintarTarjeta();
    });
  }
  pintarLista();
}
