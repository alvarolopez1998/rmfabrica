// Configuración general de ligas
const CONFIG = {
  castilla: {
    canteraId: "rm_castilla",
    nombreCantera: "RM CASTILLA",
    tituloCompeticion: "PRIMERA FEDERACIÓN",
    logoCompeticion: "assets/logos/primera_rfef.png",
    esUYL: false,
    maxJornadas: 38,
    zonas: { verde: [1], azul: [2, 3, 4, 5], rojo: [16, 17, 18, 19, 20] }
  },
  rmc: {
    canteraId: "real_madrid_c",
    nombreCantera: "REAL MADRID C",
    tituloCompeticion: "SEGUNDA FEDERACIÓN",
    logoCompeticion: "assets/logos/segunda_rfef.png",
    esUYL: false,
    maxJornadas: 34,
    zonas: { verde: [1], azul: [2, 3, 4, 5], naranja: [13], rojo: [14, 15, 16, 17, 18] }
  },
  juvenilA: {
    canteraId: "juvenil_a",
    nombreCantera: "JUVENIL A",
    tituloCompeticion: "DIVISIÓN DE HONOR",
    logoCompeticion: "assets/logos/dh.png",
    esUYL: false,
    maxJornadas: 30,
    zonas: { verde: [1], azul: [2, 3, 4, 5], rojo: [13, 14, 15, 16] }
  },
  uyl: {
    canteraId: "juvenil_a",
    nombreCantera: "JUVENIL A",
    tituloCompeticion: "UEFA YOUTH LEAGUE",
    logoCompeticion: "assets/logos/uyl.png",
    esUYL: true,
    maxJornadas: 6,
    zonas: { 
      verde: [1, 2, 3, 4, 5, 6], 
      azul: Array.from({ length: 16 }, (_, i) => i + 7), 
      rojo: Array.from({ length: 14 }, (_, i) => i + 23) 
    }
  }
};

// Credenciales de la base de datos en la nube (JSONBin.io)
const BIN_ID = '6acbeddfac6210605a28b863';
const API_KEY = '$2a$10$7vYa8GikHCcgoiO7LXnyTeZQSkXRSJqyGF6swRqNcUFMym20SgVRC';

let todosLosEquipos = {};
let calendariosJornadas = {};
let resultadosGlobales = {};
let cacheImagenes = {};
let ligaActual = "castilla";
let tablaEquipos = [];

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const [resEquipos, resCalendarios, resResultados] = await Promise.all([
      fetch('./data/equipos.json').then(res => res.json()),
      fetch('./data/calendarios.json').then(res => res.json()),
      fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      }).then(res => res.json()).catch(() => ({ record: {} }))
    ]);
    todosLosEquipos = resEquipos;
    calendariosJornadas = resCalendarios;
    resultadosGlobales = resResultados.record || {};
  } catch (err) {
    console.warn("No se pudieron cargar los datos.", err);
    resultadosGlobales = {};
  } finally {
    cambiarLiga();
    
    const inputJornada = document.getElementById('input-jornada');
    if (inputJornada) {
      ['input', 'change'].forEach(evt => {
        inputJornada.addEventListener(evt, () => {
          cargarJornadaDesdeCalendario();
          actualizarClasificacion();
        });
      });
    }
  }
});

function precargarAssets(callback) {
  const imagenesAObtener = [
    { id: 'franjas', src: 'assets/logos/franjas.png' },
    { id: 'rm_fabrica', src: 'assets/logos/rm_fabrica.png' },
    { id: 'logo_liga', src: CONFIG[ligaActual].logoCompeticion }
  ];

  const lista = todosLosEquipos[ligaActual] || [];
  lista.forEach(eq => imagenesAObtener.push({ id: `escudo_${eq.id}`, src: `assets/escudos/${eq.id}.png` }));

  let cargadas = 0;
  const total = imagenesAObtener.length;

  if (total === 0) {
    callback();
    return;
  }

  imagenesAObtener.forEach(item => {
    const img = new Image();
    img.src = item.src;
    img.onload = () => { cacheImagenes[item.id] = img; revisarFin(); };
    img.onerror = () => { cacheImagenes[item.id] = null; revisarFin(); };
  });

  function revisarFin() {
    cargadas++;
    if (cargadas >= total) callback();
  }
}

function obtenerPrimeraJornadaPendiente() {
  const cfg = CONFIG[ligaActual];
  const maxJ = cfg.maxJornadas || 38;

  for (let j = 1; j <= maxJ; j++) {
    const clave = `${ligaActual}_j${j}`;
    if (!resultadosGlobales[clave]) {
      return j;
    }
  }
  return 1;
}

