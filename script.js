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
// El gesto que autoriza el audio ahora es el botón "Ingresar" de la
// pantalla de bienvenida (ver initLandingGate) — ya no hace falta escuchar
// la primera interacción en cualquier parte de la página. Acá solo queda
// la sincronización del ícono del botón flotante y el loop del fragmento.
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
// PANTALLA DE BIENVENIDA (landing gate)
// Tapa todo el sitio al cargar. El único gesto que dispara el audio es el
// click en "Ingresar" — es un click real del usuario, así que el navegador
// lo autoriza sin bloqueos, a diferencia de un autoplay disparado por JS.
// ==========================================================================
function initLandingGate() {
  const gate = document.getElementById('landing-gate');
  const enterBtn = document.getElementById('landing-gate-enter');
  const curtainLeft = gate ? gate.querySelector('.landing-gate__curtain--left') : null;
  const curtainRight = gate ? gate.querySelector('.landing-gate__curtain--right') : null;
  if (!gate || !enterBtn) return;

  const audio = document.getElementById('bg-audio');

  document.body.style.overflow = 'hidden';
  enterBtn.focus();

  enterBtn.addEventListener('click', () => {
    // audio.play() se llama de forma síncrona, dentro del propio handler
    // de click: así el navegador todavía lo reconoce como parte del gesto
    // del usuario y no lo bloquea (si se llamara después, en un callback
    // async o un setTimeout, dejaría de contar como gesto válido).
    if (audio) {
      audio.play().catch((err) => {
        console.warn('No se pudo iniciar la música al ingresar:', err);
      });
    }

    document.body.style.overflow = '';

    // Devolvemos el foco al inicio del sitio (el hero), no lo dejamos
    // "perdido" en un botón que está por desaparecer.
    const hero = document.getElementById('inicio');
    if (hero) {
      hero.setAttribute('tabindex', '-1');
      hero.focus();
      hero.removeAttribute('tabindex');
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !curtainLeft || !curtainRight) {
      // Fade simple de siempre, sin cortina: la clase .is-hidden anima
      // solo la opacidad de todo el gate en 0.6s (ver CSS).
      gate.classList.add('is-hidden');
      gate.addEventListener('transitionend', () => {
        gate.hidden = true;
      }, { once: true });
      return;
    }

    // Efecto de cortina: .is-opening dispara en simultáneo el
    // deslizamiento de las dos mitades (0.75s) y el fade del contenido
    // (logo/nombres/fecha en el mismo tiempo; el botón, más rápido y por
    // separado, ver CSS de .landing-gate__enter).
    gate.classList.add('is-opening');

    // Esperamos el transitionend de "transform" en LAS DOS mitades antes
    // de ocultar el gate del todo — si esperáramos solo una, podríamos
    // ocultarlo un instante antes de que la otra termine de deslizarse.
    let halvesFinished = 0;
    const onCurtainEnd = (event) => {
      if (event.propertyName !== 'transform') return;
      halvesFinished += 1;
      if (halvesFinished >= 2) {
        curtainLeft.removeEventListener('transitionend', onCurtainEnd);
        curtainRight.removeEventListener('transitionend', onCurtainEnd);
        gate.hidden = true;
      }
    };
    curtainLeft.addEventListener('transitionend', onCurtainEnd);
    curtainRight.addEventListener('transitionend', onCurtainEnd);
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
  initLandingGate();
});
