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
├── icon.png            → Icône/logo officiel de l'application (carré)
├── splash.png          → Écran de lancement 9:16
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

## 🔐 Écran de sécurité au démarrage

Au lancement, `splash.png` est affichée pendant **1 seconde**. L'application affiche ensuite un écran de code de sécurité :

- première utilisation : création d'un code numérique de **4, 6 ou 8 chiffres**, avec confirmation ;
- utilisations suivantes : déverrouillage avec le code déjà enregistré sur l'appareil ;
- le code n'est pas enregistré en clair : l'application conserve un dérivé **PBKDF2/SHA-256 avec sel aléatoire** dans `localStorage`.

Le code est un verrou d'accès local à l'interface. Il ne remplace pas l'authentification Firebase du compte utilisateur.

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

La génération réelle du PDF de ticket (nom de l'événement, nom/prénom de l'acheteur, numéro unique à 8 caractères alphanumériques, format portrait) nécessite une librairie comme **jsPDF**.

1. Ajoute dans `index.html` :
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   ```
2. Implémente `WorkerTSA.generateTicketPDF()` dans `provider.js` (voir commentaires)

Le numéro unique à 8 caractères alphanumériques est déjà généré par `WorkerTSA.generateTicketNumber()`.

---

## 💰 Modèle économique

- **Prestataires de services** : abonnement (2 000 FCFA/mois, 5 000 FCFA/trimestre, ou 18 000 FCFA/an). Les clients accèdent gratuitement à leurs coordonnées.
- **Organisateurs d'événements** : **5 000 FCFA par événement enregistré**, en paiement unique. Il n'y a pas d'abonnement organisateur pour l'enregistrement de l'événement.
- **Commission sur les tickets** : **5% du prix de chaque ticket vendu** pour les événements (voir `WorkerTSA.TICKET_COMMISSION_RATE` dans `provider.js`).

---

## 📱 Paiement (statut actuel)

Aucun paiement réel n'est traité pour le moment. Les écrans de paiement (frais d'enregistrement d'événement ou abonnement prestataire) sont fonctionnels visuellement mais simulent la validation. Moyens de paiement prévus : **T-Money (Mixx by YAS)** et **Moov Money (Flooz)** — Wave, Orange Money et MTN sont affichés comme indisponibles en attendant leur intégration.

---

*Innover aujourd'hui, construire demain.*
**Trillion Software**


## Modification v3

Après une connexion réussie avec l'e-mail et le mot de passe Firebase, l'application ouvre maintenant `screen-profile-type`, qui correspond à la suite du parcours déjà présente dans `index.html`. Le placeholder `screen-home` n'est plus affiché immédiatement après la connexion.


## Version 6 — Espace vendeur

- Tableau de bord organisateur avec nombre de tickets vendus, ventes brutes, commission Worker TSA de 5 % et fonds disponibles.
- Verrouillage automatique des ventes à l'heure exacte de début de l'événement.
- Demande de retrait des fonds après verrouillage, via T-Money ou Moov Money.
- Les demandes de retrait sont enregistrées dans Firestore (`withdrawals`) avec le statut `pending`. Le versement réel reste à connecter au prestataire Mobile Money.
- Les ventes futures peuvent être enregistrées dans `ticketSales`; `recordTicketSale()` refuse une vente après l'heure de l'événement et met à jour les compteurs de l'événement.
- Accueil visuellement plus doux, typographie légèrement agrandie et mention discrète « BY TRILLION SOFTWARE ».

> Remarque : le verrouillage côté interface et `recordTicketSale()` sont des protections côté client. Les règles Firestore doivent aussi interdire les écritures de ventes après l'heure de l'événement et sécuriser les retraits en production.


## Version 9 — comptes, tickets participants et identifiants uniques

- Le rôle du compte est choisi à la création : `participant` ou `organisateur`.
- Le rôle `participant` est considéré comme définitif : l'interface ne propose plus de conversion vers l'espace professionnel.
- Un compte `organisateur` peut aussi utiliser l'espace participant avec le même compte.
- L'espace professionnel (`Mes ventes`, retraits, création/gestion d'événements) est protégé côté navigation et doit être protégé côté règles Firebase.
- Un participant renseigne son nom et son prénom avant son premier achat ; ces informations sont imprimées sur chaque ticket.
- Chaque achat individuel génère automatiquement un **numéro de ticket de 8 caractères alphanumériques**, différent des autres tickets. Le code est créé au moment de l'achat, pas à la création de l'événement.
- Le ticket affiché dans l'application reprend le modèle visuel 1 retenu : bordeaux/crème, contours de ticket et perforation, **sans QR code**.
- Un compte peut acheter au maximum **5 tickets pour un même événement**. Chaque achat est individuel et crée son propre ticket/code.
- Les tickets achetés sont consultables dans « Mes tickets ».

### Important sur la sécurité

La génération du code et la limite de 5 tickets sont gérées par une transaction Firestore côté client avec un document de compteur. Pour une mise en production avec paiements réels, il faudra déplacer la validation financière et la génération/attribution définitive des tickets dans une fonction backend Firebase (Cloud Functions) afin qu'un client malveillant ne puisse pas fabriquer lui-même une vente valide.

### Règles Firestore v9

Le fichier `firestore.rules` fourni avec cette version est destiné à être copié dans **Firebase Console > Firestore Database > Rules** puis publié. Les règles empêchent notamment les participants de lire les ventes d'autres participants, les organisateurs de lire les tickets d'autres organisateurs et les utilisateurs de modifier/supprimer un ticket après sa création.
