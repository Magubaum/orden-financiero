const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const ExcelJS = require("exceljs");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const uid = () => crypto.randomBytes(6).toString("hex");
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// ---------- Movimientos ----------
app.get("/api/movimientos", (req, res) => {
  const rows = db.prepare("SELECT * FROM movimientos ORDER BY fecha DESC").all();
  res.json(rows);
});

app.post("/api/movimientos", (req, res) => {
  const { tipo, categoria, monto, descripcion, fecha, persona } = req.body;
  if (!["ingreso", "gasto"].includes(tipo) || !categoria || !(Number(monto) > 0) || !fecha) {
    return res.status(400).json({ error: "Datos incompletos" });
  }
  const id = uid();
  db.prepare("INSERT INTO movimientos (id, tipo, categoria, monto, descripcion, fecha, persona) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, tipo, categoria, Number(monto), descripcion || "", fecha, persona || "");
  res.json({ id, tipo, categoria, monto: Number(monto), descripcion: descripcion || "", fecha, persona: persona || "" });
});

app.delete("/api/movimientos/:id", (req, res) => {
  db.prepare("DELETE FROM movimientos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- Categorías ----------
app.get("/api/categorias", (req, res) => {
  const rows = db.prepare("SELECT tipo, nombre FROM categorias ORDER BY rowid").all();
  res.json({
    ingreso: rows.filter((r) => r.tipo === "ingreso").map((r) => r.nombre),
    gasto: rows.filter((r) => r.tipo === "gasto").map((r) => r.nombre),
  });
});

app.put("/api/categorias/:tipo", (req, res) => {
  const tipo = req.params.tipo;
  const { categorias } = req.body;
  if (!["ingreso", "gasto"].includes(tipo) || !Array.isArray(categorias)) {
    return res.status(400).json({ error: "Datos incompletos" });
  }
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM categorias WHERE tipo = ?").run(tipo);
    const insert = db.prepare("INSERT INTO categorias (tipo, nombre) VALUES (?, ?)");
    for (const nombre of categorias) insert.run(tipo, nombre);
  });
  tx();
  res.json({ ok: true });
});

// ---------- Objetivos ----------
app.get("/api/objetivos", (req, res) => {
  const objetivos = db.prepare("SELECT * FROM objetivos ORDER BY rowid").all();
  const aportes = db.prepare("SELECT * FROM aportes ORDER BY fecha").all();
  const conAportes = objetivos.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    montoObjetivo: o.monto_objetivo,
    aportes: aportes.filter((a) => a.objetivo_id === o.id).map((a) => ({ id: a.id, monto: a.monto, fecha: a.fecha })),
  }));
  res.json(conAportes);
});

app.post("/api/objetivos", (req, res) => {
  const { nombre, montoObjetivo } = req.body;
  if (!nombre || !(Number(montoObjetivo) > 0)) return res.status(400).json({ error: "Datos incompletos" });
  const id = uid();
  db.prepare("INSERT INTO objetivos (id, nombre, monto_objetivo) VALUES (?, ?, ?)").run(id, nombre, Number(montoObjetivo));
  res.json({ id, nombre, montoObjetivo: Number(montoObjetivo), aportes: [] });
});

app.delete("/api/objetivos/:id", (req, res) => {
  db.prepare("DELETE FROM aportes WHERE objetivo_id = ?").run(req.params.id);
  db.prepare("DELETE FROM objetivos WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/objetivos/:id/aportes", (req, res) => {
  const { monto, fecha } = req.body;
  if (!(Number(monto) > 0) || !fecha) return res.status(400).json({ error: "Datos incompletos" });
  const id = uid();
  db.prepare("INSERT INTO aportes (id, objetivo_id, monto, fecha) VALUES (?, ?, ?, ?)").run(id, req.params.id, Number(monto), fecha);
  res.json({ id, monto: Number(monto), fecha });
});

// ---------- Export a Excel ----------
app.get("/api/export", async (req, res) => {
  const movimientos = db.prepare("SELECT * FROM movimientos ORDER BY fecha ASC").all();
  const objetivos = db.prepare("SELECT * FROM objetivos ORDER BY rowid").all();
  const aportes = db.prepare("SELECT * FROM aportes").all();

  const wb = new ExcelJS.Workbook();

  const wsMov = wb.addWorksheet("Movimientos");
  wsMov.columns = [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Categoría", key: "categoria", width: 24 },
    { header: "Monto", key: "monto", width: 14 },
    { header: "Descripción", key: "descripcion", width: 28 },
    { header: "Persona", key: "persona", width: 14 },
  ];
  wsMov.getRow(1).font = { bold: true };
  movimientos.forEach((m) => wsMov.addRow({
    fecha: m.fecha, tipo: m.tipo === "ingreso" ? "Ingreso" : "Gasto",
    categoria: m.categoria, monto: m.monto, descripcion: m.descripcion, persona: m.persona,
  }));

  const meses = Array.from(new Set(movimientos.map((m) => m.fecha.slice(0, 7)))).sort();
  const wsResumen = wb.addWorksheet("Resumen mensual");
  wsResumen.columns = [
    { header: "Mes", key: "mes", width: 18 },
    { header: "Ingresos", key: "ingresos", width: 14 },
    { header: "Gastos", key: "gastos", width: 14 },
    { header: "Ahorro", key: "ahorro", width: 14 },
  ];
  wsResumen.getRow(1).font = { bold: true };
  meses.forEach((k) => {
    const delMes = movimientos.filter((m) => m.fecha.slice(0, 7) === k);
    const ing = delMes.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
    const gas = delMes.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);
    const [y, mo] = k.split("-");
    wsResumen.addRow({ mes: `${MESES[Number(mo) - 1]} ${y}`, ingresos: ing, gastos: gas, ahorro: ing - gas });
  });

  const wsObj = wb.addWorksheet("Objetivos de ahorro");
  wsObj.columns = [
    { header: "Objetivo", key: "nombre", width: 24 },
    { header: "Monto objetivo", key: "objetivo", width: 16 },
    { header: "Aportado", key: "aportado", width: 14 },
    { header: "Restante", key: "restante", width: 14 },
  ];
  wsObj.getRow(1).font = { bold: true };
  objetivos.forEach((o) => {
    const aportado = aportes.filter((a) => a.objetivo_id === o.id).reduce((s, a) => s + a.monto, 0);
    wsObj.addRow({ nombre: o.nombre, objetivo: o.monto_objetivo, aportado, restante: Math.max(0, o.monto_objetivo - aportado) });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="orden-financiero.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// Todo lo que no sea /api va al front (SPA de una sola página).
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Orden financiero corriendo en el puerto ${PORT}`));
