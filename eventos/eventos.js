// AsisteQR — Módulo de Gestión de Eventos

(function () {

  let editingId      = null;
  let capturedGPS    = null;
  let allEvents      = [];
  let leafletMap     = null;
  let mapMarker      = null;
  let selectedMapLoc = null;

  const DEFAULT_CENTER = { lat: 4.6097, lng: -74.0817 };

  // ─── Inicialización ───────────────────────────────────────────────────────
  async function init() {
    await Store.ready;
    allEvents = Store.getEvents();
    setupEventListeners();
    updateEventStatuses();
    renderEvents();
    updateStats();
    setInterval(() => {
      if (updateEventStatuses()) { renderEvents(); updateStats(); }
    }, 60000);
  }

  function setupEventListeners() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
    on('btn-new-event',    'click',  openNewModal);
    on('btn-close-modal',  'click',  closeModal);
    on('btn-cancel',       'click',  closeModal);
    on('event-form',       'submit', handleSubmit);
    on('search-input',     'input',  () => renderEvents());
    on('filter-status',    'change', () => renderEvents());
    on('filter-limit',     'change', () => renderEvents());
    on('date-from',        'change', () => renderEvents());
    on('date-to',          'change', () => renderEvents());
    on('btn-clear-dates',  'click',  clearDates);
    on('btn-capture-gps',  'click',  captureGPS);
    on('btn-select-map',   'click',  openMapModal);
    on('btn-close-map',    'click',  closeMapModal);
    on('btn-cancel-map',   'click',  closeMapModal);
    on('btn-confirm-map',  'click',  confirmMapLocation);
  }

  function clearDates() {
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    renderEvents();
  }

  // ─── CRUD de eventos ──────────────────────────────────────────────────────
  function openNewModal() {
    editingId   = null;
    capturedGPS = null;
    document.getElementById('modal-title').textContent = 'Nuevo Evento';
    document.getElementById('event-form').reset();
    document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
    setGPSHelp('Presiona el botón para capturar las coordenadas GPS de la ubicación del evento', '');
    document.getElementById('event-gps').value = '';
    document.getElementById('event-modal').classList.add('active');
  }

  function openEditModal(eventId) {
    editingId = eventId;
    const ev  = Store.getEventById(eventId);
    if (!ev) return;

    document.getElementById('modal-title').textContent     = 'Editar Evento';
    document.getElementById('event-name').value            = ev.nombre;
    document.getElementById('event-description').value     = ev.descripcion;
    document.getElementById('event-date').value            = ev.fecha;
    document.getElementById('event-time-start').value      = ev.horaInicio || '09:00';
    document.getElementById('event-time-end').value        = ev.horaFin    || '17:00';
    document.getElementById('event-location').value        = ev.lugar;
    document.getElementById('event-capacity').value        = ev.cupos || 100;

    if (ev.gpsLocation) {
      capturedGPS = ev.gpsLocation;
      document.getElementById('event-gps').value = `${ev.gpsLocation.lat.toFixed(6)}, ${ev.gpsLocation.lng.toFixed(6)}`;
      setGPSHelp(`✓ Coordenadas guardadas (Precisión: ${ev.gpsLocation.accuracy}m)`, 'success');
    } else {
      capturedGPS = null;
      document.getElementById('event-gps').value = '';
      setGPSHelp('No hay coordenadas GPS registradas para este evento', '');
    }

    document.getElementById('event-modal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('event-modal').classList.remove('active');
    editingId = null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const data = {
      nombre:      document.getElementById('event-name').value.trim(),
      descripcion: document.getElementById('event-description').value.trim(),
      fecha:       document.getElementById('event-date').value,
      horaInicio:  document.getElementById('event-time-start').value,
      horaFin:     document.getElementById('event-time-end').value,
      lugar:       document.getElementById('event-location').value.trim(),
      cupos:       parseInt(document.getElementById('event-capacity').value) || 100,
      gpsLocation: capturedGPS
    };

    if (editingId) {
      const updated = await Store.updateEvent(editingId, data);
      if (updated) {
        const idx = allEvents.findIndex(e => e.id === editingId);
        if (idx !== -1) allEvents[idx] = updated;
      }
    } else {
      const eventCode = `EVT-${Date.now()}`;
      const created = await Store.createEvent({
        ...data,
        codigo: eventCode,
        estado: 'programado'
      });
      if (created) allEvents.push(created);
    }

    closeModal();
    renderEvents();
    updateStats();
  }

  async function deleteEvent(eventId) {
    if (!confirm('¿Estás seguro de eliminar este evento? Esta acción no se puede deshacer.')) return;
    await Store.deleteEvent(eventId);
    allEvents = allEvents.filter(e => e.id !== eventId);
    renderEvents();
    updateStats();
  }

  // ─── Estado automático ────────────────────────────────────────────────────
  function getAutoStatus(ev) {
    const now  = new Date();
    const [y, m, d]       = ev.fecha.split('-').map(Number);
    const [sh, sm]        = (ev.horaInicio || '00:00').split(':').map(Number);
    const [eh, em]        = (ev.horaFin    || '23:59').split(':').map(Number);
    const start           = new Date(y, m-1, d, sh, sm);
    const end             = new Date(y, m-1, d, eh, em);
    const finalize        = new Date(end); finalize.setHours(finalize.getHours() + 1);

    if (now < start)     return 'programado';
    if (now <= finalize) return 'activo';
    return 'finalizado';
  }

  function updateEventStatuses() {
    let changed = false;
    allEvents.forEach(ev => {
      if (!ev.manualStatus) {
        const auto = getAutoStatus(ev);
        if (ev.estado !== auto) { ev.estado = auto; changed = true; }
      }
    });
    if (changed) Store.saveEvents(allEvents);
    return changed;
  }

  // ─── Cambio manual de estado ──────────────────────────────────────────────
  function toggleStatus(eventId, btn) {
    const ev = allEvents.find(e => e.id === eventId);
    if (!ev) return;
    closeStatusSubmenu();

    const statuses = ['activo', 'programado', 'finalizado'];
    const overlay  = document.createElement('div');
    overlay.className = 'status-submenu-overlay';
    overlay.id = 'status-submenu-overlay';

    const menu = document.createElement('div');
    menu.className = 'status-submenu';
    menu.innerHTML = '<div class="status-submenu-title">Cambiar estado</div>' +
      statuses.map(s => {
        const cfg = Store.getEstadoConfig(s);
        const active = s === ev.estado;
        return `<div class="status-option${active ? ' active' : ''}" data-status="${s}">
          <span class="status-dot dot-${s}"></span>${cfg.text}
          ${active ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="margin-left:auto"><path d="M2 7l3.5 3.5L12 3" stroke="#0078D4" stroke-width="2" stroke-linecap="round"/></svg>' : ''}
        </div>`;
      }).join('');

    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    const r = btn.getBoundingClientRect();
    let top  = r.bottom + 6 + window.scrollY;
    let left = r.left + window.scrollX;
    if (top + 160 > window.innerHeight + window.scrollY) top = r.top - 166 + window.scrollY;
    if (left + 190 > window.innerWidth) left = window.innerWidth - 200;
    menu.style.cssText = `top:${top}px;left:${left}px`;

    menu.querySelectorAll('.status-option').forEach(opt => {
      opt.addEventListener('click', async () => {
        ev.estado = opt.dataset.status;
        ev.manualStatus = true;
        await Store.updateEvent(eventId, { estado: ev.estado, manualStatus: true });
        closeStatusSubmenu();
        renderEvents();
        updateStats();
      });
    });

    overlay.addEventListener('click', closeStatusSubmenu);
  }

  function closeStatusSubmenu() {
    document.getElementById('status-submenu-overlay')?.remove();
    document.querySelectorAll('.status-submenu').forEach(m => m.remove());
  }

  // ─── Renderizado ──────────────────────────────────────────────────────────
  function renderEvents() {
    const search  = document.getElementById('search-input').value.toLowerCase();
    const status  = document.getElementById('filter-status').value;
    const limit   = document.getElementById('filter-limit').value;
    const from    = document.getElementById('date-from').value;
    const to      = document.getElementById('date-to').value;

    updateEventStatuses();

    let list = allEvents.filter(ev => {
      const estado = ev.estado || 'programado';
      if (status && status !== 'all' && estado !== status) return false;
      if (from && ev.fecha < from)     return false;
      if (to   && ev.fecha > to)       return false;
      return (ev.nombre + ev.descripcion + ev.lugar).toLowerCase().includes(search);
    });

    const order = { activo:0, programado:1, finalizado:2 };
    list.sort((a, b) => {
      const diff = (order[a.estado] || 0) - (order[b.estado] || 0);
      return diff !== 0 ? diff : b.fecha.localeCompare(a.fecha);
    });

    if (limit !== 'all') list = list.slice(0, parseInt(limit));

    const grid = document.getElementById('events-grid');

    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style="opacity:.3;margin-bottom:20px;">
            <rect x="30" y="40" width="60" height="60" rx="4" stroke="#666" stroke-width="3" fill="none"/>
            <path d="M45 30v20M75 30v20M30 60h60" stroke="#666" stroke-width="3"/>
          </svg>
          <h3 style="color:#666;margin-bottom:8px;">No se encontraron eventos</h3>
          <p style="color:#999;">Ajusta los filtros o crea un nuevo evento</p>
        </div>`;
      return;
    }

    grid.innerHTML = list.map(ev => {
      const [y, m, d]   = ev.fecha.split('-').map(Number);
      const dateLabel   = new Date(y, m-1, d).toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      const attendance  = Store.getAttendancesByEvent(ev.id).length;
      const cfg         = Store.getEstadoConfig(ev.estado || 'programado');

      return `
        <div class="event-card">
          <div class="event-header">
            <div>
              <span class="event-status-badge ${cfg.class}">${cfg.text}</span>
              <span class="event-code">${ev.codigo}</span>
            </div>
            <div class="event-actions">
              <button class="btn-icon btn-status" onclick="eventModule.toggleStatus(${ev.id},this)" title="Cambiar estado" style="color:${cfg.color};position:relative;">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
                  <path d="M8 4v4l3 2" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
              <button class="btn-icon" onclick="eventModule.editEvent(${ev.id})" title="Editar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
              </button>
              <button class="btn-icon" onclick="eventModule.deleteEvent(${ev.id})" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>
          <h3 class="event-title">${ev.nombre}</h3>
          <p class="event-description">${ev.descripcion}</p>
          <div class="event-details">
            <div class="event-detail">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="3" y="4" width="12" height="11" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M6 2v4M12 2v4M3 8h12" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span>${dateLabel}</span>
            </div>
            <div class="event-detail">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M9 5v4l3 2" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span>${ev.horaInicio||'09:00'} - ${ev.horaFin||'17:00'}</span>
            </div>
            <div class="event-detail">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1c-3 0-5 2-5 5 0 4 5 10 5 10s5-6 5-10c0-3-2-5-5-5z" stroke="currentColor" stroke-width="2" fill="none"/>
                <circle cx="9" cy="6" r="2" stroke="currentColor" stroke-width="2" fill="none"/>
              </svg>
              <span>${ev.lugar}</span>
            </div>
            <div class="event-detail">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="6" cy="6" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
                <circle cx="13" cy="9" r="2" stroke="currentColor" stroke-width="2" fill="none"/>
                <circle cx="5" cy="13" r="2.5" stroke="currentColor" stroke-width="2" fill="none"/>
              </svg>
              <span><strong>Cupos:</strong> ${ev.cupos||100}</span>
            </div>
          </div>
          <div class="event-footer">
            <div class="attendance-count"><strong>${attendance}</strong> asistencias</div>
          </div>
        </div>`;
    }).join('');
  }

  // ─── Estadísticas ─────────────────────────────────────────────────────────
  function updateStats() {
    const count = s => allEvents.filter(e => (e.estado||'programado') === s).length;
    document.getElementById('stat-total-events').textContent     = allEvents.length;
    document.getElementById('stat-programado-events').textContent = count('programado');
    document.getElementById('stat-active-events').textContent    = count('activo');
    document.getElementById('stat-finalizado-events').textContent = count('finalizado');
    document.getElementById('stat-total-attendance').textContent = Store.getAttendances().length;
  }

  // ─── GPS: captura y mapa ──────────────────────────────────────────────────
  function setGPSHelp(text, cls) {
    const el = document.getElementById('gps-help');
    el.textContent  = text;
    el.className    = `gps-help${cls ? ' ' + cls : ''}`;
  }

  function captureGPS() {
    const btn   = document.getElementById('btn-capture-gps');
    const input = document.getElementById('event-gps');

    if (!navigator.geolocation) {
      setGPSHelp('❌ Tu navegador no soporta geolocalización', 'error'); return;
    }

    btn.classList.add('loading');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="animation:spin 1s linear infinite;">
      <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="15 10"/></svg>
      Mejorando precisión GPS...`;
    setGPSHelp('🛰️ Tomando múltiples lecturas para máxima precisión...');

    const readings = [];
    let readingCount = 0;
    const MAX = 5;
    let watchId = null;

    const finalize = () => {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      if (!readings.length) return;

      const best        = readings.reduce((a, b) => a.accuracy < b.accuracy ? a : b);
      const totalWeight = readings.reduce((s, r) => s + 1/r.accuracy, 0);
      const avgLat      = readings.reduce((s, r) => s + r.lat/r.accuracy, 0) / totalWeight;
      const avgLng      = readings.reduce((s, r) => s + r.lng/r.accuracy, 0) / totalWeight;

      capturedGPS = {
        lat: parseFloat(avgLat.toFixed(7)),
        lng: parseFloat(avgLng.toFixed(7)),
        accuracy: Math.round(best.accuracy),
        rawReadings: readings.length
      };

      input.value = `${capturedGPS.lat.toFixed(6)}, ${capturedGPS.lng.toFixed(6)}`;
      const emoji = capturedGPS.accuracy <= 5 ? '🎯' : capturedGPS.accuracy <= 15 ? '✅' : capturedGPS.accuracy <= 30 ? '⚠️' : '📍';
      setGPSHelp(`${emoji} Ubicación capturada — Precisión: ${capturedGPS.accuracy}m (${readings.length} lecturas)`, 'success');

      btn.classList.remove('loading');
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="10" cy="10" r="2" fill="currentColor"/>
        <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="currentColor" stroke-width="2"/></svg>
        Ubicación Capturada ✓`;
    };

    const onPos = pos => {
      readings.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      readingCount++;
      setGPSHelp(`🛰️ Lectura ${readingCount}/${MAX} — Precisión: ${Math.round(pos.coords.accuracy)}m`);
      if (readingCount >= MAX) finalize();
    };

    const onErr = err => {
      if (readings.length) { finalize(); return; }
      setGPSHelp(`❌ ${Geo.errorMessage(err)}`, 'error');
      btn.classList.remove('loading');
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="10" cy="10" r="2" fill="currentColor"/>
        <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke="currentColor" stroke-width="2"/></svg>
        Capturar Ubicación Actual`;
    };

    watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy:true, timeout:12000, maximumAge:0 });
    setTimeout(() => { if (watchId !== null) finalize(); }, 1800 * MAX + 2000);
  }

  // ─── Modal de mapa ────────────────────────────────────────────────────────
  function openMapModal() {
    selectedMapLoc = null;
    document.getElementById('map-lat').textContent = '-';
    document.getElementById('map-lng').textContent = '-';
    document.getElementById('btn-confirm-map').disabled = true;
    document.getElementById('map-modal').classList.add('active');
    setTimeout(initLeafletMap, 100);
  }

  function closeMapModal() {
    document.getElementById('map-modal').classList.remove('active');
    if (leafletMap) { leafletMap.remove(); leafletMap = null; mapMarker = null; }
  }

  function initLeafletMap() {
    const container = document.getElementById('map-container');
    container.innerHTML = '';

    if (typeof L === 'undefined') {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:16px;">
        <div style="color:#666;font-size:14px;">Cargando mapa...</div></div>`;
      setTimeout(() => { if (document.getElementById('map-modal').classList.contains('active')) initLeafletMap(); }, 500);
      return;
    }

    const center = capturedGPS ? [capturedGPS.lat, capturedGPS.lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
    leafletMap   = L.map(container, { center, zoom:16 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom:19
    }).addTo(leafletMap);

    const redIcon = L.divIcon({
      className: 'custom-marker',
      html: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,.3));">
        <path d="M20 2c-6.627 0-12 5.373-12 12 0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#D13438" stroke="white" stroke-width="2"/>
        <circle cx="20" cy="14" r="4" fill="white"/></svg>`,
      iconSize:[40,40], iconAnchor:[20,40]
    });

    mapMarker = L.marker(center, { icon:redIcon, draggable:true }).addTo(leafletMap);
    setSelectedMapLoc(parseFloat(center[0].toFixed(6)), parseFloat(center[1].toFixed(6)));

    const onMove = (lat, lng) => setSelectedMapLoc(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));

    leafletMap.on('click', e => { mapMarker.setLatLng([e.latlng.lat, e.latlng.lng]); onMove(e.latlng.lat, e.latlng.lng); });
    mapMarker.on('dragend', () => { const p = mapMarker.getLatLng(); onMove(p.lat, p.lng); });

    if (navigator.geolocation && !capturedGPS) {
      navigator.geolocation.getCurrentPosition(pos => {
        const ul = [pos.coords.latitude, pos.coords.longitude];
        leafletMap.setView(ul, 16);
        mapMarker.setLatLng(ul);
        setSelectedMapLoc(parseFloat(ul[0].toFixed(6)), parseFloat(ul[1].toFixed(6)));
      }, () => {}, { timeout:5000, enableHighAccuracy:true });
    }

    setTimeout(() => leafletMap.invalidateSize(), 100);
  }

  function setSelectedMapLoc(lat, lng) {
    selectedMapLoc = { lat, lng, accuracy:10 };
    document.getElementById('map-lat').textContent = lat.toFixed(6);
    document.getElementById('map-lng').textContent = lng.toFixed(6);
    document.getElementById('btn-confirm-map').disabled = false;
  }

  function confirmMapLocation() {
    if (!selectedMapLoc) return;
    capturedGPS = selectedMapLoc;
    document.getElementById('event-gps').value = `${capturedGPS.lat.toFixed(6)}, ${capturedGPS.lng.toFixed(6)}`;
    setGPSHelp(`✓ Ubicación seleccionada en el mapa (Precisión: ${capturedGPS.accuracy}m)`, 'success');
    closeMapModal();
  }

  // ─── API pública para handlers inline ────────────────────────────────────
  window.eventModule = {
    editEvent:    openEditModal,
    deleteEvent:  deleteEvent,
    toggleStatus: toggleStatus
  };

  document.addEventListener('DOMContentLoaded', init);

})();
