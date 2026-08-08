/* ============================================================
   EstimatorPro v3 — App Controller
   ============================================================ */

const App = {
  currentRoute: 'dashboard',

  async init() {
    const settings = Storage.getSettings();
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

    // Init DB (auto-detects Supabase if configured)
    Storage.migrate(); // Convert old IDs to UUIDs
    await DB.init();
    await Auth.init();

    // Show login gate if cloud mode and NOT logged in
    if (DB.isCloud() && !Auth.getUser()) {
      this.showLoginGate();
    } else {
      this.hideLoginGate();
    }

    // Sync AFTER auth is ready — only if user is logged in
    if (DB.isCloud() && Auth.getUser()) {
      await Storage.syncFromCloud();
      Storage.listenToCloud();
    }

    // Bind login gate events
    Auth.bindLoginGate();

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

    // Sidebar minimize / expand (desktop)
    const sbToggle = document.getElementById('sidebarToggle');
    if (sbToggle) {
      if (localStorage.getItem('ep2_sidebar_min') === '1') document.body.classList.add('sidebar-min');
      sbToggle.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-min');
        localStorage.setItem('ep2_sidebar_min', document.body.classList.contains('sidebar-min') ? '1' : '0');
        sbToggle.textContent = document.body.classList.contains('sidebar-min') ? '▾' : '▴';
      });
      sbToggle.textContent = document.body.classList.contains('sidebar-min') ? '▾' : '▴';
    }

    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        App.navigate('#' + item.dataset.route);
        document.getElementById('sidebar').classList.remove('open');
        App.toggleOverlay(false);
      });
      // Tooltip title when sidebar is minimized
      const label = item.querySelector('span');
      if (label && !item.getAttribute('title')) item.setAttribute('title', label.textContent.trim());
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

  renderSidebarUser() {
    const card = document.getElementById('sidebarUser');
    if (!card) return;

    if (DB.isCloud() && Auth.getUser()) {
      const u = Auth.getUser();
      const email = u.email || '';
      const name = u.user_metadata?.name || email.split('@')[0] || 'User';
      const initial = name.charAt(0).toUpperCase();

      document.getElementById('sidebarAvatar').textContent = initial;
      document.getElementById('sidebarAvatar').classList.remove('muted');
      document.getElementById('sidebarUserName').textContent = name;
      document.getElementById('sidebarUserEmail').textContent = email;
      document.getElementById('sidebarLogout').style.display = '';
      card.style.display = 'flex';
      card.classList.remove('clickable');
      document.getElementById('sidebarLogout').onclick = (e) => { e.stopPropagation(); Auth.logout(); };
    } else if (DB.isCloud()) {
      document.getElementById('sidebarAvatar').textContent = '?';
      document.getElementById('sidebarAvatar').classList.add('muted');
      document.getElementById('sidebarUserName').textContent = 'Not signed in';
      document.getElementById('sidebarUserEmail').textContent = 'Click to sign in';
      document.getElementById('sidebarLogout').style.display = 'none';
      card.style.display = 'flex';
      card.classList.add('clickable');
      card.onclick = () => App.showLoginGate();
    } else {
      card.style.display = 'none';
    }
  },

  renderView() {
    const main = document.getElementById('mainContent');
    const views = {
      'dashboard': Dashboard, 'requests': Requests, 'tasks': Tasks,
      'kanban': Kanban, 'estimates': Estimates, 'wbs': Wbs, 'gantt': Gantt,
      'settings': SettingsView
    };
    const View = views[this.currentRoute] || Dashboard;
    // Reset filters when switching views
    main.innerHTML = View.render();
    Utils.initComboboxes(main);
  },

  openModal(html, size = '') {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    box.className = 'modal-box' + (size ? ' ' + size : '');
    box.innerHTML = html;
    Utils.initComboboxes(box);
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
  },

  showLoginGate() {
    const gate = document.getElementById('loginGate');
    if (gate) gate.style.display = 'flex';
  },

  hideLoginGate() {
    const gate = document.getElementById('loginGate');
    if (gate) gate.style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