window.cambiarLiga = function() {
  const select = document.getElementById('select-liga');
  ligaActual = select ? select.value : 'castilla';

  const cfg = CONFIG[ligaActual];
  const inputJornada = document.getElementById('input-jornada');
  
  if (inputJornada) {
    inputJornada.max = cfg.maxJornadas;
    inputJornada.value = obtenerPrimeraJornadaPendiente();
  }

  const listaInicial = todosLosEquipos[ligaActual] || [];
  
  tablaEquipos = listaInicial.map((eq, i) => ({
    ...eq,
    pts: 0, pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0, dg: 0, posicion: i + 1
  }));

  precargarAssets(() => {
    cargarJornadaDesdeCalendario();
    actualizarClasificacion();
  });
};

function cargarJornadaDesdeCalendario() {
  const inputJornada = document.getElementById('input-jornada');
  const numJornada = inputJornada ? inputJornada.value : '1';
  const lista = todosLosEquipos[ligaActual] || [];
  
  let partidosJornada = [];

  if (calendariosJornadas[ligaActual] && calendariosJornadas[ligaActual][numJornada]) {
    const jornadaData = calendariosJornadas[ligaActual][numJornada];
    partidosJornada = jornadaData.map(p => ({
      local: lista.find(e => e.id === p.local) || { id: p.local, nombre: p.local.toUpperCase() },
      visitante: lista.find(e => e.id === p.visitante) || { id: p.visitante, nombre: p.visitante.toUpperCase() }
    }));
  } else {
    for (let i = 0; i < lista.length; i += 2) {
      if (lista[i + 1]) {
        partidosJornada.push({ local: lista[i], visitante: lista[i + 1] });
      }
    }
  }

  renderizarFormularioPartidos(partidosJornada);
}

function renderizarFormularioPartidos(partidos) {
  const contenedor = document.getElementById('partidos-lista');
  if (!contenedor) return;
  
  contenedor.innerHTML = '';
  
  const inputJornada = document.getElementById('input-jornada');
  const numJornada = inputJornada ? inputJornada.value : '1';
  const clave = `${ligaActual}_j${numJornada}`;
  const golesGuardados = (resultadosGlobales[clave]) || {};

  partidos.forEach((p, index) => {
    const gLocal = golesGuardados[`${index}_local`] !== undefined ? golesGuardados[`${index}_local`] : 0;
    const gVisitante = golesGuardados[`${index}_vis`] !== undefined ? golesGuardados[`${index}_vis`] : 0;

    const div = document.createElement('div');
    div.className = 'partido-fila';
    div.innerHTML = `
      <div class="equipo-box">
        <img src="assets/escudos/${p.local.id}.png" onerror="this.style.opacity='0'">
        <span>${p.local.nombre}</span>
      </div>
      <input type="number" class="goles-input" data-index="${index}" data-id="${p.local.id}" value="${gLocal}" min="0" onchange="guardarYActualizar()">
      <span>-</span>
      <input type="number" class="goles-input" data-index="${index}" data-id="${p.visitante.id}" value="${gVisitante}" min="0" onchange="guardarYActualizar()">
      <div class="equipo-box" style="justify-content: flex-end;">
        <span>${p.visitante.nombre}</span>
        <img src="assets/escudos/${p.visitante.id}.png" onerror="this.style.opacity='0'">
      </div>
    `;
    contenedor.appendChild(div);
  });
}

window.guardarYActualizar = async function() {
  const inputJornada = document.getElementById('input-jornada');
  const numJornada = inputJornada ? inputJornada.value : '1';
  const clave = `${ligaActual}_j${numJornada}`;
  
  const inputs = document.querySelectorAll('.goles-input');
  const jornadaResultados = {};

  inputs.forEach(input => {
    const idx = input.dataset.index;
    const esLocal = input === inputs[parseInt(idx) * 2];
    const tipoKey = esLocal ? `${idx}_local` : `${idx}_vis`;
    jornadaResultados[tipoKey] = parseInt(input.value) || 0;
  });

  resultadosGlobales[clave] = jornadaResultados;
  actualizarClasificacion();

  // Guardado automático en la nube en segundo plano
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY
      },
      body: JSON.stringify(resultadosGlobales)
    });
  } catch (err) {
    console.error("Error al sincronizar con la nube:", err);
  }
};

