/**
 * Carga masiva de barrios desde un CSV.
 *
 * Formato esperado (con encabezado):
 *   ciudad,barrio,valor_domicilio
 *   Medellín,Popular Nº 1,10000
 *
 * Uso:
 *   node scripts/cargar_barrios_csv.js [ruta/al/archivo.csv]
 *   (por defecto: scripts/barrios_medellin_envigado.csv)
 *
 * Es idempotente: antes de insertar cada barrio, compara contra los barrios
 * ya existentes en esa ciudad usando el nombre normalizado (sin tildes,
 * minusculas, espacios colapsados) -- si ya existe, lo salta en vez de
 * duplicarlo. Reutiliza la Ciudad si ya existe (comparacion normalizada
 * tambien), o la crea si no. Pensado para poder cargar mas ciudades despues
 * corriendo el mismo script contra un CSV distinto.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

function parseCsv(rutaCsv) {
  const contenido = fs.readFileSync(rutaCsv, 'utf8');
  const lineas = contenido.split(/\r?\n/).filter((l) => l.trim() !== '');
  const [header, ...filas] = lineas;
  const columnas = header.split(',').map((c) => c.trim().toLowerCase());
  const idxCiudad = columnas.indexOf('ciudad');
  const idxBarrio = columnas.indexOf('barrio');
  const idxValor  = columnas.indexOf('valor_domicilio');
  if (idxCiudad === -1 || idxBarrio === -1 || idxValor === -1) {
    throw new Error(`El CSV debe tener columnas ciudad,barrio,valor_domicilio -- encontradas: ${columnas.join(',')}`);
  }

  return filas.map((linea, i) => {
    // barrio puede traer comas si algun dato viene mal escapado -- se asume
    // que ciudad y valor_domicilio no las llevan, así que se parte por la
    // primera y la última coma y todo lo del medio es el nombre del barrio.
    const primeraComa = linea.indexOf(',');
    const ultimaComa  = linea.lastIndexOf(',');
    if (primeraComa === -1 || ultimaComa === primeraComa) {
      throw new Error(`Fila ${i + 2} mal formada: "${linea}"`);
    }
    const ciudad = linea.slice(0, primeraComa).trim();
    const barrio = linea.slice(primeraComa + 1, ultimaComa).trim();
    const valorRaw = linea.slice(ultimaComa + 1).trim();
    const valor = Number(valorRaw);
    if (!ciudad || !barrio) throw new Error(`Fila ${i + 2} con ciudad o barrio vacío: "${linea}"`);
    if (isNaN(valor)) throw new Error(`Fila ${i + 2} con valor_domicilio inválido: "${valorRaw}"`);
    return { ciudad, barrio, valor };
  });
}

async function obtenerOcrearCiudad(nombreCsv, cacheCiudades) {
  const key = norm(nombreCsv);
  if (cacheCiudades.has(key)) return cacheCiudades.get(key);

  const todas = await prisma.ciudad.findMany();
  const existente = todas.find((c) => norm(c.nombre) === key);
  if (existente) {
    cacheCiudades.set(key, existente);
    return existente;
  }

  const creada = await prisma.ciudad.create({ data: { nombre: nombreCsv, estado: 1 } });
  cacheCiudades.set(key, creada);
  console.log(`  + Ciudad creada: "${creada.nombre}" (id_ciudad=${creada.id_ciudad})`);
  return creada;
}

async function cargar(rutaCsv) {
  const filas = parseCsv(rutaCsv);
  console.log(`CSV: ${rutaCsv}`);
  console.log(`Filas leídas: ${filas.length}\n`);

  const cacheCiudades = new Map();
  // barriosPorCiudad[id_ciudad] = Set de nombres normalizados ya presentes
  // (se carga una vez por ciudad y se va actualizando en memoria a medida
  // que se insertan filas nuevas del mismo CSV, para detectar duplicados
  // internos del propio archivo además de los que ya estaban en BD).
  const barriosPorCiudad = new Map();

  const resumen = {}; // nombreCiudad -> { creados, saltados }
  const saltados = [];

  for (const fila of filas) {
    const ciudad = await obtenerOcrearCiudad(fila.ciudad, cacheCiudades);

    if (!barriosPorCiudad.has(ciudad.id_ciudad)) {
      const existentes = await prisma.barrio.findMany({ where: { id_ciudad: ciudad.id_ciudad } });
      barriosPorCiudad.set(ciudad.id_ciudad, new Set(existentes.map((b) => norm(b.nombre))));
    }
    const setBarrios = barriosPorCiudad.get(ciudad.id_ciudad);
    const keyBarrio = norm(fila.barrio);

    if (!resumen[ciudad.nombre]) resumen[ciudad.nombre] = { creados: 0, saltados: 0 };

    if (setBarrios.has(keyBarrio)) {
      resumen[ciudad.nombre].saltados++;
      saltados.push({ ciudad: ciudad.nombre, barrio: fila.barrio });
      continue;
    }

    await prisma.barrio.create({
      data: {
        id_ciudad: ciudad.id_ciudad,
        nombre: fila.barrio,
        precio_domicilio: fila.valor,
        estado: 1,
      },
    });
    setBarrios.add(keyBarrio);
    resumen[ciudad.nombre].creados++;
  }

  console.log('── Resumen ──');
  for (const [nombreCiudad, r] of Object.entries(resumen)) {
    console.log(`${nombreCiudad}: ${r.creados} creados, ${r.saltados} saltados (ya existían)`);
  }
  if (saltados.length) {
    console.log('\nBarrios saltados por ya existir:');
    saltados.forEach((s) => console.log(`  - [${s.ciudad}] ${s.barrio}`));
  }

  console.log('\n── Conteo final en BD ──');
  for (const ciudad of cacheCiudades.values()) {
    const total = await prisma.barrio.count({ where: { id_ciudad: ciudad.id_ciudad } });
    console.log(`${ciudad.nombre} (id_ciudad=${ciudad.id_ciudad}): ${total} barrios totales`);
  }
}

if (require.main === module) {
  const rutaArg = process.argv[2] || path.join(__dirname, 'barrios_medellin_envigado.csv');
  cargar(rutaArg)
    .catch((e) => {
      console.error('Error cargando barrios:', e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { parseCsv, norm };
