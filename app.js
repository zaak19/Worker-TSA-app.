/* ===========================================================
   WORKER TSA — app.js
   Navigation entre écrans, état de l'application, logique UI.
   by Trillion Software
   =========================================================== */

window.WorkerTSA = window.WorkerTSA || {};

/* ---------------------------------------------------------
   ÉTAT GLOBAL (en mémoire ; persistance Firestore via provider.js)
   --------------------------------------------------------- */
WorkerTSA.state = {
  language: localStorage.getItem('workerTsaLang') || null,
  profileType: null,        // 'organisateur' | 'participant'
  activityType: 'evenement', // 'evenement' | 'service' (profil organisateur)
  participantType: null,     // 'evenement' | 'service'
  org: {
    email: null,
    country: null,
    phone: null,
    whatsapp: null,
    plan: null,
    planPrice: null,
    billingType: null,
    eventRegistrationFee: null,
    payMethod: null
  },
  currentUserId: null,
  accountRole: null,
  accountProfile: null,
  selectedEvent: null,
  selectedTicket: null,
  pendingTicketPurchase: null,
  organizerDashboard: { events: [], selectedEventId: null, withdrawalMethod: null },
  addingEvent: false,
  isAdmin: false
};

WorkerTSA.MAX_ORGANIZER_EVENTS = 5;

/* ---------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------- */
WorkerTSA.PROTECTED_ORGANIZER_SCREENS = ['screen-org-1','screen-org-2','screen-org-3','screen-org-4','screen-org-5','screen-org-6','screen-org-7','screen-org-8','screen-org-9','screen-org-10','screen-org-pending','screen-new-event','screen-organizer-dashboard'];
WorkerTSA.ADMIN_SCREEN = 'screen-admin';
WorkerTSA.goTo = function (screenId) {
  if (screenId === WorkerTSA.ADMIN_SCREEN && !WorkerTSA.state.isAdmin) {
    console.warn('Accès console admin refusé.');
    alert('Cet espace est réservé à l’administrateur.');
    screenId = 'screen-home';
  }
  if (WorkerTSA.PROTECTED_ORGANIZER_SCREENS.indexOf(screenId) !== -1 && WorkerTSA.state.accountRole !== 'organisateur') {
    console.warn('Accès professionnel refusé.');
    alert('Cet espace est réservé aux comptes organisateur / prestataire.');
    screenId = 'screen-home';
  }
  document.querySelectorAll('.screen').forEach(function (el) { el.classList.remove('active'); });
  const target = document.getElementById(screenId);
  if (target) { target.classList.add('active'); window.scrollTo(0, 0); }
  else console.warn('Écran introuvable :', screenId);
};

/* ---------------------------------------------------------
   LOGO — injecte le SVG partout où un .logo-slot est présent
   --------------------------------------------------------- */
function injectLogos() {
  const template = document.getElementById('logo-svg-template');
  if (!template) return;
  document.querySelectorAll('.logo-slot').forEach(function (slot) {
    slot.innerHTML = template.innerHTML;
  });
}

/* ---------------------------------------------------------
   CODE DE SÉCURITÉ — PIN LOCAL
   Le PIN n'est jamais enregistré en clair : seul un dérivé
   PBKDF2 + sel aléatoire est conservé dans localStorage.
   --------------------------------------------------------- */
WorkerTSA.pin = {
  length: 4,
  buffer: '',
  firstEntry: null,
  confirming: false,
  storageKey: 'workerTsaPinV1'
};

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derivePinHash(pin, saltBase64) {
  if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
    throw new Error('La sécurité cryptographique du navigateur est indisponible.');
  }
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltBase64), iterations: 100000, hash: 'SHA-256' },
    material,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function hasLocalPin() {
  try {
    const record = JSON.parse(localStorage.getItem(WorkerTSA.pin.storageKey) || 'null');
    return !!(record && record.hash && record.salt && [4, 6, 8].indexOf(Number(record.length)) !== -1);
  } catch (e) {
    return false;
  }
}

function getLocalPinRecord() {
  try {
    return JSON.parse(localStorage.getItem(WorkerTSA.pin.storageKey) || 'null');
  } catch (e) {
    return null;
  }
}

WorkerTSA.setPinLength = function (length) {
  length = Number(length);
  if ([4, 6, 8].indexOf(length) === -1) return;
  WorkerTSA.pin.length = length;
  WorkerTSA.pin.buffer = '';
  WorkerTSA.pin.firstEntry = null;
  WorkerTSA.pin.confirming = false;
  document.querySelectorAll('.pin-length-btn').forEach(function (btn) {
    btn.classList.toggle('selected', Number(btn.dataset.length) === length);
  });
  renderPinDots('pin-setup-dots', 0, length);
  const status = document.getElementById('pin-setup-status');
  if (status) status.textContent = 'Saisissez votre nouveau code';
  clearPinError('pin-setup-error');
};

