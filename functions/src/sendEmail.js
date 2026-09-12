// ============================================================
// functions/src/sendEmail.js — Service d'envoi d'email via Brevo
// ============================================================
// Brevo (ex-Sendinblue) : free tier 300 emails/jour
// Variables d'environnement requises :
//   BREVO_API_KEY  → Clé API Brevo (Settings > API Keys)
//   SENDER_EMAIL   → Email expéditeur vérifié sur Brevo
//   SENDER_NAME    → Nom expéditeur (ex: "AEEMCI GRADA 2026")
// ============================================================

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const axios = require('axios');

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 60000; // 1 minute

// ── Send email via Brevo API ────────────────────────────────
async function sendViaBrevo(to, toName, subject, htmlContent) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL || 'noreply@aeemci.ci';
  const senderName = process.env.SENDER_NAME || 'AEEMCI — GRADA 2026';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY non configurée. Voir README.md');
  }

  const response = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent
    },
    {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  return response.data;
}

// ── Build email HTML ────────────────────────────────────────
function buildEmailHtml(participant) {
  const {
    firstName, lastName, registrationNumber,
    email, phone, subCommittee, profession, type
  } = participant;

  let title = "Reçu GRADA 2026";
  let introText = `Votre inscription au <strong>GRADA 2026</strong> a été enregistrée avec succès ! Nous avons le plaisir de vous compter parmi les participants à ce rassemblement.`;
  let bannerText = `✓ Inscription confirmée — Présentez ce reçu le jour de l'activité`;

  if (type === 'reminder_j3') {
    title = "J-3 avant le GRADAA 2026 !";
    introText = `Le <strong>GRADAA 2026</strong> approche à grands pas ! Il ne reste plus que 3 jours. Préparez-vous et n'oubliez pas d'apporter votre reçu (QR code) le jour J.`;
    bannerText = `⏳ J-3 : Nous avons hâte de vous retrouver !`;
  } else if (type === 'reminder_j1') {
    title = "C'est demain ! GRADAA 2026";
    introText = `C'est le grand jour demain ! Le <strong>GRADAA 2026</strong> vous ouvre ses portes. Assurez-vous d'avoir votre reçu à portée de main.`;
    bannerText = `⏰ C'est demain ! Soyez à l'heure au rendez-vous.`;
  }

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #F3F4F6; }
    .wrapper { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1A1A1A, #2D2D2D); padding: 40px 32px; text-align: center; }
    .header h1 { color: #F97316; font-size: 2rem; margin: 0 0 8px; }
    .header p { color: #9CA3AF; margin: 0; font-size: 0.9rem; }
    .badge { display: inline-block; background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.4); color: #FED7AA; padding: 6px 16px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
    .body { padding: 32px; }
    .greeting { font-size: 1.1rem; color: #1A1A1A; margin-bottom: 8px; }
    .intro { color: #6B7280; margin-bottom: 24px; font-size: 0.95rem; }
    .reg-number { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .reg-number .label { font-size: 0.8rem; color: #9A3412; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .reg-number .value { font-size: 1.6rem; font-weight: 800; color: #F97316; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #F9FAFB; padding: 12px 16px; text-align: left; font-size: 0.75rem; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; border-bottom: 1px solid #E5E7EB; }
    td { padding: 12px 16px; border-bottom: 1px solid #F9FAFB; font-size: 0.9rem; color: #1A1A1A; }
    tr:last-child td { border-bottom: none; }
    .success-banner { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 16px; text-align: center; color: #15803D; font-weight: 600; margin-bottom: 24px; }
    .cta { text-align: center; margin-bottom: 24px; }
    .cta a { display: inline-block; background: #F97316; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 1rem; }
    .note { background: #EFF6FF; border-left: 4px solid #2563EB; padding: 14px 16px; border-radius: 0 8px 8px 0; font-size: 0.85rem; color: #1E40AF; margin-bottom: 24px; }
    .footer { background: #1A1A1A; padding: 24px 32px; text-align: center; }
    .footer p { color: #6B7280; font-size: 0.8rem; margin: 4px 0; }
    .footer a { color: #FED7AA; text-decoration: none; }
    .divider { border: none; border-top: 1px solid #F9FAFB; margin: 8px 0; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="badge">AEEMCI — Sous-comité 1-2 Anyama</div>
    <h1>GRADA 2026</h1>
    <p>Grand Rassemblement Des Anciens — 4 octobre 2026</p>
  </div>

  <div class="body">
    <p class="greeting">Salam, <strong>${firstName} ${lastName}</strong> 👋</p>
    <p class="intro">
      ${introText}
    </p>

    <div class="reg-number">
      <div class="label">Votre numéro d'inscription</div>
      <div class="value">${registrationNumber}</div>
    </div>

    <table>
      <thead><tr><th colspan="2">Vos informations</th></tr></thead>
      <tbody>
        <tr><td style="color:#6B7280;">Nom complet</td><td><strong>${firstName} ${lastName}</strong></td></tr>
        <tr><td style="color:#6B7280;">Email</td><td>${email}</td></tr>
        <tr><td style="color:#6B7280;">Téléphone</td><td>${phone}</td></tr>
        <tr><td style="color:#6B7280;">Sous-comité</td><td>${subCommittee || 'Non renseigné'}</td></tr>
        <tr><td style="color:#6B7280;">Profession</td><td>${profession || 'Non renseigné'}</td></tr>
      </tbody>
    </table>

    <table>
      <thead><tr><th colspan="2">Détails de l'activité</th></tr></thead>
      <tbody>
        <tr><td style="color:#6B7280;">Activité</td><td><strong>GRADA 2026</strong></td></tr>
        <tr><td style="color:#6B7280;">Date</td><td><strong>4 octobre 2026</strong></td></tr>
        <tr><td style="color:#6B7280;">Lieu</td><td>Anyama, Côte d'Ivoire</td></tr>
        <tr><td style="color:#6B7280;">Organisateur</td><td>Sous-comité 1-2 Anyama de l'AEEMCI</td></tr>
        <tr><td style="color:#6B7280;">Participation</td><td><strong style="color:#16A34A;">Gratuite ✓</strong></td></tr>
      </tbody>
    </table>

    <div class="success-banner">
      ${bannerText}
    </div>

    <div class="note">
      <strong>ℹ️ Le jour J :</strong> Scannez le QR code à l'entrée de la salle pour valider votre présence.
      Si vous avez perdu ce reçu, rendez-vous sur la page de check-in et saisissez votre email ou téléphone.
    </div>

    <p style="color:#6B7280;font-size:0.85rem;text-align:center;">
      Baraka Allah ou fikoum — Nous vous souhaitons une excellente journée le 4 octobre 2026 !
    </p>
  </div>

  <div class="footer">
    <p><strong style="color:#F97316;">AEEMCI</strong> — Sous-comité 1-2 Anyama</p>
    <p>Association des Élèves et Étudiants Musulmans de Côte d'Ivoire</p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.05);margin:12px 0;" />
    <p>Cet email a été envoyé automatiquement. Ne pas répondre.</p>
  </div>
</div>
</body>
</html>`;
}

// ── Process email queue ────────────────────────────────────
async function processEmailQueue() {
  const db = getFirestore();
  const now = Timestamp.now();

  const snapshot = await db.collection('emailQueue')
    .where('status', '==', 'pending')
    .limit(50) // Process max 50 per run to avoid timeout
    .get();

  if (snapshot.empty) {
    console.log('Email queue empty.');
    return;
  }

  console.log(`Processing ${snapshot.size} queued emails…`);
  let sent = 0, failed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const ref = doc.ref;

    // Skip if max attempts reached
    if ((data.attempts || 0) >= MAX_ATTEMPTS) {
      continue;
    }

    // Skip if not enough time has passed since last attempt
    if (data.lastAttemptAt) {
      const lastAttempt = data.lastAttemptAt.toMillis();
      if (now.toMillis() - lastAttempt < RETRY_DELAY_MS * data.attempts) {
        continue;
      }
    }

    // Fetch participant if not embedded
    let participant = data;
    if (data.participantId && !data.firstName) {
      try {
        const pDoc = await db.collection('participants').doc(data.participantId).get();
        if (pDoc.exists) participant = { ...data, ...pDoc.data() };
      } catch (err) {
        console.error(`Failed to fetch participant ${data.participantId}:`, err);
      }
    }

    try {
      const html = buildEmailHtml(participant);
      await sendViaBrevo(
        participant.to || participant.email,
        participant.toName || `${participant.firstName} ${participant.lastName}`,
        `GRADA 2026 — Reçu d'inscription ${participant.registrationNumber}`,
        html
      );

      // Mark as sent
      await ref.update({
        status: 'sent',
        sentAt: FieldValue.serverTimestamp(),
        attempts: FieldValue.increment(1),
        error: null
      });

      // Update participant
      if (data.participantId) {
        await db.collection('participants').doc(data.participantId).update({
          emailSent: true,
          emailSentAt: FieldValue.serverTimestamp()
        });
      }

      sent++;
      console.log(`✅ Email sent to ${participant.to || participant.email}`);
    } catch (err) {
      const attempts = (data.attempts || 0) + 1;
      await ref.update({
        attempts: FieldValue.increment(1),
        lastAttemptAt: FieldValue.serverTimestamp(),
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        error: err.message
      });
      failed++;
      console.error(`❌ Email failed for ${data.to}: ${err.message}`);
    }
  }

  console.log(`Queue processed: ${sent} sent, ${failed} failed.`);
}

module.exports = { processEmailQueue, sendViaBrevo, buildEmailHtml };
