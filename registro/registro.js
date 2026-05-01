// AsisteQR — Módulo de Registro de Estudiantes

(function () {

  let registeredStudent = null;

  // ─── Inicialización ───────────────────────────────────────────────────────
  async function init() {
    await Store.ready;
    setupEventListeners();
    updateStats();
  }

  function setupEventListeners() {
    document.getElementById('registration-form').addEventListener('submit', handleRegistration);
    document.getElementById('btn-close-qr').addEventListener('click', closeModal);
    document.getElementById('btn-new-registration').addEventListener('click', newRegistration);
    document.getElementById('btn-download-qr').addEventListener('click', downloadQR);
    document.getElementById('btn-search-cedula').addEventListener('click', searchByCedula);
    document.getElementById('cedula-quick-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') searchByCedula();
    });
  }

  // ─── Búsqueda por cédula ──────────────────────────────────────────────────
  function searchByCedula() {
    const cedula    = document.getElementById('cedula-quick-search').value.trim();
    const resultDiv = document.getElementById('cedula-search-result');

    if (!cedula) {
      showSearchMessage(resultDiv, `Por favor ingresa un número de cédula para buscar.`);
      return;
    }

    const student = Store.getStudentByCedula(cedula);

    if (student) {
      resultDiv.style.display = 'none';
      registeredStudent = student;
      showQRModal(student);
    } else {
      showSearchMessage(resultDiv,
        `No se encontró ningún estudiante con la cédula <strong>${cedula}</strong>. 
         Puedes registrarlo usando el formulario a continuación.`
      );
    }
  }

  function showSearchMessage(container, html) {
    container.style.display = 'block';
    container.innerHTML = `
      <div class="cedula-not-found">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="#f97316" stroke-width="2" fill="none"/>
          <path d="M10 6v5M10 14v.5" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
        </svg>
        ${html}
      </div>`;
  }

  // ─── Registro ─────────────────────────────────────────────────────────────
  async function handleRegistration(e) {
    e.preventDefault();

    const fields = {
      cedula:          document.getElementById('cedula').value.trim(),
      primerNombre:    document.getElementById('primer-nombre').value.trim(),
      segundoNombre:   document.getElementById('segundo-nombre').value.trim(),
      primerApellido:  document.getElementById('primer-apellido').value.trim(),
      segundoApellido: document.getElementById('segundo-apellido').value.trim(),
      correo:          document.getElementById('correo').value.trim(),
      carrera:         document.getElementById('carrera').value.trim(),
      semestre:        document.getElementById('semestre').value || ''
    };

    if (Store.getStudentByCedula(fields.cedula)) {
      alert('Ya existe un estudiante registrado con esta cédula.');
      return;
    }

    const codigo = generateCodigo(fields, Store.getStudents());
    const nombre = buildFullName(fields);

    const newStudent = await Store.createStudent({
      ...fields,
      nombre,
      codigo,
      fechaRegistro: new Date().toISOString(),
      qrCode: codigo
    });

    registeredStudent = newStudent;
    alert(`${nombre} (${codigo}) registrado exitosamente`);
    showQRModal(newStudent);
    updateStats();
  }

  // ─── Generación de código único ───────────────────────────────────────────
  function generateCodigo({ primerNombre, segundoNombre, primerApellido, segundoApellido, cedula }, students) {
    const initials =
      primerNombre.charAt(0).toUpperCase() +
      (segundoNombre  ? segundoNombre.charAt(0).toUpperCase()  : '') +
      primerApellido.charAt(0).toUpperCase() +
      (segundoApellido ? segundoApellido.charAt(0).toUpperCase() : '');
    const suffix = cedula.slice(-3);

    let codigo = `${initials}${suffix}`;
    while (students.find(s => s.codigo === codigo)) {
      codigo = `${initials}${suffix}${Math.floor(Math.random() * 10)}`;
    }
    return codigo;
  }

  function buildFullName({ primerNombre, segundoNombre, primerApellido, segundoApellido }) {
    return [primerNombre, segundoNombre, primerApellido, segundoApellido]
      .filter(Boolean).join(' ');
  }

  // ─── Modal QR ─────────────────────────────────────────────────────────────
  function showQRModal(student) {
    document.getElementById('student-info').innerHTML = `
      <div><strong>Código:</strong> <span>${student.codigo}</span></div>
      <div><strong>Nombre:</strong> <span>${student.nombre}</span></div>
      <div><strong>Cédula:</strong> <span>${student.cedula}</span></div>
      <div><strong>Correo:</strong> <span>${student.correo}</span></div>
      <div><strong>Carrera:</strong> <span>${student.carrera}</span></div>
    `;

    const qrContainer = document.getElementById('qr-code');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: student.codigo, width: 200, height: 200,
      colorDark: '#000000', colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.M
    });

    document.getElementById('qr-modal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('qr-modal').classList.remove('active');
  }

  function newRegistration() {
    closeModal();
    document.getElementById('registration-form').reset();
    document.getElementById('cedula').focus();
  }

  // ─── Descarga QR ─────────────────────────────────────────────────────────
  function downloadQR() {
    if (!registeredStudent) return;
    downloadCanvasQR('#qr-code canvas', `QR_${registeredStudent.codigo}.png`, 20);
  }

  function downloadCanvasQR(selector, filename, margin) {
    const src = document.querySelector(selector);
    if (!src) return;
    const canvas = document.createElement('canvas');
    canvas.width  = src.width  + margin * 2;
    canvas.height = src.height + margin * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, margin, margin);
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  // ─── Estadísticas ─────────────────────────────────────────────────────────
  function updateStats() {
    const students = Store.getStudents();
    const today    = new Date().toISOString().split('T')[0];
    document.getElementById('total-students').textContent    = students.length;
    document.getElementById('today-registrations').textContent =
      students.filter(s => s.fechaRegistro?.startsWith(today)).length;
    document.getElementById('qr-generated').textContent      = students.length;
  }

  document.addEventListener('DOMContentLoaded', init);

})();
