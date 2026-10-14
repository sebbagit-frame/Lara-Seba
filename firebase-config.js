// Configuración de Firebase compartida por el sitio (script.js, formulario
// RSVP) y por admin.html.
//
// Estos datos NO son secretos: la configuración web de Firebase está
// pensada para ir en el código público del navegador. Quién puede leer o
// escribir cada cosa lo deciden las reglas de Firestore (firestore.rules)
// y el login de Google, no esconder esta configuración.

export const firebaseConfig = {
  apiKey: 'AIzaSyAQ8RhQBNG_xYy198lu1UyWXm5TwOeR8go',
  authDomain: 'boda-lara-seba.firebaseapp.com',
  projectId: 'boda-lara-seba',
  storageBucket: 'boda-lara-seba.firebasestorage.app',
  messagingSenderId: '801957410362',
  appId: '1:801957410362:web:91fb97ca3a8a24c58b2703',
};

// Versión del SDK modular que se carga por CDN (gstatic). Cambiarla acá y
// en los import de admin.html si en algún momento se actualiza.
export const FIREBASE_SDK_URL = 'https://www.gstatic.com/firebasejs/10.12.0';
