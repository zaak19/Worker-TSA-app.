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
WorkerTSA.EVENT_REGISTRATION_FEE = 5000; // 5 000 FCFA, paiement unique par événement enregistré

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
   ESPACE VENDEUR — ventes et retraits
   --------------------------------------------------------- */
WorkerTSA.getOrganizerEvents = async function (uid) {
  if (!uid) return [];
  const snap = await db.collection('events').where('organizerId', '==', uid).get();
  return snap.docs.map(function (doc) { return { id: doc.id, ...doc.data() }; });
};

WorkerTSA.isEventSalesLocked = function (eventData) {
  if (!eventData || !eventData.date || !eventData.time) return false;
  const eventAt = new Date(eventData.date + 'T' + eventData.time);
  return !Number.isNaN(eventAt.getTime()) && Date.now() >= eventAt.getTime();
};

WorkerTSA.getEventSalesSummary = async function (eventId, eventData) {
  const data = eventData || {};
  let sold = Number(data.ticketsSold || data.soldTickets || 0);
  let gross = Number(data.grossSales || 0);
  let commission = Number(data.totalCommission || 0);
  try {
    const salesSnap = await db.collection('ticketSales').where('eventId', '==', eventId).get();
    if (!salesSnap.empty) {
      sold = 0; gross = 0; commission = 0;
      salesSnap.forEach(function (doc) {
        const sale = doc.data() || {};
        const qty = Math.max(1, Number(sale.quantity || 1));
        const unitPrice = Number(sale.unitPrice != null ? sale.unitPrice : data.price) || 0;
        const saleGross = Number(sale.grossAmount != null ? sale.grossAmount : unitPrice * qty) || 0;
        const saleCommission = Number(sale.commissionAmount != null ? sale.commissionAmount : Math.round(saleGross * WorkerTSA.TICKET_COMMISSION_RATE)) || 0;
        sold += qty; gross += saleGross; commission += saleCommission;
      });
    }
  } catch (error) { console.warn('Impossible de lire ticketSales :', error); }
  if (!gross && sold && Number(data.price)) gross = sold * Number(data.price);
  if (!commission && gross) commission = Math.round(gross * WorkerTSA.TICKET_COMMISSION_RATE);

  let withdrawn = 0;
  try {
    const withdrawalsSnap = await db.collection('withdrawals').where('eventId', '==', eventId).get();
    withdrawalsSnap.forEach(function (doc) {
      const w = doc.data() || {};
      if (w.status === 'pending' || w.status === 'paid') withdrawn += Number(w.amount) || 0;
    });
  } catch (error) { console.warn('Impossible de lire les retraits :', error); }

  const net = Math.max(0, gross - commission);
  return { sold, gross, commission, net, withdrawn, available: Math.max(0, net - withdrawn), locked: WorkerTSA.isEventSalesLocked(data) };
};

/* Enregistre une vente et bloque automatiquement toute vente après l'heure
   exacte de l'événement. Cette fonction est prévue pour le futur parcours
   d'achat participant et centralise le calcul de la commission de 5 %. */
WorkerTSA.recordTicketSale = async function (eventId, saleData) {
  if (!eventId) return { success: false, error: new Error('Événement manquant.') };
  try {
    const eventRef = db.collection('events').doc(eventId);
    const saleRef = db.collection('ticketSales').doc();
    const result = await db.runTransaction(async function (transaction) {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) throw new Error('Événement introuvable.');
      const event = eventSnap.data() || {};
      if (WorkerTSA.isEventSalesLocked(event)) throw new Error('La vente des tickets est verrouillée : l’heure de l’événement est atteinte.');

      const quantity = Math.max(1, Number(saleData && saleData.quantity || 1));
      const unitPrice = Number(saleData && saleData.unitPrice != null ? saleData.unitPrice : event.price) || 0;
      const grossAmount = Number(saleData && saleData.grossAmount != null ? saleData.grossAmount : unitPrice * quantity) || 0;
      const commissionAmount = Math.round(grossAmount * WorkerTSA.TICKET_COMMISSION_RATE);
      const netAmount = grossAmount - commissionAmount;

      transaction.set(saleRef, {
        eventId,
        organizerId: event.organizerId || null,
        quantity,
        unitPrice,
        grossAmount,
        commissionRate: WorkerTSA.TICKET_COMMISSION_RATE,
        commissionAmount,
        netAmount,
        buyerName: (saleData && saleData.buyerName) || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(eventRef, {
        ticketsSold: firebase.firestore.FieldValue.increment(quantity),
        grossSales: firebase.firestore.FieldValue.increment(grossAmount),
        totalCommission: firebase.firestore.FieldValue.increment(commissionAmount),
        totalNetSales: firebase.firestore.FieldValue.increment(netAmount)
      });
      return { quantity, grossAmount, commissionAmount, netAmount };
    });
    return { success: true, sale: result, saleId: saleRef.id };
  } catch (error) {
    console.error('Vente de ticket refusée :', error);
    return { success: false, error };
  }
};

WorkerTSA.saveWithdrawalRequest = async function (uid, withdrawalData) {
  try {
    const ref = await db.collection('withdrawals').add({ organizerId: uid, ...withdrawalData, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    return { success: true, withdrawalId: ref.id };
  } catch (error) { console.error('Erreur saveWithdrawalRequest :', error); return { success: false, error }; }
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
