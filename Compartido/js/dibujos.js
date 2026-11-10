// Dibujos de referencia para los menús (Compartido/img/menu/). Un producto sin foto se ve
// con el dibujo que eligió el local o, si no eligió, con el que mejor le queda por su
// nombre, categoría o descripción. En la base, productos.foto_url guarda "dibujo:<clave>"
// cuando el local elige uno. Un local sin logo se ve con el dibujo de su nombre
// ("Tacos El Gordo" → tacos) o con el de un local.
//
// Palabras: se buscan al inicio de una palabra ("taco" encuentra "tacos" y "taquito" no),
// sin acentos y en minúsculas. Con un espacio al final solo cuentan como palabra completa
// ("te " no encuentra "tequila"). Gana la que aparece primero en el texto; si empatan, la
// más larga ("agua de" le gana a "agua ").
const DIBUJOS = {
  tacos: { nombre: "Tacos", palabras: ["taco", "taquito", "taqueria", "tostada", "pastor", "suadero", "barbacoa", "carnitas", "campechano", "antojito"] },
  torta: { nombre: "Torta", palabras: ["torta", "torteria", "lonche", "loncheria", "pambazo", "guajolota"] },
  burrito: { nombre: "Burrito", palabras: ["burrito", "burro ", "burros", "wrap", "chimichanga"] },
  quesadilla: { nombre: "Quesadilla", palabras: ["quesadilla", "gringa", "sincronizada"] },
  gordita: { nombre: "Gordita", palabras: ["gordita", "sope", "huarache", "tlacoyo", "arepa", "pupusa"] },
  enchiladas: { nombre: "Enchiladas", palabras: ["enchilada", "enfrijolada", "entomatada", "enmolada", "flauta", "chilaquil", "tacos dorados", "taquitos dorados"] },
  tamal: { nombre: "Tamal", palabras: ["tamal", "uchepo", "zacahuil", "corunda"] },
  hamburguesa: { nombre: "Hamburguesa", palabras: ["hamburguesa", "hamburgesa", "hamburger", "burger"] },
  hotdog: { nombre: "Hot dog", palabras: ["hot dog", "hotdog", "dogo", "jocho", "salchicha", "banderilla"] },
  pizza: { nombre: "Pizza", palabras: ["pizza", "pizzeria", "pepperoni", "peperoni", "calzone"] },
  sandwich: { nombre: "Sándwich", palabras: ["sandwich", "sandwic", "sanwich", "sandwhich", "emparedado", "club ", "baguette", "panini", "bagel"] },
  plato: { nombre: "Comida", palabras: ["comida", "plato", "platillo", "menu del dia", "guisado", "pollo", "milanesa", "carne", "bistec", "arroz", "frijol", "pasta", "espagueti", "spaghetti", "lasagna", "chile relleno", "mole ", "picadillo", "asado", "fajita", "costilla", "pescado", "camaron", "filete", "almuerzo", "alambre", "alitas", "boneless", "cocina", "fonda", "comedor"] },
  sopa: { nombre: "Sopa", palabras: ["sopa", "maruchan", "ramen", "noodle", "caldo", "consome", "pozole", "menudo", "crema de", "fideo", "instantanea"] },
  ensalada: { nombre: "Ensalada", palabras: ["ensalada", "bowl", "poke", "verdura", "vegetal", "vegan", "vegetarian"] },
  desayuno: { nombre: "Desayuno", palabras: ["desayuno", "huevo", "omelet", "mollete", "machacado", "avena"] },
  hotcakes: { nombre: "Hot cakes", palabras: ["hotcake", "hot cake", "panqueque", "pancake", "waffle", "wafle", "crepa", "crepe", "pan frances"] },
  sushi: { nombre: "Sushi", palabras: ["sushi", "maki", "rollo", "roll ", "rolls", "california", "onigiri", "nigiri", "kushiage", "yakimeshi"] },
  nachos: { nombre: "Nachos", palabras: ["nacho", "totopo", "tostiloco", "doriloco", "chicharrones preparados"] },
  papas: { nombre: "Papas", palabras: ["papa", "francesa", "gajo", "salchipapa", "aros de cebolla", "fries"] },
  elote: { nombre: "Elote", palabras: ["elote", "esquite", "maiz", "chasca", "trolelote"] },
  fruta: { nombre: "Fruta", palabras: ["fruta", "fruteria", "coctel de fruta", "ensalada de fruta", "fresa", "mango", "sandia", "melon", "papaya", "piña", "pina", "pepino", "jicama", "manzana", "uva", "platano", "naranja", "toronja", "yogur", "granola", "parfait"] },
  botana: { nombre: "Botana", palabras: ["botana", "snack", "sabritas", "papitas", "fritura", "chicharron", "cacahuate", "cheetos", "doritos", "takis", "ruffles", "rancheritos", "churrumais", "tostitos", "palomitas", "dulce", "gomita", "chips"] },
  cafe: { nombre: "Café", palabras: ["cafe", "americano", "espresso", "expreso", "capuchino", "cappuccino", "latte", "mocha", "moka", "macchiato", "matcha", "te ", "tisana", "infusion", "chocolate", "atole", "champurrado", "chai", "bebida caliente", "bebidas calientes"] },
  frappe: { nombre: "Frappé", palabras: ["frappe", "frape", "frapuccino", "frappuccino", "cafe frio", "cafe helado", "iced", "cold brew", "malteada", "milkshake", "chamoyada", "raspado", "raspa ", "granizado"] },
  licuado: { nombre: "Licuado", palabras: ["licuado", "jugo", "jugueria", "smoothie", "batido", "chocomilk", "leche", "proteina", "yakult", "boing"] },
  "agua-fresca": { nombre: "Agua fresca", palabras: ["agua de", "agua fresca", "aguas frescas", "horchata", "jamaica", "limonada", "naranjada", "tamarindo", "te helado", "te frio", "iced tea", "bebida", "drink"] },
  refresco: { nombre: "Refresco", palabras: ["refresco", "soda", "coca", "pepsi", "sprite", "fanta", "manzanita", "sidral", "squirt", "mundet", "jarrito", "7up", "seven up", "fresca ", "lata", "topo chico", "agua mineral", "mineral", "red bull", "monster", "energetica", "energizante", "dr pepper"] },
  agua: { nombre: "Agua", palabras: ["agua ", "agua natural", "agua embotellada", "botella de agua", "ciel", "epura", "e pura", "bonafont", "electrolit", "gatorade", "powerade", "suero"] },
  postre: { nombre: "Postre", palabras: ["postre", "pastel", "pay ", "pie ", "cheesecake", "flan", "chocoflan", "gelatina", "brownie", "tres leches", "carlota", "mousse", "tiramisu", "cupcake", "arroz con leche", "gansito", "pinguino", "reposteria", "cajeta"] },
  pan: { nombre: "Pan dulce", palabras: ["pan ", "pan dulce", "panaderia", "concha", "cuerno", "cuernito", "croissant", "mantecada", "panque", "muffin", "polvoron", "oreja", "rol ", "roles", "rollo de canela", "empanada", "churro", "bisquet", "magdalena", "cocol", "marranito", "puerquito", "bolillo", "telera"] },
  dona: { nombre: "Dona", palabras: ["dona", "donut", "dough", "berlina"] },
  galletas: { nombre: "Galletas", palabras: ["galleta", "cookie", "barra", "barrita", "oreo", "emperador", "chokis", "marias"] },
  helado: { nombre: "Helado", palabras: ["helado", "nieve", "neveria", "paleta", "paleteria", "cono", "sundae", "yogurt helado", "frozen", "mantecado"] },
  platillo: { nombre: "Platillo", palabras: [] },
  local: { nombre: "Local", palabras: [] },
};

