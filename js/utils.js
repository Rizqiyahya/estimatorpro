/* ============================================================
   EstimatorPro v3 — Utils
   Division: NETCO=Biru  OMG=Hijau  ITSOL=Ungu
   ============================================================ */

const Utils = {
  genId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  },

  formatCurrency(amount, symbol = 'Rp') {
    if (amount == null || isNaN(amount)) return symbol + ' 0';
    return symbol + ' ' + parseInt(amount).toLocaleString('id-ID');
  },

  formatDate(ds) {
    if (!ds) return '—';
    return new Date(ds).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  formatDateShort(ds) {
    if (!ds) return '—';
    return new Date(ds).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  },

  todayStr() { return new Date().toISOString().split('T')[0]; },

  escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
  },

  truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
  },

  // Debounce — solves search "stuck" bug
  debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // Division helpers
  divClass(div) {
    const m = { NETCO: 'badge-netco', OMG: 'badge-omg', ITSOL: 'badge-itsol' };
    return m[div] || 'badge-neutral';
  },

  divColor(div) {
    const m = { NETCO: 'var(--netco)', OMG: 'var(--omg)', ITSOL: 'var(--itsol)' };
    return m[div] || 'var(--text-muted)';
  },

  // Status badges
  reqStatusBadge(s) {
    const m = { open: 'badge-blue', win: 'badge-green', lose: 'badge-red' };
    const l = { open: 'Open', win: 'Win', lose: 'Lose/Drop' };
    return `<span class="badge ${m[s] || 'badge-neutral'}">${l[s] || s}</span>`;
  },

  pipeBadge(s) {
    const m = { todo: 'badge-neutral', in_progress: 'badge-orange', review: 'badge-blue', done: 'badge-green', revisi: 'badge-pink' };
    const l = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done', revisi: 'Revisi' };
    return `<span class="badge ${m[s] || 'badge-neutral'}">${l[s] || s}</span>`;
  },

  showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }
};
