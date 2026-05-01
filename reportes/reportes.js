// AsisteQR — Módulo de Reportes

(function () {

  let filteredAttendances = [];
  let map     = null;
  let markers = [];

  // ─── Inicialización ───────────────────────────────────────────────────────
  async function init() {
    await Store.ready;
    setupEventListeners();
    loadEventFilter();
    initMap();
    applyFilters();
  }

  function setupEventListeners() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
    on('filter-event',     'change', applyFilters);
    on('filter-date-from', 'change', applyFilters);
    on('filter-date-to',   'change', applyFilters);
    on('filter-search',    'input',  applyFilters);
    on('btn-export-pdf',   'click',  exportPDF);
    on('btn-export-excel', 'click',  exportExcel);
  }

  function loadEventFilter() {
    const select = document.getElementById('filter-event');
    select.innerHTML = '<option value="">Todos los eventos</option>';
    Store.getEvents().forEach(ev => {
      const opt = document.createElement('option');
      opt.value       = ev.id;
      opt.textContent = `${ev.nombre} - ${ev.fecha}`;
      select.appendChild(opt);
    });
  }

  // ─── Filtros ──────────────────────────────────────────────────────────────
  function applyFilters() {
    const eventId    = document.getElementById('filter-event').value;
    const dateFrom   = document.getElementById('filter-date-from').value;
    const dateTo     = document.getElementById('filter-date-to').value;
    const searchTerm = document.getElementById('filter-search').value.toLowerCase();

    filteredAttendances = Store.getAttendances().filter(a => {
      if (eventId && a.eventId !== parseInt(eventId)) return false;

      if (dateFrom || dateTo) {
        const d = new Date(a.timestamp).toISOString().split('T')[0];
        if (dateFrom && d < dateFrom) return false;
        if (dateTo   && d > dateTo)   return false;
      }

      if (searchTerm) {
        const student = Store.getStudentById(a.studentId);
        const event   = Store.getEventById(a.eventId);
        const text    = `${student?.nombre||''} ${student?.codigo||''} ${student?.cedula||''} ${event?.nombre||''}`.toLowerCase();
        if (!text.includes(searchTerm)) return false;
      }

      return true;
    });

    renderTable();
    updateMapMarkers();
    updateStats();
  }

  // ─── Tabla ────────────────────────────────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('table-body');
    document.getElementById('record-count').textContent =
      `${filteredAttendances.length} registro${filteredAttendances.length !== 1 ? 's' : ''}`;

    if (!filteredAttendances.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:#999;">
        No se encontraron registros con los filtros seleccionados</td></tr>`;
      updateMapMarkers([]);
      return;
    }

    tbody.innerHTML = [...filteredAttendances].reverse().map(a => {
      const student  = Store.getStudentById(a.studentId);
      const event    = Store.getEventById(a.eventId);
      const date     = new Date(a.timestamp);
      const accClass = a.location.accuracy <= 10 ? 'accuracy-excellent'
                     : a.location.accuracy <= 20 ? 'accuracy-good' : 'accuracy-regular';

      return `
        <tr>
          <td><strong>${student?.codigo||'N/A'}</strong></td>
          <td>${student?.cedula||'N/A'}</td>
          <td>${student?.nombre||'N/A'}</td>
          <td>${student?.correo||'N/A'}</td>
          <td>${student?.carrera||'N/A'}</td>
          <td>${event?.nombre||'N/A'}</td>
          <td><span style="background:linear-gradient(135deg,#0078D4,#00A4EF);color:white;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${a.encargado||'admin'}</span></td>
          <td>${date.toLocaleDateString('es-CO')}<br><small style="color:#999;">${date.toLocaleTimeString('es-CO')}</small></td>
          <td><span class="gps-coords">${a.location.lat.toFixed(6)},<br>${a.location.lng.toFixed(6)}</span></td>
          <td><span class="accuracy-badge ${accClass}">${a.location.accuracy}m</span></td>
          <td>
            <span class="distance-badge ${a.fueraDeRadio ? 'accuracy-regular' : 'accuracy-excellent'}">${a.location.distance}m</span>
            ${a.fueraDeRadio ? '<br><small style="color:#F59E0B;font-size:10px;">⚠️ Fuera de radio</small>' : ''}
          </td>
        </tr>`;
    }).join('');
  }

  // ─── Estadísticas ─────────────────────────────────────────────────────────
  function updateStats() {
    const unique     = new Set(filteredAttendances.map(a => a.studentId));
    const eventCount = new Set(filteredAttendances.map(a => a.eventId)).size;
    const avgAcc     = filteredAttendances.length
      ? Math.round(filteredAttendances.reduce((s, a) => s + a.location.accuracy, 0) / filteredAttendances.length)
      : 0;

    document.getElementById('summary-total').textContent    = filteredAttendances.length;
    document.getElementById('summary-events').textContent   = eventCount;
    document.getElementById('summary-students').textContent = unique.size;
    document.getElementById('summary-accuracy').textContent = `${avgAcc}m`;
  }

  // ─── Mapa ─────────────────────────────────────────────────────────────────
  function initMap() {
    map = L.map('map-view').setView([4.6097, -74.0817], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
  }

  function updateMapMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (!filteredAttendances.length) return;

    const bounds = filteredAttendances.map(a => {
      const student = Store.getStudentById(a.studentId);
      const event   = Store.getEventById(a.eventId);
      const date    = new Date(a.timestamp);
      const color   = a.location.accuracy <= 10 ? 'green' : a.location.accuracy <= 20 ? 'orange' : 'red';

      const marker = L.circleMarker([a.location.lat, a.location.lng],
        { radius:8, fillColor:color, color:'#fff', weight:2, opacity:1, fillOpacity:0.8 }
      ).addTo(map);

      marker.bindPopup(`
        <div style="font-family:Segoe UI,sans-serif;">
          <strong>${student?.nombre||'N/A'}</strong><br>
          <small>Código: ${student?.codigo||'N/A'}</small><br>
          <strong>Evento:</strong> ${event?.nombre||'N/A'}<br>
          <strong>Fecha:</strong> ${date.toLocaleDateString('es-CO')} ${date.toLocaleTimeString('es-CO')}<br>
          <strong>Precisión GPS:</strong> ${a.location.accuracy}m<br>
          <strong>Distancia:</strong> ${a.location.distance}m
        </div>`);

      markers.push(marker);
      return [a.location.lat, a.location.lng];
    });

    map.fitBounds(bounds, { padding:[50,50] });
  }

  // ─── Exportaciones ────────────────────────────────────────────────────────
  function exportPDF() {
    if (!filteredAttendances.length) { alert('No hay datos para exportar. Ajusta los filtros primero.'); return; }
    alert(`📄 Exportación a PDF\n\nSe generaría un reporte con ${filteredAttendances.length} registros.\n✓ Tabla de asistencias\n✓ Estadísticas\n✓ Mapa\n\n(Funcionalidad simulada para demo.)`);
  }

  function exportExcel() {
    if (!filteredAttendances.length) { alert('No hay datos para exportar. Ajusta los filtros primero.'); return; }

    const headers = ['Código','Cédula','Nombre','Correo','Carrera','Semestre','Evento','Encargado','Fecha','Hora','Latitud','Longitud','Precisión GPS (m)','Distancia (m)'];
    const rows = filteredAttendances.map(a => {
      const s = Store.getStudentById(a.studentId);
      const e = Store.getEventById(a.eventId);
      const d = new Date(a.timestamp);
      return [s?.codigo||'', s?.cedula||'', s?.nombre||'', s?.correo||'', s?.carrera||'', s?.semestre||'',
              e?.nombre||'', a.encargado||'admin', d.toLocaleDateString('es-CO'), d.toLocaleTimeString('es-CO'),
              a.location.lat.toFixed(6), a.location.lng.toFixed(6), a.location.accuracy, a.location.distance];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [12,12,30,25,25,10,30,12,12,12,12,12,15,12].map(w => ({ wch:w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');
    XLSX.writeFile(wb, `Reporte_Asistencias_${new Date().toISOString().split('T')[0]}.xlsx`);
    alert('✅ El archivo Excel (.xlsx) se ha descargado correctamente.');
  }

  document.addEventListener('DOMContentLoaded', init);

})();
