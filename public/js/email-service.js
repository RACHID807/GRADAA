// ============================================================
// email-service.js â€” Service d'envoi d'email GRADA
// ============================================================
// Solution retenue : EmailJS (free tier 200 emails/mois)
// Fallback : Firestore emailQueue â†’ Cloud Function (Brevo SMTP)
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

  // â”€â”€ Convert Blob to base64 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // â”€â”€ Send receipt via EmailJS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function sendViaEmailJS(participant, pdfBlob) {
    initEmailJS();
    if (!window.emailjs) throw new Error('EmailJS not loaded');

    const pdfBase64 = await blobToBase64(pdfBlob);

    const templateParams = {
      to_email: participant.email,
      to_name: `${participant.firstName} ${participant.lastName}`,
      registration_number: participant.registrationNumber,
      event_name: 'GRADAA 2026',
      event_date: '27 septembre 2026',
      event_location: 'Anyama, CÃ´te d\'Ivoire',
      sub_committee: participant.subCommittee || 'Non renseignÃ©',
      pdf_content: pdfBase64,
      pdf_name: `recu-GRADAA-2026-${participant.registrationNumber}.pdf`,
      organizer: 'Sous-comitÃ© 1-2 Anyama de l\'AEEMCI'
    };

    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams
    );
    return true;
  }

  // â”€â”€ Fallback: Add to Firestore emailQueue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Main send function (EmailJS â†’ Fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function sendReceipt(participant, pdfBlob) {
    try {
      await sendViaEmailJS(participant, pdfBlob);
      console.log('âœ… Email sent via EmailJS');
      return true;
    } catch (emailJSError) {
      console.warn('âš ï¸ EmailJS failed, using queue fallback:', emailJSError.message || emailJSError);
      try {
        await sendViaQueue(participant);
        console.log('ðŸ“¬ Email queued for retry via Cloud Function');
        return false;
      } catch (queueError) {
        console.error('âŒ Email queue failed:', queueError);
        return false;
      }
    }
  }

  // â”€â”€ Admin: manually resend email for a participant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function resendFromAdmin(participantId) {
    const ref = db.collection('participants').doc(participantId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Participant not found');

    const data = doc.data();
    await db.collection('emailQueue').add({
      to: data.email,
      toName: `${data.firstName} ${data.lastName}`,
      participantId,
      registrationNumber: data.registrationNumber,
      eventId: data.eventId,
      type: 'receipt',
      status: 'pending',
      attempts: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastAttemptAt: null,
      error: null,
      triggeredBy: 'admin'
    });

    await ref.update({
      emailRetries: firebase.firestore.FieldValue.increment(1),
      emailQueuedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  return { sendReceipt, resendFromAdmin };
})();
