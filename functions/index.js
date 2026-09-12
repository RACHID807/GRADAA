// ============================================================
// functions/index.js — Point d'entrée des Cloud Functions GRADA
// ============================================================

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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

// ── Scheduled: rappels automatiques (J-3, J-1) ──────────────
exports.sendDailyReminders = functions
  .region('europe-west1')
  .pubsub.schedule('0 8 * * *')
  .timeZone('Africa/Abidjan')
  .onRun(async (context) => {
    const today = new Date().toISOString().split('T')[0];
    
    let reminderType = null;
    if (today === '2026-10-01') {
      reminderType = 'reminder_j3';
    } else if (today === '2026-10-03') {
      reminderType = 'reminder_j1';
    }

    if (!reminderType) {
      console.log('Pas de rappel prévu pour aujourd\'hui:', today);
      return null;
    }

    console.log(`Lancement des rappels ${reminderType} pour GRADAA 2026`);
    const db = getFirestore();
    const participantsSnap = await db.collection('participants')
      .where('eventId', '==', 'gradaa-2026')
      .get();

    let count = 0;
    let batch = db.batch();
    let batchSize = 0;
    
    for (const doc of participantsSnap.docs) {
      const p = doc.data();
      if (p.email) {
        const queueRef = db.collection('emailQueue').doc();
        batch.set(queueRef, {
          to: p.email,
          toName: `${p.firstName} ${p.lastName}`,
          participantId: doc.id,
          registrationNumber: p.registrationNumber,
          eventId: p.eventId,
          type: reminderType,
          status: 'pending',
          attempts: 0,
          createdAt: FieldValue.serverTimestamp(),
          triggeredBy: 'cron'
        });
        count++;
        batchSize++;
        
        if (batchSize === 400) {
          await batch.commit();
          batch = db.batch();
          batchSize = 0;
        }
      }
    }
    
    if (batchSize > 0) {
      await batch.commit();
    }
    
    console.log(`Mis en file d'attente de ${count} emails pour ${reminderType}`);
    
    // Déclenche l'envoi immédiat du premier lot
    try {
      await processEmailQueue();
    } catch (e) {}

    return null;
  });

// ── HTTP: renvoi manuel d'un email (depuis le dashboard) ────
exports.resendEmail = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // We allow unauthenticated users (e.g. from checkin.html) to request a resend.
    // The email is only sent to the participant's already registered email address,
    // so there is no spam risk to arbitrary addresses.
    const { participantId } = data;
    if (!participantId) {
      throw new functions.https.HttpsError('invalid-argument', 'participantId requis.');
    }

    const participantDoc = await getFirestore()
      .collection('participants')
      .doc(participantId)
      .get();

    if (!participantDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Participant introuvable.');
    }

    const participant = participantDoc.data();
    await getFirestore().collection('emailQueue').add({
      to: participant.email,
      toName: `${participant.firstName} ${participant.lastName}`,
      participantId,
      registrationNumber: participant.registrationNumber,
      eventId: participant.eventId,
      type: 'receipt',
      status: 'pending',
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
      triggeredBy: 'admin-manual'
    });

    // Déclenche l'envoi immédiatement sans attendre le cron de 5 minutes
    try {
      await processEmailQueue();
    } catch (e) {
      console.error("Erreur lors du traitement immédiat de la file d'attente:", e);
    }

    return { success: true, message: 'Email mis en file d\'attente et en cours d\'envoi.' };
  });

// ── HTTP: statistiques publiques (optionnel) ────────────────
exports.getStats = functions
  .region('europe-west1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=60'); // Cache 1 minute

    try {
      const eventId = req.query.eventId || 'grada-2026';
      const snap = await getFirestore()
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
