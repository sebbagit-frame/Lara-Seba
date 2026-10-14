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
// CARTEL "DESLIZÁ HACIA ABAJO" DEL HERO
// Se desvanece pasados ~80px de scroll y reaparece si se vuelve al tope.
// ==========================================================================
function initHeroScrollCue() {
  const scrollCue = document.getElementById('hero-scroll');
  if (!scrollCue) return;

  const HIDE_AFTER_PX = 80;

  function updateVisibility() {
    scrollCue.classList.toggle('is-hidden', window.scrollY > HIDE_AFTER_PX);
  }

  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });
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
// Guarda cada confirmación como un documento en la colección "rsvps" de
// Firebase Firestore (configuración en firebase-config.js, reglas en
// firestore.rules).
// ==========================================================================

// Este archivo es un script clásico (no un módulo), así que el SDK modular
// de Firebase se carga con import() dinámico, recién cuando el invitado
// empieza a completar el formulario: así quien solo mira la invitación no
// descarga el SDK. La promesa se reutiliza entre envíos; si falla (por
// ejemplo, sin conexión), se descarta para que el próximo intento reintente.
let firestorePromise = null;

function loadFirestore() {
  if (!firestorePromise) {
    firestorePromise = (async () => {
      const { firebaseConfig, FIREBASE_SDK_URL } = await import('./firebase-config.js');
      const [{ initializeApp }, firestore] = await Promise.all([
        import(`${FIREBASE_SDK_URL}/firebase-app.js`),
        import(`${FIREBASE_SDK_URL}/firebase-firestore.js`),
      ]);
      const app = initializeApp(firebaseConfig);
      return {
        db: firestore.getFirestore(app),
        doc: firestore.doc,
        setDoc: firestore.setDoc,
        serverTimestamp: firestore.serverTimestamp,
      };
    })();
    firestorePromise.catch(() => {
      firestorePromise = null;
    });
  }
  return firestorePromise;
}