function renderPinDots(targetId, count, length) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = '';
  for (let i = 0; i < length; i++) {
    const dot = document.createElement('span');
    dot.className = 'pin-dot' + (i < count ? ' filled' : '');
    dot.setAttribute('aria-hidden', 'true');
    target.appendChild(dot);
  }
}

function clearPinError(id) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

function showPinError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
}

function renderPinKeypad(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0',''];
  target.innerHTML = keys.map(function (key) {
    if (!key) return '<span class="pin-key-spacer" aria-hidden="true"></span>';
    if (key === '⌫') {
      return '<button type="button" class="pin-key pin-key-action" aria-label="Effacer" onclick="WorkerTSA.pinBackspace()">⌫</button>';
    }
    return '<button type="button" class="pin-key" onclick="WorkerTSA.pinDigit(\'' + key + '\')">' + key + '</button>';
  }).join('');
}

WorkerTSA.pinDigit = function (digit) {
  if (!/^\d$/.test(digit)) return;
  const p = WorkerTSA.pin;
  if (p.buffer.length >= p.length) return;
  p.buffer += digit;
  const isSetup = !p.unlockMode;
  renderPinDots(isSetup ? 'pin-setup-dots' : 'pin-unlock-dots', p.buffer.length, p.length);
  clearPinError(isSetup ? 'pin-setup-error' : 'pin-unlock-error');

  if (p.buffer.length === p.length) {
    if (isSetup) finishPinSetupEntry();
    else verifyPin();
  }
};

WorkerTSA.pinBackspace = function () {
  const p = WorkerTSA.pin;
  p.buffer = p.buffer.slice(0, -1);
  const isSetup = !p.unlockMode;
  renderPinDots(isSetup ? 'pin-setup-dots' : 'pin-unlock-dots', p.buffer.length, p.length);
};

async function finishPinSetupEntry() {
  const p = WorkerTSA.pin;
  if (!p.confirming) {
    p.firstEntry = p.buffer;
    p.buffer = '';
    p.confirming = true;
    renderPinDots('pin-setup-dots', 0, p.length);
    const status = document.getElementById('pin-setup-status');
    if (status) status.textContent = 'Confirmez votre code';
    return;
  }

  if (p.buffer !== p.firstEntry) {
    p.buffer = '';
    p.firstEntry = null;
    p.confirming = false;
    renderPinDots('pin-setup-dots', 0, p.length);
    const status = document.getElementById('pin-setup-status');
    if (status) status.textContent = 'Saisissez un nouveau code';
    return showPinError('pin-setup-error', 'Les deux codes ne correspondent pas.');
  }

  try {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    const saltBase64 = bytesToBase64(salt);
    const hash = await derivePinHash(p.buffer, saltBase64);
    localStorage.setItem(p.storageKey, JSON.stringify({
      version: 1,
      length: p.length,
      salt: saltBase64,
      hash: hash
    }));
    p.buffer = '';
    p.firstEntry = null;
    p.confirming = false;
    proceedAfterPin();
  } catch (error) {
    showPinError('pin-setup-error', 'Impossible d\'activer le code de sécurité sur ce navigateur.');
  }
}

async function verifyPin() {
  const p = WorkerTSA.pin;
  const record = getLocalPinRecord();
  if (!record) return startPinScreen(true);

  try {
    const hash = await derivePinHash(p.buffer, record.salt);
    if (constantTimeEqual(hash, record.hash)) {
      p.buffer = '';
      proceedAfterPin();
      return;
    }
  } catch (error) {
    showPinError('pin-unlock-error', 'Impossible de vérifier le code sur ce navigateur.');
    p.buffer = '';
    renderPinDots('pin-unlock-dots', 0, p.length);
    return;
  }

  p.buffer = '';
  renderPinDots('pin-unlock-dots', 0, p.length);
  showPinError('pin-unlock-error', 'Code incorrect. Réessayez.');
};

function proceedAfterPin() {
  WorkerTSA.pin.unlockMode = false;
  // Si Firebase a déjà restauré une session, ne renvoie pas l'utilisateur
  // vers l'écran de connexion : affiche directement l'accueil avec les droits.
  if (auth.currentUser && WorkerTSA.state.currentUserId) {
    WorkerTSA.refreshHomeRoleUI();
    WorkerTSA.goTo('screen-home');
  } else if (WorkerTSA.state.language) WorkerTSA.goTo('screen-auth');
  else WorkerTSA.goTo('screen-language');
}

