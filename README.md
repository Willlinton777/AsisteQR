# AsisteQR 🎓

> Sistema de control de asistencia universitaria con escaneo QR, geolocalización GPS y análisis estadístico con IA. Backend en **Supabase**, frontend vanilla JavaScript con diseño **100% responsive mobile**.

---

## ¿Qué es AsisteQR?

AsisteQR permite registrar la asistencia a eventos académicos escaneando códigos QR únicos por estudiante. Cada registro captura automáticamente las coordenadas GPS del dispositivo, permitiendo validar que el estudiante estuvo físicamente presente en el evento.

El sistema incluye gestión de eventos, reportes exportables a Excel y un módulo de análisis con métricas de participación e insights impulsados por IA.

**Características principales:**
- ✅ Escáner QR con HTML5 (funciona en móviles)
- ✅ Geolocalización de alta precisión con Haversine
- ✅ Gestión de eventos con mapa interactivo
- ✅ Generación de códigos QR únicos por estudiante
- ✅ Reportes filtrados + exportación Excel
- ✅ Análisis con gráficas y predicciones
- ✅ **Diseño responsive**: 1024px, 768px, 480px, 360px
- ✅ Autenticación con Supabase

---

## Módulos

| Módulo | Ruta | Descripción |
|---|---|---|
| **Login** | `/login.html` | Autenticación segura con Supabase |
| **Escáner QR** | `/qr/escaner.html` | Registro de asistencia con cámara y GPS |
| **Eventos** | `/eventos/eventos.html` | CRUD de eventos académicos + mapa |
| **Registro** | `/registro/registro.html` | Alta de estudiantes y generación de QR |
| **Reportes** | `/reportes/reportes.html` | Tabla filtrable + mapa + exportación Excel |
| **Análisis** | `/analisis/analisis.html` | Estadísticas, gráficas y predicciones con IA |

---

## Primeros Pasos

### 1. Requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Conexión HTTPS o localhost (requerido para cámara y GPS)
- Acceso a internet (Supabase + CDN)

### 2. Instalación

```bash
# Clona el repositorio
git clone https://github.com/tu-usuario/asisteqr.git
cd asisteqr

# Abre con un servidor local
npx serve .
# o
python -m http.server 8080
# o
php -S localhost:8000
```

### 3. Acceso

Accede en `http://localhost:8080` con las credenciales:

```
Usuario:    admin
Contraseña: admin132
```

El sistema cargar automáticamente **20 eventos** (3 activos) y **10 estudiantes** desde la base de datos Supabase.

---

## Flujo de Trabajo

```
Login → Escáner QR → Eventos → Registro → Reportes → Análisis
```

### 1️⃣ **Login** 
Autentica al administrador. Las credenciales se validan contra la tabla `users` en Supabase.

### 2️⃣ **Escáner QR**
- Selecciona un evento activo ingresando su código (ej: `EVT-2026-013`)
- Activa la cámara del dispositivo
- Escanea el código QR del estudiante
- Valida ubicación GPS y registra asistencia
- Si el estudiante está fuera del radio, aparece advertencia ⚠️

### 3️⃣ **Eventos**
- Crea eventos con nombre, descripción, fecha, hora y ubicación
- Captura coordenadas GPS en vivo o selecciona en mapa
- Estado automático: `programado` → `activo` → `finalizado`
- Cambio manual de estado posible

### 4️⃣ **Registro**
- Agrega nuevos estudiantes (cédula, nombres, carrera, semestre)
- Genera automáticamente código único y QR descargable
- Validación de cédula única

### 5️⃣ **Reportes**
- Tabla de asistencias filtrable por evento, fecha, nombre
- Visualización en mapa de ubicaciones GPS
- Indicadores de precisión GPS y distancia al evento
- Exportación a Excel (`.xlsx`)

### 6️⃣ **Análisis**
- KPIs: total de asistencias, eventos activos, estudiantes
- Gráficas con Chart.js
- Análisis horario (picos de asistencia)
- Predicciones de participación
- Insights por carrera y semestre

---

## Estructura del Proyecto

