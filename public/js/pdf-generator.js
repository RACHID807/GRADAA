// ============================================================
// pdf-generator.js — Génération du reçu PDF GRADA avec jsPDF
// ============================================================
// Librairie : jsPDF 2.x (CDN) + html2canvas pour le logo
// ============================================================

'use strict';

window.GradaPDF = (() => {

  // ── Couleurs AEEMCI ─────────────────────────────────────────
  const COLORS = {
    primary: [249, 115, 22],        // #F97316 orange
    primaryDark: [234, 88, 12],     // #EA580C
    secondary: [22, 163, 74],       // #16A34A vert
    white: [255, 255, 255],
    bg: [250, 250, 250],
    text: [26, 26, 26],             // #1A1A1A
    textMuted: [107, 114, 128],     // #6B7280
    border: [229, 231, 235],        // #E5E7EB
    lightOrange: [255, 247, 237],   // #FFF7ED
    lightGreen: [240, 253, 244],    // #F0FDF4
  };

  // ── Logo AEEMCI encodé en base64 (placeholder SVG) ─────────
  // NOTE: Remplacez cette string par le base64 réel du logo /assets/logo-aeemci.png
  // Pour convertir: ouvrez logo-aeemci.png → convertir en base64 → coller ici
  const LOGO_BASE64 = null; // Sera chargé dynamiquement

  async function getLogoBase64(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function getPhotoBase64(photoDataUrl) {
    if (!photoDataUrl) return null;
    if (photoDataUrl.startsWith('data:')) return photoDataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.naturalWidth, img.naturalHeight);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const offsetX = (img.naturalWidth - size) / 2;
        const offsetY = (img.naturalHeight - size) / 2;
        ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, -offsetX, -offsetY);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = photoDataUrl;
    });
  }

  // ── Helper to set color ─────────────────────────────────────
  function setFillColor(doc, rgb) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }
  function setTextColor(doc, rgb) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }
  function setDrawColor(doc, rgb) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  }

  // ── Main Generate Function ──────────────────────────────────
  async function generate(participant) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const W = 210; // A4 width mm
    const H = 297; // A4 height mm
    const margin = 15;
    const contentW = W - 2 * margin;

    // ── Background ──────────────────────────────────────────────
    setFillColor(doc, COLORS.white);
    doc.rect(0, 0, W, H, 'F');

    // ── Top decorative bar ──────────────────────────────────────
    setFillColor(doc, COLORS.primary);
    doc.rect(0, 0, W, 8, 'F');

    // ── Header Section ──────────────────────────────────────────
    setFillColor(doc, [26, 26, 26]);
    doc.rect(0, 8, W, 45, 'F');

    // Load and draw logos
    const aeemciLogoData = await getLogoBase64('assets/logo-aeemci.png');
    const gradaaLogoData = await getLogoBase64('assets/logo-gradaa.png');
    
    if (aeemciLogoData) {
      doc.addImage(aeemciLogoData, 'PNG', margin, 14, 22, 22);
    }

    if (gradaaLogoData) {
      doc.addImage(gradaaLogoData, 'PNG', W - margin - 22, 14, 22, 22);
    }

    // Text in the middle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setTextColor(doc, COLORS.white);
    doc.text('AEEMCI', W / 2, 20, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Association des Élèves et Étudiants Musulmans de Côte d\'Ivoire', W / 2, 25, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Secteur / Abidjan Nord', W / 2, 30, { align: 'center' });
    doc.text('Sous-comité 1 ET 2 d\'Anyama', W / 2, 35, { align: 'center' });

    // ── REÇU D'INSCRIPTION Badge ────────────────────────────────
    const badgeY = 56;
    setFillColor(doc, COLORS.lightOrange);
    doc.roundedRect(margin, badgeY, contentW, 14, 3, 3, 'F');
    setDrawColor(doc, COLORS.primary);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, badgeY, contentW, 14, 3, 3, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setTextColor(doc, COLORS.primaryDark);
    doc.text('REÇU D\'INSCRIPTION', W / 2, badgeY + 9, { align: 'center' });

    // ── Registration Number ─────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    setTextColor(doc, COLORS.primary);
    doc.text(participant.registrationNumber, W / 2, 86, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextColor(doc, COLORS.textMuted);
    doc.text('Numéro d\'inscription', W / 2, 92, { align: 'center' });

    // ── Separating line ─────────────────────────────────────────
    setDrawColor(doc, COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(margin, 96, W - margin, 96);

    // ── Participant Info Section ─────────────────────────────────
    let currentY = 103;

    // Photo if available
    if (participant.photoDataUrl || participant.photoUrl) {
      const photoSrc = participant.photoDataUrl || participant.photoUrl;
      const photoBase64 = await getPhotoBase64(photoSrc);
      if (photoBase64) {
        doc.addImage(photoBase64, 'PNG', W - margin - 28, 97, 28, 28, undefined, 'FAST');
      }
    }

    // Section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(doc, COLORS.secondary);
    doc.text('INFORMATIONS DU PARTICIPANT', margin, currentY);
    currentY += 5;

    setDrawColor(doc, COLORS.secondary);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, margin + 60, currentY);
    currentY += 7;

    // Info rows
    const infoRows = [
      { label: 'Nom complet', value: `${participant.firstName} ${participant.lastName}` },
      { label: 'Adresse email', value: participant.email },
      { label: 'Téléphone', value: participant.phone },
      { label: 'Sous-comité', value: participant.subCommittee || 'Non renseigné' },
      { label: 'Profession', value: participant.profession || 'Non renseigné' },
    ];

    infoRows.forEach((row, i) => {
      if (i % 2 === 0) {
        setFillColor(doc, COLORS.bg);
        doc.rect(margin, currentY - 4, contentW, 10, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setTextColor(doc, COLORS.textMuted);
      doc.text(row.label, margin + 3, currentY + 2);

      doc.setFont('helvetica', 'normal');
      setTextColor(doc, COLORS.text);
      doc.text(row.value, margin + 55, currentY + 2);

      currentY += 10;
    });

    currentY += 5;

    // ── Event Info Section ──────────────────────────────────────
    setDrawColor(doc, COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, W - margin, currentY);
    currentY += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(doc, COLORS.primary);
    doc.text('DÉTAILS DE L\'ACTIVITÉ', margin, currentY);
    currentY += 5;

    setDrawColor(doc, COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, margin + 55, currentY);
    currentY += 7;

    const eventRows = [
      { label: 'Nom de l\'activité', value: "GRADAA 2026 — Grand Rassemblement des Aeemcistes d'Anyama" },
      { label: 'Date', value: '4 octobre 2026' },
      { label: 'Lieu', value: 'Anyama, Côte d\'Ivoire' },
      { label: 'Organisateur', value: 'Sous-comité 1-2 Anyama de l\'AEEMCI' },
      { label: 'Participation', value: 'Gratuite' },
    ];

    eventRows.forEach((row, i) => {
      if (i % 2 === 0) {
        setFillColor(doc, COLORS.lightOrange);
        doc.rect(margin, currentY - 4, contentW, 10, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setTextColor(doc, COLORS.textMuted);
      doc.text(row.label, margin + 3, currentY + 2);

      doc.setFont('helvetica', 'normal');
      setTextColor(doc, COLORS.text);
      doc.text(row.value, margin + 55, currentY + 2, { maxWidth: contentW - 57 });

      currentY += 10;
    });

    // ── Date d'inscription ──────────────────────────────────────
    currentY += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    setTextColor(doc, COLORS.textMuted);
    const now = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Inscription enregistrée le ${now}`, margin, currentY);

    // ── Green Success Banner ────────────────────────────────────
    currentY += 10;
    setFillColor(doc, COLORS.lightGreen);
    doc.roundedRect(margin, currentY, contentW, 18, 3, 3, 'F');
    setDrawColor(doc, COLORS.secondary);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, currentY, contentW, 18, 3, 3, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setTextColor(doc, COLORS.secondary);
    doc.text('✓ Inscription confirmée', W / 2, currentY + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextColor(doc, [21, 128, 61]);
    doc.text('Présentez ce reçu le jour de l\'activité pour valider votre présence.', W / 2, currentY + 13, { align: 'center' });

    // ── Bottom decorative bars ──────────────────────────────────
    setFillColor(doc, COLORS.secondary);
    doc.rect(0, H - 8, W * 0.5, 8, 'F');
    setFillColor(doc, COLORS.primary);
    doc.rect(W * 0.5, H - 8, W * 0.5, 8, 'F');

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTextColor(doc, COLORS.textMuted);
    doc.text('AEEMCI — Association des Élèves et Étudiants Musulmans de Côte d\'Ivoire', W / 2, H - 11, { align: 'center' });

    // ── Return as Blob ──────────────────────────────────────────
    return doc.output('blob');
  }

  return { generate };
})();
