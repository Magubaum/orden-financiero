const CATS_INGRESO_DEFAULT = ["Salario Agus", "Salario Magu", "Inversiones", "Otras Fuentes", "Cliente 1", "Cliente 2", "Cliente 3", "Cliente 4"];
const CATS_GASTO_DEFAULT = [
  "Alquiler/Hipoteca", "Servicios Públicos", "Verdulería", "Transporte", "Prepaga", "Cooperativa",
  "Deudas", "Pagos", "Seguro", "Credito Hip", "Supermercado", "Delivery", "Luz", "Gas", "Celular",
  "Lety", "Tarjeta Visa", "Tarjeta Master", "Tarjeta ICBC", "Gimnasio", "Otros Gastos",
];
const MEDIOS_PAGO = ["Efectivo", "Tarjeta", "Dólar"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const state = {
  movimientos: [],
  categorias: { ingreso: CATS_INGRESO_DEFAULT, gasto: CATS_GASTO_DEFAULT },
  objetivos: [],
  mes: new Date(),
  filtro: "todos",
  quienSos: localStorage.getItem("of-quien-sos") || "",
  listo: false,
  primerRenderHecho: false,
};

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monedaDeMovimiento(m) { return m.medioPago === "Dólar" ? "USD" : "ARS"; }
function fmtMoney(n, moneda) {
  const v = Number(n) || 0;
  if (moneda === "USD") return "US$ " + v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
function esc(s) { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; }

// ---------- Firestore: escucha en tiempo real ----------
db.collection("movimientos").onSnapshot((snap) => {
  state.movimientos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.listo = true;
  render();
}, (err) => mostrarErrorConexion(err));

db.collection("config").doc("categorias").onSnapshot(async (doc) => {
  if (doc.exists) {
    state.categorias = doc.data();
  } else {
    // Primera vez que se usa la app: sembramos las categorías por defecto.
    await db.collection("config").doc("categorias").set({ ingreso: CATS_INGRESO_DEFAULT, gasto: CATS_GASTO_DEFAULT });
  }
  render();
}, (err) => mostrarErrorConexion(err));

db.collection("objetivos").onSnapshot((snap) => {
  state.objetivos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}, (err) => mostrarErrorConexion(err));

function mostrarErrorConexion(err) {
  console.error(err);
  document.getElementById("root").innerHTML = `
    <div style="max-width:480px;margin:60px auto;padding:20px;background:#F5FAFD;border-radius:8px;font-family:Georgia,serif">
      <h3>No se pudo conectar con la base de datos</h3>
      <p style="font-size:14px;color:#6D8A99">
        Revisá que en <code>firebase-config.js</code> hayan quedado bien pegados los datos del proyecto de Firebase,
        y que la base de datos Firestore esté creada y en modo que permita lectura y escritura.
      </p>
    </div>`;
}

function movimientosDelMes(mk) { return state.movimientos.filter((m) => m.fecha.slice(0, 7) === mk); }

// Suma separada por moneda: nunca se mezcla ARS con USD en un mismo número.
function totalesPorMoneda(lista) {
  return lista.reduce((acc, m) => {
    const moneda = monedaDeMovimiento(m);
    acc[moneda] = (acc[moneda] || 0) + Number(m.monto || 0);
    return acc;
  }, { ARS: 0, USD: 0 });
}

// Aportes de un objetivo, separados por moneda (cada aporte puede tener la suya).
function aportadoPorMoneda(o) {
  return (o.aportes || []).reduce((acc, a) => {
    const moneda = a.moneda === "USD" ? "USD" : "ARS";
    acc[moneda] = (acc[moneda] || 0) + Number(a.monto || 0);
    return acc;
  }, { ARS: 0, USD: 0 });
}

function render() {
  if (!state.listo) return;

  // Primera vez que la app carga en este dispositivo: pedimos el nombre.
  if (!state.primerRenderHecho) {
    state.primerRenderHecho = true;
    if (!state.quienSos) { setTimeout(abrirQuienSos, 0); }
  }

  const mk = monthKey(state.mes);
  const delMes = movimientosDelMes(mk);
  const ingresosMes = totalesPorMoneda(delMes.filter((m) => m.tipo === "ingreso"));
  const gastosMes = totalesPorMoneda(delMes.filter((m) => m.tipo === "gasto"));
  const ahorroARS = ingresosMes.ARS - gastosMes.ARS;
  const ahorroUSD = ingresosMes.USD - gastosMes.USD;

  const mesAnterior = new Date(state.mes); mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  const mkAnterior = monthKey(mesAnterior);
  const delMesAnterior = movimientosDelMes(mkAnterior);
  const gastosMesAnteriorARS = totalesPorMoneda(delMesAnterior.filter((m) => m.tipo === "gasto")).ARS;
  const diffPct = delMesAnterior.length > 0 && gastosMesAnteriorARS > 0 ? ((gastosMes.ARS - gastosMesAnteriorARS) / gastosMesAnteriorARS) * 100 : null;

  let filtrados = delMes.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  if (state.filtro === "ingresos") filtrados = filtrados.filter((m) => m.tipo === "ingreso");
  if (state.filtro === "gastos") filtrados = filtrados.filter((m) => m.tipo === "gasto");

  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="spine"></div>
    <div class="wrap">
      <header class="top">
        <div>
          <div class="eyebrow">Orden financiero</div>
          <h1>${MESES[state.mes.getMonth()]} ${state.mes.getFullYear()}</h1>
        </div>
        <div class="controls">
          <button class="navbtn round" id="mes-prev" aria-label="Mes anterior">‹</button>
          <button class="navbtn round" id="mes-next" aria-label="Mes siguiente">›</button>
          <button class="navbtn" id="btn-export">Exportar Excel</button>
          <button class="navbtn" id="btn-cats">Categorías</button>
          <button class="navbtn" id="btn-quien">${state.quienSos ? `sos ${esc(state.quienSos)}` : "config"}</button>
        </div>
      </header>

      <section class="cards">
        <div class="card">
          <div class="label">Ingresos del mes</div>
          <div class="valor mono" style="color:#3F93B5">${fmtMoney(ingresosMes.ARS, "ARS")}</div>
          ${ingresosMes.USD ? `<div class="sub mono">${fmtMoney(ingresosMes.USD, "USD")}</div>` : ""}
        </div>
        <div class="card">
          <div class="label">Gastos del mes</div>
          <div class="valor mono" style="color:#2E7A9C">${fmtMoney(gastosMes.ARS, "ARS")}</div>
          ${gastosMes.USD ? `<div class="sub mono">${fmtMoney(gastosMes.USD, "USD")}</div>` : ""}
          ${diffPct === null ? "" : `<div class="badge ${diffPct >= 0 ? "sube" : "baja"} mono">${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(0)}% vs ${MESES[mesAnterior.getMonth()]}</div>`}
        </div>
        <div class="card">
          <div class="label">Ahorro del mes</div>
          <div class="valor mono" style="color:${ahorroARS >= 0 ? "#2E7C6C" : "#B75A34"}">${fmtMoney(ahorroARS, "ARS")}</div>
          ${ingresosMes.USD || gastosMes.USD ? `<div class="sub mono" style="color:${ahorroUSD >= 0 ? "#2E7C6C" : "#B75A34"}">${fmtMoney(ahorroUSD, "USD")}</div>` : ""}
        </div>
      </section>

      <section>
        <div class="section-header">
          <h2>Objetivos de ahorro</h2>
          <button class="linklike" id="btn-objetivos">+ gestionar objetivos</button>
        </div>
        ${state.objetivos.length === 0 ? `<div class="empty">Todavía no cargaron ningún objetivo. Podés armar uno para el fondo de emergencia, unas vacaciones, lo que sea.</div>` : ""}
        ${state.objetivos.map((o) => {
          const moneda = o.moneda === "USD" ? "USD" : "ARS";
          const aportado = aportadoPorMoneda(o);
          const aportadoEnSuMoneda = aportado[moneda];
          const otraMoneda = moneda === "USD" ? "ARS" : "USD";
          const aportadoOtraMoneda = aportado[otraMoneda];
          const restante = Math.max(0, o.montoObjetivo - aportadoEnSuMoneda);
          const pct = o.montoObjetivo > 0 ? Math.min(100, (aportadoEnSuMoneda / o.montoObjetivo) * 100) : 0;
          return `
            <div class="goal">
              <div class="goal-top">
                <span class="goal-nombre">${esc(o.nombre)}</span>
                <button class="linklike btn-aporte" data-id="${o.id}">+ aporte</button>
              </div>
              <div class="goal-meta mono">${fmtMoney(aportadoEnSuMoneda, moneda)} / ${fmtMoney(o.montoObjetivo, moneda)} · falta ${fmtMoney(restante, moneda)}</div>
              ${aportadoOtraMoneda ? `<div class="goal-meta mono" style="margin-top:-4px">además, ${fmtMoney(aportadoOtraMoneda, otraMoneda)} aportados aparte (no cuentan para esta meta, está en ${moneda})</div>` : ""}
              <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join("")}
      </section>

      <section>
        <div class="section-header">
          <div class="tabs">
            <button class="tab ${state.filtro === "todos" ? "active" : ""}" data-filtro="todos">Todos</button>
            <button class="tab ${state.filtro === "ingresos" ? "active" : ""}" data-filtro="ingresos">Ingresos</button>
            <button class="tab ${state.filtro === "gastos" ? "active" : ""}" data-filtro="gastos">Gastos</button>
          </div>
          <button class="linklike" id="btn-add-mov">+ cargar movimiento</button>
        </div>
        <div class="list">
          ${filtrados.length === 0 ? `<div class="empty">No hay movimientos cargados con este filtro para este mes.</div>` : ""}
          ${filtrados.map((m) => `
            <div class="row">
              <div style="flex:1">
                <div class="titulo">${esc(m.categoria)}${m.descripcion ? ` · ${esc(m.descripcion)}` : ""}</div>
                <div class="meta">${esc(m.persona || "?")} · ${esc(m.medioPago || "Efectivo")} · ${m.fecha.slice(8,10)}/${m.fecha.slice(5,7)}</div>
              </div>
              <div class="monto mono" style="color:${m.tipo === "ingreso" ? "#2E7C6C" : "#2E7A9C"}">${m.tipo === "ingreso" ? "+" : "−"}${fmtMoney(m.monto, monedaDeMovimiento(m))}</div>
              <button class="delbtn btn-del-mov" data-id="${m.id}" aria-label="Eliminar">✕</button>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
  `;

  wireEvents();
}

function wireEvents() {
  document.getElementById("mes-prev").onclick = () => { state.mes.setMonth(state.mes.getMonth() - 1); render(); };
  document.getElementById("mes-next").onclick = () => { state.mes.setMonth(state.mes.getMonth() + 1); render(); };
  document.getElementById("btn-export").onclick = exportarExcel;
  document.getElementById("btn-cats").onclick = abrirCategorias;
  document.getElementById("btn-quien").onclick = abrirQuienSos;
  document.getElementById("btn-objetivos").onclick = abrirObjetivos;
  document.getElementById("btn-add-mov").onclick = abrirNuevoMovimiento;

  document.querySelectorAll(".tab").forEach((el) => { el.onclick = () => { state.filtro = el.dataset.filtro; render(); }; });
  document.querySelectorAll(".btn-del-mov").forEach((el) => { el.onclick = () => db.collection("movimientos").doc(el.dataset.id).delete(); });
  document.querySelectorAll(".btn-aporte").forEach((el) => { el.onclick = () => abrirAporte(el.dataset.id); });
}

function abrirOverlay(html) {
  const div = document.createElement("div");
  div.className = "overlay";
  div.innerHTML = `<div class="sheet">${html}</div>`;
  div.addEventListener("click", (e) => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  return div;
}

function abrirQuienSos() {
  const ov = abrirOverlay(`
    <h3 style="margin-top:0">¿Quién sos?</h3>
    <p style="font-size:13px;color:#6D8A99">Es solo para que quede registrado quién cargó cada movimiento. Se guarda en este dispositivo.</p>
    <div class="field"><input id="qs-nombre" placeholder="Tu nombre" value="${esc(state.quienSos)}" /></div>
    <button class="btn-primary" id="qs-guardar">Guardar</button>
  `);
  ov.querySelector("#qs-guardar").onclick = () => {
    const val = ov.querySelector("#qs-nombre").value.trim();
    state.quienSos = val;
    localStorage.setItem("of-quien-sos", val);
    ov.remove();
    render();
  };
}

function abrirNuevoMovimiento() {
  let tipo = "gasto";
  const ov = abrirOverlay(`
    <h3 style="margin-top:0">Nuevo movimiento</h3>
    <div class="field">
      <div class="tipo-toggle">
        <button id="tt-gasto" class="active-gasto">Gasto</button>
        <button id="tt-ingreso">Ingreso</button>
      </div>
    </div>
    <div class="field">
      <div class="field-label">Categoría</div>
      <select id="mv-categoria"></select>
    </div>
    <div class="field">
      <div class="field-label">Método de pago</div>
      <select id="mv-mediopago">${MEDIOS_PAGO.map((mp) => `<option>${mp}</option>`).join("")}</select>
    </div>
    <div class="field">
      <div class="field-label">Monto ${"" /* aclaración dinámica según método de pago */}<span id="mv-moneda-hint" class="mono" style="text-transform:none;letter-spacing:0"></span></div>
      <input id="mv-monto" type="number" placeholder="0" />
    </div>
    <div class="field">
      <div class="field-label">Descripción (opcional)</div>
      <input id="mv-desc" />
    </div>
    <div class="field">
      <div class="field-label">Fecha</div>
      <input id="mv-fecha" type="date" value="${new Date().toISOString().slice(0,10)}" />
    </div>
    <button class="btn-primary" id="mv-guardar">Guardar</button>
    <button class="btn-secondary" id="mv-cancelar">Cancelar</button>
  `);

  function pintarCats() {
    const sel = ov.querySelector("#mv-categoria");
    const cats = state.categorias[tipo] || [];
    sel.innerHTML = cats.map((c) => `<option>${esc(c)}</option>`).join("");
  }
  function pintarHintMoneda() {
    const mp = ov.querySelector("#mv-mediopago").value;
    ov.querySelector("#mv-moneda-hint").textContent = mp === "Dólar" ? " (en dólares)" : " (en pesos)";
  }
  pintarCats();
  pintarHintMoneda();
  ov.querySelector("#mv-mediopago").onchange = pintarHintMoneda;

  ov.querySelector("#tt-gasto").onclick = () => {
    tipo = "gasto";
    ov.querySelector("#tt-gasto").className = "active-gasto";
    ov.querySelector("#tt-ingreso").className = "";
    pintarCats();
  };
  ov.querySelector("#tt-ingreso").onclick = () => {
    tipo = "ingreso";
    ov.querySelector("#tt-ingreso").className = "active-ingreso";
    ov.querySelector("#tt-gasto").className = "";
    pintarCats();
  };
  ov.querySelector("#mv-cancelar").onclick = () => ov.remove();
  ov.querySelector("#mv-guardar").onclick = async () => {
    const categoria = ov.querySelector("#mv-categoria").value;
    const medioPago = ov.querySelector("#mv-mediopago").value;
    const monto = Number(ov.querySelector("#mv-monto").value);
    const descripcion = ov.querySelector("#mv-desc").value.trim();
    const fecha = ov.querySelector("#mv-fecha").value;
    if (!categoria || !(monto > 0) || !fecha) return;
    await db.collection("movimientos").add({ tipo, categoria, medioPago, monto, descripcion, fecha, persona: state.quienSos });
    ov.remove();
  };
}

function abrirCategorias() {
  const ov = abrirOverlay(`
    <h3 style="margin-top:0">Categorías</h3>
    <div class="field">
      <div class="field-label">Ingresos</div>
      <div id="chips-ingreso" style="margin:6px 0 8px"></div>
      <div class="newcat"><input id="nueva-ingreso" placeholder="Nueva categoría" /><button id="add-ingreso">Agregar</button></div>
    </div>
    <div class="field">
      <div class="field-label">Gastos</div>
      <div id="chips-gasto" style="margin:6px 0 8px"></div>
      <div class="newcat"><input id="nueva-gasto" placeholder="Nueva categoría" /><button id="add-gasto">Agregar</button></div>
    </div>
    <button class="btn-secondary" id="cats-cerrar">Cerrar</button>
  `);

  function pintarChips(tipo) {
    const cont = ov.querySelector(`#chips-${tipo}`);
    cont.innerHTML = (state.categorias[tipo] || []).map((c) => `
      <span class="chip">${esc(c)}<button data-tipo="${tipo}" data-nombre="${esc(c)}" class="chip-del">✕</button></span>
    `).join("");
    cont.querySelectorAll(".chip-del").forEach((b) => {
      b.onclick = async () => {
        const next = state.categorias[tipo].filter((x) => x !== b.dataset.nombre);
        await db.collection("config").doc("categorias").update({ [tipo]: next });
      };
    });
  }
  pintarChips("ingreso");
  pintarChips("gasto");

  ov.querySelector("#add-ingreso").onclick = async () => {
    const input = ov.querySelector("#nueva-ingreso");
    const val = input.value.trim();
    if (!val || state.categorias.ingreso.includes(val)) return;
    await db.collection("config").doc("categorias").update({ ingreso: [...state.categorias.ingreso, val] });
    input.value = "";
  };
  ov.querySelector("#add-gasto").onclick = async () => {
    const input = ov.querySelector("#nueva-gasto");
    const val = input.value.trim();
    if (!val || state.categorias.gasto.includes(val)) return;
    await db.collection("config").doc("categorias").update({ gasto: [...state.categorias.gasto, val] });
    input.value = "";
  };
  ov.querySelector("#cats-cerrar").onclick = () => { ov.remove(); render(); };

  // Redibuja los chips si cambian las categorías mientras el modal está abierto.
  const unsub = db.collection("config").doc("categorias").onSnapshot((doc) => {
    if (!doc.exists || !document.body.contains(ov)) return;
    pintarChips("ingreso");
    pintarChips("gasto");
  });
  const observer = new MutationObserver(() => { if (!document.body.contains(ov)) { unsub(); observer.disconnect(); } });
  observer.observe(document.body, { childList: true });
}

function abrirObjetivos() {
  const ov = abrirOverlay(`
    <h3 style="margin-top:0">Objetivos de ahorro</h3>
    <div id="lista-objetivos"></div>
    <div class="field" style="margin-top:14px">
      <div class="field-label">Nuevo objetivo</div>
      <input id="obj-nombre" placeholder="Nombre, ej: Fondo de emergencia" />
      <div style="display:flex; gap:8px; margin-top:8px">
        <input id="obj-monto" type="number" placeholder="Monto objetivo" style="flex:1" />
        <select id="obj-moneda" style="width:110px; margin-top:4px">
          <option value="ARS">Pesos ARS</option>
          <option value="USD">Dólares</option>
        </select>
      </div>
      <button class="btn-primary" id="obj-agregar">Agregar objetivo</button>
    </div>
    <button class="btn-secondary" id="obj-cerrar">Cerrar</button>
  `);

  function pintarLista() {
    ov.querySelector("#lista-objetivos").innerHTML = state.objetivos.map((o) => `
      <div class="row" style="border-bottom:1px dotted #AFC9D6">
        <div style="flex:1">
          <div class="titulo">${esc(o.nombre)}</div>
          <div class="meta mono">Meta: ${fmtMoney(o.montoObjetivo, o.moneda === "USD" ? "USD" : "ARS")}</div>
        </div>
        <button class="delbtn obj-del" data-id="${o.id}">✕</button>
      </div>
    `).join("");
    ov.querySelectorAll(".obj-del").forEach((b) => {
      b.onclick = () => db.collection("objetivos").doc(b.dataset.id).delete();
    });
  }
  pintarLista();

  ov.querySelector("#obj-agregar").onclick = async () => {
    const nombre = ov.querySelector("#obj-nombre").value.trim();
    const monto = Number(ov.querySelector("#obj-monto").value);
    const moneda = ov.querySelector("#obj-moneda").value;
    if (!nombre || !(monto > 0)) return;
    await db.collection("objetivos").add({ nombre, montoObjetivo: monto, moneda, aportes: [] });
    ov.querySelector("#obj-nombre").value = "";
    ov.querySelector("#obj-monto").value = "";
  };
  ov.querySelector("#obj-cerrar").onclick = () => { ov.remove(); render(); };

  const unsub = db.collection("objetivos").onSnapshot(() => { if (document.body.contains(ov)) pintarLista(); });
  const observer = new MutationObserver(() => { if (!document.body.contains(ov)) { unsub(); observer.disconnect(); } });
  observer.observe(document.body, { childList: true });
}

function abrirAporte(objetivoId) {
  const objetivo = state.objetivos.find((o) => o.id === objetivoId);
  if (!objetivo) return;
  const monedaObjetivo = objetivo.moneda === "USD" ? "USD" : "ARS";
  const ov = abrirOverlay(`
    <h3 style="margin-top:0">Aporte a "${esc(objetivo.nombre)}"</h3>
    <p style="font-size:12px;color:#6D8A99;margin-top:-8px">Este objetivo tiene su meta en ${monedaObjetivo === "USD" ? "dólares" : "pesos"}. Podés aportar en la otra moneda igual, pero no va a contar para el avance de la barra.</p>
    <div class="field">
      <div class="field-label">Monto</div>
      <div style="display:flex; gap:8px">
        <input id="ap-monto" type="number" placeholder="0" style="flex:1" />
        <select id="ap-moneda" style="width:110px; margin-top:4px">
          <option value="ARS" ${monedaObjetivo === "ARS" ? "selected" : ""}>Pesos ARS</option>
          <option value="USD" ${monedaObjetivo === "USD" ? "selected" : ""}>Dólares</option>
        </select>
      </div>
    </div>
    <div class="field">
      <div class="field-label">Fecha</div>
      <input id="ap-fecha" type="date" value="${new Date().toISOString().slice(0,10)}" />
    </div>
    <button class="btn-primary" id="ap-guardar">Guardar aporte</button>
    <button class="btn-secondary" id="ap-cancelar">Cancelar</button>
  `);
  ov.querySelector("#ap-cancelar").onclick = () => ov.remove();
  ov.querySelector("#ap-guardar").onclick = async () => {
    const monto = Number(ov.querySelector("#ap-monto").value);
    const moneda = ov.querySelector("#ap-moneda").value;
    const fecha = ov.querySelector("#ap-fecha").value;
    if (!(monto > 0) || !fecha) return;
    await db.collection("objetivos").doc(objetivoId).update({
      aportes: firebase.firestore.FieldValue.arrayUnion({ monto, moneda, fecha }),
    });
    ov.remove();
  };
}

function exportarExcel() {
  const wb = XLSX.utils.book_new();

  const movs = state.movimientos.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map((m) => ({
    Fecha: m.fecha, Tipo: m.tipo === "ingreso" ? "Ingreso" : "Gasto", Categoría: m.categoria,
    "Método de pago": m.medioPago || "Efectivo", Moneda: monedaDeMovimiento(m),
    Monto: Number(m.monto) || 0, Descripción: m.descripcion || "", Persona: m.persona || "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movs), "Movimientos");

  const meses = Array.from(new Set(state.movimientos.map((m) => m.fecha.slice(0, 7)))).sort();
  const resumen = meses.map((k) => {
    const delMes = state.movimientos.filter((m) => m.fecha.slice(0, 7) === k);
    const ing = totalesPorMoneda(delMes.filter((m) => m.tipo === "ingreso"));
    const gas = totalesPorMoneda(delMes.filter((m) => m.tipo === "gasto"));
    const [y, mo] = k.split("-");
    return {
      Mes: `${MESES[Number(mo) - 1]} ${y}`,
      "Ingresos ARS": ing.ARS, "Gastos ARS": gas.ARS, "Ahorro ARS": ing.ARS - gas.ARS,
      "Ingresos USD": ing.USD, "Gastos USD": gas.USD, "Ahorro USD": ing.USD - gas.USD,
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen mensual");

  const obj = state.objetivos.map((o) => {
    const moneda = o.moneda === "USD" ? "USD" : "ARS";
    const aportado = aportadoPorMoneda(o);
    return {
      Objetivo: o.nombre, Moneda: moneda, "Monto objetivo": Number(o.montoObjetivo) || 0,
      "Aportado (misma moneda)": aportado[moneda],
      Restante: Math.max(0, (Number(o.montoObjetivo) || 0) - aportado[moneda]),
      "Aportado en la otra moneda": aportado[moneda === "USD" ? "ARS" : "USD"],
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(obj), "Objetivos de ahorro");

  XLSX.writeFile(wb, `orden-financiero-${monthKey(state.mes)}.xlsx`);
}
