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

  /* ---- Cloud sync: antrean persisten, retry, dan merge aman ---- */
  _queueKey: 'ep2_cloud_queue',
  _syncState: 'lokal',
  _syncing: false,
  _retryTimer: null,
  _loadQueue() { return this._load(this._queueKey); },
  _saveQueue(queue) { this._save(this._queueKey, queue); },
  _setSyncState(state, detail = '') {
    this._syncState = state;
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const labels = { lokal: 'Mode lokal', syncing: 'Menyinkronkan…', synced: 'Tersinkron', pending: 'Menunggu sinkronisasi', error: 'Sinkronisasi gagal' };
    el.textContent = labels[state] || state;
    el.title = detail || el.textContent;
    el.dataset.state = state;
  },
  _enqueue(op, data) {
    const queue = this._loadQueue();
    const type = op.replace(/^(add|upd|del)/, '');
    const id = data.id;
    const previous = queue.findIndex(item => item.type === type && item.data.id === id);
    const previousItem = previous !== -1 ? queue[previous] : null;
    if (previous !== -1) queue.splice(previous, 1);
    // Hapus setelah item baru belum pernah tersinkron tidak perlu dikirim ke cloud.
    if (!(op.startsWith('del') && previousItem?.op.startsWith('add'))) {
      queue.push({ op, type, data, queuedAt: new Date().toISOString() });
    }
    this._saveQueue(queue);
    this._setSyncState('pending', `${queue.length} perubahan belum tersinkron`);
  },
  _cloudPush(op, data) {
    if (!DB.isCloud() || !Auth.getUser()) return;
    this._enqueue(op, data);
    this.flushCloudQueue();
  },
  async _executeCloudOp(op, data) {
    try {
      if (op === 'addReq') return await DB.addRequest(data);
      if (op === 'updReq') return await DB.updateRequest(data.id, data);
      if (op === 'delReq') return await DB.deleteRequest(data.id);
      if (op === 'addTask') return await DB.addTask(data);
      if (op === 'updTask') return await DB.updateTask(data.id, data);
      if (op === 'delTask') return await DB.deleteTask(data.id);
      // Saat bootstrap data lama, estimate/WBS bisa telah ada di cloud.
      // Gunakan update langsung jika insert bertabrakan agar tidak membaca `data` null.
      if (op === 'addEst') return await DB.addEstimate(data);
      if (op === 'updEst') return await DB.updateEstimate(data.id, data);
      if (op === 'delEst') return await DB.deleteEstimate(data.id);
      if (op === 'addWbs') return await DB.addWbsItem(data);
      if (op === 'updWbs') return await DB.updateWbsItem(data.id, data);
      if (op === 'delWbs') return await DB.deleteWbsItem(data.id);
    } catch (e) {
      // Data lama mungkin sudah ada di cloud tetapi belum pernah tercatat di antrean.
      // Ubah insert konflik menjadi update agar antrean tidak macet selamanya.
      if (op.startsWith('add') && e.code === '23505') {
        return this._executeCloudOp(op.replace('add', 'upd'), data);
      }
      throw e;
    }
  },
  async flushCloudQueue() {
    if (this._syncing || !DB.isCloud() || !Auth.getUser()) return;
    const queue = this._loadQueue();
    if (!queue.length) { this._setSyncState('synced'); return; }
    this._syncing = true;
    this._setSyncState('syncing');
    try {
      while (this._loadQueue().length) {
        const item = this._loadQueue()[0];
        await this._executeCloudOp(item.op, item.data);
        const remaining = this._loadQueue();
        const completedIndex = remaining.findIndex(q => q.queuedAt === item.queuedAt && q.op === item.op && q.data.id === item.data.id);
        if (completedIndex !== -1) remaining.splice(completedIndex, 1);
        this._saveQueue(remaining);
      }
      this._setSyncState('synced');
    } catch (e) {
      console.warn('Cloud sync error:', e.message);
      this._setSyncState('error', `Perubahan tersimpan di perangkat dan akan dicoba kembali. ${e.message}`);
      clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => this.flushCloudQueue(), 15000);
    } finally { this._syncing = false; }
  },
  _mergeByLatest(local, cloud) {
    const map = new Map(local.map(item => [item.id, item]));
    cloud.forEach(remote => {
      const current = map.get(remote.id);
      const localTime = new Date(current?.updatedAt || current?.createdAt || 0).getTime();
      const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
      if (!current || remoteTime >= localTime) map.set(remote.id, remote);
    });
    return [...map.values()];
  },
  async pushLocalToCloud() {
    if (!DB.isCloud() || !Auth.getUser()) return;
    // Data lama yang belum memiliki antrean tetap dikirim sekali, dengan urutan relasi aman.
    const queue = this._loadQueue();
    if (!queue.length) {
      this.getRequests().forEach(item => this._enqueue('addReq', item));
      this.getTasks().forEach(item => this._enqueue('addTask', item));
      this.getEstimates().forEach(item => this._enqueue('addEst', item));
      this.getWbs().forEach(item => this._enqueue('addWbs', item));
    }
    await this.flushCloudQueue();
  },
  async syncFromCloud() {
    if (!DB.isCloud() || !Auth.getUser()) return;
    try {
      const [reqs, tasks, ests, wbs] = await Promise.all([DB.getRequests(), DB.getTasks(), DB.getEstimates(), DB.getWbs()]);
      this.saveRequests(this._mergeByLatest(this.getRequests(), reqs));
      const mergedTasks = this._mergeByLatest(this.getTasks(), tasks);
      this.saveTasks(mergedTasks);
      mergedTasks.forEach(t => { if (t.location) Utils.addLocation(t.location); });
      this.saveEstimates(this._mergeByLatest(this.getEstimates(), ests));
      this.saveWbs(this._mergeByLatest(this.getWbs(), wbs));
      if (!this._loadQueue().length) this._setSyncState('synced');
      console.log('📥 Data cloud berhasil digabungkan.');
    } catch(e) {
      console.warn('Cloud sync failed:', e.message);
      this._setSyncState('error', 'Tidak dapat mengambil data cloud.');
    }
  },

  /* Realtime: listen for changes from other users */
  listenToCloud() {
    if (!DB.isCloud() || !DB._supabase) return;
    const sub = DB._supabase
      .channel('storage-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => this.syncFromCloud())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => this.syncFromCloud())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estimates' }, () => this.syncFromCloud())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wbs' }, () => this.syncFromCloud())
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
    if (i!==-1) {
      const oldStatus = a[i].status;
      a[i] = {...a[i],...u,updatedAt:new Date().toISOString()};
      this.saveRequests(a);
      // Cascade status change to linked tasks
      const newStatus = a[i].status;
      if (newStatus !== oldStatus) {
        if (newStatus === 'lose' && oldStatus === 'open') {
          this._cascadeTaskStatus(id, 'done', oldStatus);
          Utils.showToast('Request Drop/Lose → semua task di-mark Done', 'info');
        } else if (newStatus === 'open' && oldStatus === 'lose') {
          this._cascadeTaskStatus(id, 'todo', oldStatus);
          Utils.showToast('Request dibuka kembali → semua task kembali ke To Do', 'info');
        }
      }
      this._cloudPush('updReq', a[i]); return a[i];
    }
    return null;
  },

  /* Cascade request status change → update all linked task pipeline status */
  _cascadeTaskStatus(requestId, newPipeline, _oldReqStatus) {
    const tasks = this.getTasks();
    let changed = false;
    tasks.forEach(t => {
      if (t.requestId === requestId && t.pipelineStatus !== newPipeline) {
        const oldTaskStatus = t.pipelineStatus;
        t.pipelineStatus = newPipeline;
        t.updatedAt = new Date().toISOString();
        // Track pipeline history
        if (!t.pipelineHistory) t.pipelineHistory = [];
        t.pipelineHistory.push({
          status: newPipeline,
          from: oldTaskStatus,
          at: new Date().toISOString(),
          by: Auth.getUser()?.email || 'local'
        });
        changed = true;
      }
    });
    if (changed) {
      this.saveTasks(tasks);
      // Push each changed task to cloud
      tasks.filter(t => t.requestId === requestId).forEach(t => {
        this._cloudPush('updTask', t);
      });
    }
  },
  deleteRequest(id) {
    const taskIds = this.getTasks().filter(t => t.requestId === id).map(t => t.id);
    const estimates = this.getEstimates();
    const wbs = this.getWbs();
    this.saveRequests(this.getRequests().filter(r => r.id !== id));
    this.saveTasks(this.getTasks().filter(t => t.requestId !== id));
    this.saveEstimates(estimates.filter(e => !taskIds.includes(e.taskId)));
    this.saveWbs(wbs.filter(w => !taskIds.includes(w.taskId)));
    // FK cascade di database menangani children; hapus lokal dilakukan eksplisit agar tidak ada data yatim.
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
  deleteTask(id) {
    this.saveTasks(this.getTasks().filter(t => t.id !== id));
    this.saveEstimates(this.getEstimates().filter(e => e.taskId !== id));
    this.saveWbs(this.getWbs().filter(w => w.taskId !== id));
    this._cloudPush('delTask', { id });
  },
  autoPrioritize() {
    const tasks = this.getTasks();
    const today = Utils.todayStr();
    let changed = false;
    tasks.forEach(t => {
      if (t.pipelineStatus !== 'done' && t.targetDate && t.targetDate < today && t.priority !== 'High') {
        t.priority = 'High';
        t.updatedAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) this.saveTasks(tasks);
    return changed;
  },
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

  // WBS (Work Breakdown Structure)
  getWbs() { return this._load('ep2_wbs'); },
  saveWbs(d) { this._save('ep2_wbs', d); },
  addWbsItem(w) {
    const a = this.getWbs();
    w.id = Utils.genId(); w.level = w.level || 1; w.createdAt = new Date().toISOString();
    a.push(w); this.saveWbs(a);
    this._cloudPush('addWbs', w);
    return w;
  },
  updateWbsItem(id, u) {
    const a = this.getWbs(); const i = a.findIndex(w => w.id === id);
    if (i!==-1) { a[i] = {...a[i],...u}; this.saveWbs(a); this._cloudPush('updWbs', a[i]); return a[i]; }
    return null;
  },
  deleteWbsItem(id) { this.saveWbs(this.getWbs().filter(w => w.id !== id)); this._cloudPush('delWbs', { id }); },
  getWbsByTask(tid) { return this.getWbs().filter(w => w.taskId === tid); },

  // Settings
  getSettings() {
    const d = { theme: 'dark' };
    try { return {...d,...JSON.parse(localStorage.getItem('ep2_settings'))}; } catch(e) { return d; }
  },
  saveSettings(s) { this._save('ep2_settings', s); },

  // Export / Import / Reset
  exportAll() { return { version:'2.0', exportedAt:new Date().toISOString(), requests:this.getRequests(), tasks:this.getTasks(), estimates:this.getEstimates(), wbs:this.getWbs() }; },
  importAll(data) {
    if (!data || data.version !== '2.0') throw new Error('Invalid format');
    if (data.requests) this.saveRequests(data.requests);
    if (data.tasks) this.saveTasks(data.tasks);
    if (data.estimates) this.saveEstimates(data.estimates);
    if (data.wbs) this.saveWbs(data.wbs);
  },
  resetAll() { ['ep2_requests','ep2_tasks','ep2_estimates','ep2_wbs'].forEach(k => localStorage.removeItem(k)); }
};
