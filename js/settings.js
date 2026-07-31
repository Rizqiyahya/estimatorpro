/* ============================================================
   EstimatorPro v3 — Settings
   ============================================================ */

const SettingsView = {
  render() {
    const d = Storage.exportAll();
    const settings = Storage.getSettings();
    const html = `
      <div class="page-header">
        <div><h1 class="page-title">Settings</h1><p class="page-subtitle">Data management, backup & cloud config</p></div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">☁️ Cloud Configuration (Supabase)</h3>
        <div class="settings-card">
          <p style="font-size:0.84rem;color:var(--text-secondary);margin-bottom:14px">
            Connect to Supabase to enable multi-user access, cloud sync, and real-time updates.
            <a href="https://supabase.com" target="_blank" style="color:var(--accent)">Create free project →</a>
          </p>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="form-group">
              <label class="form-label">Supabase URL</label>
              <input type="text" class="form-input" id="supabaseUrl" value="${Utils.escapeHtml(settings.supabaseUrl || '')}" placeholder="https://xxxxxxxxxxxx.supabase.co">
            </div>
            <div class="form-group">
              <label class="form-label">Supabase Anon Key</label>
              <input type="text" class="form-input" id="supabaseKey" value="${Utils.escapeHtml(settings.supabaseKey || '')}" placeholder="eyJhbGciOiJIUzI1NiIs...">
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" onclick="SettingsView.saveSupabase()">💾 Save & Connect</button>
              ${settings.supabaseUrl ? `<button class="btn btn-secondary btn-sm" onclick="SettingsView.disconnectSupabase()">🔌 Disconnect</button>` : ''}
            </div>
            <div id="supabaseStatus" style="font-size:0.8rem;color:var(--text-muted)">
              ${settings.supabaseUrl ? '✅ Supabase configured. Refresh page to connect.' : '⚠️ Not connected — using local storage only.'}
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">📊 Data Overview</h3>
        <div class="kpi-grid" style="margin-bottom:0">
          <div class="kpi-card"><div class="kpi-value" style="font-size:1.4rem">${d.requests.length}</div><div class="kpi-label">Requests</div></div>
          <div class="kpi-card"><div class="kpi-value" style="font-size:1.4rem">${d.tasks.length}</div><div class="kpi-label">Tasks</div></div>
          <div class="kpi-card"><div class="kpi-value" style="font-size:1.4rem">${d.estimates.length}</div><div class="kpi-label">BoQ Items</div></div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">💾 Backup & Restore</h3>
        <div class="settings-card">
          <div style="display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div><strong>Export Data</strong><p style="font-size:0.8rem;color:var(--text-secondary)">Download all data as JSON backup.</p></div>
              <button class="btn btn-primary btn-sm" onclick="SettingsView.exportData()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export JSON</button>
            </div>
            <div style="border-top:1px solid var(--border-light)"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div><strong>Import Data</strong><p style="font-size:0.8rem;color:var(--text-secondary)">Restore from backup file.</p></div>
              <div>
                <input type="file" id="importFileInput" accept=".json" style="display:none" onchange="SettingsView.importData(event)">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('importFileInput').click()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import JSON</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">⚠️ Danger Zone</h3>
        <div class="settings-card" style="border-color:var(--red)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div><strong style="color:var(--red)">Reset All Data</strong><p style="font-size:0.8rem;color:var(--text-secondary)">Permanently delete everything.</p></div>
            <button class="btn btn-danger btn-sm" onclick="SettingsView.confirmReset()">Reset</button>
          </div>
        </div>
      </div>
    `; return html;
  },

  exportData() {
    const json = JSON.stringify(Storage.exportAll(), null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `estimatorpro_${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    Utils.showToast('Data exported','success');
  },

  importData(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { Storage.importAll(JSON.parse(ev.target.result)); Utils.showToast('Data imported!','success'); setTimeout(()=>App.navigate('#dashboard'),500); }
      catch(err) { Utils.showToast('Invalid file','error'); }
    };
    reader.readAsText(file); e.target.value='';
  },

  confirmReset() {
    App.openModal(`
      <div class="modal-header"><h2 class="modal-title" style="color:var(--red)">⚠️ Reset All</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <p style="color:var(--text-primary)">Delete <strong>all</strong> requests, tasks, and BoQ items? This cannot be undone.</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="Storage.resetAll();App.closeModal();App.navigate('#dashboard')">Reset Everything</button>
      </div>
    `);
  },

  saveSupabase() {
    const url = document.getElementById('supabaseUrl').value.trim();
    const key = document.getElementById('supabaseKey').value.trim();
    const settings = Storage.getSettings();
    settings.supabaseUrl = url;
    settings.supabaseKey = key;
    Storage.saveSettings(settings);
    Utils.showToast('Settings saved! Refresh page to connect.', 'success');
    document.getElementById('supabaseStatus').textContent = '✅ Saved. Reload page to activate cloud mode.';
  },

  disconnectSupabase() {
    const settings = Storage.getSettings();
    delete settings.supabaseUrl;
    delete settings.supabaseKey;
    Storage.saveSettings(settings);
    Utils.showToast('Disconnected. Using local storage.', 'info');
    document.getElementById('supabaseStatus').textContent = '⚠️ Disconnected — using local storage only.';
  }
};
