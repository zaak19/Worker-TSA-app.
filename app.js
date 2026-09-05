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
    city: null,
    address: null,
    mapsLink: null,
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
  organizerDashboard: { events: [], selectedEventId: null, withdrawalMethod: null },
  addingEvent: false
};

WorkerTSA.MAX_ORGANIZER_EVENTS = 5;

/* ---------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------- */
WorkerTSA.PROTECTED_ORGANIZER_SCREENS = ['screen-org-1','screen-org-2','screen-org-3','screen-org-4','screen-org-5','screen-org-6','screen-org-7','screen-org-8','screen-org-9','screen-org-10','screen-org-11','screen-org-pending','screen-new-event','screen-organizer-dashboard'];
WorkerTSA.goTo = function (screenId) {
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
  if (WorkerTSA.state.language) WorkerTSA.goTo('screen-auth');
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

    // Après une connexion Firebase réussie, on reprend le parcours
    // de l'application avec l'écran de choix du profil déjà présent
    // dans le projet, au lieu d'afficher le placeholder d'accueil.
    WorkerTSA.goTo('screen-profile-type');
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
  document.getElementById('card-organisateur').classList.toggle('selected', type === 'organisateur');
  document.getElementById('card-participant').classList.toggle('selected', type === 'participant');
  document.getElementById('btn-profile-continue').disabled = false;
};

WorkerTSA.confirmProfileType = async function () {
  const role = WorkerTSA.state.profileType;
  if (!role) return;
  try {
    await WorkerTSA.saveAccountRole(WorkerTSA.state.currentUserId, role);
    if (role === 'organisateur') {
      WorkerTSA.goTo('screen-org-1');
    } else {
      WorkerTSA.goTo('screen-part-profile');
    }
  } catch (error) {
    alert(error.message || 'Impossible d’enregistrer le rôle du compte.');
  }
};

WorkerTSA.refreshHomeRoleUI = function () {
  const proButton = document.getElementById('home-pro-action');
  const roleBadge = document.getElementById('home-role-badge');
  if (proButton) proButton.style.display = WorkerTSA.state.accountRole === 'organisateur' ? '' : 'none';
  if (roleBadge) roleBadge.textContent = WorkerTSA.state.accountRole === 'organisateur' ? 'Organisateur / Prestataire' : 'Client / Participant';
};

/* ---------------------------------------------------------
   PARCOURS ORGANISATEUR
   --------------------------------------------------------- */
WorkerTSA.orgStep1Next = async function () {
  const emailInput = document.getElementById('org-email');
  const passwordInput = document.getElementById('org-password');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';
  const errorEl = document.getElementById('org-1-error');
  errorEl.classList.remove('visible');

  // Cas normal : le compte Firebase a déjà été créé/authentifié avant
  // d'entrer dans l'espace organisateur. Ne pas créer un deuxième compte.
  if (WorkerTSA.state.currentUserId) {
    const current = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    WorkerTSA.state.org.email = (current && current.email) || email || '';
    if (email && !WorkerTSA.isValidEmail(email)) {
      return showError(errorEl, 'Adresse e-mail invalide.');
    }
    WorkerTSA.goTo('screen-org-2');
    return;
  }

  // Fallback pour une entrée directe dans le parcours professionnel.
  if (!WorkerTSA.isValidEmail(email)) {
    return showError(errorEl, 'Adresse e-mail invalide.');
  }
  if (!WorkerTSA.isValidPassword(password)) {
    return showError(errorEl, 'Le mot de passe doit contenir au moins 8 caractères.');
  }

  try {
    const cred = await WorkerTSA.createAccount(email, password);
    WorkerTSA.state.currentUserId = cred.user.uid;
    WorkerTSA.state.org.email = email;
    WorkerTSA.goTo('screen-org-2');
  } catch (err) {
    showError(errorEl, translateFirebaseError(err));
  }
};

WorkerTSA.selectCountry = function (country) {
  WorkerTSA.state.org.country = country;
  document.getElementById('org-country').value = country;
  WorkerTSA.goTo('screen-org-3');
};

WorkerTSA.orgStep5Next = function () {
  WorkerTSA.state.org.phone = document.getElementById('org-phone').value.trim();
  WorkerTSA.state.org.whatsapp = document.getElementById('org-whatsapp').value.trim();
  WorkerTSA.goTo('screen-org-6');
};

WorkerTSA.orgStep6Next = function () {
  WorkerTSA.state.org.city = document.getElementById('org-city').value.trim();
  WorkerTSA.state.org.address = document.getElementById('org-address').value.trim();
  WorkerTSA.state.org.mapsLink = document.getElementById('org-maps-link').value.trim();
  renderOrgSummary();
  WorkerTSA.goTo('screen-org-7');
};

