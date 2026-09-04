/* ===========================================================
   WORKER TSA — Configuration Firebase
   by Trillion Software
   ===========================================================
   ⚠️ IMPORTANT :
   Remplace les valeurs ci-dessous par la configuration RÉELLE
   de ton projet Firebase existant "worker-tsa-ebd91" (Console
   Firebase > Paramètres du projet > Vos applications > SDK
   setup and configuration). Ne garde JAMAIS ce placeholder
   en production.
   =========================================================== */

const firebaseConfig = {
  apiKey: "REMPLACE_PAR_TA_VRAIE_CLE_API",
  authDomain: "worker-tsa-ebd91.firebaseapp.com",
  projectId: "worker-tsa-ebd91",
  storageBucket: "worker-tsa-ebd91.appspot.com",
  messagingSenderId: "REMPLACE_PAR_TON_SENDER_ID",
  appId: "REMPLACE_PAR_TON_APP_ID"
};

// Initialisation Firebase (SDK compat, cohérent avec les balises <script> de index.html)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* ---------------------------------------------------------
   GOOGLE_MAPS_API_KEY
   ---------------------------------------------------------
   La sélection de localisation sur carte (écrans "Localisation"
   et "Configuration du ticket") est actuellement désactivée.
   Pour l'activer :
   1. Crée une clé API Google Maps (Google Cloud Console)
   2. Active "Maps JavaScript API" et "Places API"
   3. Colle la clé ci-dessous
   4. Ajoute le script Google Maps dans index.html
   5. Remplace le bouton désactivé "Sélectionner sur la carte"
      par une vraie intégration (Autocomplete / carte interactive)
   --------------------------------------------------------- */
const GOOGLE_MAPS_API_KEY = ""; // à renseigner plus tard
