# Worker TSA
### par Trillion Software

Application web (PWA-ready) de mise en relation entre organisateurs/prestataires de services et clients/participants, pour le Togo, le Bénin, le Ghana, la Côte d'Ivoire et le Cameroun.

---

## 📁 Structure du projet

```
worker-tsa/
├── index.html          → Toutes les pages/écrans de l'application
├── styles.css          → Feuille de style complète
├── app.js              → Navigation entre écrans + logique d'interface
├── firebase-config.js  → Configuration et initialisation Firebase
├── auth.js             → Authentification (création de compte, connexion)
├── provider.js         → Catégories, profils organisateurs, tickets, commission
└── README.md           → Ce fichier
```

---

## 🚀 Mise en ligne sur GitHub Pages

1. Crée un nouveau repository GitHub (public).
2. Dépose les 6 fichiers ci-dessus à la racine du repository (pas dans un sous-dossier, sauf si tu adaptes les chemins dans `index.html`).
3. Va dans **Settings > Pages** du repository.
4. Sous "Source", sélectionne la branche `main` (ou `master`) et le dossier `/ (root)`.
5. Ton application sera accessible à une adresse du type :
   `https://tonpseudo.github.io/nom-du-repository/`

---

## 🔥 Configuration Firebase (obligatoire)

L'application utilise **Firebase Authentication** (Email/Password) et **Firestore** pour sauvegarder les profils organisateurs et les événements/tickets.

### Étapes :
1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Crée un nouveau projet (ou utilise un projet existant)
3. Dans **Authentication > Sign-in method**, active "Email/Password"
4. Dans **Firestore Database**, crée une base de données (mode production ou test selon ton besoin)
5. Dans **Paramètres du projet > Vos applications**, ajoute une application Web et copie la configuration
6. Ouvre `firebase-config.js` et remplace ces valeurs :

```javascript
const firebaseConfig = {
  apiKey: "TA_VRAIE_CLE_API",
  authDomain: "ton-projet.firebaseapp.com",
  projectId: "ton-projet",
  storageBucket: "ton-projet.appspot.com",
  messagingSenderId: "TON_SENDER_ID",
  appId: "TON_APP_ID"
};
```

⚠️ Sans cette étape, les écrans de création de compte et de connexion afficheront une erreur.

---

## 🗺️ Google Maps (optionnel, à activer plus tard)

La sélection de localisation sur carte est désactivée par défaut (les utilisateurs peuvent en attendant coller un lien Google Maps manuellement). Pour l'activer :

1. Crée une clé API sur [Google Cloud Console](https://console.cloud.google.com)
2. Active "Maps JavaScript API" et "Places API"
3. Renseigne la clé dans `firebase-config.js` (`GOOGLE_MAPS_API_KEY`)
4. Ajoute le script Google Maps dans `index.html`
5. Implémente la sélection interactive dans `app.js` (voir commentaires dans le code)

---

## 🖼️ Firebase Storage (à activer plus tard)

Actuellement, les photos uploadées (profil, présentation, carte d'identité) sont seulement **prévisualisées localement** dans le navigateur — elles ne sont pas encore envoyées vers un serveur.

Pour activer l'envoi réel :
1. Active **Firebase Storage** dans la Console Firebase
2. Ajoute le SDK Storage dans `index.html` :
   ```html
   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js"></script>
   ```
3. Décommente et adapte la fonction `WorkerTSA.uploadProviderFile` dans `provider.js`

---

## 🎟️ Génération des tickets PDF (à activer plus tard)

La génération réelle du PDF de ticket (nom de l'événement, nom/prénom de l'acheteur, numéro unique à 6 caractères, format portrait) nécessite une librairie comme **jsPDF**.

1. Ajoute dans `index.html` :
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   ```
2. Implémente `WorkerTSA.generateTicketPDF()` dans `provider.js` (voir commentaires)

Le numéro unique à 6 caractères est déjà généré par `WorkerTSA.generateTicketNumber()`.

---

## 💰 Modèle économique

- **Prestataires de services** : abonnement (2 000 FCFA/mois, 5 000 FCFA/trimestre, ou 18 000 FCFA/an). Les clients accèdent gratuitement à leurs coordonnées.
- **Organisateurs d'événements** : mêmes abonnements + **commission de 5%** prélevée sur chaque ticket vendu dans l'application (voir `WorkerTSA.TICKET_COMMISSION_RATE` dans `provider.js`).

---

## 📱 Paiement (statut actuel)

Aucun paiement réel n'est traité pour le moment. Les écrans de paiement (abonnement et achat de ticket) sont fonctionnels visuellement mais simulent la validation. Moyens de paiement prévus : **T-Money (Mixx by YAS)** et **Moov Money (Flooz)** — Wave, Orange Money et MTN sont affichés comme indisponibles en attendant leur intégration.

---

*Innover aujourd'hui, construire demain.*
**Trillion Software**