```
asisteqr/
│
├── shared/                  # Módulos compartidos (cargados primero)
│   ├── store.js             # Capa Supabase: getEvents, addAttendance, etc.
│   ├── geo.js               # Haversine, validación GPS, labels
│   └── auth-guard.js        # Verificación sesión + widget usuario
│
├── login/
│   ├── login.html
│   ├── login.css
│   └── login.js
│
├── qr/
│   ├── escaner.html
│   ├── escaner.css
│   └── escaner.js           # Cámara + geolocalización + procesamiento QR
│
├── eventos/
│   ├── eventos.html
│   ├── eventos.css
│   └── eventos.js           # CRUD, estado automático, mapa Leaflet
│
├── registro/
│   ├── registro.html
│   ├── registro.css
│   └── registro.js          # Alta estudiantes, generación QR
│
├── reportes/
│   ├── reportes.html
│   ├── reportes.css
│   └── reportes.js          # Filtros, tabla, mapa, exportación xlsx
│
├── analisis/
│   ├── analisis.html
│   ├── analisis.css
│   └── analisis.js          # Chart.js, heatmap, predicciones
│
├── index.html               # Landing page
├── login.html               # Login
├── index.css                # Estilos globales
├── nav-user.css             # Widget sesión compartido
├── responsive-mobile.css    # Media queries 480px y 360px
└── README.md                # Este archivo
```

---

## Arquitectura Técnica

### Backend: Supabase REST API
- **Endpoint:** `https://rbkeuvpimgsoccrirtrg.supabase.co/rest/v1`
- **Autenticación:** Bearer token (service_role)
- **Tablas:** `events`, `students`, `attendances`, `users`

### Frontend: Vanilla JavaScript + CDN
- Sin framework (React, Vue, etc.)
- Sin bundler (webpack, vite)
- Módulos IIFE con patrón singleton
- Carga de librerías por CDN

### `shared/store.js` — Fuente única de verdad

Todos los módulos acceden a los datos **exclusivamente** a través de `window.Store`:

```js
// Leer eventos
const eventos = Store.getEvents();

// Buscar evento por ID
const evento = Store.getEventById(eventId);

// Agregar asistencia
await Store.addAttendance({
  eventId, studentId, timestamp, 
  location: { lat, lng, accuracy },
  encargado: 'admin'
});

// Obtener config de estado
const cfg = Store.getEstadoConfig('activo');
// → { text: 'Activo', class: 'status-activo', color: '#107C10' }
```

### `shared/geo.js` — Geolocalización reutilizable

```js
// Distancia en metros (Haversine)
const dist = Geo.calcDistance(lat1, lng1, lat2, lng2);

// Validar si usuario está en radio del evento
const result = Geo.validateAgainstEvent(
  currentLocation,  // { lat, lng, accuracy }
  accuracy,         // metros
  event            // { gpsLocation: { lat, lng } }
);
// → { valid, distance, fueraDeRadio, nota }
```

---

## Base de Datos (Supabase)

### Tabla: `events`
```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TEXT,
  hora_fin TEXT,
  lugar TEXT,
  cupos INTEGER,
  estado TEXT DEFAULT 'programado',
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION,
  manual_status BOOLEAN DEFAULT FALSE
);
```

### Tabla: `students`
```sql
CREATE TABLE students (
  id BIGSERIAL PRIMARY KEY,
  cedula TEXT NOT NULL UNIQUE,
  codigo TEXT NOT NULL UNIQUE,
  qr_code TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  carrera TEXT,
  semestre TEXT
);
```

### Tabla: `attendances`
```sql
CREATE TABLE attendances (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id),
  student_id BIGINT REFERENCES students(id),
  encargado TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_accuracy DOUBLE PRECISION,
  location_distance DOUBLE PRECISION,
  fuera_de_radio BOOLEAN DEFAULT FALSE
);
```

