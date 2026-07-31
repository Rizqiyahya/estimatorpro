/* ============================================================
   EstimatorPro v3 — Storage (localStorage CRUD)
   ============================================================ */

const Storage = {
  _load(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch(e) { return []; } },
  _save(k,d) { try { localStorage.setItem(k, JSON.stringify(d)); } catch(e) { Utils.showToast('Storage penuh!','error'); } },

  /* ---- Cloud background sync ---- */
  _cloudPush(op, data) {
    if (!DB.isCloud()) return;
    // Fire & forget — don't block UI
    (async () => {
      try {
        if (op === 'addReq') await DB.addRequest(data);
        else if (op === 'updReq') await DB.updateRequest(data.id, data);
        else if (op === 'delReq') await DB.deleteRequest(data.id);
        else if (op === 'addTask') await DB.addTask(data);
        else if (op === 'updTask') await DB.updateTask(data.id, data);
        else if (op === 'delTask') await DB.deleteTask(data.id);
        else if (op === 'addEst') await DB.addEstimate(data);
        else if (op === 'updEst') await DB.updateEstimate(data.id, data);
        else if (op === 'delEst') await DB.deleteEstimate(data.id);
      } catch(e) { console.warn('Cloud sync error:', e.message); }
    })();
  },

  /* Pull all cloud data into localStorage */
  async syncFromCloud() {
    if (!DB.isCloud()) return;
    try {
      const [reqs, tasks, ests] = await Promise.all([
        DB.getRequests(), DB.getTasks(), DB.getEstimates()
      ]);
      // Merge: cloud wins for existing, keep local non-conflicting
      if (reqs.length) this.saveRequests(reqs);
      if (tasks.length) this.saveTasks(tasks);
      if (ests.length) this.saveEstimates(ests);
      console.log('📥 Synced from cloud:', reqs.length, 'reqs,', tasks.length, 'tasks,', ests.length, 'estimates');
    } catch(e) { console.warn('Cloud sync failed:', e.message); }
  },

  /* Realtime: listen for changes from other users */
  listenToCloud() {
    if (!DB.isCloud() || !DB._supabase) return;
    const sub = DB._supabase
      .channel('storage-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => this.syncFromCloud())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => this.syncFromCloud())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estimates' }, () => this.syncFromCloud())
      .subscribe();
    console.log('🔄 Realtime sync active');
    return sub;
  },

  // Requests
  getRequests() { return this._load('ep2_requests'); },
  saveRequests(d) { this._save('ep2_requests', d); },
  addRequest(r) {
    const a = this.getRequests();
    r.id = Utils.genId(); r.noId = a.length + 1;
    r.status = r.status || 'open'; r.division = r.division || 'NETCO';
    r.createdAt = r.updatedAt = new Date().toISOString();
    a.push(r); this.saveRequests(a);
    this._cloudPush('addReq', r);
    return r;
  },
  updateRequest(id, u) {
    const a = this.getRequests(); const i = a.findIndex(r => r.id === id);
    if (i!==-1) { a[i] = {...a[i],...u,updatedAt:new Date().toISOString()}; this.saveRequests(a); this._cloudPush('updReq', a[i]); return a[i]; }
    return null;
  },
  deleteRequest(id) {
    this.saveRequests(this.getRequests().filter(r => r.id !== id));
    this.saveTasks(this.getTasks().filter(t => t.requestId !== id));
    this._cloudPush('delReq', { id });
  },

  // Tasks
  getTasks() { return this._load('ep2_tasks'); },
  saveTasks(d) { this._save('ep2_tasks', d); },
  addTask(t) {
    const a = this.getTasks();
    t.id = Utils.genId(); t.createdAt = t.updatedAt = new Date().toISOString();
    a.push(t); this.saveTasks(a);
    this._cloudPush('addTask', t);
    return t;
  },
  updateTask(id, u) {
    const a = this.getTasks(); const i = a.findIndex(t => t.id === id);
    if (i!==-1) { a[i] = {...a[i],...u,updatedAt:new Date().toISOString()}; this.saveTasks(a); this._cloudPush('updTask', a[i]); return a[i]; }
    return null;
  },
  deleteTask(id) { this.saveTasks(this.getTasks().filter(t => t.id !== id)); this._cloudPush('delTask', { id }); },
  getTasksByRequest(rid) { return this.getTasks().filter(t => t.requestId === rid); },

  // Estimates
  getEstimates() { return this._load('ep2_estimates'); },
  saveEstimates(d) { this._save('ep2_estimates', d); },
  addEstimate(e) {
    const a = this.getEstimates();
    e.id = Utils.genId(); e.createdAt = new Date().toISOString();
    a.push(e); this.saveEstimates(a);
    this._cloudPush('addEst', e);
    return e;
  },
  updateEstimate(id, u) {
    const a = this.getEstimates(); const i = a.findIndex(e => e.id === id);
    if (i!==-1) { a[i] = {...a[i],...u}; this.saveEstimates(a); this._cloudPush('updEst', a[i]); return a[i]; }
    return null;
  },
  deleteEstimate(id) { this.saveEstimates(this.getEstimates().filter(e => e.id !== id)); this._cloudPush('delEst', { id }); },
  getEstimatesByTask(tid) { return this.getEstimates().filter(e => e.taskId === tid); },

  // Settings
  getSettings() {
    const d = { theme: 'dark' };
    try { return {...d,...JSON.parse(localStorage.getItem('ep2_settings'))}; } catch(e) { return d; }
  },
  saveSettings(s) { this._save('ep2_settings', s); },

  // Export / Import / Reset
  exportAll() { return { version:'2.0', exportedAt:new Date().toISOString(), requests:this.getRequests(), tasks:this.getTasks(), estimates:this.getEstimates() }; },
  importAll(data) {
    if (!data || data.version !== '2.0') throw new Error('Invalid format');
    if (data.requests) this.saveRequests(data.requests);
    if (data.tasks) this.saveTasks(data.tasks);
    if (data.estimates) this.saveEstimates(data.estimates);
  },
  resetAll() { ['ep2_requests','ep2_tasks','ep2_estimates'].forEach(k => localStorage.removeItem(k)); }
};
