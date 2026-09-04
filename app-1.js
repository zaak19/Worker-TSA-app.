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
    payMethod: null
  },
  currentUserId: null
};

/* ---------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------- */
WorkerTSA.goTo = function (screenId) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  } else {
    console.warn('Écran introuvable :', screenId);
  }
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
    WorkerTSA.goTo('screen-home');
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
  WorkerTSA.state.profileType = type;
  document.getElementById('card-organisateur').classList.toggle('selected', type === 'organisateur');
  document.getElementById('card-participant').classList.toggle('selected', type === 'participant');
  document.getElementById('btn-profile-continue').disabled = false;
};

WorkerTSA.confirmProfileType = function () {
  if (WorkerTSA.state.profileType === 'organisateur') {
    WorkerTSA.goTo('screen-org-1');
  } else if (WorkerTSA.state.profileType === 'participant') {
    WorkerTSA.goTo('screen-part-type');
  }
};

/* ---------------------------------------------------------
   PARCOURS ORGANISATEUR
   --------------------------------------------------------- */
WorkerTSA.orgStep1Next = async function () {
  const email = document.getElementById('org-email').value.trim();
  const password = document.getElementById('org-password').value;
  const errorEl = document.getElementById('org-1-error');
  errorEl.classList.remove('visible');

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
  const rows = [
    ['Adresse e-mail', o.email, false],
    ['Photo de profil', o.profilePhoto ? 'Ajoutée' : 'Non renseignée', !o.profilePhoto],
    ['Photos de présentation', o.hasPresentationPhotos ? 'Ajoutées' : 'Non renseignées', !o.hasPresentationPhotos],
    ['Numéro d\'appel', o.phone || 'Non renseigné', !o.phone],
    ['Numéro WhatsApp', o.whatsapp || 'Non renseigné', !o.whatsapp],
    ['Ville', o.city || 'Non renseigné', !o.city],
    ['Pays', o.country || 'Non renseigné', !o.country],
    ['Localisation', (o.address || o.mapsLink) ? 'Renseignée' : 'Non renseigné', !(o.address || o.mapsLink)]
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
   ABONNEMENT
   --------------------------------------------------------- */
WorkerTSA.selectPlan = function (planId, price, cardEl) {
  document.querySelectorAll('#screen-org-8 .plan-card').forEach(function (c) {
    c.classList.remove('selected');
  });
  cardEl.classList.add('selected');
  WorkerTSA.state.org.plan = planId;
  WorkerTSA.state.org.planPrice = price;
  document.getElementById('btn-plan-continue').disabled = false;

  const names = { mensuelle: 'Formule mensuelle', trimestrielle: 'Formule trimestrielle', annuelle: 'Formule annuelle' };
  document.getElementById('org-plan-name-display').textContent = names[planId];
  document.getElementById('org-plan-price-display').textContent = price.toLocaleString('fr-FR') + ' FCFA';
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
  // ⚠️ Aucun encaissement réel n'est effectué ici (voir note à l'écran).
  // Cette fonction simule la validation et enregistre l'abonnement.
  const o = WorkerTSA.state.org;
  const names = { mensuelle: 'Formule mensuelle', trimestrielle: 'Formule trimestrielle', annuelle: 'Formule annuelle' };
  document.getElementById('confirm-plan-name').textContent = names[o.plan] || '—';
  document.getElementById('confirm-plan-price').textContent = (o.planPrice || 0).toLocaleString('fr-FR') + ' FCFA';
  document.getElementById('confirm-pay-method').textContent = o.payMethod || '—';

  if (WorkerTSA.state.currentUserId) {
    await WorkerTSA.saveProviderProfile(WorkerTSA.state.currentUserId, {
      email: o.email,
      country: o.country,
      city: o.city,
      address: o.address,
      mapsLink: o.mapsLink,
      phone: o.phone,
      whatsapp: o.whatsapp,
      plan: o.plan,
      planPrice: o.planPrice,
      payMethod: o.payMethod,
      subscriptionStatus: 'active',
      profileStatus: 'pending_review'
    });
  }

  WorkerTSA.goTo('screen-org-10');
};

/* ---------------------------------------------------------
   PROFIL PRINCIPAL (étape 11) — Type Événement / Service
   --------------------------------------------------------- */
WorkerTSA.setActivityType = function (type) {
  WorkerTSA.state.activityType = type;
  document.getElementById('type-evenement').classList.toggle('active', type === 'evenement');
  document.getElementById('type-service').classList.toggle('active', type === 'service');
  document.getElementById('main-photos-label').textContent = type === 'evenement' ? 'Photos de l\'événement' : 'Photos de l\'organisation ou du service';
  document.getElementById('main-name-label').textContent = type === 'evenement' ? 'Nom de l\'événement' : 'Nom de l\'organisation ou du service';
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
    WorkerTSA.goTo('screen-org-pending');
  }
};

/* ---------------------------------------------------------
   CONFIGURATION DU TICKET
   --------------------------------------------------------- */
WorkerTSA.publishEvent = async function () {
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

  const commission = WorkerTSA.computeCommission(price);

  const ticketData = {
    eventName: eventName,
    price: Number(price),
    date: date,
    time: time,
    lieu: lieu,
    mapsLink: mapsLink,
    commissionRate: WorkerTSA.TICKET_COMMISSION_RATE,
    commissionAmount: commission.commission,
    netAmount: commission.net
  };

  if (WorkerTSA.state.currentUserId) {
    await WorkerTSA.saveEventTicket(WorkerTSA.state.currentUserId, ticketData);
  }

  WorkerTSA.goTo('screen-org-pending');
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
   INITIALISATION
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  injectLogos();
  renderCategoryOptions('evenement'); // catégories par défaut pour l'écran org-11

  // Écran de démarrage : passe automatiquement à la langue (ou à l'auth
  // si la langue est déjà mémorisée) après un court délai.
  setTimeout(function () {
    if (WorkerTSA.state.language) {
      WorkerTSA.goTo('screen-auth');
    } else {
      WorkerTSA.goTo('screen-language');
    }
  }, 1800);
});
