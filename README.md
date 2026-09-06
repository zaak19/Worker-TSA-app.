# Worker TSA
### par Trillion Software

Application web (PWA-ready) de mise en relation entre organisateurs/prestataires de services et clients/participants, pour le Togo, le Bénin, le Ghana, la Côte d'Ivoire et le Cameroun.

### Version 16 — nouvelle page d'authentification

La page de création de compte et de connexion suit désormais une maquette mobile 9:16 avec arrière-plan blanc, champs blancs à bordure douce et boutons bordeaux. La connexion accessible depuis le parcours professionnel renvoie également vers cette nouvelle page.

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

## 📍 Localisation — choix produit

La fonctionnalité de localisation sur carte est définitivement supprimée de Worker TSA.

- Aucun organisateur ou prestataire ne renseigne d'adresse géolocalisée.
- Aucun lien Google Maps n'est demandé ou enregistré.
- Aucune sélection sur carte, Google Maps ou Places n'est utilisée.
- Le profil professionnel utilise uniquement un champ texte **Lieu**.
- Chaque événement utilise uniquement un champ texte **Lieu**.
- Le pays reste sélectionnable pendant l'inscription professionnelle ; il sert à identifier le pays choisi et ne constitue pas une géolocalisation.

Cette version n'a donc pas besoin de `GOOGLE_MAPS_API_KEY`.

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

## 🎟️ Génération des tickets PDF — ACTIVE

La génération du ticket PDF est intégrée à Worker TSA. Après la validation de l'achat, le ticket est enregistré dans Firestore, affiché dans l'espace participant et peut être téléchargé immédiatement en PDF.

Le PDF contient notamment :
- le nom de l'événement ;
- le nom et le prénom du participant ;
- la date et l'heure ;
- le lieu ;
- le type de ticket ;
- le prix ;
- le numéro unique du ticket ;
- la date d'achat.

La génération est réalisée côté navigateur avec **jsPDF**. jsPDF est une bibliothèque JavaScript de génération de PDF distribuée sous licence MIT ; elle ne nécessite donc pas de compte Google ni de facturation Google Maps. citeturn0search2

Le numéro unique à 8 caractères alphanumériques est généré par `WorkerTSA.generateTicketNumber()`. Le bouton **Télécharger mon ticket en PDF** est disponible sur l'écran de détail du ticket.

---

## 💰 Modèle économique

- **Prestataires de services** : abonnement (2 000 FCFA/mois, 5 000 FCFA/trimestre, ou 18 000 FCFA/an). Les clients accèdent gratuitement à leurs coordonnées.
- **Organisateurs d'événements** : **5 000 FCFA par événement enregistré**, en paiement unique. Il n'y a pas d'abonnement organisateur pour l'enregistrement de l'événement.
- **Commission sur les tickets** : **5% du prix de chaque ticket vendu** pour les événements (voir `WorkerTSA.TICKET_COMMISSION_RATE` dans `provider.js`).

---

## 📱 Paiement et trésorerie (v17)

Les écrans de paiement existants restent en mode simulation tant qu'un prestataire de paiement n'a pas fourni ses accès/API. La console admin v17 permet de gérer les moyens de paiement (nom, opérateur, contact/numéro, titulaire, activation/désactivation), les ordres de versement aux organisateurs et les retraits de la part Worker TSA. Les données financières sont contrôlées par les règles Firestore et le custom claim `admin=true`.

---

*Innover aujourd'hui, construire demain.*
**Trillion Software**


## Modification v3

Après une connexion réussie avec l'e-mail et le mot de passe Firebase, l'application ouvre maintenant `screen-profile-type`, qui correspond à la suite du parcours déjà présente dans `index.html`. Le placeholder `screen-home` n'est plus affiché immédiatement après la connexion.


## Version 6 — Espace vendeur

- Tableau de bord organisateur avec nombre de tickets vendus, ventes brutes, commission Worker TSA de 5 % et fonds disponibles.
- Verrouillage automatique des ventes à l'heure exacte de début de l'événement.
- Demande de retrait des fonds après verrouillage, via T-Money ou Moov Money.
- Les demandes de retrait organisateur sont enregistrées dans `withdrawals`. La console admin ajoute aussi `organizerPayouts`, `adminWithdrawals` et `paymentMethods`. Le transfert Mobile Money réel doit être effectué via l'API/compte marchand du prestataire ; aucun secret Mobile Money ne doit être placé dans le JavaScript public.
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


