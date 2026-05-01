// AsisteQR — Módulo compartido: utilidades de geolocalización
// Expone window.Geo

(function () {

  const MAX_DISTANCE_METERS = 30;

  // Fórmula de Haversine: distancia en metros entre dos coordenadas
  function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Valida la posición del usuario respecto a la ubicación GPS del evento
  function validateAgainstEvent(currentLocation, currentAccuracy, event) {
    if (!currentLocation) {
      return { valid: false, message: 'Ubicación GPS no disponible. Espera a que se active el GPS.' };
    }
    if (currentAccuracy > 100) {
      return { valid: false, message: `Precisión GPS muy baja (${currentAccuracy}m). Muévete a un área abierta.` };
    }

    const eventLoc = event?.gpsLocation || null;
    if (!eventLoc) {
      return { valid: true, distance: 0, fueraDeRadio: false };
    }

    const distance = Math.round(calcDistance(
      currentLocation.lat, currentLocation.lng,
      eventLoc.lat, eventLoc.lng
    ));

    const fueraDeRadio = distance > MAX_DISTANCE_METERS;
    return {
      valid: true,
      distance,
      fueraDeRadio,
      nota: fueraDeRadio
        ? `⚠️ Fuera del radio recomendado (${distance}m del evento, máx. ${MAX_DISTANCE_METERS}m)`
        : null
    };
  }

  // Texto descriptivo de precisión GPS
  function accuracyLabel(meters) {
    if (meters <= 15) return { text: `${meters}m (⭐ Excelente)`, color: '#107C10' };
    if (meters <= 30) return { text: `${meters}m (✓ Buena)`,     color: '#00B294' };
    if (meters <= 60) return { text: `${meters}m (⚠ Aceptable)`, color: '#F7630C' };
    return                   { text: `${meters}m (⚠ Baja)`,      color: '#D13438' };
  }

  // Mensaje de error de geolocalización del navegador
  function errorMessage(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:    return 'Permiso de ubicación denegado';
      case error.POSITION_UNAVAILABLE: return 'Señal GPS no disponible';
      case error.TIMEOUT:              return 'Tiempo de espera GPS agotado';
      default:                         return 'Error de ubicación';
    }
  }

  window.Geo = { calcDistance, validateAgainstEvent, accuracyLabel, errorMessage, MAX_DISTANCE_METERS };

})();
