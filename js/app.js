/* ============================================================
   EstimatorPro v3 — App Controller
   ============================================================ */

const App = {
  currentRoute: 'dashboard',

  async init() {
    const settings = Storage.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

    // Init DB (auto-detects Supabase if configured)
    await DB.init();
    if (DB.isCloud()) {
      await Storage.syncFromCloud();
      Storage.listenToCloud();
    }
    await Auth.init();

    document.getElementById('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      Storage.saveSettings({ ...Storage.getSettings(), theme: next });
    });

    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      const sb = document.getElementById('sidebar');
      sb.classList.toggle('open');
      App.toggleOverlay(sb.classList.contains('open'));
    });

    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        App.navigate('#' + item.dataset.route);
        document.getElementById('sidebar').classList.remove('open');
        App.toggleOverlay(false);
      });
    });

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) App.closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') App.closeModal();
    });

    window.addEventListener('hashchange', () => App.route());
    this.route();
  },

  route() {
    const hash = window.location.hash || '#dashboard';
    this.currentRoute = hash.replace('#', '') || 'dashboard';
    this.setActiveNav();
    this.renderView();
  },

  navigate(hash) { window.location.hash = hash; },

  setActiveNav() {
    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
      item.classList.toggle('active', item.dataset.route === this.currentRoute);
    });
    // Update badges
    const open = Storage.getRequests().filter(r => r.status === 'open').length;
    const active = Storage.getTasks().filter(t => t.pipelineStatus !== 'done').length;
    const bo = document.getElementById('navReqOpen'); if (bo) bo.textContent = open;
    const bt = document.getElementById('navTaskActive'); if (bt) bt.textContent = active;

    // Auth area
    const authArea = document.getElementById('authArea');
    if (authArea) {
      const user = Auth.getUser();
      if (user && DB.isCloud()) {
        authArea.style.display = 'block';
        document.getElementById('userName').textContent = user.email || 'User';
        document.getElementById('userRole').textContent = 'Estimator · PT. Starcom';
        document.getElementById('userAvatar').textContent = (user.email || '?')[0].toUpperCase();
      } else if (DB.isCloud()) {
        authArea.style.display = 'block';
        document.getElementById('userName').textContent = 'Not signed in';
        document.getElementById('userRole').textContent = 'Cloud mode';
        document.getElementById('userAvatar').textContent = '?';
        // Click to login
        authArea.onclick = () => Auth.showLogin();
        authArea.style.cursor = 'pointer';
      } else {
        authArea.style.display = 'none';
      }
    }
  },

  renderView() {
    const main = document.getElementById('mainContent');
    const views = {
      'dashboard': Dashboard, 'requests': Requests, 'tasks': Tasks,
      'kanban': Kanban, 'estimates': Estimates, 'settings': SettingsView
    };
    const View = views[this.currentRoute] || Dashboard;
    // Reset filters when switching views
    main.innerHTML = View.render();
  },

  openModal(html, size = '') {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    box.className = 'modal-box' + (size ? ' ' + size : '');
    box.innerHTML = html;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.body.style.overflow = '';
  },

  toggleOverlay(show) {
    let overlay = document.querySelector('.sidebar-overlay');
    if (show && !overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay show';
      overlay.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        overlay.remove();
      });
      document.body.appendChild(overlay);
    } else if (!show && overlay) {
      overlay.remove();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
