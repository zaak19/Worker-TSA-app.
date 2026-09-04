/* ===========================================================
   WORKER TSA — provider.js
   Logique métier : catégories, profil organisateur/prestataire,
   tickets, commission.
   by Trillion Software
   =========================================================== */

window.WorkerTSA = window.WorkerTSA || {};

/* ---------------------------------------------------------
   CATÉGORIES
   --------------------------------------------------------- */
WorkerTSA.CATEGORIES_SERVICE = [
  { id: 'photographie', label: 'Photographie', icon: '📷' },
  { id: 'lounge-bar', label: 'Lounge & Bar', icon: '🍸' },
  { id: 'restauration-hotellerie', label: 'Restauration & Hôtellerie', icon: '🍽' },
  { id: 'couture-coiffure', label: 'Couture & Coiffure', icon: '✂️' },
  { id: 'architecture-geometre', label: 'Architecture & Géomètre', icon: '📐' },
  { id: 'avocat-huissier', label: 'Avocat & Huissier', icon: '⚖️' },
  { id: 'gymnase-fitness', label: 'Gymnase & Fitness', icon: '🏋️' },
  { id: 'parc-piscine', label: 'Parc & Piscine', icon: '🏊' },
  { id: 'chauffeur-cuisinier', label: 'Chauffeur & Cuisinier', icon: '🚗' }
];

WorkerTSA.CATEGORIES_EVENEMENT = [
  { id: 'concert', label: 'Concert', icon: '🎤' },
  { id: 'conference', label: 'Conférence', icon: '🎙' },
  { id: 'reunion', label: 'Réunion', icon: '🧑‍🤝‍🧑' },
  { id: 'festival', label: 'Festival', icon: '🎉' },
  { id: 'match-football', label: 'Match de football', icon: '⚽' },
  { id: 'match-boxe', label: 'Match de boxe', icon: '🥊' },
  { id: 'match-baseball', label: 'Match de baseball', icon: '⚾' },
  { id: 'grande-rencontre', label: 'Grande rencontre', icon: '🏟' }
];

/**
 * Retourne la liste de catégories adaptée au type d'activité.
 * @param {'evenement'|'service'} type
 */
WorkerTSA.getCategoriesFor = function (type) {
  return type === 'evenement' ? WorkerTSA.CATEGORIES_EVENEMENT : WorkerTSA.CATEGORIES_SERVICE;
};

/* ---------------------------------------------------------
   COMMISSION
   --------------------------------------------------------- */
WorkerTSA.TICKET_COMMISSION_RATE = 0.05; // 5% prélevés par Worker TSA sur chaque ticket vendu

WorkerTSA.computeCommission = function (ticketPrice) {
  const price = Number(ticketPrice) || 0;
  const commission = Math.round(price * WorkerTSA.TICKET_COMMISSION_RATE);
  return { commission, net: price - commission };
};

/* ---------------------------------------------------------
   NUMÉRO DE TICKET UNIQUE (6 caractères alphanumériques)
   --------------------------------------------------------- */
WorkerTSA.generateTicketNumber = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/* ---------------------------------------------------------
   SAUVEGARDE DU PROFIL ORGANISATEUR / PRESTATAIRE (Firestore)
   --------------------------------------------------------- */
WorkerTSA.saveProviderProfile = async function (uid, profileData) {
  try {
    await db.collection('providers').doc(uid).set(profileData, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Erreur saveProviderProfile :', error);
    return { success: false, error };
  }
};

/* ---------------------------------------------------------
   SAUVEGARDE D'UN ÉVÉNEMENT + TICKET (Firestore)
   --------------------------------------------------------- */
WorkerTSA.saveEventTicket = async function (uid, ticketData) {
  try {
    const docRef = await db.collection('events').add({
      organizerId: uid,
      ...ticketData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, eventId: docRef.id };
  } catch (error) {
    console.error('Erreur saveEventTicket :', error);
    return { success: false, error };
  }
};

/* ---------------------------------------------------------
   UPLOAD DE FICHIERS (Firebase Storage)
   ---------------------------------------------------------
   Placeholder : décommente et adapte une fois Firebase Storage
   activé sur le projet worker-tsa-ebd91.

   WorkerTSA.uploadProviderFile = async function (uid, file, path) {
     const storageRef = firebase.storage().ref(`providers/${uid}/${path}`);
     const snapshot = await storageRef.put(file);
     return snapshot.ref.getDownloadURL();
   };
   --------------------------------------------------------- */

/* ---------------------------------------------------------
   GÉNÉRATION DU TICKET PDF
   ---------------------------------------------------------
   Placeholder : la génération réelle du PDF (format portrait 9:12,
   avec nom de l'événement, nom/prénom de l'acheteur et numéro
   unique à 6 caractères) nécessite une librairie comme jsPDF.
   Étapes pour l'activer :
   1. Ajouter dans index.html :
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   2. Implémenter WorkerTSA.generateTicketPDF(ticket, buyerName)
      en utilisant window.jspdf.jsPDF pour dessiner le ticket
      et déclencher le téléchargement (doc.save('ticket.pdf')).
   --------------------------------------------------------- */