window.actualizarClasificacion = function() {
  tablaEquipos.forEach(e => {
    e.pts = 0; e.pj = 0; e.v = 0; e.e = 0; e.d = 0; e.gf = 0; e.gc = 0; e.dg = 0;
  });

  const cfg = CONFIG[ligaActual];
  const maxJ = cfg.maxJornadas || 38;

  for (let j = 1; j <= maxJ; j++) {
    const clave = `${ligaActual}_j${j}`;
    const guardados = resultadosGlobales[clave];
    
    if (guardados && calendariosJornadas[ligaActual] && calendariosJornadas[ligaActual][j]) {
      const partidosJ = calendariosJornadas[ligaActual][j];

      partidosJ.forEach((p, index) => {
        const g1 = guardados[`${index}_local`];
        const g2 = guardados[`${index}_vis`];

        if (g1 !== undefined && g2 !== undefined) {
          const eq1 = tablaEquipos.find(e => e.id === p.local);
          const eq2 = tablaEquipos.find(e => e.id === p.visitante);

          if (eq1 && eq2) {
            eq1.pj++; eq2.pj++;
            eq1.gf += g1; eq1.gc += g2;
            eq2.gf += g2; eq2.gc += g1;
            eq1.dg = eq1.gf - eq1.gc;
            eq2.dg = eq2.gf - eq2.gc;

            if (g1 > g2) {
              eq1.pts += 3; eq1.v++; eq2.d++;
            } else if (g2 > g1) {
              eq2.pts += 3; eq2.v++; eq1.d++;
            } else {
              eq1.pts += 1; eq2.pts += 1;
              eq1.e++; eq2.e++;
            }
          }
        }
      });
    }
  }

  tablaEquipos.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  tablaEquipos.forEach((eq, idx) => { eq.posicion = idx + 1; });

  renderizarCanvas();
};

function obtenerRecorte(tabla, canteraId, esUYL) {
  const total = tabla.length;
  if (total === 0) return [];
  
  const idx = tabla.findIndex(e => e.id === canteraId);
  const pos = idx !== -1 ? idx + 1 : 1;

  if (!esUYL) {
    if (pos <= 10) return tabla.slice(0, Math.min(10, total));
    return tabla.slice(Math.max(0, total - 10), total);
  } else {
    if (pos <= 10) return tabla.slice(0, Math.min(10, total));
    let inicio = Math.max(0, idx - 4);
    let fin = Math.min(total, inicio + 10);
    if (fin - inicio < 10) inicio = Math.max(0, fin - 10);
    return tabla.slice(inicio, fin);
  }
}

