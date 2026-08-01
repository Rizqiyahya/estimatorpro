/* ============================================================
   EstimatorPro v3 — Storage (localStorage CRUD)
   ============================================================ */

const Storage = {
  _load(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch(e) { return []; } },
  _save(k,d) { try { localStorage.setItem(k, JSON.stringify(d)); } catch(e) { Utils.showToast('Storage penuh!','error'); } },

  /* Convert old-format IDs (id_xxxx) to valid UUIDs */
  _migrateIds(arr) {
    let changed = false;
    const oldToNew = {};
    for (const item of arr) {
      if (item.id && item.id.startsWith('id_')) {
        const newId = Utils.genId();
        oldToNew[item.id] = newId;
        item.id = newId;
        changed = true;
      }
    }
    return { changed, oldToNew };
  },

  /* Run migration once on init */
  migrate() {
    const migrated = localStorage.getItem('ep2_migrated_v3');
    if (migrated) return;

    // Migrate requests + build ID map
    const reqs = this._load('ep2_requests');
    const reqResult = this._migrateIds(reqs);
    if (reqResult.changed) this._save('ep2_requests', reqs);

    // Migrate tasks + fix requestId refs
    const tasks = this._load('ep2_tasks');
    const taskResult = this._migrateIds(tasks);
    for (const t of tasks) {
      if (t.requestId && reqResult.oldToNew[t.requestId]) {
        t.requestId = reqResult.oldToNew[t.requestId];
        taskResult.changed = true;
      }
    }
    if (taskResult.changed) this._save('ep2_tasks', tasks);

    // Migrate estimates + fix taskId refs
    const ests = this._load('ep2_estimates');
    const estResult = this._migrateIds(ests);
    for (const e of ests) {
      if (e.taskId && taskResult.oldToNew[e.taskId]) {
        e.taskId = taskResult.oldToNew[e.taskId];
        estResult.changed = true;
      }
    }
    if (estResult.changed) this._save('ep2_estimates', ests);

    localStorage.setItem('ep2_migrated_v3', '1');
    console.log('🔄 ID migration complete');
  },

  /* ---- Cloud background sync ---- */
  _cloudPush(op, data) {
    if (!DB.isCloud() || !Auth.getUser()) return; // Must be logged in
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

  /* Push all local data to cloud (call after login) */
  async pushLocalToCloud() {
    if (!DB.isCloud() || !Auth.getUser()) return;
    try {
      const reqs = this.getRequests();
      const tasks = this.getTasks();
      const ests = this.getEstimates();
      let pushed = 0;
      for (const r of reqs) { try { await DB.addRequest(r); pushed++; } catch(e) { /* dup ok */ } }
      for (const t of tasks) { try { await DB.addTask(t); pushed++; } catch(e) { /* dup ok */ } }
      for (const e of ests) { try { await DB.addEstimate(e); pushed++; } catch(e) { /* dup ok */ } }
      if (pushed) console.log('📤 Pushed', pushed, 'local items to cloud');
    } catch(e) { console.warn('Push local failed:', e.message); }
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
    t.category = t.category || '';
    // Initialize pipeline history
    t.pipelineHistory = t.pipelineHistory || [{
      status: t.pipelineStatus || 'todo',
      from: null,
      at: t.createdAt,
      by: Auth.getUser()?.email || 'local'
    }];
    a.push(t); this.saveTasks(a);
    this._cloudPush('addTask', t);
    return t;
  },
  updateTask(id, u) {
    const a = this.getTasks(); const i = a.findIndex(t => t.id === id);
    if (i!==-1) {
      const oldStatus = a[i].pipelineStatus;
      a[i] = {...a[i],...u,updatedAt:new Date().toISOString()};
      // Track pipeline history when status changes
      if (u.pipelineStatus && u.pipelineStatus !== oldStatus) {
        if (!a[i].pipelineHistory) a[i].pipelineHistory = [];
        a[i].pipelineHistory.push({
          status: u.pipelineStatus,
          from: oldStatus,
          at: new Date().toISOString(),
          by: Auth.getUser()?.email || 'local'
        });
      }
      this.saveTasks(a); this._cloudPush('updTask', a[i]); return a[i];
    }
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
