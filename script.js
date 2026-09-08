// ==========================================================================
// SIEMPRE ARRANCAR ARRIBA DE TODO
// Se suma al history.scrollRestoration = 'manual' del <head>: ese solo evita
// que el navegador restaure la posición, esto la fuerza a 0. El listener de
// "pageshow" cubre el caso de volver con los botones atrás/adelante, donde
// el navegador puede restaurar la página completa desde su caché (bfcache)
// sin volver a ejecutar este script normalmente.
// ==========================================================================
window.scrollTo(0, 0);

window.addEventListener('pageshow', () => {
  window.scrollTo(0, 0);
});

// ==========================================================================
// CONFIGURACIÓN DEL EVENTO
// Cambiá acá la fecha/hora del casamiento (formato: 'AAAA-MM-DDTHH:MM:SS')
// Usá la hora local de Argentina (no hace falta indicar zona horaria).
// ==========================================================================
const WEDDING_DATE = new Date('2027-03-06T18:00:00');

// ==========================================================================
// COUNTDOWN
// ==========================================================================
function initCountdown() {
  const elDays = document.getElementById('cd-days');
  const elHours = document.getElementById('cd-hours');
  const elMinutes = document.getElementById('cd-minutes');
  const elSeconds = document.getElementById('cd-seconds');
  const countdownEl = document.getElementById('countdown');

  if (!elDays || !elHours || !elMinutes || !elSeconds) return;

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function update() {
    const now = new Date();
    const diff = WEDDING_DATE - now;

    if (diff <= 0) {
      // El día ya llegó (o pasó): mostramos ceros y un mensaje.
      elDays.textContent = '00';
      elHours.textContent = '00';
      elMinutes.textContent = '00';
      elSeconds.textContent = '00';
      if (countdownEl) {
        countdownEl.setAttribute('aria-label', '¡Hoy es el gran día!');
      }
      clearInterval(timer);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    elDays.textContent = pad(days);
    elHours.textContent = pad(hours);
    elMinutes.textContent = pad(minutes);
    elSeconds.textContent = pad(seconds);
  }

  update();
  const timer = setInterval(update, 1000);
}

// ==========================================================================
// ANIMACIONES AL HACER SCROLL (reveal)
// Cualquier elemento con la clase .reveal fuera del hero se anima al entrar
// en el viewport.
// ==========================================================================
function initScrollReveal() {
  const revealEls = document.querySelectorAll('section .reveal');
  if (!revealEls.length) return;

  if (!('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealEls.forEach((el) => observer.observe(el));
}

// ==========================================================================
// MODAL DE REGALOS
// ==========================================================================
function initGiftsModal() {
  const overlay = document.getElementById('gifts-modal-overlay');
  const openBtn = document.getElementById('gifts-open-btn');
  const closeBtn = document.getElementById('gifts-close-btn');
  const closeBtnFull = document.getElementById('gifts-close-btn-full');
  const modal = document.getElementById('gifts-modal');

  if (!overlay || !openBtn || !modal) return;

  let lastFocusedEl = null;

  function openModal() {
    lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    // Forzamos reflow para que la transición de apertura se dispare.
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModal() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    // Esperamos a que termine la transición antes de ocultar del todo.
    setTimeout(() => {
      overlay.hidden = true;
    }, 300);
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  if (closeBtnFull) closeBtnFull.addEventListener('click', closeModal);

  // Cerrar al hacer click en el overlay (fuera de la tarjeta).
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Cerrar con Escape.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  // Botones de copiar al portapapeles.
  const copyBtns = document.querySelectorAll('.copy-btn');
  copyBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy-target');
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      const text = targetEl.textContent.trim();

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback para navegadores/contextos sin Clipboard API.
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }

        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 1500);
      } catch (err) {
        console.error('No se pudo copiar al portapapeles:', err);
      }
    });
  });
}

// ==========================================================================
// FORMULARIO DE RSVP
// Envía las respuestas a SheetDB (https://sheetdb.io), que las guarda como
// filas en una hoja de Google Sheets conectada a este endpoint.
// ==========================================================================
const SHEETDB_URL = 'https://sheetdb.io/api/v1/icao3nsec6d7i';

