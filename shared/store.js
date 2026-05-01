// AsisteQR — Módulo compartido: almacenamiento remoto con Supabase
// Cargado antes de cualquier módulo. Expone window.Store y window.Utils.

(function () {

  const SUPABASE_URL = 'https://rbkeuvpimgsoccrirtrg.supabase.co/rest/v1';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJia2V1dnBpbWdzb2NjcmlydHJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzA3OTM0NiwiZXhwIjoyMDkyNjU1MzQ2fQ.tNN3Yu_bxAcpwo_9cue48axO0PrB2pP4UJaKjHB6j1Y';

  const HEADERS = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  const KEYS = {
    session: 'asisteqr-session',
    user:    'asisteqr-user'
  };

  const ESTADO_CONFIG = {
    programado: { text: 'Programado', class: 'status-programado', color: '#0078D4' },
    activo:     { text: 'Activo',     class: 'status-activo',     color: '#107C10' },
    finalizado: { text: 'Finalizado', class: 'status-finalizado', color: '#999' }
  };

  let eventsCache = [];
  let studentsCache = [];
  let attendancesCache = [];
  let usersCache = [];
  let readyPromise = null;

  function buildUrl(path, query = '') {
    if (!query) return path;
    return query.startsWith('?') || query.startsWith('&') ? `${path}${query}` : `${path}?${query}`;
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      headers: { ...HEADERS, ...(options.headers || {}) }
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Supabase request failed ${response.status} ${response.statusText}: ${bodyText}`);
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  async function apiGet(table, query = '') {
    return apiRequest(buildUrl(`/${table}`, query));
  }

  async function apiPost(table, body, query = '') {
    return apiRequest(buildUrl(`/${table}`, query), {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async function apiPatch(table, body, query) {
    return apiRequest(buildUrl(`/${table}`, query), {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  async function apiDelete(table, query) {
    return apiRequest(buildUrl(`/${table}`, query), {
      method: 'DELETE'
    });
  }

  function getEstadoConfig(estado) {
    return ESTADO_CONFIG[estado] || ESTADO_CONFIG.programado;
  }

  function normalizeEvent(row) {
    return {
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      fecha: row.fecha,
      horaInicio: row.hora_inicio,
      horaFin: row.hora_fin,
      lugar: row.lugar,
      cupos: row.cupos,
      estado: row.estado,
      manualStatus: row.manual_status || false,
      gpsLocation: row.gps_lat != null ? {
        lat: row.gps_lat,
        lng: row.gps_lng,
        accuracy: row.gps_accuracy
      } : null
    };
  }

  function normalizeStudent(row) {
    return {
      id: row.id,
      cedula: row.cedula,
      codigo: row.codigo,
      qrCode: row.qr_code,
      primerNombre: row.primer_nombre,
      segundoNombre: row.segundo_nombre,
      primerApellido: row.primer_apellido,
      segundoApellido: row.segundo_apellido,
      nombre: row.nombre,
      correo: row.correo,
      carrera: row.carrera,
      semestre: row.semestre,
      fechaRegistro: row.fecha_registro
    };
  }

  function normalizeAttendance(row) {
    return {
      id: row.id,
      eventId: row.event_id,
      studentId: row.student_id,
      encargado: row.encargado,
      timestamp: row.registered_at || row.timestamp,
      nota: row.nota,
      fueraDeRadio: row.fuera_de_radio || false,
      location: {
        lat: row.location_lat,
        lng: row.location_lng,
        accuracy: row.location_accuracy,
        distance: row.location_distance
      }
    };
  }

  function eventPayload(event) {
    const payload = {
      codigo: event.codigo,
      nombre: event.nombre,
      descripcion: event.descripcion,
      fecha: event.fecha,
      hora_inicio: event.horaInicio,
      hora_fin: event.horaFin,
      lugar: event.lugar,
      cupos: event.cupos,
      estado: event.estado,
      manual_status: event.manualStatus || false,
      gps_lat: event.gpsLocation?.lat ?? null,
      gps_lng: event.gpsLocation?.lng ?? null,
      gps_accuracy: event.gpsLocation?.accuracy ?? null
    };
    if (event.id != null) payload.id = event.id;
    return payload;
  }

  function studentPayload(student) {
    const payload = {
      cedula: student.cedula,
      codigo: student.codigo,
      qr_code: student.qrCode,
      primer_nombre: student.primerNombre,
      segundo_nombre: student.segundoNombre || null,
      primer_apellido: student.primerApellido,
      segundo_apellido: student.segundoApellido || null,
      nombre: student.nombre,
      correo: student.correo,
      carrera: student.carrera,
      semestre: student.semestre,
      fecha_registro: student.fechaRegistro
    };
    if (student.id != null) payload.id = student.id;
    return payload;
  }

  function attendancePayload(attendance) {
    const payload = {
      event_id: attendance.eventId,
      student_id: attendance.studentId,
      encargado: attendance.encargado,
      registered_at: attendance.timestamp,
      nota: attendance.nota,
      fuera_de_radio: attendance.fueraDeRadio,
      location_lat: attendance.location.lat,
      location_lng: attendance.location.lng,
      location_accuracy: attendance.location.accuracy,
      location_distance: attendance.location.distance
    };
    if (attendance.id != null) payload.id = attendance.id;
    return payload;
  }

  function normalizeUser(row) {
    return {
      id: row.id,
      username: row.username,
      role: row.role || 'admin',
      password: row.password || row.password_hash || null
    };
  }

  async function loadEvents() {
    let rows = null;
    try {
      rows = await apiGet('events', '?select=*');
    } catch (error) {
      console.warn('No se pudo cargar /events, intentando /eventos...', error);
    }

    if (!Array.isArray(rows) || !rows.length) {
      try {
        rows = await apiGet('eventos', '?select=*');
        console.info('Uso de tabla alternativa /eventos para cargar eventos');
      } catch (error) {
        console.error('No se pudo cargar la tabla de eventos con /events ni /eventos', error);
        rows = [];
      }
    }

    eventsCache = Array.isArray(rows) ? rows.map(normalizeEvent) : [];
    console.debug('Eventos cargados:', eventsCache.length, eventsCache.map(e => e.codigo));
    return eventsCache;
  }

  async function loadStudents() {
    const rows = await apiGet('students', '?select=*');
    studentsCache = Array.isArray(rows) ? rows.map(normalizeStudent) : [];
    return studentsCache;
  }

  async function loadAttendances() {
    const rows = await apiGet('attendances', '?select=*');
    attendancesCache = Array.isArray(rows) ? rows.map(normalizeAttendance) : [];
    return attendancesCache;
  }

  async function loadUsers() {
    const rows = await apiGet('users', '?select=*');
    usersCache = Array.isArray(rows) ? rows.map(normalizeUser) : [];
    return usersCache;
  }

  function getUserByUsername(username) {
    return getUsers().find(u => String(u.username).toLowerCase() === String(username).toLowerCase()) || null;
  }

  function getUsers() {
    return usersCache;
  }

  function authenticateUser(username, password) {
    const user = getUserByUsername(username);
    if (!user || !user.password) return null;
    if (String(user.password) !== String(password)) return null;
    return { id: user.id, username: user.username, role: user.role };
  }

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = Promise.all([
      loadEvents(),
      loadStudents(),
      loadAttendances(),
      loadUsers()
    ]).catch(error => {
      console.error('Error inicializando Store con Supabase', error);
      throw error;
    });
    return readyPromise;
  }

  function getEvents() { return eventsCache; }
  function getStudents() { return studentsCache; }
  function getAttendances() { return attendancesCache; }
  function getEventById(id) { return getEvents().find(e => e.id === id) || null; }
  function getStudentById(id) { return getStudents().find(s => s.id === id) || null; }
  function getStudentByCedula(cedula) { return getStudents().find(s => s.cedula === cedula) || null; }
  function getStudentByCode(code) { return getStudents().find(s => s.codigo === code || s.qrCode === code) || null; }
  function getAttendancesByEvent(eventId) { return getAttendances().filter(a => a.eventId === eventId); }
  function isAlreadyRegistered(studentId, eventId) {
    return getAttendances().some(a => a.studentId === studentId && a.eventId === eventId);
  }

  async function createEvent(event) {
    const rows = await apiPost('events', [eventPayload(event)]);
    const created = Array.isArray(rows) && rows.length ? normalizeEvent(rows[0]) : null;
    if (created) eventsCache.push(created);
    return created;
  }

  async function updateEvent(eventId, changes) {
    const original = getEventById(eventId) || {};
    const rows = await apiPatch('events', eventPayload({ ...original, ...changes, id: eventId }), `?id=eq.${eventId}`);
    const updated = Array.isArray(rows) && rows.length ? normalizeEvent(rows[0]) : null;
    if (updated) {
      eventsCache = eventsCache.map(e => e.id === updated.id ? updated : e);
    }
    return updated;
  }

  async function deleteEvent(eventId) {
    await apiDelete('events', `?id=eq.${eventId}`);
    eventsCache = eventsCache.filter(e => e.id !== eventId);
    attendancesCache = attendancesCache.filter(a => a.eventId !== eventId);
  }

  async function saveEvents(events) {
    const rows = await apiPost('events', events.map(eventPayload), '?on_conflict=id');
    eventsCache = Array.isArray(rows) ? rows.map(normalizeEvent) : events;
    return eventsCache;
  }

  async function createStudent(student) {
    const rows = await apiPost('students', [studentPayload(student)]);
    const created = Array.isArray(rows) && rows.length ? normalizeStudent(rows[0]) : null;
    if (created) studentsCache.push(created);
    return created;
  }

  async function saveStudents(students) {
    const rows = await apiPost('students', students.map(studentPayload), '?on_conflict=id');
    studentsCache = Array.isArray(rows) ? rows.map(normalizeStudent) : students;
    return studentsCache;
  }

  async function addAttendance(attendance) {
    const rows = await apiPost('attendances', [attendancePayload(attendance)]);
    const created = Array.isArray(rows) && rows.length ? normalizeAttendance(rows[0]) : null;
    if (created) attendancesCache.push(created);
    return created;
  }

  async function saveAttendances(attendances) {
    const rows = await apiPost('attendances', attendances.map(attendancePayload), '?on_conflict=id');
    attendancesCache = Array.isArray(rows) ? rows.map(normalizeAttendance) : attendances;
    return attendancesCache;
  }

  function getCurrentUser() {
    try { return JSON.parse(sessionStorage.getItem(KEYS.user)) || { username: 'admin', role: 'admin' }; }
    catch { return { username: 'admin', role: 'admin' }; }
  }

  async function ensureDemoData() {
    await init();
  }

  window.Store = {
    KEYS,
    ready: init(),
    init,
    getEvents, saveEvents, getEventById,
    getStudents, saveStudents, getStudentById, getStudentByCedula, getStudentByCode,
    getAttendances, saveAttendances, getAttendancesByEvent, isAlreadyRegistered, addAttendance,
    createEvent, updateEvent, deleteEvent, createStudent,
    getUsers, getUserByUsername, authenticateUser,
    getCurrentUser,
    getEstadoConfig, ESTADO_CONFIG,
    ensureDemoData
  };

})();
