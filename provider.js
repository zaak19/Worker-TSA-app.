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
   NUMÉRO DE TICKET UNIQUE (8 caractères alphanumériques)
   --------------------------------------------------------- */
WorkerTSA.generateTicketNumber = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  if (window.crypto && crypto.getRandomValues) {
    const bytes = new Uint32Array(8);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  } else {
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
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
    const salesSnap = data.organizerId
      ? await db.collection('ticketSales').where('organizerId', '==', data.organizerId).get()
      : { empty: true, forEach: function () {} };
    if (!salesSnap.empty) {
      sold = 0; gross = 0; commission = 0;
      salesSnap.forEach(function (doc) {
        const sale = doc.data() || {};
        if (sale.eventId !== eventId) return;
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
WorkerTSA.MAX_TICKETS_PER_EVENT = 5;

/* ---------------------------------------------------------
   ACHAT PARTICIPANT — ticket individuel
   Chaque achat génère un code unique de 8 caractères.
   Un compteur transactionnel limite le compte à 5 tickets
   pour un même événement.
   --------------------------------------------------------- */
WorkerTSA.getParticipantTickets = async function (uid) {
  if (!uid) return [];
  const snap = await db.collection('ticketSales').where('buyerId', '==', uid).get();
  return snap.docs.map(function (doc) { return { id: doc.id, ...doc.data() }; });
};

WorkerTSA.getParticipantTicketCount = async function (uid, eventId) {
  if (!uid || !eventId) return 0;
  const ref = db.collection('ticketLimits').doc(uid + '_' + eventId);
  const snap = await ref.get();
  return snap.exists ? Number((snap.data() || {}).count || 0) : 0;
};

WorkerTSA.recordTicketSale = async function (eventId, saleData) {
  if (!eventId) return { success: false, error: new Error('Événement manquant.') };
  const buyerId = WorkerTSA.state && WorkerTSA.state.currentUserId;
  if (!buyerId) return { success: false, error: new Error('Connexion participant requise.') };

  const payload = saleData || {};
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  if (!firstName || !lastName) return { success: false, error: new Error('Nom et prénom du participant requis.') };

  const eventRef = db.collection('events').doc(eventId);
  const limitRef = db.collection('ticketLimits').doc(buyerId + '_' + eventId);

  for (let attempt = 0; attempt < 5; attempt++) {
    const ticketCode = WorkerTSA.generateTicketNumber();
    const ticketRef = db.collection('ticketSales').doc(ticketCode);
    try {
      const result = await db.runTransaction(async function (transaction) {
        const eventSnap = await transaction.get(eventRef);
        const limitSnap = await transaction.get(limitRef);
        const ticketSnap = await transaction.get(ticketRef);
        if (!eventSnap.exists) throw new Error('Événement introuvable.');
        if (ticketSnap.exists) throw new Error('CODE_COLLISION');

        const event = eventSnap.data() || {};
        if (WorkerTSA.isEventSalesLocked(event)) {
          throw new Error('La vente des tickets est verrouillée : l’heure de l’événement est atteinte.');
        }

        const currentCount = limitSnap.exists ? Number((limitSnap.data() || {}).count || 0) : 0;
        if (currentCount >= WorkerTSA.MAX_TICKETS_PER_EVENT) {
          throw new Error('MAX_TICKETS');
        }

        const unitPrice = Number(payload.unitPrice != null ? payload.unitPrice : event.price) || 0;
        if (unitPrice <= 0) throw new Error('Prix du ticket invalide.');
        const grossAmount = unitPrice;
        const commissionAmount = Math.round(grossAmount * WorkerTSA.TICKET_COMMISSION_RATE);
        const netAmount = grossAmount - commissionAmount;

        const sale = {
          ticketCode: ticketCode,
          quantity: 1,
          eventId: eventId,
          organizerId: event.organizerId || null,
          buyerId: buyerId,
          firstName: firstName,
          lastName: lastName,
          buyerName: firstName + ' ' + lastName,
          eventName: event.eventName || 'Événement',
          category: event.category || 'Événement',
          ticketType: event.ticketType || 'Standard',
          price: unitPrice,
          unitPrice: unitPrice,
          grossAmount: grossAmount,
          commissionRate: WorkerTSA.TICKET_COMMISSION_RATE,
          commissionAmount: commissionAmount,
          netAmount: netAmount,
          date: event.date || '',
          time: event.time || '',
          lieu: event.lieu || '',
          status: 'valid',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        transaction.set(ticketRef, sale);
        transaction.set(limitRef, {
          buyerId: buyerId,
          eventId: eventId,
          count: currentCount + 1,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return { ticketCode: ticketCode, sale: sale, count: currentCount + 1 };
      });
      return { success: true, ticket: result.sale, ticketCode: result.ticketCode, count: result.count };
    } catch (error) {
      if (error && error.message === 'CODE_COLLISION') continue;
      return { success: false, error: error };
    }
  }
  return { success: false, error: new Error('Impossible de générer un numéro de ticket unique. Réessayez.') };
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
   GÉNÉRATION DU TICKET PDF — ACTIVE
   ---------------------------------------------------------
   Le ticket PDF est généré dans app.js avec jsPDF chargé
   dans index.html. La fonction WorkerTSA.downloadTicketPDF()
   utilise les données du ticket enregistré dans Firestore.
   --------------------------------------------------------- */
