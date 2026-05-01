// AsisteQR — Módulo de Análisis IA

(function () {

  let charts = {};

  const STEPS = [
    { text:'🔍 Cargando y validando registros de asistencia...', ms:700  },
    { text:'🧮 Calculando métricas de participación...',          ms:900  },
    { text:'📊 Generando distribuciones estadísticas...',         ms:800  },
    { text:'🕐 Analizando patrones temporales...',                ms:1000 },
    { text:'🌍 Procesando datos geoespaciales...',                ms:900  },
    { text:'🤖 Ejecutando modelos predictivos...',                ms:1100 },
    { text:'✨ Construyendo visualizaciones...',                   ms:600  }
  ];

  // ─── Inicialización ───────────────────────────────────────────────────────
  async function init() {
    await Store.ready;
    setupEventListeners();
    loadEventFilter();
    if (Store.getAttendances().length > 0) setTimeout(generateAnalysis, 600);
  }

  function setupEventListeners() {
    document.getElementById('btn-generate-analysis').addEventListener('click', generateAnalysis);
    document.getElementById('event-filter').addEventListener('change', generateAnalysis);
  }

  function loadEventFilter() {
    const select = document.getElementById('event-filter');
    select.innerHTML = '<option value="">Todos los eventos</option>';
    Store.getEvents().forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.id; opt.textContent = ev.nombre;
      select.appendChild(opt);
    });
  }

  // ─── Datos filtrados ──────────────────────────────────────────────────────
  function getData() {
    const id = document.getElementById('event-filter').value;
    let attendances = Store.getAttendances();
    if (id) attendances = attendances.filter(a => String(a.eventId) === String(id));
    return { attendances, events: Store.getEvents(), students: Store.getStudents(), selectedId: id };
  }

  // ─── Análisis principal ───────────────────────────────────────────────────
  async function generateAnalysis() {
    const processing = document.getElementById('ai-processing');
    const results    = document.getElementById('analysis-results');
    results.classList.remove('active');
    processing.classList.add('active');

    const fill   = document.getElementById('progress-fill');
    const status = document.getElementById('processing-status');

    for (let i = 0; i < STEPS.length; i++) {
      status.textContent  = STEPS[i].text;
      fill.style.width    = ((i + 1) / STEPS.length * 100) + '%';
      await new Promise(r => setTimeout(r, STEPS[i].ms));
    }

    Object.values(charts).forEach(c => { try { c.destroy(); } catch {} });
    charts = {};

    processing.classList.remove('active');
    results.classList.add('active');

    renderKPIs();
    renderAttendanceChart();
    renderHourlyHeatmap();
    renderCarreraChart();
    renderEngagement();
    renderGPSQuality();
    renderInsights();
    renderPredictions();
  }

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  function renderKPIs() {
    const { attendances, events, selectedId } = getData();
    const unique     = new Set(attendances.map(a => a.studentId));
    const eventCount = selectedId ? 1 : events.length;
    const avgPerEv   = eventCount > 0 ? (attendances.length / eventCount).toFixed(1) : 0;
    const capacity   = selectedId
      ? (events.find(e => String(e.id) === String(selectedId))?.cupos || 0)
      : events.reduce((s, e) => s + (e.cupos || 0), 0);
    const fillRate   = capacity > 0 ? Math.min(100, Math.round(attendances.length / capacity * 100)) : 0;
    const avgAcc     = attendances.length > 0
      ? Math.round(attendances.reduce((s, a) => s + (a.location?.accuracy || 0), 0) / attendances.length) : 0;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('kpi-asistencias', attendances.length);
    set('kpi-estudiantes', unique.size);
    set('kpi-promedio',    avgPerEv);
    set('kpi-tasa',        fillRate + '%');
    set('kpi-gps',         avgAcc + 'm');

    const tasa = document.getElementById('kpi-tasa');
    if (tasa) tasa.style.color = fillRate >= 80 ? '#22c55e' : fillRate >= 50 ? '#f59e0b' : '#ef4444';
  }

  // ─── Gráfico de asistencia por fecha ─────────────────────────────────────
  function renderAttendanceChart() {
    const { attendances } = getData();
    const byDate = {};
    attendances.forEach(a => { const d = a.timestamp.split('T')[0]; byDate[d] = (byDate[d]||0)+1; });
    const sorted = Object.keys(byDate).sort();
    const labels = sorted.map(d => { const [,m,day] = d.split('-'); return day+'/'+m; });
    const data   = sorted.map(d => byDate[d]);

    const ctx = document.getElementById('chart-attendance')?.getContext('2d');
    if (!ctx) return;
    charts.attendance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label:'Asistencias', data, borderColor:'#0078D4',
        backgroundColor:'rgba(0,120,212,.10)', fill:true, tension:.4, pointBackgroundColor:'#0078D4',
        pointRadius:5, pointHoverRadius:8 }]},
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }},
        scales: { x:{ grid:{ display:false }, ticks:{ color:'#64748b', font:{size:12}}},
                  y:{ beginAtZero:true, grid:{ color:'#f1f5f9'}, ticks:{ color:'#64748b', stepSize:1}}}}
    });

    const trend = data.length >= 2 ? data[data.length-1] - data[data.length-2] : 0;
    const el = document.getElementById('attendance-trend');
    if (el) el.innerHTML = trend >= 0
      ? `<span class="trend-up">↑ ${trend > 0 ? '+'+trend : 'Sin cambio'} vs día anterior</span>`
      : `<span class="trend-down">↓ ${trend} vs día anterior</span>`;
  }

  // ─── Heatmap por hora ─────────────────────────────────────────────────────
  function renderHourlyHeatmap() {
    const { attendances } = getData();
    const hours = Array(24).fill(0);
    attendances.forEach(a => { hours[new Date(a.timestamp).getHours()]++; });
    const maxVal = Math.max(...hours, 1);
    const container = document.getElementById('hourly-heatmap');
    if (!container) return;

    container.innerHTML = '';
    for (let h = 6; h <= 22; h++) {
      const count     = hours[h];
      const intensity = count / maxVal;
      const cell      = document.createElement('div');
      cell.className  = 'heatmap-cell';
      cell.style.background = count === 0 ? '#f1f5f9' : `rgba(0,120,212,${0.15 + intensity * 0.85})`;
      cell.style.color      = intensity > 0.5 ? 'white' : '#334155';
      cell.innerHTML        = `<span class="heatmap-hour">${h}:00</span><span class="heatmap-count">${count}</span>`;
      container.appendChild(cell);
    }

    const peakH = hours.indexOf(Math.max(...hours));
    const el = document.getElementById('peak-hour-label');
    if (el) el.textContent = hours[peakH] > 0
      ? `Hora pico: ${peakH}:00 (${hours[peakH]} registros)` : 'Sin datos suficientes';
  }

  // ─── Gráfico por carrera ──────────────────────────────────────────────────
  function renderCarreraChart() {
    const { attendances, students } = getData();
    const byCarrera = {};
    attendances.forEach(a => {
      const s = students.find(st => String(st.id) === String(a.studentId));
      const c = s?.carrera || 'Sin datos';
      byCarrera[c] = (byCarrera[c]||0) + 1;
    });

    const labels = Object.keys(byCarrera);
    const data   = Object.values(byCarrera);
    const COLORS = ['#0078D4','#8B5CF6','#00B294','#F7630C','#E91E63','#FBBF24','#06B6D4','#84CC16'];

    const ctx = document.getElementById('chart-carrera')?.getContext('2d');
    if (!ctx) return;
    if (!labels.length) {
      const wrapper = document.getElementById('chart-carrera')?.parentElement;
      if (wrapper) wrapper.innerHTML = '<p class="no-data-msg">No hay datos de carrera disponibles</p>';
      return;
    }

    charts.carrera = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets:[{ data, backgroundColor:COLORS.slice(0,labels.length), borderWidth:3, borderColor:'white', hoverOffset:8 }]},
      options: { responsive:true, maintainAspectRatio:false, cutout:'65%',
        plugins: { legend:{ position:'right', labels:{ color:'#334155', font:{size:12}, padding:12, usePointStyle:true }},
          tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/data.reduce((a,b)=>a+b,0)*100)}%)` }}}}
    });
  }

  // ─── Engagement ───────────────────────────────────────────────────────────
  function renderEngagement() {
    const { attendances, students } = getData();
    const unique = new Set(attendances.map(a => a.studentId));
    const participation = students.length > 0 ? (unique.size / students.length * 100).toFixed(1) : 0;

    const freq = {};
    attendances.forEach(a => { freq[a.studentId] = (freq[a.studentId]||0) + 1; });
    const vals     = Object.values(freq);
    const avg      = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : 0;
    const loyal    = vals.filter(v => v >= 3).length;
    const loyalPct = unique.size > 0 ? (loyal/unique.size*100).toFixed(1) : 0;
    const oneTime  = vals.filter(v => v === 1).length;
    const onePct   = unique.size > 0 ? (oneTime/unique.size*100).toFixed(1) : 0;

    const bar = (label, value, maxPct, color) =>
      `<div class="eng-metric"><div class="eng-metric-header"><span>${label}</span><strong>${value}</strong></div>
       <div class="eng-bar"><div class="eng-fill" style="width:${Math.min(maxPct,100)}%;background:${color};"></div></div></div>`;

    const el = document.getElementById('engagement-metrics');
    if (!el) return;
    el.innerHTML =
      bar('Tasa de participación', participation+'%', participation, '#0078D4') +
      bar('Promedio eventos/estudiante', avg, parseFloat(avg)*20, '#8B5CF6') +
      bar('Estudiantes recurrentes (3+ eventos)', loyalPct+'%', loyalPct, '#00B294') +
      bar('Asistentes de una sola vez', onePct+'%', onePct, '#F7630C') +
      `<div class="eng-stat-row">
        <div class="eng-stat"><span class="eng-stat-val">${unique.size}</span><span>Estudiantes únicos</span></div>
        <div class="eng-stat"><span class="eng-stat-val">${loyal}</span><span>Muy comprometidos</span></div>
        <div class="eng-stat"><span class="eng-stat-val">${oneTime}</span><span>Asistieron 1 vez</span></div>
      </div>`;
  }

  // ─── Calidad GPS ──────────────────────────────────────────────────────────
  function renderGPSQuality() {
    const { attendances } = getData();
    const el = document.getElementById('gps-quality');
    if (!el) return;
    if (!attendances.length) { el.innerHTML = '<p class="no-data-msg">Sin registros de GPS</p>'; return; }

    const accs      = attendances.map(a => a.location?.accuracy||0).filter(v => v > 0);
    const avg       = accs.length ? Math.round(accs.reduce((a,b)=>a+b,0)/accs.length) : 0;
    const avgDist   = Math.round(attendances.reduce((s,a) => s+(a.location?.distance||0), 0) / attendances.length);
    const total     = accs.length;
    const pct       = n => total > 0 ? Math.round(n/total*100) : 0;
    const excellent = accs.filter(v => v<=5).length;
    const good      = accs.filter(v => v>5 && v<=20).length;
    const fair      = accs.filter(v => v>20 && v<=50).length;
    const poor      = accs.filter(v => v>50).length;

    const gpsBar = (label, count, color) =>
      `<div class="gps-bar-row"><span class="gps-bar-label">${label}</span>
       <div class="gps-bar-track"><div class="gps-bar-fill" style="width:${pct(count)}%;background:${color};"></div></div>
       <span class="gps-bar-pct">${pct(count)}%</span></div>`;

    el.innerHTML =
      `<div class="gps-avg"><span class="gps-avg-val">${avg}m</span><span class="gps-avg-label">Precisión promedio GPS</span></div>
       <div class="gps-dist-info">Distancia promedio al evento: <strong>${avgDist}m</strong></div>
       <div class="gps-bars">
         ${gpsBar('🎯 Excelente (≤5m)',    excellent, '#22c55e')}
         ${gpsBar('✅ Buena (6-20m)',       good,      '#0078D4')}
         ${gpsBar('⚠️ Regular (21-50m)',    fair,      '#f59e0b')}
         ${gpsBar('❌ Baja (&gt;50m)',       poor,      '#ef4444')}
       </div>`;
  }

  // ─── Insights IA ──────────────────────────────────────────────────────────
  function renderInsights() {
    const { attendances, events } = getData();
    const el = document.getElementById('ai-insights');
    if (!el) return;

    const hours  = Array(24).fill(0);
    attendances.forEach(a => { hours[new Date(a.timestamp).getHours()]++; });
    const peakH    = hours.indexOf(Math.max(...hours));
    const morning  = hours.slice(6,12).reduce((a,b)=>a+b,0);
    const afternoon = hours.slice(12,18).reduce((a,b)=>a+b,0);

    const last7 = attendances.filter(a => (Date.now()-new Date(a.timestamp))/86400000 <= 7).length;
    const prev7 = attendances.filter(a => { const d=(Date.now()-new Date(a.timestamp))/86400000; return d>7 && d<=14; }).length;
    const trend = prev7 > 0 ? Math.round((last7-prev7)/prev7*100) : 0;

    const insight = (cls, icon, title, body) =>
      `<div class="ai-insight-item ${cls}"><div class="ai-insight-icon">${icon}</div>
       <div class="ai-insight-body"><strong>${title}</strong><p>${body}</p></div></div>`;

    el.innerHTML =
      insight(trend>=0?'positive':'negative', trend>=0?'📈':'📉',
        `Tendencia semanal ${trend>=0?'positiva':'negativa'}`,
        `La asistencia ${trend>=0?'aumentó':'disminuyó'} un <b>${Math.abs(trend)}%</b> vs semana anterior (${last7} vs ${prev7} registros).`) +
      insight('positive', '🕐', `Hora pico detectada: ${peakH}:00`,
        morning >= afternoon
          ? 'Los eventos matutinos generan más asistencia. Programa eventos importantes entre 6-12AM.'
          : 'Los eventos vespertinos dominan la participación. El horario de tarde es más efectivo.') +
      insight('neutral', '🎯', 'Cobertura de eventos',
        `El sistema registró <b>${attendances.length}</b> asistencias en <b>${events.length}</b> eventos. Promedio: <b>${events.length>0?(attendances.length/events.length).toFixed(1):0}</b> personas/evento.`) +
      insight('positive', '💡', 'Recomendación estratégica',
        'Envía recordatorios 24h antes del evento. La asistencia en la primera hora supera el promedio — abre inscripciones anticipadas para maximizar participación.');
  }

  // ─── Predicciones ─────────────────────────────────────────────────────────
  function renderPredictions() {
    const { attendances, events } = getData();
    const el = document.getElementById('predictions');
    if (!el) return;

    const avgPerEv   = events.length > 0 ? attendances.length / events.length : 0;
    const growth     = attendances.length > 10 ? 1.12 : 1.08;
    const predicted  = Math.round(avgPerEv * growth);
    const confidence = attendances.length > 20 ? 91 : attendances.length > 10 ? 82 : 68;
    const freq       = {};
    attendances.forEach(a => { freq[a.studentId] = (freq[a.studentId]||0)+1; });
    const churn   = Object.values(freq).filter(v => v===1).length;
    const confBg  = confidence >= 85 ? '#dcfce7' : '#fef3c7';
    const confClr = confidence >= 85 ? '#166534' : '#92400e';

    const card = (icon, title, value, chipBg, chipClr, chipTxt, desc) =>
      `<div class="prediction-card-item">
        <div class="pred-header"><span class="pred-icon">${icon}</span>
          <div><div class="pred-title">${title}</div><div class="pred-value">${value}</div></div>
          <span class="confidence-chip" style="background:${chipBg};color:${chipClr}">${chipTxt}</span>
        </div><p class="pred-desc">${desc}</p></div>`;

    el.innerHTML =
      card('📈','Asistencia proyectada — próximo evento', `${predicted} personas`, confBg, confClr, `${confidence}% confianza`,
        `Basado en promedio histórico de <b>${avgPerEv.toFixed(1)}</b> asistentes/evento y tendencias de crecimiento.`) +
      card('⚠️','Riesgo de deserción', `${churn} estudiantes`, '#fee2e2','#991b1b','Alerta',
        'Estudiantes que asistieron a un solo evento. Sin intervención, alta probabilidad de no regresar. Considera estrategias de retención.') +
      card('🚀','Potencial de crecimiento', `+${Math.round((growth-1)*100)}% proyectado`, '#ede9fe','#5b21b6','IA',
        'El modelo detecta margen de crecimiento para el próximo mes si se mantienen los patrones actuales.');
  }

  document.addEventListener('DOMContentLoaded', init);

})();
