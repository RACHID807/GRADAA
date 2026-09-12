// ============================================================
// checkin.js — Logique du Check-in (Jour J)
// ============================================================

'use strict';

function initCheckin() {
  const { db, EVENT_CONFIG } = window.GRADAA;

  // Screens
  const screenQuestion = document.getElementById('screen-question');
  const screenVerify = document.getElementById('screen-verify');
  const screenConfirmed = document.getElementById('screen-confirmed');
  const screenNotFound = document.getElementById('screen-not-found');
  const screenOffline = document.getElementById('screen-offline');

  // Elements
  const verifyAlert = document.getElementById('verify-alert');
  const btnVerify = document.getElementById('btn-verify');
  const btnVerifyText = document.getElementById('btn-verify-text');
  const btnVerifySpinner = document.getElementById('btn-verify-spinner');
  
  // Data of current scanned/checked-in participant
  let currentParticipant = null;

  // ── Connection Monitoring ──
  window.addEventListener('online', () => {
    document.getElementById('offline-banner').classList.remove('visible');
    if (screenOffline && screenOffline.classList.contains('active')) {
      showScreen(screenQuestion);
    }
  });
  
  window.addEventListener('offline', () => {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.classList.add('visible');
  });

  function isOffline() {
    return !navigator.onLine;
  }

  // ── Navigation ──
  function showScreen(screenEl) {
    if (!screenEl) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screenEl.classList.add('active');
  }

  // Question Screen Actions
  const btnYes = document.getElementById('btn-yes');
  if (btnYes) {
    btnYes.addEventListener('click', () => {
      showScreen(screenVerify);
    });
  }
  
  const btnNo = document.getElementById('btn-no');
  if (btnNo) {
    btnNo.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  const btnBack = document.getElementById('btn-back-to-question');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      showScreen(screenQuestion);
    });
  }

  const btnTryAgain = document.getElementById('btn-try-again');
  if (btnTryAgain) {
    btnTryAgain.addEventListener('click', () => {
      showScreen(screenVerify);
    });
  }

  const btnRetryConn = document.getElementById('btn-retry-connection');
  if (btnRetryConn) {
    btnRetryConn.addEventListener('click', () => {
      if (!isOffline()) showScreen(screenQuestion);
    });
  }


  // ── Verification Logic ──
  function setVerifyLoading(isLoading) {
    if (!btnVerify) return;
    btnVerify.disabled = isLoading;
    if (btnVerifyText) btnVerifyText.style.display = isLoading ? 'none' : 'inline';
    if (btnVerifySpinner) btnVerifySpinner.style.display = isLoading ? 'inline-block' : 'none';
  }

  function showVerifyAlert(msg, type='error') {
    if (!verifyAlert) return;
    verifyAlert.style.display = 'block';
    verifyAlert.className = `alert alert--${type}`;
    verifyAlert.innerHTML = `<span>${type==='error'?'❌':'⚠️'}</span><span>${msg}</span>`;
  }

  function hideVerifyAlert() {
    if (verifyAlert) verifyAlert.style.display = 'none';
  }

  if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
      if (isOffline()) {
        showScreen(screenOffline);
        return;
      }

      hideVerifyAlert();
      const emailInput = document.getElementById('verify-email');
      const phoneInput = document.getElementById('verify-phone');
      
      const email = emailInput ? emailInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';

      if (!email && !phone) {
        showVerifyAlert("Veuillez saisir votre e-mail ou votre numéro de téléphone.");
        return;
      }

      setVerifyLoading(true);

      try {
        let query = db.collection('participants').where('eventId', '==', EVENT_CONFIG.id);
        
        let snap;
        if (email) {
          snap = await query.where('email', '==', email).limit(1).get();
        } 
        if ((!snap || snap.empty) && phone) {
          snap = await query.where('phone', '==', phone).limit(1).get();
        }

        if (!snap || snap.empty) {
          showScreen(screenNotFound);
          setVerifyLoading(false);
          return;
        }

        const doc = snap.docs[0];
        currentParticipant = { id: doc.id, ...doc.data() };

        // Update checkin status in Firestore if not already checked in
        if (!currentParticipant.checkedIn) {
          await db.collection('participants').doc(doc.id).update({
            checkedIn: true,
            checkedInAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        // Show Confirmed Screen
        document.getElementById('confirmed-name').textContent = `${currentParticipant.firstName} ${currentParticipant.lastName}`;
        document.getElementById('confirmed-regnum').textContent = currentParticipant.registrationNumber;
        document.getElementById('confirmed-email').textContent = currentParticipant.email;
        document.getElementById('confirmed-subcommittee').textContent = currentParticipant.subCommittee || 'Non renseigné';
        
        showScreen(screenConfirmed);

      } catch (err) {
        console.error("Erreur de vérification :", err);
        showVerifyAlert("Une erreur réseau est survenue. Veuillez réessayer.");
      }

      setVerifyLoading(false);
    });
  }

  // ── Confirmed Screen Actions ──
  const btnRedownload = document.getElementById('btn-redownload-receipt');
  if (btnRedownload) {
    btnRedownload.addEventListener('click', async () => {
      if (!currentParticipant) return;
      try {
        const pdfBlob = await window.GradaPDF.generate({
          ...currentParticipant,
          eventDate: EVENT_CONFIG.dateDisplay,
          eventName: EVENT_CONFIG.fullName,
          eventLocation: EVENT_CONFIG.location,
          eventOrganizer: EVENT_CONFIG.organizer
        });
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recu-GRADAA-2026-${currentParticipant.registrationNumber}.pdf`;
        a.click();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la génération du PDF.");
      }
    });
  }

  const btnResendCheckin = document.getElementById('btn-resend-email-checkin');
  if (btnResendCheckin) {
    btnResendCheckin.addEventListener('click', async () => {
      if (!currentParticipant) return;
      btnResendCheckin.disabled = true;
      btnResendCheckin.textContent = 'Envoi en cours...';
      try {
        await window.GradaEmail.resendFromAdmin(currentParticipant.id);
        alert("Email renvoyé avec succès !");
        btnResendCheckin.textContent = '📧 Renvoyer le reçu par email';
      } catch(err) {
        alert("Erreur de l'envoi. Veuillez réessayer.");
        btnResendCheckin.textContent = '📧 Renvoyer le reçu par email';
      }
      btnResendCheckin.disabled = false;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckin);
} else {
  initCheckin();
}