function renderOrgSummary() {
  const o = WorkerTSA.state.org;
  const billingLabel = WorkerTSA.state.activityType === 'evenement' ? 'Événement — 5 000 FCFA par événement' : 'Service — abonnement prestataire';
  const rows = [
    ['Adresse e-mail', o.email, false],
    ['Photo de profil', o.profilePhoto ? 'Ajoutée' : 'Non renseignée', !o.profilePhoto],
    ['Photos de présentation', o.hasPresentationPhotos ? 'Ajoutées' : 'Non renseignées', !o.hasPresentationPhotos],
    ['Numéro d\'appel', o.phone || 'Non renseigné', !o.phone],
    ['Numéro WhatsApp', o.whatsapp || 'Non renseigné', !o.whatsapp],
    ['Ville', o.city || 'Non renseigné', !o.city],
    ['Pays', o.country || 'Non renseigné', !o.country],
    ['Localisation', (o.address || o.mapsLink) ? 'Renseignée' : 'Non renseigné', !(o.address || o.mapsLink)],
    ['Modèle de paiement', billingLabel, false]
  ];
  const card = document.getElementById('org-summary-card');
  card.innerHTML = rows.map(function (r) {
    return '<div class="info-row"><span class="label">' + r[0] + '</span>' +
      '<span class="value' + (r[2] ? ' muted' : '') + '">' + r[1] + '</span></div>';
  }).join('');
}

/* ---------------------------------------------------------
   UPLOAD D'IMAGES — prévisualisation locale (avant Firebase Storage)
   --------------------------------------------------------- */
WorkerTSA.previewImage = function (inputEl, targetId) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;
  const targetEl = document.getElementById(targetId);
  const reader = new FileReader();
  reader.onload = function (e) {
    targetEl.innerHTML = '<img src="' + e.target.result + '" alt="aperçu" />';
  };
  reader.readAsDataURL(file);

  // Marque les infos correspondantes dans le récapitulatif
  if (targetId === 'org-profile-photo-zone') WorkerTSA.state.org.profilePhoto = file;
  if (targetId === 'org-photo-1' || targetId === 'org-photo-2' || targetId === 'org-photo-3') {
    WorkerTSA.state.org.hasPresentationPhotos = true;
  }
};

WorkerTSA.markUploaded = function (inputEl, labelId, message) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;
  document.getElementById(labelId).textContent = message;
};

/* ---------------------------------------------------------
   TARIFICATION ORGANISATEUR / PRESTATAIRE
   - Événement : 5 000 FCFA par événement, paiement unique
   - Service : abonnement 2 000/mois, 5 000/trimestre, 18 000/an
   --------------------------------------------------------- */
WorkerTSA.EVENT_REGISTRATION_FEE = 5000;

WorkerTSA.selectActivityForBilling = function (type) {
  WorkerTSA.state.activityType = type;
  WorkerTSA.state.org.billingType = type === 'evenement' ? 'event_registration' : 'service_subscription';

  document.getElementById('billing-event-card').classList.toggle('selected', type === 'evenement');
  document.getElementById('billing-service-card').classList.toggle('selected', type === 'service');

  const planOptions = document.getElementById('service-plan-options');
  if (planOptions) planOptions.style.display = type === 'service' ? 'block' : 'none';

  if (type === 'evenement') {
    WorkerTSA.state.org.plan = 'evenement';
    WorkerTSA.state.org.planPrice = WorkerTSA.EVENT_REGISTRATION_FEE;
    WorkerTSA.state.org.eventRegistrationFee = WorkerTSA.EVENT_REGISTRATION_FEE;
  } else {
    WorkerTSA.state.org.plan = null;
    WorkerTSA.state.org.planPrice = null;
    WorkerTSA.state.org.eventRegistrationFee = null;
  }

  document.getElementById('btn-billing-type-continue').disabled = false;
};

WorkerTSA.continueBillingChoice = function () {
  if (!WorkerTSA.state.activityType) return;

  if (WorkerTSA.state.activityType === 'service' && (!WorkerTSA.state.org.plan || !WorkerTSA.state.org.planPrice)) {
    alert('Veuillez choisir une formule d’abonnement prestataire.');
    return;
  }

  if (WorkerTSA.state.activityType === 'evenement') {
    document.getElementById('org-plan-name-display').textContent = 'Enregistrement d’un événement';
    document.getElementById('org-plan-price-display').textContent = '5 000 FCFA';
  } else {
    const names = { mensuelle: 'Formule mensuelle', trimestrielle: 'Formule trimestrielle', annuelle: 'Formule annuelle' };
    document.getElementById('org-plan-name-display').textContent = names[WorkerTSA.state.org.plan] || 'Abonnement';
    document.getElementById('org-plan-price-display').textContent = WorkerTSA.state.org.planPrice.toLocaleString('fr-FR') + ' FCFA';
  }

  const desc = document.getElementById('billing-payment-description');
  const note = document.getElementById('billing-payment-note');
  if (WorkerTSA.state.activityType === 'evenement') {
    desc.textContent = 'Payez les frais fixes de 5 000 FCFA pour enregistrer cet événement sur Worker TSA.';
    note.textContent = 'Ce paiement est unique pour l’enregistrement de cet événement. La commission de 5 % sur chaque ticket vendu reste applicable.';
  } else {
    desc.textContent = 'Finalisez votre abonnement prestataire pour rester visible sur Worker TSA.';
    note.textContent = 'L’abonnement concerne les prestataires de services. Il ne s’applique pas aux organisateurs d’événements.';
  }

  document.querySelectorAll('#screen-org-9 .pay-method').forEach(function (r) {
    r.style.borderColor = 'var(--border-soft)';
  });
  WorkerTSA.state.org.payMethod = null;
  document.getElementById('btn-pay-now').disabled = true;

  WorkerTSA.goTo('screen-org-9');
};