function startPinScreen(unlockMode) {
  const setup = document.getElementById('pin-setup-content');
  const unlock = document.getElementById('pin-unlock-content');
  const p = WorkerTSA.pin;
  p.unlockMode = !!unlockMode;
  p.buffer = '';
  p.firstEntry = null;
  p.confirming = false;

  if (p.unlockMode) {
    const record = getLocalPinRecord();
    p.length = Number(record && record.length) || 4;
    if (setup) setup.classList.add('hidden');
    if (unlock) unlock.classList.remove('hidden');
    renderPinDots('pin-unlock-dots', 0, p.length);
    renderPinKeypad('pin-unlock-keypad');
    clearPinError('pin-unlock-error');
  } else {
    if (setup) setup.classList.remove('hidden');
    if (unlock) unlock.classList.add('hidden');
    document.querySelectorAll('.pin-length-btn').forEach(function (btn) {
      btn.classList.toggle('selected', Number(btn.dataset.length) === p.length);
    });
    renderPinDots('pin-setup-dots', 0, p.length);
    renderPinKeypad('pin-setup-keypad');
    clearPinError('pin-setup-error');
  }
  WorkerTSA.goTo('screen-pin');
}

/* ---------------------------------------------------------
   LANGUE
   --------------------------------------------------------- */
WorkerTSA.setLanguage = function (lang) {
  WorkerTSA.state.language = lang;
  localStorage.setItem('workerTsaLang', lang);
  // NOTE : la traduction complète de l'interface (FR/EN) sera à
  // implémenter ici (dictionnaire de textes) une fois le contenu
  // final validé. Pour l'instant, seule la langue est mémorisée.
  WorkerTSA.goTo('screen-auth');
};

/* ---------------------------------------------------------
   MOT DE PASSE — afficher / masquer
   --------------------------------------------------------- */
WorkerTSA.togglePassword = function (inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
};

/* ---------------------------------------------------------
   ÉCRAN AUTH — Créer un compte / Se connecter
   --------------------------------------------------------- */
WorkerTSA.loadAccountProfile = async function (uid) {
  if (!uid) return null;
  try {
    const snap = await db.collection('providers').doc(uid).get();
    const data = snap.exists ? (snap.data() || {}) : null;
    WorkerTSA.state.accountProfile = data;
    WorkerTSA.state.accountRole = data && data.accountRole ? data.accountRole : (data && data.profileType ? data.profileType : null);
    return data;
  } catch (error) {
    console.warn('Impossible de charger le rôle du compte.', error);
    return null;
  }
};

WorkerTSA.checkAdminClaim = async function () {
  try {
    if (!auth.currentUser) return false;
    const token = await auth.currentUser.getIdTokenResult(true);
    return !!(token && token.claims && token.claims.admin === true);
  } catch (error) { return false; }
};

WorkerTSA.openLogin = function () {
  const source = document.getElementById('signup-email');
  const target = document.getElementById('login-email');
  if (source && target && source.value.trim()) target.value = source.value.trim();
  // Tous les accès à la connexion utilisent désormais la nouvelle maquette
  // blanche et bordeaux de l'écran d'authentification.
  WorkerTSA.goTo('screen-auth');
};

WorkerTSA.handleDirectLogin = async function () {
  const email = document.getElementById('direct-login-email').value.trim();
  const password = document.getElementById('direct-login-password').value;
  const errorEl = document.getElementById('direct-login-error');
  errorEl.classList.remove('visible');
  if (!WorkerTSA.isValidEmail(email) || !password) return showError(errorEl, 'Veuillez renseigner un e-mail et un mot de passe valides.');
  try {
    const cred = await WorkerTSA.signIn(email, password);
    WorkerTSA.state.currentUserId = cred.user.uid;
    WorkerTSA.state.isAdmin = await WorkerTSA.checkAdminClaim();
    const profile = await WorkerTSA.loadAccountProfile(cred.user.uid);
    WorkerTSA.state.profileType = profile && profile.accountRole ? profile.accountRole : null;
    WorkerTSA.refreshHomeRoleUI();
    if (WorkerTSA.state.profileType === 'organisateur') WorkerTSA.registerPushForCurrentUser().catch(function(){});
    WorkerTSA.goTo('screen-home');
  } catch (err) { showError(errorEl, translateFirebaseError(err)); }
};

