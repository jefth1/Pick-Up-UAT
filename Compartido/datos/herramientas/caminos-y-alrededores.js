// Arma uat-caminos.geojson y uat-alrededores.geojson con dos descargas de Overpass
// (ver ../LEEME.md):
//   node caminos-y-alrededores.js <dentro.json> <alrededor.json> <carpeta de salida>
// Lo que ya está en uat-campus.geojson (facultades, edificios, canchas…) no se repite, y
// las calles que cruzan el borde del campus quedan completas en uat-caminos.
const fs = require("fs");
const path = require("path");
const [, , insidePath, outsidePath, outDir] = process.argv;
const CAMPUS_ID = 200606345;
const r6 = (n) => Number(n.toFixed(6));
const pt = (p) => [r6(p.lon), r6(p.lat)];
const isClosed = (w) => w.nodes && w.nodes.length > 3 && w.nodes[0] === w.nodes[w.nodes.length - 1];
const coords = (w) => w.geometry.map(pt);
function inRing(p, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function centroid(ring) {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const f = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    a += f; x += (ring[i][0] + ring[i + 1][0]) * f; y += (ring[i][1] + ring[i + 1][1]) * f;
  }
  if (Math.abs(a) < 1e-14) { const n = ring.length; return [r6(ring.reduce((s, p) => s + p[0], 0) / n), r6(ring.reduce((s, p) => s + p[1], 0) / n)]; }
  a /= 2;
  return [r6(x / (6 * a)), r6(y / (6 * a))];
}
function center(e) {
  if (e.type === "node") return pt(e);
  if (e.type === "way" && e.geometry) return centroid(coords(e));
  if (e.bounds) return [r6((e.bounds.minlon + e.bounds.maxlon) / 2), r6((e.bounds.minlat + e.bounds.maxlat) / 2)];
  return null;
}
const props = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
const F = (geometry, properties) => ({ type: "Feature", properties, geometry });
const line = (e, p) => F({ type: "LineString", coordinates: coords(e) }, props(p));
const poly = (e, p) => F({ type: "Polygon", coordinates: [coords(e)] }, props(p));
const point = (c, p) => F({ type: "Point", coordinates: c }, props(p));
const area = (e, p) => (e.type === "way" && isClosed(e) ? poly(e, p) : line(e, p));
const rank = { Polygon: 0, LineString: 1, Point: 2 };
const write = (name, features) => fs.writeFileSync(path.join(outDir, name), JSON.stringify({ type: "FeatureCollection", features }));

// 1) Dentro del campus: calles, andadores, árboles y arbustos → uat-caminos.geojson
const inside = JSON.parse(fs.readFileSync(insidePath, "utf8")).elements;
const campusRing = coords(inside.find((e) => e.type === "way" && e.id === CAMPUS_ID));
const insideIds = new Set(inside.map((e) => `${e.type}/${e.id}`));
const f1 = [];
for (const e of inside) {
  const t = e.tags || {};
  if (e.type === "way" && t.highway) { f1.push(line(e, { h: t.highway, n: t.name, a: t.area === "yes" ? 1 : undefined })); continue; }
  let tv = null;
  if (["tree", "shrub", "scrub"].includes(t.natural)) tv = `natural=${t.natural}`;
  else if (t.barrier === "gate") tv = "barrier=gate";
  else if (t.amenity && !["university", "parking", "library"].includes(t.amenity)) tv = `amenity=${t.amenity}`;
  if (!tv) continue;
  if (e.type === "node") f1.push(point(pt(e), { t: tv, n: t.name }));
  else if (e.type === "way") f1.push(area(e, { t: tv, n: t.name }));
}
f1.sort((a, b) => rank[a.geometry.type] - rank[b.geometry.type]);
write("uat-caminos.geojson", f1);

// 2) Alrededor: calles, manzanas, edificios y comercios con nombre → uat-alrededores.geojson
const outside = JSON.parse(fs.readFileSync(outsidePath, "utf8")).elements;
const f2 = [], seen = new Set();
for (const e of outside) {
  const key = `${e.type}/${e.id}`;
  if (seen.has(key) || (e.type === "way" && (e.id === CAMPUS_ID || !e.geometry))) continue;
  seen.add(key);
  const t = e.tags || {}, c = center(e);
  if (e.type === "way" && t.highway && insideIds.has(key)) continue;        // ya está en el interior
  if (insideIds.has(key) && c && inRing(c, campusRing)) continue;           // parte del campus
  if (e.type === "way" && t.highway) { f2.push(line(e, { h: t.highway, n: t.name, a: t.area === "yes" ? 1 : undefined })); continue; }
  if (e.type === "way" && t.building) f2.push(poly(e, { n: t.name }));
  else if (e.type === "way" && (t.waterway || t.natural === "water")) f2.push(area(e, { t: t.waterway ? `waterway=${t.waterway}` : "natural=water", n: t.name }));
  else if (e.type === "way" && (t.landuse || t.leisure || t.natural)) { const k = t.landuse ? "landuse" : t.leisure ? "leisure" : "natural"; f2.push(area(e, { t: `${k}=${t[k]}`, n: t.name })); }
  if (t.name && (t.amenity || t.shop) && c) { const k = t.amenity ? "amenity" : "shop"; f2.push(point(c, { t: `${k}=${t[k]}`, n: t.name })); }
}
f2.sort((a, b) => rank[a.geometry.type] - rank[b.geometry.type]);
write("uat-alrededores.geojson", f2);
