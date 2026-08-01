/* ============================================================
   EstimatorPro v3 — Utils
   Division: NETCO=Biru  OMG=Hijau  ITSOL=Ungu
   ============================================================ */

const Utils = {
  genId() {
    // Use proper UUID v4 for Supabase compatibility
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
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

	capitalize(str) {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
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

  /* Task category badge */
  catBadge(c) {
    const m = {
      pembuatan_boq: 'badge-amber',
      timeline: 'badge-blue',
      ajuan_solusi_teknis: 'badge-purple',
      sto: 'badge-green',
      proposal_teknis: 'badge-cyan'
    };
    const l = {
      pembuatan_boq: 'Pembuatan BoQ',
      timeline: 'Timeline',
      ajuan_solusi_teknis: 'Ajuan Solusi Teknis',
      sto: 'STO',
      proposal_teknis: 'Proposal Teknis'
    };
    if (!c) return '<span class="badge badge-neutral">—</span>';
    return `<span class="badge ${m[c] || 'badge-neutral'}">${l[c] || c}</span>`;
  },

  /* All category options for dropdowns */
  catOptions(selected) {
    const cats = ['pembuatan_boq','timeline','ajuan_solusi_teknis','sto','proposal_teknis'];
    const labels = ['Pembuatan BoQ','Timeline','Ajuan Solusi Teknis','STO','Proposal Teknis'];
    const none = '<option value="">— Semua Kategori —</option>';
    const opts = cats.map((c,i) => `<option value="${c}" ${c===selected?'selected':''}>${labels[i]}</option>`).join('');
    return none + opts;
  },

  catOptionsNoAll(selected) {
    const cats = ['pembuatan_boq','timeline','ajuan_solusi_teknis','sto','proposal_teknis'];
    const labels = ['Pembuatan BoQ','Timeline','Ajuan Solusi Teknis','STO','Proposal Teknis'];
    return '<option value="">— Pilih —</option>' + cats.map((c,i) => `<option value="${c}" ${c===selected?'selected':''}>${labels[i]}</option>`).join('');
  },

  showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  },

  /* Format duration: milliseconds -> "2h 30m" or "1d 4h" */
  formatDuration(ms) {
    if (!ms || ms < 0) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h < 24) return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return d + 'd' + (rh > 0 ? ' ' + rh + 'h' : '');
  },

  /* Get total cycle time from pipeline history (ms) */
  calcCycleTime(history) {
    if (!history || history.length < 2) return null;
    const start = new Date(history[0].at).getTime();
    const doneEntry = history.find(h => h.status === 'done');
    const end = doneEntry ? new Date(doneEntry.at).getTime() : new Date(history[history.length - 1].at).getTime();
    return end - start;
  }
};