WorkerTSA.selectPlan = function (planId, price, cardEl) {
  if (WorkerTSA.state.activityType !== 'service') return;
  document.querySelectorAll('#service-plan-options .plan-card').forEach(function (c) {
    c.classList.remove('selected');
  });
  cardEl.classList.add('selected');
  WorkerTSA.state.org.plan = planId;
  WorkerTSA.state.org.planPrice = price;
};

WorkerTSA.prepareServicePlan = function (planId, price) {
  WorkerTSA.state.org.plan = planId;
  WorkerTSA.state.org.planPrice = price;
};

/* ---------------------------------------------------------
   PAIEMENT
   --------------------------------------------------------- */
WorkerTSA.selectPayMethod = function (method, rowEl) {
  document.querySelectorAll('#screen-org-9 .pay-method').forEach(function (r) {
    r.style.borderColor = 'var(--border-soft)';
  });
  rowEl.style.borderColor = 'var(--bordeaux)';
  WorkerTSA.state.org.payMethod = method;
  document.getElementById('btn-pay-now').disabled = false;
};

WorkerTSA.processPayment = async function () {
  // Aucun encaissement réel n'est effectué ici. La validation reste simulée
  // jusqu'à l'intégration d'un prestataire Mobile Money.
  const o = WorkerTSA.state.org;
  const isEvent = WorkerTSA.state.activityType === 'evenement';
  const names = { mensuelle: 'Formule mensuelle', trimestrielle: 'Formule trimestrielle', annuelle: 'Formule annuelle' };

  if (!o.payMethod) return;
  if (!isEvent && (!o.plan || !o.planPrice)) {
    alert('Veuillez choisir une formule d’abonnement.');
    return;
  }

  const amount = isEvent ? WorkerTSA.EVENT_REGISTRATION_FEE : o.planPrice;
  const label = isEvent ? 'Enregistrement d’un événement' : (names[o.plan] || 'Abonnement');

  document.getElementById('confirm-plan-label').textContent = isEvent ? 'Type de paiement' : 'Formule';
  document.getElementById('confirm-plan-name').textContent = label;
  document.getElementById('confirm-plan-price').textContent = amount.toLocaleString('fr-FR') + ' FCFA';
  document.getElementById('confirm-pay-method').textContent = o.payMethod || '—';
  document.getElementById('billing-confirm-description').textContent = isEvent
    ? 'Le paiement de 5 000 FCFA pour l’enregistrement de votre événement a été confirmé. La commission de 5 % sera prélevée sur chaque ticket vendu.'
    : 'Votre abonnement prestataire a été activé avec succès. Bienvenue sur Worker TSA.';

  if (WorkerTSA.state.currentUserId) {
    const billingData = {
      email: o.email,
      country: o.country,
      city: o.city,
      address: o.address,
      mapsLink: o.mapsLink,
      phone: o.phone,
      whatsapp: o.whatsapp,
      activityType: WorkerTSA.state.activityType,
      payMethod: o.payMethod,
      profileStatus: 'pending_review'
    };

    if (isEvent) {
      billingData.billingType = 'event_registration';
      billingData.eventRegistrationFee = WorkerTSA.EVENT_REGISTRATION_FEE;
      billingData.eventPaymentStatus = 'paid_simulated';
      billingData.subscriptionStatus = 'not_applicable';
      billingData.plan = null;
      billingData.planPrice = null;
    } else {
      billingData.billingType = 'service_subscription';
      billingData.plan = o.plan;
      billingData.planPrice = o.planPrice;
      billingData.subscriptionStatus = 'active_simulated';
    }

    await WorkerTSA.saveProviderProfile(WorkerTSA.state.currentUserId, billingData);
  }

  // Pour un événement supplémentaire, le profil professionnel existe déjà :
  // on passe directement à la configuration du ticket après le paiement.
  if (WorkerTSA.state.addingEvent) {
    WorkerTSA.goTo('screen-org-ticket');
  } else {
    WorkerTSA.goTo('screen-org-10');
  }
};

/* ---------------------------------------------------------
   PROFIL PRINCIPAL (étape 11) — Type Événement / Service
   --------------------------------------------------------- */
WorkerTSA.setActivityType = function (type) {
  WorkerTSA.state.activityType = type;
  WorkerTSA.state.org.billingType = type === 'evenement' ? 'event_registration' : 'service_subscription';
  const typeDisplay = document.getElementById('main-activity-type-display');
  const feeDisplay = document.getElementById('main-activity-fee-display');
  if (typeDisplay) typeDisplay.textContent = type === 'evenement' ? 'Événement' : 'Service';
  if (feeDisplay) feeDisplay.textContent = type === 'evenement' ? '5 000 FCFA par événement' : 'Abonnement prestataire';
  const photos = document.getElementById('main-photos-label');
  const name = document.getElementById('main-name-label');
  if (photos) photos.textContent = type === 'evenement' ? "Photos de l'événement" : "Photos de l'organisation ou du service";
  if (name) name.textContent = type === 'evenement' ? "Nom de l'événement" : "Nom de l'organisation ou du service";
  renderCategoryOptions(type);
};

function renderCategoryOptions(type) {
  const select = document.getElementById('main-category');
  const categories = WorkerTSA.getCategoriesFor(type);
  select.innerHTML = categories.map(function (c) {
    return '<option value="' + c.id + '">' + c.icon + ' ' + c.label + '</option>';
  }).join('');
}

