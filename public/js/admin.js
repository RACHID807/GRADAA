// ============================================================
// admin.js â€” Logique du tableau de bord GRADA
// ============================================================

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const { db, auth, EVENT_CONFIG } = window.GRADAA;

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let allParticipants = [];
  let filteredParticipants = [];
  let currentPage = 1;
  const PAGE_SIZE = 20;
  let unsubscribeListener = null;
  let chartRegistrations = null;
  let chartSubcommittees = null;
  let chartPresence = null;
  let currentSection = 'overview';

  // â”€â”€ Auth Guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'admin-login.html';
      return;
    }
    const adminDoc = await db.collection('admins').doc(user.uid).get();
    if (!adminDoc.exists) {
      await auth.signOut();
      window.location.href = 'admin-login.html';
      return;
    }

    // Set user info in sidebar
    document.getElementById('user-email').textContent = user.email;
    const initials = (user.email || 'A').charAt(0).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;

    // Initialize app
    initApp();
  });

  // â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icons = { success: 'âœ…', error: 'âŒ', info: 'â„¹ï¸', warning: 'âš ï¸' };
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'â€”';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDateShort(timestamp) {
    if (!timestamp) return 'â€”';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return 'â€”';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function showSection(name) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.sidebar__nav-item').forEach(i => i.classList.remove('active'));

    const section = document.getElementById(`section-${name}`);
    const navItem = document.getElementById(`nav-${name}`);
    if (section) section.style.display = 'block';
    if (navItem) navItem.classList.add('active');

    currentSection = name;

    const titles = {
      overview: 'ðŸ“Š Vue d\'ensemble',
      participants: 'ðŸ‘¥ Participants',
      checkin: 'âœ… Check-in â€” Jour J',
      qrcode: 'ðŸ”³ QR Code d\'accÃ¨s',
      export: 'ðŸ“¥ Export des donnÃ©es'
    };
    document.getElementById('page-title').textContent = titles[name] || '';

    if (name === 'qrcode') initQRCode();
    if (name === 'checkin') updateCheckinSection();
  }

  document.querySelectorAll('.sidebar__nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      showSection(section);
      // Close sidebar on mobile
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').style.display = 'none';
    });
  });

  // Mobile sidebar
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (unsubscribeListener) unsubscribeListener();
    await auth.signOut();
    window.location.href = 'admin-login.html';
  });

  // â”€â”€ Init App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function initApp() {
    setupRealtimeListener();
  }

  // â”€â”€ Realtime Listener â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function setupRealtimeListener() {
    if (unsubscribeListener) unsubscribeListener();

    unsubscribeListener = db.collection('participants')
      .where('eventId', '==', EVENT_CONFIG.id)
      .orderBy('registeredAt', 'desc')
      .onSnapshot((snapshot) => {
        allParticipants = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        document.getElementById('loading-overlay').style.display = 'none';
        showSection('overview');

        updateKPIs();
        updateCharts();
        updateRecentTable();
        applyFilters();
      }, (err) => {
        console.error('Listener error:', err);
        document.getElementById('loading-overlay').innerHTML = `
          <div class="alert alert--error">
            <span>âŒ Erreur de chargement des donnÃ©es. VÃ©rifiez vos permissions Firestore.</span>
          </div>`;
      });
  }

  // â”€â”€ KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function updateKPIs() {
    const total = allParticipants.length;
    const checkedIn = allParticipants.filter(p => p.checkedIn).length;
    const emailsSent = allParticipants.filter(p => p.emailSent).length;
    const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-checkedin').textContent = checkedIn;
    document.getElementById('kpi-rate').textContent = `${rate}%`;
    document.getElementById('kpi-emails').textContent = emailsSent;

    document.getElementById('kpi-total-sub').textContent = `Sur ${EVENT_CONFIG.dateDisplay}`;
    document.getElementById('kpi-checkedin-sub').textContent = `${total - checkedIn} non arrivÃ©s`;
    document.getElementById('kpi-emails-sub').textContent = `${total - emailsSent} en attente`;
  }

  // â”€â”€ Charts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function updateCharts() {
    updateRegistrationsChart();
    updateSubcommitteesChart();
  }

  function updateRegistrationsChart() {
    // Group registrations by day
    const byDay = {};
    allParticipants.forEach(p => {
      if (!p.registeredAt) return;
      const date = p.registeredAt.toDate ? p.registeredAt.toDate() : new Date(p.registeredAt);
      const key = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      byDay[key] = (byDay[key] || 0) + 1;
    });

    // Sort dates
    const sortedDates = Object.keys(byDay).sort((a, b) => {
      const [da, ma] = a.split('/').map(Number);
      const [db2, mb] = b.split('/').map(Number);
      return (ma * 31 + da) - (mb * 31 + db2);
    });

    // Cumulative
    let cumulative = 0;
    const cumulativeData = sortedDates.map(d => {
      cumulative += byDay[d];
      return cumulative;
    });

    const ctx = document.getElementById('chart-registrations').getContext('2d');
    if (chartRegistrations) chartRegistrations.destroy();

    chartRegistrations = new Chart(ctx, {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: [{
          label: 'Inscriptions cumulÃ©es',
          data: cumulativeData,
          borderColor: '#F97316',
          backgroundColor: 'rgba(249,115,22,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#F97316',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1A1A',
            titleColor: '#F97316',
            bodyColor: '#E5E7EB',
            padding: 10
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6B7280', font: { size: 11 } } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: '#6B7280', font: { size: 11 } },
            grid: { color: '#F3F4F6' }
          }
        }
      }
    });
  }

  function updateSubcommitteesChart() {
    const counts = { 'Anyama 1': 0, 'Anyama 2': 0, 'Non renseignÃ©': 0 };
    allParticipants.forEach(p => {
      const sc = p.subCommittee;
      if (sc === 'Anyama 1') counts['Anyama 1']++;
      else if (sc === 'Anyama 2') counts['Anyama 2']++;
      else counts['Non renseignÃ©']++;
    });

    const ctx = document.getElementById('chart-subcommittees').getContext('2d');
    if (chartSubcommittees) chartSubcommittees.destroy();

    chartSubcommittees = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ['#F97316', '#16A34A', '#9CA3AF'],
          borderColor: ['#EA580C', '#15803D', '#6B7280'],
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, color: '#1A1A1A', font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: '#1A1A1A',
            bodyColor: '#E5E7EB',
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function updateCheckinSection() {
    const total = allParticipants.length;
    const present = allParticipants.filter(p => p.checkedIn).length;
    const absent = total - present;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    document.getElementById('ci-total').textContent = total;
    document.getElementById('ci-present').textContent = present;
    document.getElementById('ci-absent').textContent = absent;
    document.getElementById('ci-rate').textContent = `${rate}%`;

    const ctx = document.getElementById('chart-presence').getContext('2d');
    if (chartPresence) chartPresence.destroy();

    chartPresence = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['PrÃ©sents', 'Non arrivÃ©s'],
        datasets: [{
          data: [present, absent],
          backgroundColor: ['#16A34A', '#E5E7EB'],
          borderColor: ['#15803D', '#D1D5DB'],
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, color: '#1A1A1A' } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total2 = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total2 > 0 ? Math.round((ctx.parsed / total2) * 100) : 0;
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // â”€â”€ Recent Table (last 5) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function updateRecentTable() {
    const tbody = document.getElementById('recent-tbody');
    const recent = allParticipants.slice(0, 5);

    tbody.innerHTML = recent.map(p => `
      <tr>
        <td><span class="badge badge--orange">${escapeHtml(p.registrationNumber)}</span></td>
        <td><strong>${escapeHtml(p.lastName)} ${escapeHtml(p.firstName)}</strong></td>
        <td style="font-size:0.8rem;">${escapeHtml(p.email)}</td>
        <td>${p.subCommittee ? `<span class="badge badge--gray">${escapeHtml(p.subCommittee)}</span>` : '<span style="color:#9CA3AF;">â€”</span>'}</td>
        <td style="font-size:0.8rem;">${formatDateShort(p.registeredAt)}</td>
        <td>${p.checkedIn
          ? '<span class="badge badge--green">âœ“ PrÃ©sent</span>'
          : '<span class="badge badge--gray">En attente</span>'
        }</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:2rem;">Aucun participant inscrit</td></tr>';
  }

  // â”€â”€ Participants Table (with filters + pagination) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function applyFilters() {
    const search = document.getElementById('search-input')?.value?.toLowerCase() || '';
    const subFilter = document.getElementById('filter-subcommittee')?.value || '';
    const checkinFilter = document.getElementById('filter-checkin')?.value || '';

    filteredParticipants = allParticipants.filter(p => {
      const name = `${p.firstName} ${p.lastName} ${p.email} ${p.phone} ${p.registrationNumber}`.toLowerCase();
      const matchSearch = !search || name.includes(search);

      let matchSub = true;
      if (subFilter === 'none') matchSub = !p.subCommittee;
      else if (subFilter) matchSub = p.subCommittee === subFilter;

      let matchCheckin = true;
      if (checkinFilter === 'true') matchCheckin = p.checkedIn;
      else if (checkinFilter === 'false') matchCheckin = !p.checkedIn;

      return matchSearch && matchSub && matchCheckin;
    });

    currentPage = 1;
    renderParticipantsTable();
  }

  function renderParticipantsTable() {
    const tbody = document.getElementById('participants-tbody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredParticipants.slice(start, end);

    tbody.innerHTML = pageData.map(p => `
      <tr>
        <td><span class="badge badge--orange" style="font-size:0.7rem;">${escapeHtml(p.registrationNumber)}</span></td>
        <td><strong>${escapeHtml(p.lastName)}</strong></td>
        <td>${escapeHtml(p.firstName)}</td>
        <td style="font-size:0.8rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.email)}</td>
        <td style="font-size:0.8rem;">${escapeHtml(p.phone)}</td>
        <td>${p.subCommittee ? `<span class="badge badge--gray">${escapeHtml(p.subCommittee)}</span>` : 'â€”'}</td>
        <td>${p.checkedIn
          ? `<span class="badge badge--green">âœ“ PrÃ©sent</span>`
          : '<span class="badge badge--gray">Non arrivÃ©</span>'
        }</td>
        <td>${p.emailSent
          ? '<span class="badge badge--green">âœ“</span>'
          : '<span class="badge badge--orange">Ã‰chec</span>'
        }</td>
        <td>
          <div class="table-actions">
            <button class="btn btn--ghost btn--sm" onclick="downloadReceipt('${p.id}')" title="TÃ©lÃ©charger le reÃ§u">ðŸ“„</button>
            <button class="btn btn--ghost btn--sm" onclick="resendEmail('${p.id}')" title="Renvoyer l'email">ðŸ“§</button>
          </div>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);padding:2rem;">Aucun rÃ©sultat</td></tr>`;

    const total = filteredParticipants.length;
    document.getElementById('pagination-info').textContent =
      `${Math.min(start + 1, total)}â€“${Math.min(end, total)} sur ${total} participants`;

    document.getElementById('btn-prev').disabled = currentPage === 1;
    document.getElementById('btn-next').disabled = end >= total;
  }

  // Filters
  ['search-input', 'filter-subcommittee', 'filter-checkin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', applyFilters);
  });

  // Pagination
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderParticipantsTable(); }
  });
  document.getElementById('btn-next')?.addEventListener('click', () => {
    const maxPage = Math.ceil(filteredParticipants.length / PAGE_SIZE);
    if (currentPage < maxPage) { currentPage++; renderParticipantsTable(); }
  });

  // â”€â”€ Global action handlers (called from inline onclick) â”€â”€â”€â”€â”€â”€â”€
  window.downloadReceipt = async (participantId) => {
    showToast('GÃ©nÃ©ration du reÃ§uâ€¦', 'info');
    try {
      const snap = await db.collection('participants').doc(participantId).get();
      if (!snap.exists) { showToast('Participant introuvable.', 'error'); return; }
      const data = { id: snap.id, ...snap.data() };
      const pdfBlob = await window.GradaPDF.generate({
        ...data,
        eventDate: EVENT_CONFIG.dateDisplay,
        eventName: EVENT_CONFIG.fullName,
        eventLocation: EVENT_CONFIG.location,
        eventOrganizer: EVENT_CONFIG.organizer
      });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recu-GRADAA-2026-${data.registrationNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('ReÃ§u tÃ©lÃ©chargÃ© !', 'success');
    } catch (err) {
      showToast('Erreur gÃ©nÃ©ration PDF.', 'error');
      console.error(err);
    }
  };

  window.resendEmail = async (participantId) => {
    showToast('Email mis en file d\'envoiâ€¦', 'info');
    try {
      await window.GradaEmail.resendFromAdmin(participantId);
      showToast('Email planifiÃ© pour renvoi !', 'success');
    } catch (err) {
      showToast('Erreur lors du renvoi.', 'error');
    }
  };

  // â”€â”€ QR Code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function initQRCode() {
    const url = `${window.location.origin}/checkin.html`;
    document.getElementById('qr-url').textContent = url;

    window.GradaQR.generate('qr-code-container', url, {
      width: 280,
      height: 280,
      colorDark: '#1A1A1A',
      colorLight: '#FFFFFF'
    });
  }

  document.getElementById('btn-download-qr')?.addEventListener('click', () => {
    window.GradaQR.download('qr-code-container', 'qr-checkin-GRADAA-2026.png');
    showToast('QR Code tÃ©lÃ©chargÃ© !', 'success');
  });

  document.getElementById('btn-print-qr')?.addEventListener('click', () => {
    const container = document.getElementById('qr-code-container');
    const img = container.querySelector('canvas')?.toDataURL('image/png')
      || container.querySelector('img')?.src;
    if (!img) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head><title>QR Code GRADAA 2026</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;text-align:center;}
      h1{font-size:2rem;margin-bottom:1rem;} p{color:#666;} img{max-width:400px;border:2px solid #eee;border-radius:12px;padding:16px;}</style>
      </head><body>
      <h1>GRADAA 2026</h1>
      <p>Scannez ce QR code pour accÃ©der au formulaire de check-in</p>
      <p style="color:#F97316;font-weight:bold;">27 septembre 2026 â€” Anyama, CÃ´te d'Ivoire</p>
      <img src="${img}" alt="QR Code Check-in GRADAA 2026" />
      <p style="margin-top:1rem;font-size:0.85rem;">${window.location.origin}/checkin.html</p>
      <script>window.print();<\/script>
      </body></html>`);
    win.document.close();
  });

  // â”€â”€ CSV Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function exportToCSV(data, filename) {
    const headers = [
      'NÂ° Inscription', 'Nom', 'PrÃ©nom', 'Email', 'TÃ©lÃ©phone',
      'Sous-comitÃ©', 'Profession', 'Date inscription', 'Check-in',
      'Date check-in', 'Email envoyÃ©'
    ];

    const rows = data.map(p => [
      p.registrationNumber || '',
      p.lastName || '',
      p.firstName || '',
      p.email || '',
      p.phone || '',
      p.subCommittee || '',
      p.profession || '',
      p.registeredAt ? formatDate(p.registeredAt) : '',
      p.checkedIn ? 'Oui' : 'Non',
      p.checkedInAt ? formatDate(p.checkedInAt) : '',
      p.emailSent ? 'Oui' : 'Non'
    ].map(v => `"${String(v).replace(/"/g, '""')}"`));

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('btn-export-all')?.addEventListener('click', () => {
    exportToCSV(allParticipants, `GRADAA-2026-tous-inscrits-${new Date().toISOString().slice(0,10)}.csv`);
    showToast('Export CSV gÃ©nÃ©rÃ© !', 'success');
  });

  document.getElementById('btn-export-present')?.addEventListener('click', () => {
    const present = allParticipants.filter(p => p.checkedIn);
    exportToCSV(present, `GRADAA-2026-presents-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`Export de ${present.length} prÃ©sents gÃ©nÃ©rÃ© !`, 'success');
  });

  document.getElementById('btn-export-email-failed')?.addEventListener('click', () => {
    const failed = allParticipants.filter(p => !p.emailSent);
    exportToCSV(failed, `GRADAA-2026-emails-non-envoyes.csv`);
    showToast(`${failed.length} participants avec email non envoyÃ© exportÃ©s.`, 'success');
  });

  // Resend all failed emails
  document.getElementById('btn-resend-all-emails')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-resend-all-emails');
    const resultDiv = document.getElementById('resend-result');
    const failed = allParticipants.filter(p => !p.emailSent);

    if (failed.length === 0) {
      showToast('Tous les emails ont dÃ©jÃ  Ã©tÃ© envoyÃ©s !', 'info');
      return;
    }

    btn.disabled = true;
    btn.textContent = `Planification de ${failed.length} emailsâ€¦`;

    let count = 0;
    for (const p of failed) {
      try {
        await db.collection('emailQueue').add({
          to: p.email,
          toName: `${p.firstName} ${p.lastName}`,
          participantId: p.id,
          registrationNumber: p.registrationNumber,
          eventId: EVENT_CONFIG.id,
          type: 'receipt',
          status: 'pending',
          attempts: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          triggeredBy: 'admin-bulk'
        });
        count++;
      } catch (err) {
        console.error(`Failed to queue email for ${p.email}:`, err);
      }
    }

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<div class="alert alert--success"><span>âœ… ${count} emails planifiÃ©s pour renvoi !</span></div>`;
    btn.disabled = false;
    btn.textContent = 'ðŸ”„ Re-planifier l\'envoi des emails manquants';
    showToast(`${count} emails mis en file d'attente !`, 'success');
  });
});
