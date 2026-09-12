// ============================================================
// qr-generator.js — Génération du QR Code GRADA
// ============================================================
// Utilisé en standalone pour générer le QR code du panneau
// ============================================================

'use strict';

window.GradaQR = (() => {

  // ── Generate QR Code ────────────────────────────────────────
  function generate(targetElementId, url, options = {}) {
    const defaultOpts = {
      width: options.width || 300,
      height: options.height || 300,
      colorDark: options.colorDark || '#1A1A1A',
      colorLight: options.colorLight || '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H,
      ...options
    };

    const container = document.getElementById(targetElementId);
    if (!container) return;
    container.innerHTML = '';

    new QRCode(container, {
      text: url,
      ...defaultOpts
    });
  }

  // ── Download QR as PNG ──────────────────────────────────────
  async function download(targetElementId, filename = 'qr-checkin-GRADA-2026.png') {
    const container = document.getElementById(targetElementId);
    if (!container) return;

    const canvas = container.querySelector('canvas');
    const img = container.querySelector('img');

    let dataUrl;
    if (canvas) {
      dataUrl = canvas.toDataURL('image/png');
    } else if (img) {
      dataUrl = img.src;
    } else {
      return;
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return { generate, download };
})();