function initRsvpForm() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  const submitBtn = document.getElementById('rsvp-submit-btn');
  const errorEl = document.getElementById('rsvp-form-error');
  const successEl = document.getElementById('rsvp-success');
  const againBtn = document.getElementById('rsvp-again-btn');
  const submitBtnDefaultText = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const nombre = form.nombre.value.trim();
    const asistenciaInput = form.querySelector('input[name="asistencia"]:checked');
    const asistencia = asistenciaInput ? asistenciaInput.value : '';
    const mensaje = form.mensaje.value.trim();

    // Fecha en formato legible (ej: "7/9/2026 14:32") para identificar cuándo llegó cada respuesta.
    const fecha = new Date().toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const response = await fetch(SHEETDB_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            Nombre: nombre,
            Asistencia: asistencia,
            Mensaje: mensaje,
            Fecha: fecha,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`SheetDB respondió con estado ${response.status}`);
      }

      // Éxito: reseteamos el formulario (para que ya esté vacío la próxima
      // vez que se muestre), lo ocultamos y mostramos el agradecimiento.
      form.reset();
      form.hidden = true;
      successEl.hidden = false;
    } catch (err) {
      // Error de red o de la API: mostramos el aviso y dejamos el formulario
      // intacto (con todo lo que la persona ya completó) para que reintente.
      console.error('Error al enviar el RSVP:', err);
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtnDefaultText;
    }
  });

  // "Enviar otra respuesta": vuelve a mostrar el formulario (ya vacío, por
  // el form.reset() de arriba) con el botón de submit en su estado normal.
  // Útil para que dos personas de la misma familia confirmen por separado
  // desde el mismo dispositivo.
  if (againBtn) {
    againBtn.addEventListener('click', () => {
      successEl.hidden = true;
      errorEl.hidden = true;
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtnDefaultText;
      form.hidden = false;
    });
  }
}

// ==========================================================================
// MÚSICA DE FONDO
// Los navegadores bloquean el autoplay con sonido, así que no podemos
// arrancar la música al cargar la página. En cambio, esperamos la primera
// interacción real del usuario (click, scroll, tecla o touch) en cualquier
// parte de la página para intentar reproducirla — no hace falta que toque
// el botón específicamente. A partir de ahí, el botón queda disponible
// para mutear/activar manualmente cuando quiera.
// ==========================================================================
function initBackgroundMusic() {
  const audio = document.getElementById('bg-audio');
  const btn = document.getElementById('music-toggle-btn');
  if (!audio || !btn) return;

  // Fragmento a loopear (en segundos): de 0:00 a 0:40. No usamos el
  // atributo "loop" del <audio> porque ese repite el archivo entero al
  // llegar a su final; acá cortamos manualmente mucho antes.
  const FRAGMENT_START = 0;
  const FRAGMENT_END = 40;

  function setPlayingUI(isPlaying) {
    btn.classList.toggle('is-playing', isPlaying);
    btn.setAttribute('aria-pressed', String(isPlaying));
    btn.setAttribute('aria-label', isPlaying ? 'Silenciar música' : 'Activar música');
  }

  function tryPlay() {
    // audio.play() devuelve una Promise que puede rechazarse si el
    // navegador todavía considera que no hubo una interacción "suficiente"
    // (pasa sobre todo en iOS). Si eso pasa, el botón queda en estado
    // "muteado" y la persona puede tocarlo para intentarlo de nuevo, esta
    // vez con un click directo sobre el botón.
    audio.play().catch((err) => {
      console.warn('No se pudo iniciar la música automáticamente:', err);
    });
  }

  // Arranca siempre en FRAGMENT_START, sea la primera vez que suena o una
  // repetición manual (botón) después de haber estado pausada.
  audio.addEventListener('play', () => {
    if (audio.currentTime >= FRAGMENT_END) {
      audio.currentTime = FRAGMENT_START;
    }
    setPlayingUI(true);
  });
  audio.addEventListener('pause', () => setPlayingUI(false));

  // Loop del fragmento: en vez de dejar que llegue al final del archivo,
  // apenas currentTime pasa FRAGMENT_END lo mandamos de nuevo a
  // FRAGMENT_START y sigue reproduciendo desde ahí, sin cortarse.
  audio.addEventListener('timeupdate', () => {
    if (audio.currentTime >= FRAGMENT_END) {
      audio.currentTime = FRAGMENT_START;
    }
  });

  // Primera interacción del usuario en cualquier parte de la página.
  // No incluye 'scroll': los navegadores no lo consideran un gesto válido
  // para autorizar autoplay de audio, así que escucharlo no ayuda y solo
  // suma inconsistencia (a veces "gasta" el { once: true } sin lograr
  // reproducir nada).
  const startOnFirstInteraction = () => {
    tryPlay();
    document.removeEventListener('click', startOnFirstInteraction);
    document.removeEventListener('keydown', startOnFirstInteraction);
    document.removeEventListener('touchstart', startOnFirstInteraction);
  };
  document.addEventListener('click', startOnFirstInteraction, { once: true, passive: true });
  document.addEventListener('keydown', startOnFirstInteraction, { once: true });
  document.addEventListener('touchstart', startOnFirstInteraction, { once: true, passive: true });

  // Toggle manual: reutiliza tryPlay() para el mismo manejo de errores.
  btn.addEventListener('click', () => {
    if (audio.paused) {
      tryPlay();
    } else {
      audio.pause();
    }
  });
}

// ==========================================================================
// INIT
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initScrollReveal();
  initGiftsModal();
  initRsvpForm();
  initBackgroundMusic();
});