WorkerTSA.validateMainProfile = async function () {
  const errorEl = document.getElementById('org-11-error');
  errorEl.classList.remove('visible');

  const name = document.getElementById('main-name').value.trim();
  const category = document.getElementById('main-category').value;
  const phone = document.getElementById('main-phone').value.trim();
  const whatsapp = document.getElementById('main-whatsapp').value.trim();
  const lieu = document.getElementById('main-lieu').value.trim();
  const mapsLink = document.getElementById('main-maps-link').value.trim();

  const idRecto = document.getElementById('id-recto-input').files.length > 0;
  const idVerso = document.getElementById('id-verso-input').files.length > 0;
  const idSelfie = document.getElementById('id-selfie-input').files.length > 0;

  if (!name || !category || !phone || !lieu) {
    return showError(errorEl, 'Veuillez remplir tous les champs obligatoires.');
  }
  if (!idRecto || !idVerso || !idSelfie) {
    return showError(errorEl, 'La vérification d\'identité (recto, verso, selfie) est obligatoire.');
  }

  const mainProfileData = {
    activityType: WorkerTSA.state.activityType,
    name: name,
    category: category,
    phone: phone,
    whatsapp: whatsapp,
    lieu: lieu,
    mapsLink: mapsLink,
    identityVerification: 'submitted'
  };

  if (WorkerTSA.state.currentUserId) {
    await WorkerTSA.saveProviderProfile(WorkerTSA.state.currentUserId, mainProfileData);
  }

  WorkerTSA.state.mainProfile = mainProfileData;

  if (WorkerTSA.state.activityType === 'evenement') {
    // Pré-remplit le nom de l'événement dans l'écran ticket
    document.getElementById('ticket-event-name').value = name;
    WorkerTSA.goTo('screen-org-ticket');
  } else {
    if (WorkerTSA.state.currentUserId) await WorkerTSA.saveProviderProfile(WorkerTSA.state.currentUserId, { profileType: 'organisateur', onboardingComplete: true });
    WorkerTSA.goTo('screen-org-pending');
  }
};

/* ---------------------------------------------------------
   CONFIGURATION DU TICKET
   --------------------------------------------------------- */
WorkerTSA.publishEvent = async function () {
  if (!(await WorkerTSA.requireOrganizer())) return;
  const errorEl = document.getElementById('ticket-error');
  errorEl.classList.remove('visible');

  const eventName = document.getElementById('ticket-event-name').value.trim();
  const price = document.getElementById('ticket-price').value;
  const date = document.getElementById('ticket-date').value;
  const time = document.getElementById('ticket-time').value;
  const lieu = document.getElementById('ticket-lieu').value.trim();
  const mapsLink = document.getElementById('ticket-maps-link').value.trim();

  if (!eventName || !price || !date || !time || !lieu) {
    return showError(errorEl, 'Veuillez remplir tous les champs obligatoires.');
  }

  if (WorkerTSA.state.activityType !== 'evenement') {
    return showError(errorEl, 'La publication d’un événement est réservée au profil Événement.');
  }

  if (WorkerTSA.state.org.eventRegistrationFee !== WorkerTSA.EVENT_REGISTRATION_FEE) {
    return showError(errorEl, 'Les frais fixes de 5 000 FCFA pour l’enregistrement de l’événement doivent être validés avant sa publication.');
  }

  const commission = WorkerTSA.computeCommission(price);

  const ticketData = {
    eventName: eventName,
    category: (WorkerTSA.state.mainProfile && WorkerTSA.state.mainProfile.category) || '',
    price: Number(price),
    ticketType: (document.getElementById('ticket-type') || {}).value || 'Standard',
    date: date,
    time: time,
    lieu: lieu,
    mapsLink: mapsLink,
    registrationFee: WorkerTSA.EVENT_REGISTRATION_FEE,
    registrationFeeStatus: 'paid_simulated',
    commissionRate: WorkerTSA.TICKET_COMMISSION_RATE,
    commissionAmount: commission.commission,
    netAmount: commission.net
  };

  let savedEventId = null;
  if (WorkerTSA.state.currentUserId) {
    const result = await WorkerTSA.saveEventTicket(WorkerTSA.state.currentUserId, { ...ticketData, ticketsSold: 0, grossSales: 0, totalCommission: 0 });
    if (!result.success) return showError(errorEl, 'Impossible d’enregistrer l’événement pour le moment.');
    savedEventId = result.eventId;
    await WorkerTSA.saveProviderProfile(WorkerTSA.state.currentUserId, { profileType: 'organisateur', onboardingComplete: true, publishedEventId: savedEventId });
  }
  WorkerTSA.state.org.publishedEventId = savedEventId;

  if (WorkerTSA.state.addingEvent) {
    WorkerTSA.state.addingEvent = false;
    WorkerTSA.state.org.eventRegistrationFee = null;
    WorkerTSA.goTo('screen-organizer-dashboard');
    await WorkerTSA.loadOrganizerDashboard();
  } else {
    WorkerTSA.goTo('screen-org-pending');
  }
};

/* ---------------------------------------------------------
   AJOUT D'UN ÉVÉNEMENT SUPPLÉMENTAIRE
   Un organisateur peut enregistrer jusqu'à 5 événements.
   --------------------------------------------------------- */
