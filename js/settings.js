/* ============================================================
   EstimatorPro v3 — Settings
   ============================================================ */

const SettingsView = {
  render() {
    const d = Storage.exportAll();
    const cloudReady = DB && DB.isCloud && DB.isCloud();
    const lastSync = localStorage.getItem(Storage._lastSyncKey);
    const signedIn = Boolean(Auth.getUser());
    const queuedChanges = Storage._loadQueue().length;
    const syncError = Storage.getLastSyncError?.();
    const isSynced = Storage._syncState === 'synced';
    const syncLabel = cloudReady ? (isSynced ? 'Tersinkron' : Storage._syncState === 'syncing' ? 'Menyinkronkan…' : 'Menunggu sinkronisasi') : 'Offline cache';
    const syncClass = cloudReady && isSynced ? 'success' : 'warning';
    const lastSyncLabel = lastSync ? new Date(lastSync).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' }) : 'Belum ada sinkronisasi tercatat';
    const html = `
      <div class="page-header">
        <div><h1 class="page-title">Settings</h1><p class="page-subtitle">Data management, synchronization & backup</p></div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">☁️ Data & Synchronization</h3>
        <div class="settings-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
            <div>
              <strong>Starcom EstimatorPro Workspace</strong>
              <p style="font-size:0.84rem;color:var(--text-secondary);margin-top:4px">Koneksi data dikelola oleh administrator aplikasi. Kredensial cloud tidak dapat diubah dari perangkat pengguna.</p>
            </div>
            <span class="status-badge ${syncClass}">${cloudReady ? '●' : '◌'} ${syncLabel}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0">
            <div class="sync-info-item"><span>Mode data</span><strong>${cloudReady ? 'Cloud + local cache' : 'Local cache'}</strong></div>
            <div class="sync-info-item"><span>Sinkronisasi terakhir</span><strong>${lastSyncLabel}</strong></div>
            <div class="sync-info-item"><span>Perubahan tertunda</span><strong>${queuedChanges} perubahan</strong></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="SettingsView.retrySync()" ${cloudReady && signedIn ? '' : 'disabled'}>↻ Sync sekarang</button>
            <button class="btn btn-secondary btn-sm" onclick="SettingsView.exportData()">⇩ Download Backup</button>
          </div>
          ${syncError ? `<div class="sync-error-detail" role="status"><strong>Sinkronisasi terakhir belum selesai.</strong><span>${Utils.escapeHtml(syncError.userMessage || 'Perubahan tetap aman di perangkat.')}</span>${syncError.operation ? `<small>Operasi: ${Utils.escapeHtml(syncError.operation)} · ID data: ${Utils.escapeHtml(String(syncError.recordId || '-').slice(0, 12))}</small>` : ''}</div>` : ''}
          <p style="font-size:0.78rem;color:var(--text-muted);margin-top:12px">Realtime digunakan untuk pembaruan instan. Jika Realtime terganggu, aplikasi memeriksa cloud setiap 60 detik saat halaman aktif. Perubahan lokal tetap tersimpan dan akan dicoba kembali saat koneksi tersedia.</p>
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
    a.download = `estimatorpro_backup_${Utils.todayStr()}.json`;
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

  async retrySync() {
    if (!DB || !DB.isCloud || !DB.isCloud()) {
      Utils.showToast('Cloud workspace sedang tidak tersedia. Coba lagi saat koneksi pulih.', 'warning');
      return;
    }
    const result = await Storage.syncNow();
    if (result.ok) {
      Utils.showToast('Sinkronisasi berhasil diperbarui.', 'success');
      App.navigate('#settings');
      return;
    }
    if (result.reason === 'busy') {
      Utils.showToast('Sinkronisasi sedang berjalan. Mohon tunggu sebentar.', 'info');
      return;
    }
    Utils.showToast(result.error?.userMessage || 'Sinkronisasi belum selesai. Perubahan tetap aman di perangkat.', 'error');
    App.navigate('#settings');
  }
};
