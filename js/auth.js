/* ============================================================
   EstimatorPro — Auth Module
   ============================================================ */

const Auth = {
  async init() {
    if (!DB.isCloud()) return; // No auth in local mode
    const { data: { session } } = await DB._supabase.auth.getSession();
    if (session) {
      this._user = session.user;
    }
  },

  getUser() { return this._user; },

  showLogin() {
    const html = `
      <div style="text-align:center;padding:20px">
        <div style="font-size:3rem;margin-bottom:12px">📐</div>
        <h2 style="font-size:1.4rem;font-weight:700;margin-bottom:4px">EstimatorPro</h2>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:24px">Sign in with your company email</p>
      </div>
      <form id="loginForm" onsubmit="Auth.login(event)" style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" name="email" required placeholder="nama@starcoms.net" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" name="password" required placeholder="········" minlength="6">
        </div>
        <div id="loginError" style="color:var(--red);font-size:0.8rem;display:none"></div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px">
          Sign In
        </button>
      </form>
      <div style="text-align:center;margin-top:14px;font-size:0.82rem;color:var(--text-secondary)">
        Don't have an account?
        <a href="#" onclick="Auth.showRegister()" style="color:var(--accent);font-weight:600">Register</a>
      </div>
    `;
    App.openModal(html);
  },

  showRegister() {
    const html = `
      <div style="text-align:center;padding:20px">
        <div style="font-size:3rem;margin-bottom:12px">📐</div>
        <h2 style="font-size:1.4rem;font-weight:700;margin-bottom:4px">Create Account</h2>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:24px">Register with your company email</p>
      </div>
      <form id="registerForm" onsubmit="Auth.register(event)" style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" class="form-input" name="name" required placeholder="Your full name">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" name="email" required placeholder="nama@starcoms.net">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" class="form-input" name="password" required placeholder="Min. 6 characters" minlength="6">
        </div>
        <div id="registerError" style="color:var(--red);font-size:0.8rem;display:none"></div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px">
          Create Account
        </button>
      </form>
      <div style="text-align:center;margin-top:14px;font-size:0.82rem;color:var(--text-secondary)">
        Already have an account?
        <a href="#" onclick="Auth.showLogin()" style="color:var(--accent);font-weight:600">Sign In</a>
      </div>
    `;
    App.openModal(html);
  },

  async login(e) {
    e.preventDefault();
    const f = document.getElementById('loginForm');
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';

    const { data, error } = await DB._supabase.auth.signInWithPassword({
      email: f.email.value.trim(),
      password: f.password.value
    });

    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
      return;
    }

    this._user = data.user;
    App.closeModal();
    Utils.showToast('Signed in as ' + data.user.email, 'success');
    App.renderView(); // Refresh everything
    App.setActiveNav();
  },

  async register(e) {
    e.preventDefault();
    const f = document.getElementById('registerForm');
    const errEl = document.getElementById('registerError');
    errEl.style.display = 'none';

    const { data, error } = await DB._supabase.auth.signUp({
      email: f.email.value.trim(),
      password: f.password.value,
      options: {
        data: { name: f.name.value.trim() }
      }
    });

    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
      return;
    }

    if (data.user && data.session) {
      this._user = data.user;
      App.closeModal();
      Utils.showToast('Account created! Welcome, ' + data.user.email, 'success');
      App.renderView();
      App.setActiveNav();
    } else {
      App.closeModal();
      Utils.showToast('Check your email to confirm your account.', 'info');
    }
  },

  async logout() {
    if (!DB.isCloud()) return;
    await DB._supabase.auth.signOut();
    this._user = null;
    Utils.showToast('Signed out', 'info');
    App.renderView();
    App.setActiveNav();
  }
};