### Tabla: `users`
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin'
);
```

---

## Funcionalidades Destacadas

### 🎯 Geolocalización de Alta Precisión

- Toma múltiples lecturas GPS con `watchPosition`
- Pondera coordenadas por precisión (da más peso a lecturas precisas)
- Almacena: latitud, longitud, precisión en metros, distancia al evento

### 🔄 Estado Automático de Eventos

Los eventos calculan su estado basado en fecha/hora actual:
- `programado` — antes de la hora de inicio
- `activo` — entre inicio y fin (+ 1 hora de tolerancia)
- `finalizado` — después del rango

Se recalcula cada 60 segundos. El administrador puede cambiar el estado manualmente.

### 🚨 Validación de Radio GPS

Cada asistencia se valida contra la ubicación del evento:
- ✅ Dentro del radio (30m) — registro sin advertencia
- ⚠️ Fuera del radio — registro con advertencia, se marca `fuera_de_radio`

### 📱 Diseño Responsive

Soporta todos los tamaños:
- **1024px** (tablet grande/laptop)
- **768px** (tablet/iPad)
- **480px** (móvil grande)
- **360px** (móvil pequeño)

El navbar se adapta con menú vertical en 480px y compacto en 360px.

---

## Dependencias Externas (CDN)

No requieren instalación npm:

| Librería | Uso | CDN |
|---|---|---|
| **QRCode.js** | Generación de QR | cdnjs.cloudflare.com |
| **Html5-QRCode** | Lectura de QR | unpkg.com |
| **Leaflet** | Mapas interactivos | unpkg.com |
| **Chart.js** | Gráficas | cdnjs.cloudflare.com |
| **SheetJS (xlsx)** | Exportación Excel | cdnjs.cloudflare.com |

---

## Personalización

### Cambiar radio de validación GPS
En `shared/geo.js`:
```js
const MAX_DISTANCE_METERS = 30; // Ajusta según necesidad
```

### Cambiar configuración de estado
En `shared/store.js`:
```js
const ESTADO_CONFIG = {
  programado: { text: 'Programado', class: 'status-programado', color: '#0078D4' },
  activo:     { text: 'Activo',     class: 'status-activo',     color: '#107C10' },
  finalizado: { text: 'Finalizado', class: 'status-finalizado', color: '#999' }
};
```

### Actualizar credenciales Supabase
En `shared/store.js`:
```js
const SUPABASE_URL = 'https://YOUR-URL.supabase.co/rest/v1';
const SUPABASE_KEY = 'YOUR-SERVICE-ROLE-KEY';
```

---

## Troubleshooting

### ❌ "Error al cargar los eventos"
**Causa:** Conexión Supabase fallida o tabla no existe.
**Solución:** Verifica las credenciales en `store.js` y que exista la tabla `/events`.

### ❌ "No se pudo acceder a la cámara"
**Causa:** Requiere HTTPS o localhost. Permisos de cámara denegados.
**Solución:** Usa `localhost` o HTTPS. Verifica permisos en navegador.

### ❌ "GPS no disponible"
**Causa:** Requiere HTTPS o localhost en navegador.
**Solución:** Usa servidor local. En móvil, asegura HTTPS y permisos.

---

## Estado del Proyecto

✅ **Completado:**
- Autenticación con Supabase
- Módulo escáner con cámara + GPS
- CRUD de eventos
- Generación de QR por estudiante
- Reportes + exportación Excel
- Análisis con gráficas
- Diseño responsive mobile completo
- Fixes de async/await en escaner.js
- Validación de ubicación GPS

🚀 **Próximas mejoras:**
- Notificaciones en tiempo real
- Estadísticas por profesor
- Integración con calendario
- API REST privada

---

## Licencia

MIT — Libre para usar, modificar y distribuir.

---

## Contacto & Soporte

Para reportar bugs o sugerencias:
- 📧 Email: soporte@asisteqr.dev
- 🐛 GitHub Issues: [Abre un issue](https://github.com/tu-usuario/asisteqr/issues)

---

**Última actualización:** Mayo 1, 2026
**Versión:** 3.0 (Supabase + Mobile Responsive)

**Cambiar credenciales de acceso** — `login/login.js`:
```js
if (usuario === 'admin' && password === 'admin123') { ... }
```

**Cambiar datos demo** — `shared/store.js`:
```js
const DEMO_EVENTS   = [ ... ];
const DEMO_STUDENTS = [ ... ];
```

**Cambiar paleta de colores** — variables CSS en cada módulo:
```css
:root {
  --primary: #0078D4;   /* Azul principal */
  --success: #107C10;   /* Verde activo   */
  --warning: #F7630C;   /* Naranja alerta */
}
```

---

## Compatibilidad

- **Navegadores:** Chrome, Edge, Firefox, Safari (versiones modernas)
- **Cámara / GPS:** requieren HTTPS o `localhost`
- **Dispositivos:** responsive — funciona en móvil, tablet y desktop

---

## Licencia

MIT — libre para uso educativo y profesional.