## V10 — scénario de test validation et achat
- Les événements nouvellement enregistrés sont `pending_review` et ne sont pas visibles dans la liste publique tant qu'ils ne sont pas approuvés.
- Le bouton « Simuler la validation de mon événement » permet au compte organisateur de tester le passage à `published`. En production, cette action devra être déplacée vers un outil réservé à l'équipe Worker TSA.
- Les achats de tickets passent par un écran de validation simulée, puis créent un ticket individuel avec un code alphanumérique unique de 8 caractères.
- Chaque compte est limité à 5 tickets pour un même événement.
- Les confirmations sont enregistrées comme notifications/e-mails simulés dans Firestore. Elles ne sont pas envoyées à une boîte Gmail réelle tant qu'un service d'e-mail backend n'est pas connecté.
- Un ticket validé peut être téléchargé en PDF depuis l'écran du ticket.


## V11
- Connexion directe dédiée depuis le parcours professionnel.
- Retour explicite depuis « Que recherchez-vous ? » vers l'accueil.
- E-mail professionnel de contact dans le profil organisateur.
- Console Trillion Software réservée au custom claim Firebase `admin=true`.
- Console financière agrégée : tickets, ventes brutes, commission 5 %, net organisateurs ; noms/prénoms des participants non affichés.
- Création d'une alerte `adminAlerts` lors d'une vente, sans identité du participant.
- `WORKER_TSA_SUPPORT_EMAIL` à renseigner dans `firebase-config.js`.
- Paiements et validation restent simulés dans cette version de test.


## 💼 Console financière administrateur — v17

- **Moyens de paiement** : ajout, modification, activation/désactivation et coordonnées de réception.
- **Versements organisateurs** : création d'un ordre, choix du moyen de paiement, destination, suivi `pending / paid / rejected`.
- **Retraits Worker TSA** : retrait de la commission disponible, choix du moyen et suivi d'état.
- **Trésorerie** : calcul de la commission, de la part organisateurs et des montants déjà engagés.
- Les opérations financières sensibles restent réservées au custom claim Firebase `admin=true`.
- **Limite importante** : une interface web Firebase ne peut pas envoyer réellement de l'argent par T-Money/Flooz sans l'API ou le service marchand du prestataire. La v17 prépare le contrôle et les ordres de paiement ; la connexion à l'API de paiement devra être faite côté serveur (Cloud Functions/serveur sécurisé), jamais avec une clé secrète dans `app.js`.

## 🔔 Notifications push et retraits organisateurs — V18

- Worker TSA utilise Firebase Cloud Messaging (FCM) pour les notifications push Web.
- Une vente de ticket crée automatiquement une notification pour l'organisateur via le backend Firebase.
- Les notifications Firestore peuvent être transformées en notifications push sur le téléphone si l'organisateur a autorisé les notifications et enregistré son appareil.
- La clé publique VAPID doit être renseignée dans `firebase-messaging-config.js`.
- Le service worker `firebase-messaging-sw.js` doit rester à la racine du domaine HTTPS.
- Les demandes de retrait organisateur passent par `pending` → `processing` → `paid`/`rejected` et affichent un délai cible de 2 à 3 heures.
- Le transfert Mobile Money réel nécessite toujours l'API/compte marchand du prestataire ; la console admin ne stocke aucun secret de paiement dans le navigateur.
- Les fonctions backend sont dans `functions/` et doivent être déployées avec Firebase CLI.


## V19 — Splash et code de sécurité

- Le splash utilise la maquette mobile 9:16 fournie pour Worker TSA.
- L’écran de création/déverrouillage du code de sécurité reprend la maquette vitrée avec fond paysage, tout en conservant le clavier PIN interactif et le stockage local sécurisé du code.
- Le fonctionnement Firebase Auth et les autres écrans de l’application restent inchangés.
