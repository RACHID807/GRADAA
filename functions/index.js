// ============================================================
// functions/index.js — Point d'entrée des Cloud Functions GRADA
// ============================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ── Import sub-modules ──────────────────────────────────────
const { processEmailQueue } = require('./src/sendEmail');
const { onParticipantCreated } = require('./src/onRegistration');

// ── Trigger: nouveau participant inscrit ────────────────────
exports.onParticipantCreated = onParticipantCreated;

// ── Scheduled: traitement de la file d'emails ───────────────
// Toutes les 5 minutes, traite les emails en attente
exports.processEmailQueue = functions
  .region('europe-west1')
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    await processEmailQueue();
    return null;
  });

// ── HTTP: renvoi manuel d'un email (depuis le dashboard) ────
exports.resendEmail = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify admin auth
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
    }

    const adminDoc = await admin.firestore()
      .collection('admins')
      .doc(context.auth.uid)
      .get();

    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Accès réservé aux administrateurs.');
    }

    const { participantId } = data;
    if (!participantId) {
      throw new functions.https.HttpsError('invalid-argument', 'participantId requis.');
    }

    const participantDoc = await admin.firestore()
      .collection('participants')
      .doc(participantId)
      .get();

    if (!participantDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Participant introuvable.');
    }

    const participant = participantDoc.data();
    await admin.firestore().collection('emailQueue').add({
      to: participant.email,
      toName: `${participant.firstName} ${participant.lastName}`,
      participantId,
      registrationNumber: participant.registrationNumber,
      eventId: participant.eventId,
      type: 'receipt',
      status: 'pending',
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      triggeredBy: 'admin-manual'
    });

    return { success: true, message: 'Email mis en file d\'attente.' };
  });

// ── HTTP: statistiques publiques (optionnel) ────────────────
exports.getStats = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60'); // Cache 1 minute

    try {
      const eventId = req.query.eventId || 'grada-2026';
      const snap = await admin.firestore()
        .collection('participants')
        .where('eventId', '==', eventId)
        .get();

      const total = snap.size;
      const checkedIn = snap.docs.filter(d => d.data().checkedIn).length;

      res.json({
        eventId,
        total,
        checkedIn,
        absent: total - checkedIn,
        rate: total > 0 ? Math.round((checkedIn / total) * 100) : 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