window.renderizarCanvas = function() {
  const canvas = document.getElementById('canvas-tabla');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cfg = CONFIG[ligaActual];
  const inputJ = document.getElementById('input-jornada');
  const jornada = inputJ ? inputJ.value : '1';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = "#694ba2";
  ctx.fillRect(0, 0, 800, 1000);

  if (cacheImagenes['franjas']) {
    ctx.drawImage(cacheImagenes['franjas'], -370, -15, 410, 420);
  }

  if (cacheImagenes['logo_liga']) {
    const imgLogo = cacheImagenes['logo_liga'];
    const maxW = 260;
    const maxH = 120;
    let w = imgLogo.width || maxW;
    let h = imgLogo.height || maxH;
    const ratio = Math.min(maxW / w, maxH / h);
    ctx.drawImage(imgLogo, 400 - ((w * ratio) / 2), 40, w * ratio, h * ratio);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.font = "bold 34px 'Now', sans-serif";
  ctx.fillText(`C L A S I F I C A C I Ó N   J ${jornada}`, 400, 205);

  const MARGEN_IZQ = 65;
  const ANCHO_TABLA = 670;
  ctx.fillRect(MARGEN_IZQ, 245, ANCHO_TABLA, 55);
  ctx.fillStyle = "#694ba2";
  ctx.font = "bold 21px 'Alfa Slab One', sans-serif";
  ctx.fillText(cfg.nombreCantera, 400, 280);

  ctx.fillStyle = "#a29bfe";
  ctx.font = "bold 17px 'Now', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("POS", 95, 335);
  ctx.textAlign = "left";
  ctx.fillText("EQUIPO", 188, 335);
  
  ctx.textAlign = "center";
  ctx.fillText("PTS", 402, 335);
  ctx.fillText("PJ", 458, 335);
  ctx.fillText("V", 498, 335);
  ctx.fillText("E", 538, 335);
  ctx.fillText("D", 578, 335);
  ctx.fillText("GF", 620, 335);
  ctx.fillText("GC", 662, 335);
  ctx.fillText("DG", 708, 335);

  const recorte = obtenerRecorte(tablaEquipos, cfg.canteraId, cfg.esUYL);
  let y = 355;
  const ALTO_FILA = 58;

  recorte.forEach((eq) => {
    const esCantera = (eq.id === cfg.canteraId) || (eq.nombre.toUpperCase().includes(cfg.nombreCantera.toUpperCase()));
    const posReal = eq.posicion;

    let colorZona = "transparent";
    if (cfg.zonas.rojo && cfg.zonas.rojo.includes(posReal)) colorZona = "#e83838";
    else if (cfg.zonas.naranja && cfg.zonas.naranja.includes(posReal)) colorZona = "#ff9f43";
    else if (cfg.zonas.azul && cfg.zonas.azul.includes(posReal)) colorZona = "#2196f3";
    else if (cfg.zonas.verde && cfg.zonas.verde.includes(posReal)) colorZona = "#21d07a";

    if (esCantera) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(MARGEN_IZQ, y, ANCHO_TABLA, ALTO_FILA);

      if (colorZona !== "transparent") {
        ctx.fillStyle = colorZona;
        ctx.fillRect(MARGEN_IZQ, y, 60, ALTO_FILA);
        ctx.fillStyle = "#FFFFFF";
      } else {
        ctx.fillStyle = "#694ba2";
      }

      ctx.font = "bold 22px 'Now', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(posReal, 95, y + 37);

      const imgEscudo = cacheImagenes[`escudo_${eq.id}`];
      if (imgEscudo) {
        const targetSize = 44;
        let w = imgEscudo.width || targetSize;
        let h = imgEscudo.height || targetSize;
        const ratio = Math.min(targetSize / w, targetSize / h);
        ctx.drawImage(imgEscudo, 150 - ((w * ratio) / 2), (y + (ALTO_FILA / 2)) - ((h * ratio) / 2), w * ratio, h * ratio);
      }

      ctx.textAlign = "left";
      dibujarTextoAjustado(ctx, eq.nombre, 188, y + 37, 175, "#694ba2", 20);

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(369, y, 66, ALTO_FILA);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 28px 'Now', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(eq.pts, 402, y + 40);

      ctx.fillStyle = "#694ba2";
      ctx.font = "bold 22px 'Now', sans-serif";
      ctx.fillText(eq.pj, 458, y + 37);
      ctx.fillText(eq.v, 498, y + 37);
      ctx.fillText(eq.e, 538, y + 37);
      ctx.fillText(eq.d, 578, y + 37);
      ctx.fillText(eq.gf, 620, y + 37);
      ctx.fillText(eq.gc, 662, y + 37);
      const dgTxt = eq.dg >= 0 ? `+${eq.dg}` : `${eq.dg}`;
      ctx.fillText(dgTxt, 708, y + 37);

    } else {
      if (colorZona !== "transparent") {
        ctx.fillStyle = colorZona;
        ctx.fillRect(MARGEN_IZQ, y, 60, ALTO_FILA);
      }

      ctx.fillStyle = "#000000";
      ctx.fillRect(369, y, 66, ALTO_FILA);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 22px 'Now', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(posReal, 95, y + 37);

      const imgEscudo = cacheImagenes[`escudo_${eq.id}`];
      if (imgEscudo) {
        const targetSize = 44;
        let w = imgEscudo.width || targetSize;
        let h = imgEscudo.height || targetSize;
        const ratio = Math.min(targetSize / w, targetSize / h);
        ctx.drawImage(imgEscudo, 150 - ((w * ratio) / 2), (y + (ALTO_FILA / 2)) - ((h * ratio) / 2), w * ratio, h * ratio);
      }

      ctx.textAlign = "left";
      dibujarTextoAjustado(ctx, eq.nombre, 188, y + 37, 175, "#FFFFFF", 20);

      ctx.font = "bold 28px 'Now', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(eq.pts, 402, y + 40);

      ctx.font = "bold 22px 'Now', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(eq.pj, 458, y + 37);
      ctx.fillText(eq.v, 498, y + 37);
      ctx.fillText(eq.e, 538, y + 37);
      ctx.fillText(eq.d, 578, y + 37);
      ctx.fillText(eq.gf, 620, y + 37);
      ctx.fillText(eq.gc, 662, y + 37);
      const dgTxt = eq.dg >= 0 ? `+${eq.dg}` : `${eq.dg}`;
      ctx.fillText(dgTxt, 708, y + 37);
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGEN_IZQ, y + ALTO_FILA);
    ctx.lineTo(MARGEN_IZQ + ANCHO_TABLA, y + ALTO_FILA);
    ctx.stroke();

    y += ALTO_FILA;
  });

  if (cacheImagenes['rm_fabrica']) {
    ctx.drawImage(cacheImagenes['rm_fabrica'], 712, 918, 88, 82);
  }
};

function dibujarTextoAjustado(ctx, texto, x, y, maxAncho, color, sizeInicial = 20) {
  let size = sizeInicial;
  ctx.font = `bold ${size}px 'Now', sans-serif`;
  while (ctx.measureText(texto).width > maxAncho && size > 10) {
    size -= 0.5;
    ctx.font = `bold ${size}px 'Now', sans-serif`;
  }
  ctx.fillStyle = color;
  ctx.fillText(texto, x, y);
}

window.descargarImagen = function() {
  const canvas = document.getElementById('canvas-tabla');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `Clasificacion_${CONFIG[ligaActual].nombreCantera}_J${document.getElementById('input-jornada').value}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};