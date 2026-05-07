/* ── Auth ─────────────────────────────────────────────── */
const token = localStorage.getItem('admin_token');
if (!token && !window.location.pathname.endsWith('login.html')) {
  window.location.href = 'login.html';
}

function logout() {
  localStorage.removeItem('admin_token');
  window.location.href = 'login.html';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

/* ── Toast ─────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  let el = document.getElementById('adminToast');
  if (!el) { el = document.createElement('div'); el.id = 'adminToast'; el.className = 'toast-admin'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `toast-admin ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

/* ── Sidebar active ────────────────────────────────────── */
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  if (window.location.pathname.includes(item.dataset.page)) item.classList.add('active');
});

/* ── Format date FR ────────────────────────────────────── */
function dateFR(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Format montant ─────────────────────────────────────── */
function euros(n) { return `${n || 0} €`; }