WorkerTSA.saveAccountRole = async function (uid, role) {
  if (!uid || ['participant','organisateur'].indexOf(role) === -1) throw new Error('Rôle de compte invalide.');
  const ref = db.collection('providers').doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    const current = snap.data() || {};
    if (current.accountRole && current.accountRole !== role) throw new Error('Le rôle de ce compte est définitif et ne peut pas être changé.');
    await ref.set({ accountRole: role, profileType: role, roleLocked: true }, { merge: true });
  } else {
    await ref.set({ accountRole: role, profileType: role, roleLocked: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  WorkerTSA.state.accountRole = role;
  WorkerTSA.state.accountProfile = Object.assign({}, WorkerTSA.state.accountProfile || {}, { accountRole: role, profileType: role, roleLocked: true });
};

WorkerTSA.requireOrganizer = async function () {
  if (!WorkerTSA.state.currentUserId) { WorkerTSA.goTo('screen-auth'); return false; }
  const profile = await WorkerTSA.loadAccountProfile(WorkerTSA.state.currentUserId);
  if (!profile || profile.accountRole !== 'organisateur') {
    alert('Accès refusé : cet espace est réservé aux comptes organisateur / prestataire.');
    WorkerTSA.goTo('screen-home');
    return false;
  }
  return true;
};

WorkerTSA.ensureParticipantIdentity = async function (nextScreen) {
  const uid = WorkerTSA.state.currentUserId;
  if (!uid) { WorkerTSA.goTo('screen-auth'); return false; }
  const profile = await WorkerTSA.loadAccountProfile(uid);
  if (!profile || !profile.firstName || !profile.lastName) {
    WorkerTSA.goTo('screen-part-profile');
    return false;
  }
  if (nextScreen) WorkerTSA.goTo(nextScreen);
  return true;
};

WorkerTSA.handleSignup = async function () {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-password-confirm').value;
  const errorEl = document.getElementById('signup-error');
  errorEl.classList.remove('visible');

  if (!WorkerTSA.isValidEmail(email)) {
    return showError(errorEl, 'Adresse e-mail invalide.');
  }
  if (!WorkerTSA.isValidPassword(password)) {
    return showError(errorEl, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
  if (password !== confirm) {
    return showError(errorEl, 'Les mots de passe ne correspondent pas.');
  }

  try {
    const cred = await WorkerTSA.createAccount(email, password);
    WorkerTSA.state.currentUserId = cred.user.uid;
    WorkerTSA.goTo('screen-profile-type');
  } catch (err) {
    showError(errorEl, translateFirebaseError(err));
  }
};

WorkerTSA.handleLogin = async function () {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.remove('visible');

  if (!WorkerTSA.isValidEmail(email) || !password) {
    return showError(errorEl, 'Veuillez renseigner un e-mail et un mot de passe valides.');
  }

  try {
    const cred = await WorkerTSA.signIn(email, password);
    WorkerTSA.state.currentUserId = cred.user.uid;
    WorkerTSA.state.isAdmin = await WorkerTSA.checkAdminClaim();
    const profile = await WorkerTSA.loadAccountProfile(cred.user.uid);
    if (WorkerTSA.state.isAdmin) {
      // Un compte administrateur peut être créé uniquement dans Firebase Auth
      // et n'a donc pas besoin d'un profil providers pour accéder à la console.
      WorkerTSA.state.profileType = profile && profile.accountRole ? profile.accountRole : null;
      WorkerTSA.refreshHomeRoleUI();
      WorkerTSA.goTo('screen-home');
    } else if (profile && profile.accountRole) {
      WorkerTSA.state.profileType = profile.accountRole;
      WorkerTSA.refreshHomeRoleUI();
      WorkerTSA.goTo('screen-home');
    } else {
      WorkerTSA.goTo('screen-profile-type');
    }
  } catch (err) {
    showError(errorEl, translateFirebaseError(err));
  }
};

WorkerTSA.handleForgotPassword = async function () {
  const email = document.getElementById('login-email').value.trim();
  if (!WorkerTSA.isValidEmail(email)) {
    alert('Veuillez d\'abord renseigner votre adresse e-mail dans le champ ci-dessus.');
    return;
  }
  try {
    await WorkerTSA.sendPasswordReset(email);
    alert('Un e-mail de réinitialisation a été envoyé à ' + email);
  } catch (err) {
    alert(translateFirebaseError(err));
  }
};

function showError(el, message) {
  el.textContent = message;
  el.classList.add('visible');
}

function translateFirebaseError(err) {
  const code = err && err.code ? err.code : '';
  const map = {
    'auth/email-already-in-use': 'Cette adresse e-mail est déjà utilisée.',
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/weak-password': 'Le mot de passe est trop faible.',
    'auth/user-not-found': 'Aucun compte ne correspond à cet e-mail.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Identifiants invalides.'
  };
  return map[code] || 'Une erreur est survenue. Veuillez réessayer.';
}

/* ---------------------------------------------------------
   CHOIX DU PROFIL (Organisateur / Participant)
   --------------------------------------------------------- */
WorkerTSA.selectProfileType = function (type) {
  if (WorkerTSA.state.accountRole && WorkerTSA.state.accountRole !== type) {
    alert('Le rôle choisi à la création du compte est définitif.');
    return;
  }
  WorkerTSA.state.profileType = type;
  document.getElementById('card-organisateur').cla