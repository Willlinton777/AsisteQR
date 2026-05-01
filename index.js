// AsisteQR - Home Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  initSmoothScroll();
  initScrollAnimations();
});

// Smooth scroll for navigation links
function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');
  
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        const navbarHeight = 80;
        const targetPosition = targetElement.offsetTop - navbarHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// Scroll animations
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  const animatedElements = document.querySelectorAll(
    '.feature-card, .benefit-item, .demo-card, .stats-card'
  );

  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// Demo mode handlers
function openDemo(mode) {
  if (mode === 'student') {
    // Simulate student experience
    alert('🎓 Modo Estudiante\n\nSerás redirigido al escáner QR donde podrás:\n\n✓ Escanear códigos QR de eventos\n✓ Confirmar tu ubicación GPS\n✓ Registrar tu asistencia instantáneamente\n\nPresiona OK para continuar...');
    window.location.href = 'qr/escaner.html';
  } else if (mode === 'admin') {
    // Simulate admin experience  
    alert('👨‍💼 Modo Administrador\n\nAccederás al panel completo donde podrás:\n\n✓ Gestionar eventos académicos\n✓ Ver reportes de asistencia en tiempo real\n✓ Analizar datos con IA avanzada\n✓ Exportar información geolocalizada\n\nCredenciales:\nUsuario: admin\nContraseña: admin123\n\nPresiona OK para continuar...');
    window.location.href = 'login.html';
  }
}

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  
  if (currentScroll > 100) {
    navbar.style.boxShadow = '0 2px 16px rgba(0, 0, 0, 0.1)';
  } else {
    navbar.style.boxShadow = 'none';
  }
  
  lastScroll = currentScroll;
});

// Counter animation for stats
function animateCounter(element, target, duration = 2000) {
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, 16);
}

// Trigger counter animations when stats come into view
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.dataset.animated) {
      const statNumbers = entry.target.querySelectorAll('.stat-number');
      statNumbers.forEach(stat => {
        const text = stat.textContent;
        const numbers = text.match(/\d+/);
        if (numbers) {
          animateCounter(stat, parseInt(numbers[0]));
          entry.target.dataset.animated = 'true';
        }
      });
    }
  });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
  statsObserver.observe(heroStats);
}
