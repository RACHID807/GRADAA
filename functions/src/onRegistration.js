// ============================================================
// functions/src/onRegistration.js — Trigger création participant
// ============================================================

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildEmailHtml, sendViaBrevo } = require('./sendEmail');

// ── Triggered when a new participant document is created ────
exports.onParticipantCreated = functions
  .region('europe-west1')
  .firestore
  .document('participants/{participantId}')
  .onCreate(async (snap, context) => {
    const participant = snap.data();
    const participantId = context.params.participantId;
    const db = getFirestore();

    console.log(`New participant: ${participant.registrationNumber} (${participant.email})`);

    // ── 1. Ensure event document exists ──────────────────────
    const eventRef = db.collection('events').doc(participant.eventId);
    await eventRef.set({
      id: participant.eventId,
      name: participant.eventName || 'GRADA 2026',
      date: participant.eventDate || '2026-09-27',
      location: 'Anyama, Côte d\'Ivoire',
      organizer: 'Sous-comité 1-2 Anyama de l\'AEEMCI',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // ── 2. Try to send welcome email ──────────────────────────
    if (participant.paymentStatus === 'pending') {
      console.log(`Payment pending for ${participant.email}, skipping automatic receipt email.`);
      return null;
    }

    try {
      const html = buildEmailHtml(participant);
      await sendViaBrevo(
        participant.email,
        `${participant.firstName} ${participant.lastName}`,
        `GRADA 2026 — Votre reçu d'inscription ${participant.registrationNumber}`,
        html
      );

      await snap.ref.update({
        emailSent: true,
        emailSentAt: FieldValue.serverTimestamp()
      });
      console.log(`✅ Email sent to ${participant.email}`);
    } catch (emailErr) {
      console.error(`❌ Email failed for ${participant.email}:`, emailErr.message);
      // Email will be retried by the queue processor
      await db.collection('emailQueue').add({
        to: participant.email,
        toName: `${participant.firstName} ${participant.lastName}`,
        participantId,
        registrationNumber: participant.registrationNumber,
        eventId: participant.eventId,
        type: 'receipt',
        status: 'pending',
        attempts: 0,
        createdAt: FieldValue.serverTimestamp(),
        triggeredBy: 'onCreate-trigger'
      });
    }

    return null;
  });
