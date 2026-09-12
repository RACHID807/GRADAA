// ============================================================
// admin.js — Logique du tableau de bord GRADA
// ============================================================

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const { db, auth, EVENT_CONFIG } = window.GRADAA;

  // ── State ───────────────────────────────────────────────────
  let allParticipants = [];
  let filteredParticipants = [];
  let currentPage = 1;
  const PAGE_SIZE = 20;
  let unsubscribeListener = null;
  let chartRegistrations = null;
  let chartSubcommittees = null;
  let chartPresence = null;
  let chartProfessions = null;
  let currentSection = 'overview';
  let currentUserRole = 'PCO';

  // ── Auth Guard ───────────────────────────────────────────────
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'admin-login.html';
      return;
    }
    const adminDoc = await db.collection('admins').doc(user.uid).get();
    if (!adminDoc.exists) {
      await db.collection('admins').doc(user.uid).set({
        email: user.email,
        role: 'EN_ATTENTE',
        createdAt: new Date()
      });
      alert('Votre compte a été créé mais doit être validé par un Super Administrateur.');
      await auth.signOut();
      window.location.href = 'admin-login.html';
      return;
    }

    const adminData = adminDoc.data();
    if (adminData.role === 'EN_ATTENTE') {
      alert('Votre compte est toujours en attente de validation par un Super Administrateur.');
      await auth.signOut();
      window.location.href = 'admin-login.html';
      return;
    }

    // Auto-update email in Firestore if missing
    if (!adminData.email && user.email) {
      await db.collection('admins').doc(user.uid).update({ email: user.email });
    }

    // Read Role
    currentUserRole = adminData.role || 'PCO';

    // Set user info in sidebar
    document.getElementById('user-email').textContent = user.email;
    const initials = (user.email || 'A').charAt(0).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
    
    // Apply role UI restrictions
    applyRoleRestrictions();

    // Initialize app
    initApp();
  });

  // ── Role Restrictions ──────────────────────────────────────────
  function applyRoleRestrictions() {
    // Defaults for PCO
    const navAdminSection = document.getElementById('nav-admin-section');
    const navRoles = document.getElementById('nav-roles');
    if (navAdminSection) navAdminSection.style.display = 'none';
    if (navRoles) navRoles.style.display = 'none';
    
    if (currentUserRole === 'FINANCE') {
      document.getElementById('nav-participants').style.display = 'none';
      document.getElementById('nav-checkin').style.display = 'none';
      document.getElementById('nav-badges').style.display = 'none';
      document.getElementById('nav-qrcode').style.display = 'none';
      document.getElementById('nav-export').style.display = 'none';
    } else if (currentUserRole === 'SUPER_ADMIN') {
      if (navAdminSection) navAdminSection.style.display = 'block';
      if (navRoles) navRoles.style.display = 'flex';
      initRolesAdmin();
    }
  }

  // ── Utilities ─────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  function formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDateShort(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '—';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Navigation ────────────────────────────────────────────────
  function showSection(name) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.sidebar__nav-item').forEach(i => i.classList.remove('active'));

    const section = document.getElementById(`section-${name}`);
    const navItem = document.getElementById(`nav-${name}`);
    if (section) section.style.display = 'block';
    if (navItem) navItem.classList.add('active');

    currentSection = name;

    const titles = {
      overview: '📊 Vue d\'ensemble',
      participants: '👥 Participants',
      checkin: '✅ Check-in — Jour J',
      finance: '💰 Finances & CO',
      qrcode: '🔲 QR Code d\'accès',
      export: '📥 Export des données',
      roles: '🛡️ Gestion des rôles'
    };
    document.getElementById('page-title').textContent = titles[name] || '';

    if (name === 'qrcode') initQRCode();
    if (name === 'checkin') updateCheckinSection();
    if (name === 'roles' && currentUserRole === 'SUPER_ADMIN') loadAdmins();
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

  // ── Init App ──────────────────────────────────────────────────
  function initApp() {
    setupRealtimeListener();
  }

  // ── Gestion des rôles (SUPER_ADMIN) ───────────────────────────
  function initRolesAdmin() {
    const btnAdd = document.getElementById('btn-add-admin');
    const btnSave = document.getElementById('btn-save-admin');
    if (!btnAdd) return;

    btnAdd.addEventListener('click', () => {
      document.getElementById('admin-modal-uid').value = '';
      document.getElementById('admin-modal-email').value = '';
      document.getElementById('admin-modal-role').value = 'PCO';
      document.getElementById('admin-modal').style.display = 'flex';
    });

    btnSave.addEventListener('click', async () => {
      const uid = document.getElementById('admin-modal-uid').value.trim();
      const email = document.getElementById('admin-modal-email').value.trim();
      const role = document.getElementById('admin-modal-role').value;
      if (!uid) return showToast('UID obligatoire', 'warning');
      try {
        const payload = { role, updatedAt: new Date() };
        if (email) payload.email = email;
        await db.collection('admins').doc(uid).set(payload, { merge: true });
        showToast('Rôle enregistré avec succès', 'success');
        window.closeAdminModal();
        loadAdmins();
      } catch (err) {
        showToast('Erreur: ' + err.message, 'error');
      }
    });

    window.closeAdminModal = () => {
      document.getElementById('admin-modal').style.display = 'none';
    };

    window.editAdmin = (uid, currentRole, email) => {
      document.getElementById('admin-modal-uid').value = uid;
      document.getElementById('admin-modal-email').value = email === 'Email inconnu' ? '' : email;
      const roleSelect = document.getElementById('admin-modal-role');
      // Set to currentRole if it exists in options, else default to PCO
      const optionExists = Array.from(roleSelect.options).some(opt => opt.value === currentRole);
      roleSelect.value = optionExists ? currentRole : 'PCO';
      document.getElementById('admin-modal').style.display = 'flex';
    };

    window.deleteAdmin = async (uid) => {
      if (!confirm('Voulez-vous vraiment révoquer les accès de cet utilisateur ?')) return;
      try {
        await db.collection('admins').doc(uid).delete();
        showToast('Accès révoqué', 'success');
        loadAdmins();
      } catch(err) {
        showToast('Erreur: ' + err.message, 'error');
      }
    };
  }

  async function loadAdmins() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3">Chargement...</td></tr>';
    try {
      const snap = await db.collection('admins').get();
      tbody.innerHTML = '';
      snap.forEach(doc => {
        const data = doc.data();
        const role = data.role || 'PCO';
        const email = data.email || 'Email inconnu';
        const badgeColor = role === 'SUPER_ADMIN' ? 'orange' : (role === 'FINANCE' ? 'blue' : (role === 'EN_ATTENTE' ? 'gray' : 'green'));
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div style="font-weight:600;">${email}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${doc.id}</div>
          </td>
          <td><span class="badge badge--${badgeColor}">${role}</span></td>
          <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end;">
            <button class="btn btn--outline btn--sm" onclick="editAdmin('${doc.id}', '${role}', '${email.replace(/'/g, "\\'")}')">✏️ Modifier</button>
            <button class="btn btn--outline btn--sm" onclick="deleteAdmin('${doc.id}')" style="color:#DC2626;border-color:#DC2626;">🗑️</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch(err) {
      tbody.innerHTML = '<tr><td colspan="3" style="color:red;">Erreur lors du chargement des admins.</td></tr>';
    }
  }

  // ── Realtime Listener ─────────────────────────────────────────
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
        updateFinanceSection();
      }, (err) => {
        console.error('Listener error:', err);
        document.getElementById('loading-overlay').innerHTML = `
          <div class="alert alert--error">
            <span>❌ Erreur de chargement des données. Vérifiez vos permissions Firestore.</span>
          </div>`;
      });
  }

  // ── KPIs ──────────────────────────────────────────────────────
  function updateKPIs() {
    const total = allParticipants.length;
    const checkedIn = allParticipants.filter(p => p.checkedIn).length;
    const emailsSent = allParticipants.filter(p => p.emailSent).length;
    const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-checkedin').textContent = checkedIn;
    document.getElementById('kpi-rate').textContent = `${rate}%`;
    document.getElementById('kpi-emails').textContent = emailsSent;

    document.getElementById('kpi-total-sub').childNodes[0].textContent = `Mise à jour en temps réel `;
    document.getElementById('kpi-checkedin-sub').textContent = `${total - checkedIn} non arrivés`;
    document.getElementById('kpi-emails-sub').textContent = `${total - emailsSent} en attente`;

    // ── Trend Badges ──
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    const recentRegs = allParticipants.filter(p => {
      if(!p.registeredAt) return false;
      const d = p.registeredAt.toDate ? p.registeredAt.toDate() : new Date(p.registeredAt);
      return d >= sevenDaysAgo;
    }).length;

    const trendTotal = document.getElementById('kpi-total-trend');
    if (trendTotal) {
      if (recentRegs > 0) {
        trendTotal.textContent = `+${recentRegs} (7j)`;
        trendTotal.className = 'trend-badge positive';
        trendTotal.style.display = 'inline-flex';
      } else {
        trendTotal.textContent = `0 (7j)`;
        trendTotal.className = 'trend-badge neutral';
        trendTotal.style.display = 'inline-flex';
      }
    }

    // ── Alerts Banner (Emails failed) ──
    const alertBanner = document.getElementById('alert-email-failed');
    const alertText = document.getElementById('alert-email-failed-text');
    const failedEmails = allParticipants.filter(p => !p.emailSent).length;
    
    if (alertBanner && alertText) {
      if (failedEmails > 0) {
        alertText.textContent = `${failedEmails} participant(s) n'ont pas reçu leur reçu.`;
        alertBanner.style.display = 'flex';
      } else {
        alertBanner.style.display = 'none';
      }
    }
  }

  // ── Finances & CO ─────────────────────────────────────────────
  function updateFinanceSection() {
    const coMembers = allParticipants.filter(p => p.role === 'CO');
    let totalCollected = 0;
    const statsByCommission = {};

    coMembers.forEach(p => {
      const comm = p.subCommittee || 'Inconnue';
      const amount = p.paymentAmount || 1500;
      if (p.paymentStatus === 'paid') {
        totalCollected += amount;
      }
      
      if (!statsByCommission[comm]) {
        statsByCommission[comm] = { count: 0, amount: 0 };
      }
      statsByCommission[comm].count += 1;
      if (p.paymentStatus === 'paid') {
        statsByCommission[comm].amount += amount;
      }
    });

    document.getElementById('kpi-co-total').textContent = coMembers.length;
    document.getElementById('kpi-finance-total').textContent = totalCollected.toLocaleString('fr-FR') + ' F';

    const tbody = document.getElementById('finance-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      Object.keys(statsByCommission).sort().forEach(comm => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(comm)}</strong></td>
          <td>${statsByCommission[comm].count}</td>
          <td style="color:var(--color-primary);font-weight:700;">${statsByCommission[comm].amount.toLocaleString('fr-FR')} F</td>
          <td>
            <button class="btn btn--outline btn--sm btn-export-specific-co" data-comm="${escapeHtml(comm)}">📥 Exporter</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind dynamic export buttons
      document.querySelectorAll('.btn-export-specific-co').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const commName = e.target.getAttribute('data-comm');
          const members = coMembers.filter(p => p.subCommittee === commName);
          exportToCSV(members, `GRADAA-2026-CO-${commName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.csv`);
          showToast(`Export de la commission ${commName} généré !`, 'success');
        });
      });
    }

    const pendingTbody = document.getElementById('finance-pending-tbody');
    if (pendingTbody) {
      const pendingMembers = coMembers.filter(p => p.paymentStatus === 'pending');
      pendingTbody.innerHTML = pendingMembers.map(p => `
        <tr>
          <td><span class="badge badge--orange" style="font-size:0.7rem;">${escapeHtml(p.registrationNumber)}</span></td>
          <td><strong>${escapeHtml(p.lastName)} ${escapeHtml(p.firstName)}</strong><br><span style="font-size:0.75rem;color:var(--color-text-muted);">${escapeHtml(p.phone)}</span></td>
          <td>${p.subCommittee ? `<span class="badge badge--gray">${escapeHtml(p.subCommittee)}</span>` : '—'}</td>
          <td><span style="font-weight:600;">${(p.paymentAmount || 1000).toLocaleString('fr-FR')} F</span></td>
          <td>
            <button class="btn btn--sm btn--primary" onclick="validatePayment('${p.id}')">✅ Valider</button>
          </td>
        </tr>
      `).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:2rem;">Aucun paiement en attente</td></tr>`;
    }
  }

  // ── Charts ────────────────────────────────────────────────────
  function updateCharts() {
    updateRegistrationsChart();
    updateSubcommitteesChart();
    updateProfessionsChart();
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
          label: 'Inscriptions cumulées',
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
    const counts = { 'Anyama 1': 0, 'Anyama 2': 0, 'Non renseigné': 0 };
    allParticipants.forEach(p => {
      const sc = p.subCommittee;
      if (sc === 'Anyama 1') counts['Anyama 1']++;
      else if (sc === 'Anyama 2') counts['Anyama 2']++;
      else counts['Non renseigné']++;
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

  function updateProfessionsChart() {
    const professionCounts = {};
    allParticipants.forEach(p => {
      const prof = p.profession || 'Non renseigné';
      professionCounts[prof] = (professionCounts[prof] || 0) + 1;
    });

    // Sort by count and get top 10
    const sortedProfessions = Object.entries(professionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = sortedProfessions.map(entry => entry[0]);
    const data = sortedProfessions.map(entry => entry[1]);

    const ctx = document.getElementById('chart-professions')?.getContext('2d');
    if (!ctx) return;
    if (chartProfessions) chartProfessions.destroy();

    chartProfessions = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Inscrits',
          data: data,
          backgroundColor: '#3B82F6',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0 }
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
        labels: ['Présents', 'Non arrivés'],
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

  // ── Recent Table (last 5) ─────────────────────────────────────
  function updateRecentTable() {
    const tbody = document.getElementById('recent-tbody');
    const recent = allParticipants.slice(0, 5);

    tbody.innerHTML = recent.map(p => `
      <tr>
        <td><span class="badge badge--orange">${escapeHtml(p.registrationNumber)}</span></td>
        <td><strong>${escapeHtml(p.lastName)} ${escapeHtml(p.firstName)}</strong></td>
        <td style="font-size:0.8rem;">${escapeHtml(p.email)}</td>
        <td>${p.subCommittee ? `<span class="badge badge--gray">${escapeHtml(p.subCommittee)}</span>` : '<span style="color:#9CA3AF;">—</span>'}</td>
        <td style="font-size:0.8rem;">${formatDateShort(p.registeredAt)}</td>
        <td>${p.checkedIn
          ? '<span class="badge badge--green">✓ Présent</span>'
          : '<span class="badge badge--gray">En attente</span>'
        }</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:2rem;">Aucun participant inscrit</td></tr>';
  }

  // ── Participants Table (with filters + pagination) ─────────────
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
        <td>${p.subCommittee ? `<span class="badge badge--gray">${escapeHtml(p.subCommittee)}</span>` : '—'}</td>
        <td>${p.checkedIn
          ? `<span class="badge badge--green">✓ Présent</span>`
          : '<span class="badge badge--gray">Non arrivé</span>'
        }</td>
        <td>${p.emailSent
          ? '<span class="badge badge--green">✓</span>'
          : '<span class="badge badge--orange">Échec</span>'
        }</td>
        <td>
          <div class="table-actions">
            <button class="btn btn--ghost btn--sm" onclick="downloadReceipt('${p.id}')" title="Télécharger le reçu">📄</button>
            <button class="btn btn--ghost btn--sm" onclick="resendEmail('${p.id}')" title="Renvoyer l'email">📧</button>
            <button class="btn btn--ghost btn--sm" onclick="printSingleBadge('${p.id}')" title="Imprimer le badge">🪪</button>
          </div>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="9" style="text-align:center;color:var(--color-text-muted);padding:2rem;">Aucun résultat</td></tr>`;

    const total = filteredParticipants.length;
    document.getElementById('pagination-info').textContent =
      `${Math.min(start + 1, total)}–${Math.min(end, total)} sur ${total} participants`;

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

  // ── Global action handlers (called from inline onclick) ───────
  window.downloadReceipt = async (participantId) => {
    showToast('Génération du reçu…', 'info');
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
      showToast('Reçu téléchargé !', 'success');
    } catch (err) {
      showToast('Erreur génération PDF.', 'error');
      console.error(err);
    }
  };

  window.resendEmail = async (participantId) => {
    showToast('Envoi de l\'email en cours…', 'info');
    try {
      await window.GradaEmail.resendFromAdmin(participantId);
      showToast('Email envoyé avec succès !', 'success');
    } catch (err) {
      showToast('Erreur lors du renvoi de l\'email.', 'error');
    }
  };

  window.printSingleBadge = (participantId) => {
    const p = allParticipants.find(x => x.id === participantId);
    if (!p) {
      showToast('Participant introuvable', 'error');
      return;
    }
    const data = [{
      name: `${p.firstName} ${p.lastName}`,
      committee: p.subCommittee || 'Aucun',
      profession: p.profession || 'Participant',
      id: p.registrationNumber,
      rawId: p.id,
      photo: p.photoDataUrl || p.photoUrl || '',
      role: p.role || 'participant'
    }];
    sessionStorage.setItem('gradaa_badges_data', JSON.stringify(data));
    window.open('badges.html', '_blank');
  };

  window.validatePayment = async (participantId) => {
    if (!confirm("Voulez-vous vraiment valider ce paiement ? Cela enverra automatiquement le reçu par email.")) return;
    showToast('Validation en cours...', 'info');
    try {
      await db.collection('participants').doc(participantId).update({ paymentStatus: 'paid' });
      showToast('Paiement validé ! Envoi du reçu en cours...', 'info');
      await window.GradaEmail.resendFromAdmin(participantId);
      showToast('Reçu envoyé avec succès !', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la validation ou de l\'envoi du reçu.', 'error');
    }
  };

  // ── QR Code ───────────────────────────────────────────────────
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
    showToast('QR Code téléchargé !', 'success');
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
      <p>Scannez ce QR code pour accéder au formulaire de check-in</p>
      <p style="color:#F97316;font-weight:bold;">27 septembre 2026 — Anyama, Côte d'Ivoire</p>
      <img src="${img}" alt="QR Code Check-in GRADAA 2026" />
      <p style="margin-top:1rem;font-size:0.85rem;">${window.location.origin}/checkin.html</p>
      <script>window.print();<\/script>
      </body></html>`);
    win.document.close();
  });

  // ── CSV Export ────────────────────────────────────────────────
  function exportToCSV(data, filename) {
    const headers = [
      'N° Inscription', 'Nom', 'Prénom', 'Email', 'Téléphone',
      'Sous-comité', 'Profession', 'Date inscription', 'Check-in',
      'Date check-in', 'Email envoyé'
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
    showToast('Export CSV généré !', 'success');
  });

  document.getElementById('btn-export-present')?.addEventListener('click', () => {
    const present = allParticipants.filter(p => p.checkedIn);
    exportToCSV(present, `GRADAA-2026-presents-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`Export de ${present.length} présents généré !`, 'success');
  });

  document.getElementById('btn-export-email-failed')?.addEventListener('click', () => {
    const failed = allParticipants.filter(p => !p.emailSent);
    exportToCSV(failed, `GRADAA-2026-emails-non-envoyes.csv`);
    showToast(`${failed.length} participants avec email non envoyé exportés.`, 'success');
  });

  // Resend all failed emails
  document.getElementById('btn-resend-all-emails')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-resend-all-emails');
    const resultDiv = document.getElementById('resend-result');
    const failed = allParticipants.filter(p => !p.emailSent);

    if (failed.length === 0) {
      showToast('Tous les emails ont déjà été envoyés !', 'info');
      return;
    }

    if (!confirm(`Vous êtes sur le point d'envoyer ${failed.length} e-mails via EmailJS.\nVoulez-vous continuer ?`)) {
      return;
    }

    btn.disabled = true;
    resultDiv.style.display = 'block';

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < failed.length; i++) {
      const p = failed[i];
      btn.textContent = `Envoi en cours (${i + 1}/${failed.length})…`;
      resultDiv.innerHTML = `<div class="alert alert--info"><span>⏳</span><span>Envoi de l'e-mail à ${escapeHtml(p.email)}...</span></div>`;
      
      try {
        await window.GradaEmail.resendFromAdmin(p.id);
        successCount++;
      } catch (err) {
        console.error(`Erreur d'envoi pour ${p.email}:`, err);
        errorCount++;
      }
      
      // Petite pause pour ne pas surcharger l'API EmailJS
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    resultDiv.innerHTML = `
      <div class="alert alert--success" style="margin-bottom:8px;">
        <span>✅</span><span>${successCount} e-mails envoyés avec succès.</span>
      </div>
      ${errorCount > 0 ? `<div class="alert alert--error"><span>❌</span><span>${errorCount} e-mails ont échoué.</span></div>` : ''}
    `;
    
    btn.textContent = '🔄 Re-planifier l\'envoi des emails manquants';
    btn.disabled = false;
    showToast(`Envoi terminé : ${successCount} succès, ${errorCount} échecs.`, successCount > 0 ? 'success' : 'error');
  });

  // Export CO
  document.getElementById('btn-export-co-all')?.addEventListener('click', () => {
    const coMembers = allParticipants.filter(p => p.role === 'CO');
    exportToCSV(coMembers, `GRADAA-2026-Tous-CO-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`Export de ${coMembers.length} membres CO généré !`, 'success');
  });

  document.getElementById('btn-export-co-commission')?.addEventListener('click', () => {
    const select = document.getElementById('export-co-commission');
    const commName = select.value;
    if (!commName) {
      showToast('Veuillez sélectionner une commission.', 'error');
      return;
    }
    const members = allParticipants.filter(p => p.role === 'CO' && p.subCommittee === commName);
    exportToCSV(members, `GRADAA-2026-CO-${commName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.csv`);
    showToast(`Export de la commission ${commName} généré !`, 'success');
  });

  // ── Badges Generation ─────────────────────────────────────────
  document.getElementById('btn-generate-badges-participants')?.addEventListener('click', async () => {
    try {
      const participantsToPrint = allParticipants
        .filter(p => p.role !== 'CO')
        .map(p => ({
          name: `${p.firstName} ${p.lastName}`,
          committee: p.subCommittee || 'Aucun',
          profession: p.profession || 'Participant',
          id: p.registrationNumber,
          rawId: p.id,
          photo: p.photoDataUrl || p.photoUrl || '',
          role: p.role || 'participant'
        }));
      
      if (participantsToPrint.length === 0) {
        showToast('Aucun participant à générer.', 'error');
        return;
      }
      
      sessionStorage.setItem('gradaa_badges_data', JSON.stringify(participantsToPrint));
      window.open('badges.html', '_blank');
      showToast('Ouverture de la planche de badges...', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la génération des badges.', 'error');
    }
  });

  document.getElementById('btn-generate-badges-co')?.addEventListener('click', async () => {
    try {
      const coToPrint = allParticipants
        .filter(p => p.role === 'CO')
        .map(p => ({
          name: `${p.firstName} ${p.lastName}`,
          committee: p.subCommittee || 'Commission',
          profession: p.profession || 'Participant',
          id: p.registrationNumber,
          rawId: p.id,
          photo: p.photoDataUrl || p.photoUrl || '',
          role: p.role || 'CO'
        }));

      if (coToPrint.length === 0) {
        showToast('Aucun membre CO à générer.', 'error');
        return;
      }

      sessionStorage.setItem('gradaa_badges_data', JSON.stringify(coToPrint));
      window.open('badges.html', '_blank');
      showToast('Ouverture de la planche de badges...', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la génération des badges.', 'error');
    }
  });

  document.getElementById('btn-generate-badges-pco')?.addEventListener('click', () => {
    const pcoData = [{
      name: "DIARRA CHEICK OMER",
      profession: "Président du Comité",
      committee: "",
      id: "GRA-PCO0001",
      role: "PCO",
      photo: "" // Il pourra insérer sa propre photo si dispo, sinon ça fait un avatar
    }];
    sessionStorage.setItem('gradaa_badges_data', JSON.stringify(pcoData));
    window.open('badges.html', '_blank');
    showToast('Ouverture du badge PCO...', 'success');
  });

  document.getElementById('btn-generate-badges-president')?.addEventListener('click', () => {
    window.open('badge-president.html', '_blank');
    showToast('Ouverture du badge PRÉSIDENT...', 'success');
  });

  document.getElementById('btn-generate-badges-panelistes')?.addEventListener('click', () => {
    const countStr = prompt("Combien de badges Panélistes voulez-vous générer ?", "8");
    if (!countStr) return;
    const count = parseInt(countStr, 10) || 8;
    const panelistes = Array(count).fill({ role: 'PANELISTE' });
    sessionStorage.setItem('gradaa_badges_data', JSON.stringify(panelistes));
    window.open('badges.html', '_blank');
    showToast('Ouverture de la planche de badges...', 'success');
  });

  document.getElementById('btn-generate-badges-medias')?.addEventListener('click', () => {
    const countStr = prompt("Combien de badges Médias voulez-vous générer ?", "8");
    if (!countStr) return;
    const count = parseInt(countStr, 10) || 8;
    const medias = Array(count).fill({ role: 'MEDIAS' });
    sessionStorage.setItem('gradaa_badges_data', JSON.stringify(medias));
    window.open('badges.html', '_blank');
    showToast('Ouverture de la planche de badges...', 'success');
  });

  // ── Global Search & Modal ──────────────────────────────────────
  const globalSearchInput = document.getElementById('global-search-input');
  const globalSearchSuggestions = document.getElementById('global-search-suggestions');

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (q.length < 2) {
        globalSearchSuggestions.style.display = 'none';
        return;
      }

      const results = allParticipants.filter(p => {
        const str = `${p.firstName} ${p.lastName} ${p.email} ${p.phone} ${p.registrationNumber}`.toLowerCase();
        return str.includes(q);
      }).slice(0, 5); // top 5

      if (results.length === 0) {
        globalSearchSuggestions.innerHTML = `<div class="search-suggestion-item"><span class="search-suggestion-sub">Aucun résultat trouvé</span></div>`;
      } else {
        globalSearchSuggestions.innerHTML = results.map(p => `
          <div class="search-suggestion-item" onclick="openParticipantModal('${p.id}')">
            <span class="search-suggestion-name">${escapeHtml(p.lastName)} ${escapeHtml(p.firstName)}</span>
            <span class="search-suggestion-sub">${escapeHtml(p.registrationNumber)} • ${escapeHtml(p.email)}</span>
          </div>
        `).join('');
      }
      globalSearchSuggestions.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.global-search-container')) {
        if(globalSearchSuggestions) globalSearchSuggestions.style.display = 'none';
      }
    });
  }

  window.openParticipantModal = (participantId) => {
    const p = allParticipants.find(x => x.id === participantId);
    if (!p) return;
    
    if (globalSearchSuggestions) globalSearchSuggestions.style.display = 'none';
    if (globalSearchInput) globalSearchInput.value = '';

    document.getElementById('modal-reg-num').textContent = p.registrationNumber;
    
    const statusEl = document.getElementById('modal-status');
    if (p.checkedIn) {
      statusEl.innerHTML = `<span class="badge badge--green">✓ Présent</span>`;
    } else {
      statusEl.innerHTML = `<span class="badge badge--gray">En attente</span>`;
    }

    document.getElementById('modal-details-tbody').innerHTML = `
      <tr><td style="color:var(--color-text-muted);">Nom complet</td><td><strong>${escapeHtml(p.lastName)} ${escapeHtml(p.firstName)}</strong></td></tr>
      <tr><td style="color:var(--color-text-muted);">Email</td><td>${escapeHtml(p.email)}</td></tr>
      <tr><td style="color:var(--color-text-muted);">Téléphone</td><td>${escapeHtml(p.phone)}</td></tr>
      <tr><td style="color:var(--color-text-muted);">Sous-comité</td><td>${escapeHtml(p.subCommittee || '—')}</td></tr>
      <tr><td style="color:var(--color-text-muted);">Profession</td><td>${escapeHtml(p.profession || '—')}</td></tr>
      <tr><td style="color:var(--color-text-muted);">Date d'inscription</td><td>${formatDate(p.registeredAt)}</td></tr>
    `;

    document.getElementById('modal-btn-email').onclick = () => window.resendEmail(p.id);
    document.getElementById('modal-btn-pdf').onclick = () => window.downloadReceipt(p.id);

    document.getElementById('participant-modal').style.display = 'flex';
  };

  window.closeParticipantModal = () => {
    document.getElementById('participant-modal').style.display = 'none';
  };

  // Bind Alert banner resend
  document.getElementById('btn-alert-resend')?.addEventListener('click', () => {
    document.getElementById('btn-resend-all-emails')?.click(); // trigger the mass resend
  });

  // ── Chart Export to PNG ───────────────────────────────────────
  window.exportChart = (canvasId) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const url = canvas.toDataURL("image/png", 1.0);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grada-chart-${canvasId}-${new Date().toISOString().slice(0,10)}.png`;
    a.click();
    showToast('Graphique téléchargé', 'success');
  };

});
