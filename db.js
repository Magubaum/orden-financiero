const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "orden-financiero.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS movimientos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto')),
    categoria TEXT NOT NULL,
    monto REAL NOT NULL,
    descripcion TEXT,
    fecha TEXT NOT NULL,
    persona TEXT
  );

  CREATE TABLE IF NOT EXISTS categorias (
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto')),
    nombre TEXT NOT NULL,
    PRIMARY KEY (tipo, nombre)
  );

  CREATE TABLE IF NOT EXISTS objetivos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    monto_objetivo REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS aportes (
    id TEXT PRIMARY KEY,
    objetivo_id TEXT NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
    monto REAL NOT NULL,
    fecha TEXT NOT NULL
  );
`);

// Semilla de categorías si la tabla está vacía, tomadas de la planilla de Magu.
const catCount = db.prepare("SELECT COUNT(*) AS c FROM categorias").get().c;
if (catCount === 0) {
  const insertCat = db.prepare("INSERT INTO categorias (tipo, nombre) VALUES (?, ?)");
  const ingresos = ["Salario Agus", "Salario Magu", "Inversiones", "Otras Fuentes", "Cliente 1", "Cliente 2", "Cliente 3", "Cliente 4"];
  const gastos = [
    "Alquiler/Hipoteca", "Servicios Públicos", "Verdulería", "Transporte", "Prepaga", "Cooperativa",
    "Deudas", "Pagos", "Seguro", "Credito Hip", "Supermercado", "Delivery", "Luz", "Gas", "Celular",
    "Lety", "Tarjeta Visa", "Tarjeta Master", "Tarjeta ICBC", "Gimnasio", "Otros Gastos",
  ];
  const insertMany = db.transaction((tipo, lista) => {
    for (const n of lista) insertCat.run(tipo, n);
  });
  insertMany("ingreso", ingresos);
  insertMany("gasto", gastos);
}

module.exports = db;
