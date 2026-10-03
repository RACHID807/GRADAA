'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const btnShowResume = document.getElementById('btn-show-resume');
    const resumeFormContainer = document.getElementById('resume-form-container');
    const resumeForm = document.getElementById('resume-form');
    const emailInput = document.getElementById('email');
    const formAlert = document.getElementById('form-alert');
    const btnSubmit = document.getElementById('btn-submit-resume');
    const btnSubmitText = document.getElementById('btn-submit-text');
    const btnSubmitSpinner = document.getElementById('btn-submit-spinner');

    const { db, EVENT_CONFIG } = window.GRADAA;

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

    btnShowResume.addEventListener('click', () => {
        resumeFormContainer.style.display = 'block';
        emailInput.focus();
        window.scrollTo({
            top: resumeFormContainer.offsetTop,
            behavior: 'smooth'
        });
    });

    resumeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();
        
        const email = emailInput.value.trim();
        if(!email) return;

        setLoading(true);

        try {
            const snap = await db.collection('participants')
                .where('eventId', '==', EVENT_CONFIG.id)
                .where('email', '==', email)
                .where('role', '==', 'AINE')
                .limit(1)
                .get();

            if (snap.empty) {
                showAlert("Aucune inscription trouvée avec cet e-mail. Veuillez faire une nouvelle inscription.");
                setLoading(false);
                return;
            }

            const doc = snap.docs[0];
            const data = doc.data();

            if (data.paymentStatus === 'paid') {
                showAlert("Votre paiement a déjà été validé ! Vous devriez avoir reçu votre reçu par email.", "success");
            } else if (data.paymentStatus === 'pending') {
                // Au lieu d'ouvrir automatiquement (ce qui est bloqué par les bloqueurs de pop-up), on crée un bouton de paiement
                const waveLink = "https://pay.wave.com/m/M_ci_PfwRIFakUd2H/c/ci/";
                
                formAlert.style.display = 'block';
                formAlert.className = `alert alert--info`;
                formAlert.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap: 15px;">
                        <span><strong>Votre inscription a été retrouvée !</strong><br>Il ne vous reste plus qu'à finaliser votre contribution de ${data.paymentAmount} FCFA.</span>
                        <a href="${waveLink}" target="_blank" onclick="setTimeout(() => { window.location.href = 'receipt.html?id=${doc.id}' }, 1000)" class="btn btn--primary" style="width: 100%; text-decoration: none;">
                            💳 Procéder au paiement (Wave)
                        </a>
                    </div>
                `;
            } else {
                showAlert(`Le statut de votre paiement est : ${data.paymentStatus}. Veuillez contacter un administrateur.`);
            }

        } catch (error) {
            console.error("Erreur:", error);
            showAlert("Une erreur s'est produite lors de la vérification. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    });
});