const CARPETA_DIBUJOS = new URL("../img/menu/", document.currentScript.src).href;

// Minúsculas, sin acentos (la ñ se queda: "doña" no es "dona") y solo letras y números.
function normalizarTexto(texto) {
  return String(texto ?? "").toLowerCase().normalize("NFD")
    .replace(/ñ/g, "ñ").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ").trim();
}

// Clave del dibujo que mejor le queda a un texto, o null si ninguno.
function buscarDibujo(texto) {
  const t = ` ${normalizarTexto(texto)} `;
  let mejor = null;
  for (const [clave, { palabras }] of Object.entries(DIBUJOS)) {
    for (const palabra of palabras) {
      const i = t.indexOf(` ${palabra}`);
      if (i >= 0 && (!mejor || i < mejor.i || (i === mejor.i && palabra.length > mejor.largo)))
        mejor = { clave, i, largo: palabra.length };
    }
  }
  return mejor?.clave ?? null;
}

const esDibujo = (url) => String(url ?? "").startsWith("dibujo:");
const urlDibujo = (clave) => `${CARPETA_DIBUJOS}${clave}.svg`;

// Dibujo de un producto: el que eligió el local o el que le toca por sus textos.
function dibujoDe(p) {
  const elegido = esDibujo(p.foto_url) && p.foto_url.slice(7);
  if (elegido && DIBUJOS[elegido]) return elegido;
  return buscarDibujo(p.nombre) || buscarDibujo(p.categoria) || buscarDibujo(p.descripcion) || "platillo";
}

// { url, dibujo }: la foto o el logo, o el dibujo que toca (dibujo = su clave).
function imagenProducto(p) {
  const foto = fotoSegura(p.foto_url);
  if (foto) return { url: foto, dibujo: null };
  const clave = dibujoDe(p);
  return { url: urlDibujo(clave), dibujo: clave };
}

function imagenLocal(l) {
  const logo = fotoSegura(l.logo_url);
  if (logo) return { url: logo, dibujo: null };
  const clave = buscarDibujo(l.nombre) || "local";
  return { url: urlDibujo(clave), dibujo: clave };
}

// Para las plantillas: <div class="foto" ${atributosImagen(imagenProducto(p))}></div>.
function atributosImagen({ url, dibujo }) {
  return `style="background-image:url('${esc(url)}')"${dibujo ? ` data-dibujo="${dibujo}"` : ""}`;
}

// Lo mismo para un elemento que ya está en la página.
function ponerImagen(elemento, { url, dibujo }) {
  elemento.style.backgroundImage = `url('${url}')`;
  if (dibujo) elemento.dataset.dibujo = dibujo;
  else delete elemento.dataset.dibujo;
}