WorkerTSA.startNewEvent = async function () {
  if (!WorkerTSA.state.currentUserId) {
    WorkerTSA.goTo('screen-auth');
    return;
  }

  try {
    const events = await WorkerTSA.getOrganizerEvents(WorkerTSA.state.currentUserId);
    if (events.length >= WorkerTSA.MAX_ORGANIZER_EVENTS) {
      alert('Vous avez atteint la limite de 5 événements.');
      return;
    }

    WorkerTSA.state.addingEvent = true;
    WorkerTSA.state.activityType = 'evenement';
    WorkerTSA.state.org.billingType = 'event_registration';
    WorkerTSA.state.org.eventRegistrationFee = WorkerTSA.EVENT_REGISTRATION_FEE;
    WorkerTSA.state.org.payMethod = null;

    const nameInput = document.getElementById('new-event-name');
    const categoryInput = document.getElementById('new-event-category');
    if (nameInput) nameInput.value = '';
    if (categoryInput) {
      categoryInput.innerHTML = WorkerTSA.CATEGORIES_EVENEMENT.map(function (c) {
        return '<option value="' + c.id + '">' + c.icon + ' ' + c.label + '</option>';
      }).join('');
    }

    WorkerTSA.goTo('screen-new-event');
  } catch (error) {
    console.error(error);
    alert('Impossible de vérifier vos événements. Vérifiez votre connexion puis réessayez.');
  }
};

WorkerTSA.prepareAdditionalEvent = function () {
  const name = (document.getElementById('new-event-name') || {}).value || '';
  const category = (document.getElementById('new-event-category') || {}).value || '';
  const errorEl = document.getElementById('new-event-error');
  if (errorEl) errorEl.classList.remove('visible');
  if (!name.trim()) {
    return showError(errorEl, 'Veuillez renseigner le nom de l’événement.');
  }
  WorkerTSA.state.mainProfile = {
    activityType: 'evenement',
    name: name.trim(),
    category: category,
    phone: WorkerTSA.state.org.phone || '',
    whatsapp: WorkerTSA.state.org.whatsapp || '',
    lieu: WorkerTSA.state.org.city || '',
    mapsLink: WorkerTSA.state.org.mapsLink || ''
  };
  const ticketName = document.getElementById('ticket-event-name');
  if (ticketName) ticketName.value = name.trim();
  WorkerTSA.goTo('screen-org-9');
};

/* ---------------------------------------------------------
   ESPACE VENDEUR — tickets, verrouillage et retraits
   --------------------------------------------------------- */