// Sin conexión, Firestore no rechaza la escritura: la deja en espera hasta
// que vuelva la red, y el botón quedaría en "Enviando..." para siempre.
// Si no hay respuesta del servidor en este tiempo, lo tratamos como error
// de red.
const RSVP_TIMEOUT_MS = 15000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('Tiempo de espera agotado');
      err.code = 'timeout';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function initRsvpForm() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  const submitBtn = document.getElementById('rsvp-submit-btn');
  const errorEl = document.getElementById('rsvp-form-error');
  const successEl = document.getElementById('rsvp-success');
  const againBtn = document.getElementById('rsvp-again-btn');
  const submitBtnDefaultText = submitBtn.textContent;
  // Guardamos el texto original del error genérico: más abajo reutilizamos
  // el mismo elemento también para el aviso de "ya respondiste", así que
  // hay que poder volver a este texto en vez de dejar pegado el otro.
  const errorElDefaultText = errorEl.textContent;
  const DUPLICATE_MESSAGE = 'El invitado/a ingresado ya realizó este formulario. Si necesitás modificar tu respuesta, escribinos.';

  // Saca tildes/diacríticos (á, é, ñ̃ con virgulilla duplicada, etc.) pero
  // conserva la ñ como letra propia: la reemplazamos por un carácter de
  // área privada (no se descompone con NFD) antes de sacar los acentos, y
  // la restituimos después. Así "ñ" no se convierte en "n" junto con el
  // resto de los diacríticos.
  function stripAccents(str) {
    return str
      .replace(/ñ/g, '\uE000')
      .replace(/Ñ/g, '\uE001')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\uE000/g, 'ñ')
      .replace(/\uE001/g, 'Ñ');
  }

  // "juan   pérez" -> "Juan Perez": recorta, colapsa espacios múltiples,
  // saca tildes (pedimos escribir sin tildes, pero por si alguien las
  // tipea igual) y deja Mayúscula inicial por palabra. Es el nombre que se
  // guarda y se ve en la admin.
  function normalizeName(rawName) {
    return stripAccents(rawName.trim().replace(/\s+/g, ' '))
      .toLowerCase()
      .split(' ')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }

  // ID del documento en Firestore: "Juan Pérez" -> "juan-perez". Como es el
  // mismo ID para el mismo nombre, un segundo envío intenta pisar un
  // documento que ya existe; las reglas solo permiten crear, así que
  // Firestore lo rechaza (permission-denied) y eso es lo que detecta el
  // duplicado. La "/" no puede ir en un ID de Firestore: se reemplaza.
  function toDocId(normalizedName) {
    return normalizedName
      .toLowerCase()
      .replace(/\//g, ' ')
      .trim()
      .replace(/\s+/g, '-');
  }

  // Bajamos el SDK de Firebase recién cuando el invitado empieza a
  // completar el formulario: para cuando toque "Confirmar", ya está listo.
  form.addEventListener('focusin', () => {
    loadFirestore().catch(() => {});
  }, { once: true });

  // El formulario es solo para confirmar asistencia (quien no puede ir
  // avisa por WhatsApp, ver link debajo del botón): Menú, Canción y
  // Mensaje se muestran siempre, sin bloque condicional.
  const menuCheckboxes = form.querySelectorAll('input[name="menu"]');
  const menuTradicional = document.getElementById('rsvp-menu-tradicional');
  const menuError = document.getElementById('rsvp-menu-error');
  const cancionInput = document.getElementById('rsvp-cancion');

  // "Menú tradicional" es excluyente con el resto: tildar uno destilda
  // automáticamente el otro grupo, en cualquiera de los dos sentidos.
  menuCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (!checkbox.checked) return;

      if (checkbox === menuTradicional) {
        menuCheckboxes.forEach((other) => {
          if (other !== menuTradicional) other.checked = false;
        });
      } else {
        menuTradicional.checked = false;
      }
    });
  });

  // El navegador puede restaurar el formulario tal como quedó antes de
  // recargar (checkboxes tildados, texto tipeado), incluso con
  // autocomplete="off" en el <form> — eso solo evita el autocompletado de
  // datos guardados, no la restauración de estado de la propia sesión de
  // navegación. Forzamos que arranque siempre vacío.
  form.reset();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const nombre = normalizeName(form.nombre.value);
    const docId = toDocId(nombre);
    const mensaje = form.mensaje.value.trim();

    // "required" no frena un nombre hecho solo de espacios; acá sí, porque
    // quedaría un ID de documento vacío.
    if (!docId) {
      form.nombre.value = '';
      form.nombre.reportValidity();
      return;
    }

    // Checkboxes no tienen una validación nativa de "al menos uno tildado
    // dentro del grupo", así que la hacemos a mano.
    const menuChecked = Array.from(menuCheckboxes).filter((cb) => cb.checked);
    if (menuChecked.length === 0) {
      menuError.hidden = false;
      menuError.previousElementSibling.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    menuError.hidden = true;

    // Varias opciones posibles, unidas por coma.
    const menu = menuChecked.map((cb) => cb.value).join(', ');
    // Opcional: string vacío si no completó nada.
    const cancion = cancionInput.value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const { db, doc, setDoc, serverTimestamp } = await withTimeout(loadFirestore(), RSVP_TIMEOUT_MS);
      await withTimeout(
        setDoc(doc(db, 'rsvps', docId), {
          nombre,
          // El formulario solo sirve para confirmar: siempre "Sí".
          asistencia: 'Sí',
          menu,
          cancion,
          mensaje,
          // La hora la pone el servidor de Firebase, no el celular del
          // invitado (que puede tener la hora mal o en otro formato).
          fecha: serverTimestamp(),
        }),
        RSVP_TIMEOUT_MS
      );

      // Éxito: reseteamos el formulario (para que ya esté vacío la próxima
      // vez que se muestre), lo ocultamos y mostramos el agradecimiento.
      form.reset();
      form.hidden = true;
      successEl.hidden = false;
    } catch (err) {
      // permission-denied = ya existe un documento con este nombre (las
      // reglas no permiten pisarlo). Cualquier otra cosa (sin conexión,
      // timeout, SDK que no cargó) es un error de red: mostramos el aviso
      // genérico y dejamos el formulario intacto para que reintente.
      const isDuplicate = err && err.code === 'permission-denied';
      if (!isDuplicate) console.error('Error al enviar el RSVP:', err);
      errorEl.textContent = isDuplicate ? DUPLICATE_MESSAGE : errorElDefaultText;
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

  // Media Session API: en iOS, el audio se trata como una sesión de medios
  // del sistema (aparece en la pantalla de bloqueo / centro de control) en
  // vez de un elemento cualquiera de la página — por eso un audio.pause()
  // llamado desde JS en pagehide/visibilitychange no siempre alcanza ahí.
  // Declarar la sesión (con metadata + un actionHandler de 'pause' real)
  // le da al sistema operativo una forma "oficial" de pausarla, y a
  // nosotros la posibilidad de reforzar el estado hacia afuera.
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Música de fondo',
      artist: 'Lara & Seba',
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
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

  // Al cerrar la pestaña el audio ya se corta solo (el navegador destruye
  // la página), pero 'pagehide' además cubre los casos donde no hay un
  // cierre "limpio": cambiar de pestaña o app en el celular, navegar a
  // otra página — ahí el audio podía seguir sonando unos segundos de más
  // antes de cortarse solo.
  window.addEventListener('pagehide', () => {
    audio.pause();
    // Además del pause() del elemento, le avisamos directo a la sesión de
    // medios del sistema que se detuvo — en iOS es la que manda, y a
    // veces no se entera solo con que el <audio> pase a paused.
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  });

  // 'pagehide' no cubre bloquear la pantalla del celular: ahí la página
  // sigue "viva" (no se descarga), solo queda oculta, así que el audio
  // seguía sonando. 'visibilitychange' + document.hidden sí detecta ese
  // caso específico (y también minimizar o cambiar de pestaña/app, que ya
  // cubría pagehide — se solapan a propósito, no hace daño pausar dos
  // veces un audio que ya está pausado).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
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
  initHeroScrollCue();
  initGiftsModal();
  initRsvpForm();
  initBackgroundMusic();
  initLandingGate();
});
