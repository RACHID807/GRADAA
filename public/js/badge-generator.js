// ============================================================
// badge-generator.js — Génération de Badges (A4) avec jsPDF
// ============================================================

'use strict';

window.GradaBadge = (() => {

  const COLORS = {
    primary: [249, 115, 22],        // Orange
    primaryDark: [234, 88, 12],
    secondary: [22, 163, 74],       // Green
    white: [255, 255, 255],
    bg: [250, 250, 250],
    text: [26, 26, 26],             // Dark
    textMuted: [107, 114, 128],     // Gray
    coDark: [31, 41, 55],           // Very Dark Gray for CO badges
    border: [229, 231, 235],
  };

  const BADGE_W = 60;
  const BADGE_H = 95;
  const COLUMNS = 3;
  const ROWS = 3;
  const MARGIN_X = 15;
  const MARGIN_Y = 6;

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

  async function generateQRCodeBase64(text) {
    return new Promise((resolve) => {
      const div = document.createElement('div');
      // QRCode is loaded from CDN in admin.html
      new window.QRCode(div, { text: text, width: 200, height: 200, colorDark: "#1A1A1A", colorLight: "#ffffff" });
      setTimeout(() => {
        const canvas = div.querySelector('canvas');
        if (canvas) resolve(canvas.toDataURL('image/png'));
        else resolve(null);
      }, 50);
    });
  }

  function setFillColor(doc, rgb) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
  function setTextColor(doc, rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }
  function setDrawColor(doc, rgb) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }

  async function drawBadge(doc, participant, x, y, isCO, logos) {
    // 1. Outline
    setDrawColor(doc, COLORS.border);
    doc.setLineWidth(0.2);
    if (isCO) {
      setFillColor(doc, COLORS.coDark);
    } else {
      setFillColor(doc, COLORS.white);
    }
    doc.roundedRect(x, y, BADGE_W, BADGE_H, 2, 2, 'FD');

    // 2. Top bar (Orange)
    setFillColor(doc, COLORS.primary);
    doc.roundedRect(x, y, BADGE_W, 6, 2, 2, 'F');
    // Hide bottom corners of the top bar to make it flat at bottom
    doc.rect(x, y + 4, BADGE_W, 2, 'F');

    // Logos
    if (logos.aeemci) doc.addImage(logos.aeemci, 'PNG', x + 2, y + 8, 10, 10);
    if (logos.gradaa) doc.addImage(logos.gradaa, 'PNG', x + BADGE_W - 12, y + 8, 10, 10);

    // Event Title
    if (logos.gradaaBadge) {
      doc.addImage(logos.gradaaBadge, 'PNG', x + BADGE_W / 2 - 16, y + 8, 32, 10);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setTextColor(doc, isCO ? COLORS.white : COLORS.text);
      doc.text('GRADAA 2026', x + BADGE_W / 2, y + 12, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('ANYAMA', x + BADGE_W / 2, y + 15, { align: 'center' });
    }

    // Photo
    const photoY = y + 20;
    const photoSize = 24;
    const photoX = x + (BADGE_W - photoSize) / 2;
    
    // Draw placeholder circle
    setFillColor(doc, isCO ? [55, 65, 81] : COLORS.bg);
    doc.circle(photoX + photoSize/2, photoY + photoSize/2, photoSize/2, 'F');
    
    let photoLoaded = false;
    if (participant.photoDataUrl || participant.photoUrl) {
      const photoBase64 = await getPhotoBase64(participant.photoDataUrl || participant.photoUrl);
      if (photoBase64) {
        doc.addImage(photoBase64, 'PNG', photoX, photoY, photoSize, photoSize);
        photoLoaded = true;
      }
    }

    if (!photoLoaded) {
      // Initials
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setTextColor(doc, isCO ? COLORS.white : COLORS.textMuted);
      const initials = (participant.firstName.charAt(0) + participant.lastName.charAt(0)).toUpperCase();
      doc.text(initials, photoX + photoSize/2, photoY + photoSize/2 + 3, { align: 'center' });
    }

    // Name
    const nameY = photoY + photoSize + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setTextColor(doc, isCO ? COLORS.white : COLORS.text);
    const fullName = `${participant.firstName.split(' ')[0]} ${participant.lastName}`.toUpperCase();
    doc.text(fullName, x + BADGE_W / 2, nameY, { align: 'center', maxWidth: BADGE_W - 4 });

    // Role / Profession
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    if (isCO) {
      setTextColor(doc, COLORS.primary);
      doc.text('MEMBRE CO', x + BADGE_W / 2, nameY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setTextColor(doc, [209, 213, 219]); // light gray
      doc.text(participant.subCommittee || 'Commission', x + BADGE_W / 2, nameY + 9, { align: 'center', maxWidth: BADGE_W - 4 });
    } else {
      setTextColor(doc, COLORS.textMuted);
      const roleText = participant.profession ? participant.profession.toUpperCase() : 'PARTICIPANT';
      doc.text(roleText, x + BADGE_W / 2, nameY + 5, { align: 'center', maxWidth: BADGE_W - 4 });
    }

    // QR Code
    const qrText = JSON.stringify({ id: participant.id, source: 'gradaa' });
    const qrBase64 = await generateQRCodeBase64(qrText);
    const qrSize = 18;
    const qrY = nameY + 12;
    if (qrBase64) {
      if (isCO) {
        // White background for QR code so it can be scanned easily on dark badge
        setFillColor(doc, COLORS.white);
        doc.rect(x + (BADGE_W - qrSize - 2) / 2, qrY - 1, qrSize + 2, qrSize + 2, 'F');
      }
      doc.addImage(qrBase64, 'PNG', x + (BADGE_W - qrSize) / 2, qrY, qrSize, qrSize);
    }

    // Bottom strip
    if (isCO) {
      setFillColor(doc, COLORS.primary);
      doc.roundedRect(x, y + BADGE_H - 4, BADGE_W, 4, 2, 2, 'F');
      doc.rect(x, y + BADGE_H - 4, BADGE_W, 2, 'F');
    }
  }

  async function generateBadges(participants, isCO = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const logos = {
      aeemci: await getLogoBase64('logo_aeemci_v2.png'),
      gradaa: await getLogoBase64('assets/logo-gradaa.png'),
      gradaaBadge: await getLogoBase64('assets/logo-gradaa-badge.png')
    };

    let count = 0;
    
    for (let i = 0; i < participants.length; i++) {
      if (count > 0 && count % (COLUMNS * ROWS) === 0) {
        doc.addPage();
      }

      const pageIndex = count % (COLUMNS * ROWS);
      const col = pageIndex % COLUMNS;
      const row = Math.floor(pageIndex / COLUMNS);

      const x = MARGIN_X + col * BADGE_W;
      const y = MARGIN_Y + row * BADGE_H;

      await drawBadge(doc, participants[i], x, y, isCO, logos);
      count++;
    }

    if (count === 0) {
      doc.text("Aucun participant trouvé pour cette catégorie.", 20, 20);
    }

    return doc.output('blob');
  }

  return {
    generateParticipants: (list) => generateBadges(list, false),
    generateCO: (list) => generateBadges(list, true)
  };
})();
