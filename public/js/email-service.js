// ============================================================
// email-service.js — Service d'envoi d'email GRADA
// ============================================================
// Solution retenue : EmailJS (free tier 200 emails/mois)
// Fallback : Firestore emailQueue ←’ Cloud Function (Brevo SMTP)
// ============================================================

'use strict';

window.GradaEmail = (() => {

  const { EMAILJS_CONFIG, db, EVENT_CONFIG } = window.GRADAA;

  let emailJSInitialized = false;

  function initEmailJS() {
    if (emailJSInitialized) return;
    if (window.emailjs) {
      emailjs.init(EMAILJS_CONFIG.publicKey);
      emailJSInitialized = true;
    }
  }

  // ── Convert Blob to base64 ──────────────────────────────────
  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ── Send receipt via EmailJS (DEPRECATED: Now handled by Cloud Functions)
  async function sendViaEmailJS(participant, pdfBlob) {
    // No-op
    return true;
  }

  // ── Fallback: Add to Firestore emailQueue ───────────────────
  // Cloud Function picks this up and sends via Brevo
  async function sendViaQueue(participant) {
    await db.collection('emailQueue').add({
      to: participant.email,
      toName: `${participant.firstName} ${participant.lastName}`,
      participantId: participant.id,
      registrationNumber: participant.registrationNumber,
      eventId: EVENT_CONFIG.id,
      type: 'receipt',
      status: 'pending',
      attempts: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastAttemptAt: null,
      error: null
    });
    return false; // Not sent immediately
  }

  // ── Main send function ────────────────────────────────────────
  async function sendReceipt(participant, pdfBlob) {
    // The backend `onParticipantCreated` Cloud Function handles sending
    // the email automatically. We just return true to satisfy the UI.
    console.log('✅ Email is being handled securely by Firebase Cloud Functions.');
    return true;
  }

  // ── Admin: manually resend email for a participant ──────────
  async function resendFromAdmin(participantId) {
    try {
      console.log('Appel de la Cloud Function resendEmail...');
      const resendEmailFn = window.GRADAA.auth.app.functions('europe-west1').httpsCallable('resendEmail');
      await resendEmailFn({ participantId });
      console.log('✅ Email mis en file d\'attente via Cloud Function');
      return true;
    } catch (error) {
      console.error('❌ Erreur lors du renvoi via Cloud Function:', error);
      throw error;
    }
  }

  return { sendReceipt, resendFromAdmin };
})();