WorkerTSA.openOrganizerDashboard = async function () {
  if (!(await WorkerTSA.requireOrganizer())) return;
  WorkerTSA.goTo('screen-organizer-dashboard');
  await WorkerTSA.loadOrganizerDashboard();
};
function formatFCFA(value) { return Number(value || 0).toLocaleString('fr-FR') + ' FCFA'; }
function formatEventDate(date, time) {
  if (!date) return 'Date non renseignée';
  const d = new Date((date || '') + 'T' + (time || '00:00'));
  if (Number.isNaN(d.getTime())) return date + (time ? ' à ' + time : '');
  return d.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'}) + (time ? ' à ' + time : '');
}
WorkerTSA.loadOrganizerDashboard = async function () {
  const list = document.getElementById('dashboard-event-list');
  if (!list || !WorkerTSA.state.currentUserId) return;
  list.innerHTML = '<div class="empty-state">Actualisation des ventes…</div>';
  try {
    const events = await WorkerTSA.getOrganizerEvents(WorkerTSA.state.currentUserId);
    const summaries = [];
    for (const event of events) summaries.push({ event, summary: await WorkerTSA.getEventSalesSummary(event.id, event) });
    WorkerTSA.state.organizerDashboard.events = summaries;
    const totals = summaries.reduce((a,x)=>({sold:a.sold+x.summary.sold,gross:a.gross+x.summary.gross,commission:a.commission+x.summary.commission,net:a.net+x.summary.net}),{sold:0,gross:0,commission:0,net:0});
    document.getElementById('dashboard-total-tickets').textContent = totals.sold.toLocaleString('fr-FR');
    document.getElementById('dashboard-gross-sales').textContent = formatFCFA(totals.gross);
    document.getElementById('dashboard-commission').textContent = formatFCFA(totals.commission);
    document.getElementById('dashboard-available-funds').textContent = formatFCFA(summaries.filter(x=>x.summary.locked).reduce((n,x)=>n+x.summary.available,0));
    const addButton = document.getElementById('btn-add-event');
    const countLabel = document.getElementById('dashboard-event-count');
    if (countLabel) countLabel.textContent = summaries.length + '/' + WorkerTSA.MAX_ORGANIZER_EVENTS;
    if (addButton) {
      addButton.disabled = summaries.length >= WorkerTSA.MAX_ORGANIZER_EVENTS;
      addButton.textContent = summaries.length >= WorkerTSA.MAX_ORGANIZER_EVENTS ? 'Limite de 5 événements atteinte' : '+ Ajouter un événement';
    }
    if (!summaries.length) { list.innerHTML='<div class="empty-state">Aucun événement enregistré pour le moment.</div>'; document.getElementById('withdrawal-panel').classList.add('hidden'); return; }
    list.innerHTML = summaries.map(function(x){
      const e=x.event, s=x.summary;
      return '<article class="seller-event-card"><div class="seller-event-top"><div><span class="seller-event-category">'+(e.category||'Événement')+'</span><h2>'+(e.eventName||'Événement')+'</h2><p>'+formatEventDate(e.date,e.time)+' · '+(e.lieu||'')+'</p></div><span class="sales-status '+(s.locked?'locked':'open')+'">'+(s.locked?'Ventes verrouillées':'Ventes ouvertes')+'</span></div><div class="seller-event-metrics"><div><span>Tickets</span><strong>'+s.sold.toLocaleString('fr-FR')+'</strong></div><div><span>Brut</span><strong>'+formatFCFA(s.gross)+'</strong></div><div><span>Commission</span><strong>'+formatFCFA(s.commission)+'</strong></div><div><span>Net</span><strong>'+formatFCFA(s.net)+'</strong></div></div>'+(s.locked?'<button class="btn btn-primary seller-withdraw-btn" onclick="WorkerTSA.prepareWithdrawal(\''+e.id+'\')">Retirer les fonds</button>':'<p class="seller-lock-note">La vente reste ouverte jusqu’à l’heure exacte de l’événement.</p>')+'</article>';
    }).join('');
    WorkerTSA.refreshWithdrawalOptions();
  } catch(error) { console.error(error); list.innerHTML='<div class="empty-state error-state">Impossible de charger vos ventes. Vérifiez votre connexion puis actualisez.</div>'; }
};
WorkerTSA.refreshWithdrawalOptions = function(){
  const select=document.getElementById('withdraw-event'); if(!select) return;
  const locked=WorkerTSA.state.organizerDashboard.events.filter(x=>x.summary.locked && x.summary.available>0);
  select.innerHTML=locked.length?locked.map(x=>'<option value="'+x.event.id+'">'+(x.event.eventName||'Événement')+' — '+formatFCFA(x.summary.available)+'</option>').join(''):'<option value="">Aucun fonds disponible</option>';
  WorkerTSA.updateWithdrawalAvailability();
};
WorkerTSA.prepareWithdrawal=function(eventId){
  const panel=document.getElementById('withdrawal-panel'),select=document.getElementById('withdraw-event'); if(!panel||!select)return;
  panel.classList.remove('hidden'); select.value=eventId; WorkerTSA.state.organizerDashboard.selectedEventId=eventId; WorkerTSA.updateWithdrawalAvailability(); panel.scrollIntoView({behavior:'smooth',block:'start'});
};
WorkerTSA.updateWithdrawalAvailability=function(){
  const select=document.getElementById('withdraw-event'), input=document.getElementById('withdraw-amount'), text=document.getElementById('withdraw-available-text'); if(!select)return;
  const item=WorkerTSA.state.organizerDashboard.events.find(x=>x.event.id===select.value), available=item?item.summary.available:0;
  if(text)text.textContent='Disponible : '+formatFCFA(available);
  if(input){input.max=available; if(!input.value||Number(input.value)>available)input.value=available||'';}
  const button=document.getElementById('btn-withdraw'); if(button)button.disabled=!(item&&item.summary.locked&&available>0&&WorkerTSA.state.organizerDashboard.withdrawalMethod);
};
WorkerTSA.selectWithdrawalMethod=function(method,el){ WorkerTSA.state.organizerDashboard.withdrawalMethod=method; document.querySelectorAll('.withdraw-method').forEach(b=>b.classList.toggle('selected',b===el)); WorkerTSA.updateWithdrawalAvailability(); };
WorkerTSA.requestWithdrawal=async function(){
  const errorEl=document.getElementById('withdraw-error'); errorEl.classList.remove('visible');
  const select=document.getElementById('withdraw-event'), amount=Number(document.getElementById('withdraw-amount').value), phone=document.getElementById('withdraw-phone').value.trim();
  const item=WorkerTSA.state.organizerDashboard.events.find(x=>x.event.id===select.value);
  if(!item||!item.summary.locked)return showError(errorEl,'Le retrait est disponible uniquement après le verrouillage des ventes.');
  if(!WorkerTSA.state.organizerDashboard.withdrawalMethod)return showError(errorEl,'Choisissez un moyen de retrait.');
  if(!amount||amount<=0||amount>item.summary.net)return showError(errorEl,'Le montant demandé dépasse les fonds disponibles.');
  if(!phone)return showError(errorEl,'Renseignez le numéro qui recevra le retrait.');
  const result=await WorkerTSA.saveWithdrawalRequest(WorkerTSA.state.currentUserId,{eventId:item.event.id,eventName:item.event.eventName||'Événement',amount,paymentMethod:WorkerTSA.state.organizerDashboard.withdrawalMethod,payoutPhone:phone,availableAtRequest:item.summary.net});
  if(!result.success)return showError(errorEl,'Impossible d’enregistrer la demande de retrait.');
  alert('Votre demande de retrait a été enregistrée. Le versement réel sera effectué lorsque le système de paiement Worker TSA sera connecté.');
  document.getElementById('withdraw-amount').value='';
};

/* ---------------------------------------------------------
   PARCOURS PARTICIPANT
   --------------------------------------------------------- */
