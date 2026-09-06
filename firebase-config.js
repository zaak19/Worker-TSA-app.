/* ===========================================================
   WORKER TSA — Configuration Firebase
   by Trillion Software
   ===========================================================
   ✅ Configuration active : projet Firebase "worker-tsa-93bb4".
   =========================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBDU1lzUrvTice37EqfptIPdcsAAqqbl8E",
  authDomain: "worker-tsa-93bb4.firebaseapp.com",
  projectId: "worker-tsa-93bb4",
  storageBucket: "worker-tsa-93bb4.firebasestorage.app",
  messagingSenderId: "115836395473",
  appId: "1:115836395473:web:ba01f028d52253bcf50af0"
};

// Initialisation Firebase (SDK compat, cohérent avec les balises <script> de index.html)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// E-mail professionnel d'assistance Worker TSA — à renseigner par Trillion Software.
const WORKER_TSA_SUPPORT_EMAIL = 'trillionsoftware@protonmail.com';
