// AsisteQR — Auth Guard y widget de sesión
// Incluir en todos los módulos excepto index.html y login.html

(function () {

  function checkAuth() {
    if (sessionStorage.getItem(Store.KEYS.session) !== 'active') {
      window.location.replace('../login.html');
      return false;
    }
    return true;
  }

  function logout() {
    sessionStorage.removeItem(Store.KEYS.session);
    sessionStorage.removeItem(Store.KEYS.user);
    window.location.replace('../login.html');
  }

  function injectUserWidget() {
    const navContent = document.querySelector('.nav-content');
    if (!navContent) return;

    const user = Store.getCurrentUser();
    const widget = document.createElement('div');
    widget.className = 'nav-user-widget';
    widget.innerHTML = `
      <div class="nav-user-info">
        <div class="nav-user-avatar">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="4" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M3 18c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
        </div>
        <span class="nav-user-name">${user.username}</span>
        <span class="nav-user-role">${user.role}</span>
      </div>
      <button class="nav-logout-btn" id="btn-logout" title="Cerrar sesión">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M8 14l4-4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 10H3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Cerrar Sesión
      </button>
    `;

    navContent.appendChild(widget);
    document.getElementById('btn-logout').addEventListener('click', () => {
      if (confirm('¿Deseas cerrar sesión?')) logout();
    });
  }

  if (!checkAuth()) return;

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', injectUserWidget)
    : injectUserWidget();

  window.AsisteQRAuth = { getCurrentUser: Store.getCurrentUser, logout };

})();
