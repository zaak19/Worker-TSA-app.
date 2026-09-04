/* ===========================================================
   WORKER TSA — auth.js
   Gestion de l'authentification Firebase (Email/Password)
   by Trillion Software
   =========================================================== */

window.WorkerTSA = window.WorkerTSA || {};

/**
 * Crée un compte utilisateur standard (parcours "Créer un compte / Se connecter"
 * générique, écran screen-auth). Pour le compte professionnel organisateur,
 * voir WorkerTSA.orgStep1Next() dans provider.js / app.js qui utilise les
 * mêmes fonctions de base ci-dessous.
 */
WorkerTSA.createAccount = function (email, password) {
  return auth.createUserWithEmailAndPassword(email, password);
};

WorkerTSA.signIn = function (email, password) {
  return auth.signInWithEmailAndPassword(email, password);
};

WorkerTSA.sendPasswordReset = function (email) {
  return auth.sendPasswordResetEmail(email);
};

WorkerTSA.signOut = function () {
  return auth.signOut();
};

/**
 * Observateur d'état de connexion.
 * Utile plus tard pour rediriger automatiquement un utilisateur déjà
 * connecté vers l'écran d'accueil au lieu du splash / login.
 */
WorkerTSA.onAuthStateChanged = function (callback) {
  auth.onAuthStateChanged(callback);
};

/* ---------- Validation basique côté client ---------- */
WorkerTSA.isValidEmail = function (email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

WorkerTSA.isValidPassword = function (password) {
  return typeof password === 'string' && password.length >= 8;
};