WorkerTSA.selectParticipantType = function (type) {
  WorkerTSA.state.participantType = type;

  const title = document.getElementById('part-cat-title');
  const desc = document.getElementById('part-cat-desc');
  const list = document.getElementById('part-category-list');

  if (type === 'evenement') {
    title.textContent = 'Choisissez une catégorie d\'événement';
    desc.textContent = 'Trouvez l\'événement qui vous intéresse et achetez votre ticket.';
  } else {
    title.textContent = 'Choisissez une catégorie de service';
    desc.textContent = 'Trouvez un prestataire et accédez gratuitement à ses coordonnées.';
  }

  const categories = WorkerTSA.getCategoriesFor(type);
  list.innerHTML = categories.map(function (c) {
    return '<button class="category-btn"><span class="cat-icon">' + c.icon + '</span>' +
      '<span class="cat-name">' + c.label + '</span><span>›</span></button>';
  }).join('');

  WorkerTSA.goTo('screen-part-categories');
};

/* ---------------------------------------------------------
   ESPACE PARTICIPANT — événements, achat et mes tickets
   --------------------------------------------------------- */
WorkerTSA.saveParticipantIdentity = async function () {
  const lastName = (document.getElementById('participant-last-name') || {}).value || '';
  const firstName = (document.getElementById('participant-first-name') || {}).value || '';
  const errorEl = document.getElementById('participant-profile-error');
  if (errorEl) errorEl.classList.remove('visible');
  if (!lastName.trim() || !firstName.trim()) return showError(errorEl, 'Veuillez renseigner votre nom et votre prénom.');
  try {
    await WorkerTSA.saveAccountRole(WorkerTSA.state.currentUserId, WorkerTSA.state.accountRole || 'participant');
    await WorkerTSA.saveProviderProfile(WorkerTSA.state.currentUserId, { firstName: firstName.trim(), lastName: lastName.trim() });
    WorkerTSA.state.accountProfile = Object.assign({}, WorkerTSA.state.accountProfile || {}, { firstName: firstName.trim(), lastName: lastName.trim() });
    WorkerTSA.goTo('screen-part-type');
  } catch (error) { showError(errorEl, 'Impossible d’enregistrer vos informations.'); }
};

WorkerTSA.openParticipantEvents = async function () {
  if (!WorkerTSA.state.currentUserId) { WorkerTSA.goTo('screen-auth'); return; }
  const allowed = await WorkerTSA.ensureParticipantIdentity();
  if (!allowed) return;
  const list = document.getElementById('participant-event-list');
  WorkerTSA.goTo('screen-part-events');
  if (list) list.innerHTML = '<div class="empty-state">Chargement des événements…</div>';
  try {
    const snap = await db.collection('events').get();
    const events = snap.docs.map(function (doc) { return { id: doc.id, ...doc.data() }; })
      .filter(function (e) { return e.eventName && e.price > 0; })
      .sort(function (a,b) { return String(a.date || '').localeCompare(String(b.date || '')); });
    WorkerTSA.state.participantEvents = events;
    if (!list) return;
    if (!events.length) { list.innerHTML = '<div class="empty-state">Aucun événement disponible pour le moment.</div>'; return; }
    list.innerHTML = events.map(function (e) {
      return '<article class="participant-event-card" onclick="WorkerTSA.openTicketPurchase(\''+e.id+'\')">' +
        '<div class="participant-event-badge">'+(e.category || 'ÉVÉNEMENT')+'</div>' +
        '<h2>'+escapeHtml(e.eventName)+'</h2>' +
        '<p>📅 '+formatEventDate(e.date,e.time)+'</p><p>📍 '+escapeHtml(e.lieu || 'Lieu à confirmer')+'</p>' +
        '<div class="participant-event-bottom"><strong>'+formatFCFA(e.price)+'</strong><span>Acheter ›</span></div></article>';
    }).join('');
  } catch (error) {
    console.error(error);
    if (list) list.innerHTML = '<div class="empty-state error-state">Impossible de charger les événements.</div>';
  }
};

WorkerTSA.openTicketPurchase = async function (eventId) {
  const event = (WorkerTSA.state.participantEvents || []).find(function (e) { return e.id === eventId; });
  if (!event) return;
  WorkerTSA.state.selectedEvent = event;
  const profile = await WorkerTSA.loadAccountProfile(WorkerTSA.state.currentUserId);
  if (!profile || !profile.firstName || !profile.lastName) { WorkerTSA.goTo('screen-part-profile'); return; }
  document.getElementById('buy-event-name').textContent = event.eventName || 'Événement';
  document.getElementById('buy-event-category').textContent = event.category || 'Événement';
  document.getElementById('buy-event-date').textContent = formatEventDate(event.date,event.time);
  document.getElementById('buy-event-place').textContent = event.lieu || 'Lieu à confirmer';
  document.getElementById('buy-ticket-type').textContent = event.ticketType || 'Standard';
  document.getElementById('buy-ticket-price').textContent = formatFCFA(event.price);
  document.getElementById('buy-first-name').value = profile.firstName || '';
  document.getElementById('buy-last-name').value = profile.lastName || '';
  const count = await WorkerTSA.getParticipantTicketCount(WorkerTSA.state.currentUserId, eventId);
  document.getElementById('buy-limit-count').textContent = count + '/5';
  document.getElementById('btn-buy-ticket').disabled = count >= 5;
  document.getElementById('buy-ticket-error').classList.remove('visible');
  WorkerTSA.goTo('screen-ticket-buy');
};

