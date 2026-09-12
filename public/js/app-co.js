// ============================================================
// app.js — Logique principale (Formulaire d'inscription)
// ============================================================

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const { db, storage, EVENT_CONFIG } = window.GRADAA;

  // Form Elements
  const form = document.getElementById('registration-form');
  const btnSubmit = document.getElementById('btn-submit-co');
  const btnSubmitText = document.getElementById('btn-submit-text');
  const btnSubmitSpinner = document.getElementById('btn-submit-spinner');
  const formAlert = document.getElementById('form-alert');
  const duplicateWarnings = {
    email: document.getElementById('email-duplicate'),
    phone: document.getElementById('phone-duplicate')
  };

  // Photo Upload Elements
  const photoInput = document.getElementById('photo');
  const photoDropZone = document.getElementById('photo-drop-zone');
  const photoPlaceholder = document.getElementById('photo-placeholder');
  const photoPreviewWrapper = document.getElementById('photo-preview-wrapper');
  const photoPreviewImg = document.getElementById('photo-preview-img');
  const photoFilename = document.getElementById('photo-filename');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');

  let selectedPhotoFile = null;

  // Utils
  function showAlert(msg, type = 'error') {
    formAlert.style.display = 'block';
    formAlert.className = `alert alert--${type}`;
    formAlert.innerHTML = `<span>${type === 'error' ? '❌' : '✅'}</span><span>${msg}</span>`;
  }

  function hideAlert() {
    formAlert.style.display = 'none';
  }

  function setLoading(isLoading) {
    btnSubmit.disabled = isLoading;
    btnSubmitText.style.display = isLoading ? 'none' : 'inline';
    btnSubmitSpinner.style.display = isLoading ? 'inline-block' : 'none';
  }

  async function generateRegistrationNumber() {
    const counterRef = db.collection('events').doc(EVENT_CONFIG.id);
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let newCount = 1;
      if (doc.exists && doc.data().participantCount) {
        newCount = doc.data().participantCount + 1;
      }
      transaction.set(counterRef, { participantCount: newCount }, { merge: true });
      return 'GRADA-' + String(newCount).padStart(4, '0');
    });
  }

  // ── Duplicate Checks (Email / Phone) ──
  async function checkDuplicate(field, value) {
    if (!value) return false;
    try {
      const snap = await db.collection('participants')
        .where('eventId', '==', EVENT_CONFIG.id)
        .where(field, '==', value)
        .limit(1)
        .get();
      return !snap.empty;
    } catch (e) {
      console.error('Error checking duplicate:', e);
      return false;
    }
  }

  let debounceTimer;
  ['email', 'phone'].forEach(field => {
    const input = document.getElementById(field);
    if (!input) return;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      duplicateWarnings[field].classList.remove('visible');

      const val = input.value.trim();
      if (val.length > 5) {
        debounceTimer = setTimeout(async () => {
          const isDup = await checkDuplicate(field, val);
          if (isDup) {
            duplicateWarnings[field].classList.add('visible');
          }
        }, 800);
      }
    });
  });


  // ── Photo Upload Logic ──
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    photoDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      photoDropZone.style.borderColor = 'var(--color-primary)';
      photoDropZone.style.background = 'var(--color-primary-xlight)';
    });

    photoDropZone.addEventListener('dragleave', () => {
      photoDropZone.style.borderColor = 'var(--color-border)';
      photoDropZone.style.background = 'var(--color-bg)';
    });

    photoDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      photoDropZone.style.borderColor = 'var(--color-border)';
      photoDropZone.style.background = 'var(--color-bg)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        photoInput.files = e.dataTransfer.files;
        handleFiles(e.dataTransfer.files);
      }
    });

    btnRemovePhoto.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent opening file dialog
      e.preventDefault();
      selectedPhotoFile = null;
      photoInput.value = '';
      photoPlaceholder.style.display = 'block';
      photoPreviewWrapper.classList.remove('visible');
    });
  }

  function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert("Veuillez sélectionner une image valide.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("La taille de l'image ne doit pas dépasser 5 Mo.");
      return;
    }

    selectedPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreviewImg.src = e.target.result;
      photoFilename.textContent = file.name;
      photoPlaceholder.style.display = 'none';
      photoPreviewWrapper.classList.add('visible');
    };
    reader.readAsDataURL(file);
  }

  // ── Form Submit (Wave) ──
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async (e) => {
      e.preventDefault();
      hideAlert();

      // Basics valid
      if (!form.checkValidity()) {
        showAlert("Veuillez remplir correctement tous les champs obligatoires (*). Vérifiez le format de votre email.");
        try { form.reportValidity(); } catch(e){}
        return;
      }

      setLoading(true);

      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const lastName = document.getElementById('lastName').value.trim().toUpperCase();
      const firstName = document.getElementById('firstName').value.trim();
      const commission = document.getElementById('commission').value;
      const profession = document.getElementById('profession').value.trim();

      try {
        // Double check duplicates to be absolutely sure
        const [dupEmail, dupPhone] = await Promise.all([
          checkDuplicate('email', email),
          checkDuplicate('phone', phone)
        ]);

        if (dupEmail || dupPhone) {
          showAlert("Un participant avec cet email ou ce numéro de téléphone existe déjà.");
          setLoading(false);
          return;
        }

        // --- MANUAL PAYMENT VIA WAVE ---
        try {
          const regNumber = await generateRegistrationNumber();
          const participantData = {
            eventId: EVENT_CONFIG.id,
            registrationNumber: regNumber,
            lastName: lastName,
            firstName: firstName,
            email: email,
            phone: phone,
            subCommittee: commission,
            profession: profession,
            role: 'CO',
            paymentStatus: 'pending',
            paymentAmount: 1000,
            registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
            checkedIn: false,
            checkedInAt: null,
            emailSent: false,
            photoUrl: null
          };

          // 1. Photo Upload (Optional)
          if (selectedPhotoFile) {
            const ext = selectedPhotoFile.name.split('.').pop();
            const storageRef = storage.ref(`events/${EVENT_CONFIG.id}/participants/${regNumber}.${ext}`);
            await storageRef.put(selectedPhotoFile);
            participantData.photoUrl = await storageRef.getDownloadURL();
          }

          // 2. Save to Firestore
          const docRef = await db.collection('participants').add(participantData);
          participantData.id = docRef.id;

          // 3. (RETIRED) PDF generation and Email sending is now deferred until admin validates payment.
          
          // 4. Redirect to Wave Payment Link in a new tab, and redirect current tab to receipt.html
          window.open("https://pay.wave.com/m/M_ci_PfwRIFakUd2H/c/ci/?amount=1000", "_blank");
          window.location.href = "receipt.html?id=" + docRef.id;

        } catch (err) {
          console.error("Erreur lors de l'enregistrement :", err);
          showAlert("Une erreur est survenue lors de l'enregistrement.");
          setLoading(false);
        }


      } catch (err) {
        console.error("Erreur d'inscription:", err);
        showAlert("Une erreur est survenue: " + (err.message || "Erreur inconnue"));
        setLoading(false);
      }
    });
  }

});
