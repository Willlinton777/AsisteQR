// AsisteQR — Módulo Escáner QR con Geolocalización

(function () {

  let currentLocation  = null;
  let currentAccuracy  = null;
  let selectedEventId  = null;
  let watchId          = null;
  let html5QrCode      = null;
  let isScanning       = false;

  // ─── Inicialización ───────────────────────────────────────────────────────
  async function init() {
    try {
      await Store.ready;
    } catch (error) {
      console.error('No se pudieron cargar los datos del Store:', error);
      alert('Error al cargar los eventos. Revisa la conexión con Supabase o el tablero de eventos.');
      return;
    }

    setupEventListeners();
    startGPSTracking();
    updateStats();
  }

  function setupEventListeners() {
    document.getElementById('btn-search-event')?.addEventListener('click', searchEvent);
    document.getElementById('event-code-input')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') searchEvent();
    });
    document.getElementById('btn-start-scan').addEventListener('click', startScanner);
    document.getElementById('btn-stop-scan')?.addEventListener('click', stopScanner);
  }

  // ─── Búsqueda de evento ───────────────────────────────────────────────────
  function searchEvent() {
    const code = document.getElementById('event-code-input')?.value.trim();
    if (!code) { alert('Por favor ingresa un código de evento'); return; }

    const normalizedCode = code.toUpperCase();
    const event = Store.getEvents().find(e => String(e.codigo || '').trim().toUpperCase() === normalizedCode);
    if (!event) { alert(`No se encontró ningún evento con el código: ${code}`); return; }

    selectedEventId = event.id;
    renderEventInfo(event);
    updateStats();

    const estado = event.estado || 'programado';
    if (estado === 'finalizado')  alert('⚠️ Este evento ya ha finalizado.\n\nNo se pueden registrar más asistencias.');
    if (estado === 'programado')  alert('⚠️ Este evento aún no ha iniciado.\n\nSolo se pueden registrar asistencias en eventos activos.');
  }

  function renderEventInfo(event) {
    const cfg = Store.getEstadoConfig(event.estado || 'programado');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('event-name',     event.nombre);
    set('event-location', event.lugar);
    set('event-date',     new Date(event.fecha).toLocaleDateString('es-CO'));

    const statusEl = document.getElementById('event-status');
    if (statusEl) { statusEl.textContent = cfg.text; statusEl.className = 'event-status-badge ' + cfg.class; }

    const info = document.getElementById('event-info');
    if (info) info.style.display = 'grid';
  }

  // ─── Escáner QR ──────────────────────────────────────────────────────────
  async function startScanner() {
    if (!selectedEventId) { alert('Por favor busca y selecciona un evento primero'); return; }

    const event  = Store.getEventById(selectedEventId);
    const estado = event?.estado || 'programado';
    if (estado === 'finalizado') { alert('⚠️ Este evento ya ha finalizado.'); return; }
    if (estado === 'programado') { alert('⚠️ Este evento aún no ha iniciado.'); return; }
    if (!currentLocation)        { alert('Esperando señal GPS. Por favor espera.'); return; }

    setScannerVisible(true);
    try {
      html5QrCode = new Html5Qrcode('qr-reader');
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps:10, qrbox:{ width:250, height:250 }, aspectRatio:1.0 },
        onScanSuccess, () => {}
      );
      isScanning = true;
    } catch {
      alert('No se pudo acceder a la cámara. Verifica los permisos.');
      resetScanner();
    }
  }

  async function stopScanner() {
    if (html5QrCode && isScanning) {
      try { await html5QrCode.stop(); document.getElementById('qr-reader').innerHTML = ''; }
      catch {}
    }
    resetScanner();
  }

  function resetScanner() {
    setScannerVisible(false);
    html5QrCode = null;
    isScanning  = false;
  }

  function setScannerVisible(scanning) {
    const placeholder = document.querySelector('.scanner-placeholder');
    const reader      = document.getElementById('qr-reader');
    const btnStart    = document.getElementById('btn-start-scan');
    const btnStop     = document.getElementById('btn-stop-scan');

    if (placeholder) placeholder.style.display = scanning ? 'none' : 'flex';
    if (reader)      { reader.style.display = scanning ? 'block' : 'none'; if (!scanning) reader.innerHTML = ''; }
    if (btnStart)    btnStart.style.display  = scanning ? 'none' : 'inline-flex';
    if (btnStop)     btnStop.style.display   = scanning ? 'inline-flex' : 'none';
  }

  function onScanSuccess(decodedText) {
    stopScanner();
    processQRCode(decodedText);
  }

  // ─── Procesamiento de QR ──────────────────────────────────────────────────
  async function processQRCode(qrCode) {
    const student = Store.getStudentByCode(qrCode);
    if (!student) { showResult('error', 'QR No Válido', `Código no encontrado: ${qrCode}`); return; }

    const event    = Store.getEventById(selectedEventId);
    const geoCheck = Geo.validateAgainstEvent(currentLocation, currentAccuracy, event);

    if (Store.isAlreadyRegistered(student.id, selectedEventId)) {
      showResult('warning', 'Ya Registrado', `${student.nombre} ya está registrado`);
      renderStudentResult(student, event, null);
      return;
    }

    const user       = Store.getCurrentUser();
    const attendance = {
      eventId:     selectedEventId,
      studentId:   student.id,
      encargado:   user.username || 'admin',
      timestamp:   new Date().toISOString(),
      nota:        geoCheck.nota || null,
      fueraDeRadio: geoCheck.fueraDeRadio || false,
      location: {
        lat:      currentLocation.lat,
        lng:      currentLocation.lng,
        accuracy: currentAccuracy,
        distance: geoCheck.distance || 0
      }
    };

    await Store.addAttendance(attendance);

    const msg = geoCheck.fueraDeRadio
      ? `${student.nombre} registrado con advertencia GPS`
      : `${student.nombre} registrado exitosamente`;
    showResult('success', 'Asistencia Registrada', msg);
    renderStudentResult(student, event, attendance);
    updateStats();

    setTimeout(() => startScanner(), 2000);
  }

  // ─── Resultado visual ─────────────────────────────────────────────────────
  function showResult(type, title, message) {
    const isSuccess = type === 'success';
    const resultIcon = document.getElementById('result-icon');
    if (resultIcon) {
      resultIcon.className = 'result-icon ' + (isSuccess ? 'success' : 'error');
      resultIcon.innerHTML = isSuccess
        ? `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="4" fill="none"/>
            <path d="M20 32l8 8 16-16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`
        : `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="4" fill="none"/>
            <path d="M24 24l16 16M40 24L24 40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;
    }
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('result-title',   title);
    set('result-message', message);

    const card = document.getElementById('result-card');
    if (card) { card.style.animation = 'none'; setTimeout(() => { card.style.animation = 'slideIn 0.4s ease-out'; }, 10); }
  }

  function renderStudentResult(student, event, attendance) {
    const modal = document.getElementById('attendance-modal');
    if (!modal) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('modal-student-name',       `${student.nombre}`);
    set('modal-student-id',         student.codigo);
    set('modal-student-career',     student.carrera);
    set('modal-event-name',         event?.nombre || 'N/A');
    set('modal-location-coords',    `${attendance.location.lat.toFixed(6)}, ${attendance.location.lng.toFixed(6)}`);
    set('modal-location-precision', `${attendance.location.accuracy}m (${attendance.location.distance}m del evento)`);
    set('modal-attendance-time',    new Date(attendance.timestamp).toLocaleString('es-CO'));

    modal.classList.add('active');

    const closeModal = () => {
      modal.classList.remove('active');
      if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
    };

    document.getElementById('modal-close-btn').onclick = closeModal;

    let autoCloseTimeout = setTimeout(closeModal, 2000);
  }

  // ─── GPS continuo ─────────────────────────────────────────────────────────
  function startGPSTracking() {
    const statusEl   = document.getElementById('location-status');
    const accuracyEl = document.getElementById('gps-accuracy');

    if (!navigator.geolocation) {
      statusEl?.classList.add('error');
      if (statusEl) statusEl.querySelector('span').textContent = 'Geolocalización no disponible';
      return;
    }

    if (location.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(location.hostname)) {
      if (statusEl) statusEl.querySelector('span').textContent = 'Se requiere HTTPS para geolocalización';
      return;
    }

    statusEl?.classList.add('checking');
    if (statusEl) statusEl.querySelector('span').textContent = 'Solicitando permisos de ubicación...';

    const opts = { enableHighAccuracy:true, timeout:30000, maximumAge:0 };

    navigator.geolocation.getCurrentPosition(pos => {
      if (statusEl) statusEl.querySelector('span').textContent = 'Mejorando precisión GPS...';
      onLocationUpdate(pos, statusEl, accuracyEl);
      watchId = navigator.geolocation.watchPosition(
        p => onLocationUpdate(p, statusEl, accuracyEl),
        err => onLocationError(err, statusEl, accuracyEl),
        { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
      );
    }, err => onLocationError(err, statusEl, accuracyEl), opts);
  }

  function onLocationUpdate(position, statusEl, accuracyEl) {
    currentLocation = {
      lat:      position.coords.latitude,
      lng:      position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    currentAccuracy = Math.round(position.coords.accuracy);

    statusEl?.classList.remove('checking', 'error');
    if (statusEl) {
      const msg = currentAccuracy <= 10 ? 'GPS de Alta Precisión Activo'
                : currentAccuracy <= 30 ? 'GPS Activo - Mejorando precisión...'
                : 'GPS Activo - Precisión limitada';
      statusEl.querySelector('span').textContent = msg;
    }

    if (accuracyEl) {
      const { text, color } = Geo.accuracyLabel(currentAccuracy);
      accuracyEl.textContent = text;
      accuracyEl.style.color = color;
    }
  }

  function onLocationError(error, statusEl, accuracyEl) {
    statusEl?.classList.add('error');
    statusEl?.classList.remove('checking');
    if (statusEl) statusEl.querySelector('span').textContent = Geo.errorMessage(error);
    if (accuracyEl) accuracyEl.textContent = 'No disponible';
  }

  // ─── Estadísticas ─────────────────────────────────────────────────────────
  function updateStats() {
    const attendances   = Store.getAttendances();
    const today         = new Date().toISOString().split('T')[0];
    const todayCount    = attendances.filter(a => (a.timestamp||'').startsWith(today)).length;
    const activeEvents  = Store.getEvents().filter(e => (e.estado||'activo') === 'activo').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-today',  todayCount);
    set('stat-event',  activeEvents);
    set('stat-total',  attendances.length);
  }

  window.addEventListener('beforeunload', () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  });

  document.addEventListener('DOMContentLoaded', init);

})();