WorkerTSA.buyTicket = async function () {
  const event = WorkerTSA.state.selectedEvent;
  if (!event) return;
  const errorEl = document.getElementById('buy-ticket-error');
  errorEl.classList.remove('visible');
  const firstName = document.getElementById('buy-first-name').value.trim();
  const lastName = document.getElementById('buy-last-name').value.trim();
  if (!firstName || !lastName) return showError(errorEl, 'Nom et prénom obligatoires.');
  const button = document.getElementById('btn-buy-ticket');
  button.disabled = true;
  button.textContent = 'Génération du ticket…';
  try {
    const result = await WorkerTSA.recordTicketSale(event.id, { firstName:firstName, lastName:lastName, unitPrice:event.price });
    if (!result.success) throw result.error;
    WorkerTSA.state.selectedTicket = result.ticket;
    await WorkerTSA.saveProviderProfile(WorkerTSA.state.currentUserId, { firstName:firstName, lastName:lastName });
    WorkerTSA.renderTicketDetail(result.ticket);
    WorkerTSA.goTo('screen-ticket-detail');
  } catch (error) {
    showError(errorEl, error.message === 'MAX_TICKETS' ? 'Vous avez atteint la limite de 5 tickets pour cet événement.' : (error.message || 'Achat impossible pour le moment.'));
  } finally {
    button.disabled = false;
    button.textContent = 'Payer et générer mon ticket';
  }
};

WorkerTSA.openMyTickets = async function () {
  if (!WorkerTSA.state.currentUserId) { WorkerTSA.goTo('screen-auth'); return; }
  const allowed = await WorkerTSA.ensureParticipantIdentity();
  if (!allowed) return;
  WorkerTSA.goTo('screen-my-tickets');
  const list = document.getElementById('my-ticket-list');
  if (list) list.innerHTML = '<div class="empty-state">Chargement de vos tickets…</div>';
  try {
    const tickets = await WorkerTSA.getParticipantTickets(WorkerTSA.state.currentUserId);
    tickets.sort(function(a,b){ return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
    WorkerTSA.state.myTickets = tickets;
    if (!tickets.length) { list.innerHTML='<div class="empty-state">Vous n’avez encore acheté aucun ticket.</div>'; return; }
    list.innerHTML = tickets.map(function(t){
      return '<article class="ticket-mini-card" onclick="WorkerTSA.showTicketById(\''+t.id+'\')"><span class="ticket-mini-category">'+escapeHtml(t.category || 'ÉVÉNEMENT')+'</span><div><h2>'+escapeHtml(t.eventName || 'Événement')+'</h2><p>'+formatEventDate(t.date,t.time)+' · '+escapeHtml(t.lieu || '')+'</p></div><span class="valid-pill">Valide</span><strong>'+escapeHtml(t.ticketCode || t.id)+'</strong></article>';
    }).join('');
  } catch(error){ if(list) list.innerHTML='<div class="empty-state error-state">Impossible de charger vos tickets.</div>'; }
};

WorkerTSA.showTicketById = function(ticketId){
  const ticket=(WorkerTSA.state.myTickets||[]).find(function(t){return t.id===ticketId;});
  if(!ticket) return;
  WorkerTSA.state.selectedTicket=ticket;
  WorkerTSA.renderTicketDetail(ticket);
  WorkerTSA.goTo('screen-ticket-detail');
};

WorkerTSA.renderTicketDetail = function(ticket){
  const map={
    'ticket-detail-event':ticket.eventName||'Événement','ticket-detail-category':ticket.category||'ÉVÉNEMENT','ticket-detail-date':formatEventDate(ticket.date,ticket.time),
    'ticket-detail-place':ticket.lieu||'Lieu à confirmer','ticket-detail-last-name':ticket.lastName||'—','ticket-detail-first-name':ticket.firstName||'—',
    'ticket-detail-type':ticket.ticketType||'Standard','ticket-detail-price':formatFCFA(ticket.price),'ticket-detail-code':ticket.ticketCode||'—','ticket-detail-purchase':'Achat enregistré dans Worker TSA'
  };
  Object.keys(map).forEach(function(id){const el=document.getElementById(id); if(el) el.textContent=map[id];});
  const bought=document.getElementById('ticket-detail-bought');
  if(bought){ const d=ticket.createdAt && ticket.createdAt.toDate ? ticket.createdAt.toDate() : new Date(); bought.textContent=d.toLocaleDateString('fr-FR')+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
};

function escapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});
}

/* ---------------------------------------------------------
   INITIALISATION
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  injectLogos();
  WorkerTSA.refreshHomeRoleUI();
  renderCategoryOptions('evenement'); // catégories par défaut pour l'écran org-11
  const withdrawEvent = document.getElementById('withdraw-event');
  if (withdrawEvent) withdrawEvent.addEventListener('change', WorkerTSA.updateWithdrawalAvailability);

  // Écran de démarrage : image 9:16 affichée pendant 1 seconde,
  // puis création du PIN lors de la première utilisation ou
  // déverrouillage du PIN lors des utilisations suivantes.
  setTimeout(function () {
    startPinScreen(hasLocalPin());
  }, 1000);
});
