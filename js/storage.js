/* ============================================================
   EstimatorPro v3 — Storage (localStorage CRUD)
   ============================================================ */

const Storage = {
  // Request owns shared identity; task-specific work fields remain independent.
  _resolveTaskParents(tasks, requests) {
    const parents = new Map(requests.map(r => [r.id, r]));
    return tasks.map(t => {
      const r = parents.get(t.requestId ?? t.request_id);
      if (!r) return t; // Never guess links for orphan/standalone tasks.
      // Request owns tender identity. Task owns only its execution fields.
      const subject = r.subject ?? '';
      const requestBy = r.requestBy !== undefined ? r.requestBy : (r.request_by ?? '');
      const customer = r.customer ?? '';
      const endUser = r.endUser !== undefined ? r.endUser : (r.end_user ?? '');
      const tenderCode = r.tenderCode !== undefined ? r.tenderCode : (r.tender_code ?? '');
      return { ...t,
        requestId: r.id, request_id: r.id,
        subjectRequest: subject, subject_request: subject,
        requestBy, request_by: requestBy,
        customer, endUser, end_user: endUser,
        tenderCode, tender_code: tenderCode
      };
    });
  },
  _load(k) {
    try {
      const data = JSON.parse(localStorage.getItem(k)) || [];
      return k === 'ep2_tasks' ? this._resolveTaskParents(data, this._load('ep2_requests')) : data;
    } catch(e) { return []; }
  },
  _save(k,d) {
    try {
      if (k === 'ep2_tasks') d = this._resolveTaskParents(d, this._load('ep2_requests'));
      localStorage.setItem(k, JSON.stringify(d));
      if (k === 'ep2_requests') {
        const tasks = JSON.parse(localStorage.getItem('ep2_tasks') || '[]');
        localStorage.setItem('ep2_tasks', JSON.stringify(this._resolveTaskParents(tasks, d)));
      }
    } catch(e) { Utils.showToast('Storage penuh!','error'); }
  },

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
  _lastSyncKey: 'ep2_last_cloud_sync',
  _syncState: 'lokal',
  _syncing: false,
  _retryTimer: null,
  _pollTimer: null,
  _realtimeChannel: null,
  _refreshIfVisible: null,
  _syncWhenOnline: null,
  _pollIntervalMs: 60000,
  _loadQueue() { return this._load(this._queueKey); },
  _saveQueue(queue) { this._save(this._queueKey, queue); },
  _setSyncState(state, detail = '') {
    this._syncState = state;
    const labels = { lokal: 'Mode lokal', syncing: 'Menyinkronkan…', synced: 'Tersinkron', pending: 'Menunggu sinkronisasi', error: 'Sinkronisasi gagal' };
    const label = labels[state] || state;
    const queued = this._loadQueue().length;
    const lastSync = localStorage.getItem(this._lastSyncKey);
    const lastSyncLabel = lastSync
      ? new Date(lastSync).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : 'belum pernah';
    const statusDetail = detail || `${label}. ${queued ? `${queued} perubahan menunggu.` : `Sinkron terakhir ${lastSyncLabel}.`}`;
    const el = document.getElementById('syncStatus');
    if (el) {
      el.textContent = label;
      el.title = statusDetail;
      el.dataset.state = state;
    }
    const accountSync = document.getElementById('accountPopoverSync');
    if (accountSync) accountSync.textContent = statusDetail;
    const syncNow = document.getElementById('syncNowButton');
    if (syncNow) {
      syncNow.disabled = state === 'syncing' || !DB.isCloud() || !Auth.getUser();
      syncNow.title = statusDetail;
    }
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
      localStorage.setItem(this._lastSyncKey, new Date().toISOString());
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
    // Hanya kirim item yang belum ada di cloud. Sebelumnya seluruh cache lokal
    // dikirim setiap login dan menghasilkan konflik ID berulang pada estimate/WBS.
    const queue = this._loadQueue();
    if (!queue.length) {
      const [cloudReqs, cloudTasks, cloudEsts, cloudWbs] = await Promise.all([
        DB.getRequests(), DB.getTasks(), DB.getEstimates(), DB.getWbs()
      ]);
      const addMissing = (op, local, cloud) => {
        const cloudIds = new Set(cloud.map(item => item.id));
        local.filter(item => !cloudIds.has(item.id)).forEach(item => this._enqueue(op, item));
      };
      // Urutan menjaga parent tersedia sebelum child dikirim.
      addMissing('addReq', this.getRequests(), cloudReqs);
      addMissing('addTask', this.getTasks(), cloudTasks);
      addMissing('addEst', this.getEstimates(), cloudEsts);
      addMissing('addWbs', this.getWbs(), cloudWbs);
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
      if (!this._loadQueue().length) {
        localStorage.setItem(this._lastSyncKey, new Date().toISOString());
        this._setSyncState('synced');
      }
      console.log('📥 Data cloud berhasil digabungkan.');
    } catch(e) {
      console.warn('Cloud sync failed:', e.message);
      this._setSyncState('error', 'Tidak dapat mengambil data cloud.');
    }
  },

  async syncNow() {
    if (!DB.isCloud() || !Auth.getUser()) {
      this._setSyncState('lokal', 'Masuk ke cloud untuk menyinkronkan perubahan perangkat ini.');
      throw new Error('Cloud workspace belum tersedia.');
    }
    this._setSyncState('syncing', 'Memeriksa perubahan lokal dan cloud…');
    await this.flushCloudQueue();
    const queued = this._loadQueue().length;
    if (queued) {
      this._setSyncState('pending', `${queued} perubahan belum dapat dikirim. Akan dicoba otomatis lagi.`);
      throw new Error('Masih ada perubahan yang menunggu sinkronisasi.');
    }
    await this.syncFromCloud();
    return this._syncState === 'synced';
  },

  startCloudFallback() {
    if (this._pollTimer || !DB.isCloud() || !Auth.getUser()) return;
    this._refreshIfVisible = () => {
      if (document.visibilityState === 'visible') this.syncFromCloud();
    };
    this._syncWhenOnline = () => this.syncNow().catch(() => {});
    this._pollTimer = setInterval(this._refreshIfVisible, this._pollIntervalMs);
    window.addEventListener('online', this._syncWhenOnline);
    document.addEventListener('visibilitychange', this._refreshIfVisible);
    console.log('↻ Cloud fallback refresh active (60 seconds)');
  },

  stopCloudFallback() {
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    if (this._syncWhenOnline) window.removeEventListener('online', this._syncWhenOnline);
    if (this._refreshIfVisible) document.removeEventListener('visibilitychange', this._refreshIfVisible);
    this._syncWhenOnline = null;
    this._refreshIfVisible = null;
  },

  /* Realtime is convenient, but polling keeps data fresh when Realtime is delayed. */
  listenToCloud() {
    if (!DB.isCloud() || !DB._supabase || this._realtimeChannel) return this._realtimeChannel;
    const sync = () => this.syncFromCloud();
    const sub = DB._supabase
      .channel('storage-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, sync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, sync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estimates' }, sync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wbs' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('🔄 Realtime sync active');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime unavailable; periodic cloud refresh remains active.');
        }
      });
    this._realtimeChannel = sub;
    this.startCloudFallback();
    return sub;
  },

  stopCloudListeners() {
    this.stopCloudFallback();
    if (this._realtimeChannel && DB._supabase) DB._supabase.removeChannel(this._realtimeChannel);
    this._realtimeChannel = null;
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
      // Request is the source of truth for tender identity on each linked task.
      this._cascadeTaskIdentity(a[i]);
      // Cascade status change to linked tasks.
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

  _taskWithRequestIdentity(task, request) {
    const requestBy = request.requestBy !== undefined ? request.requestBy : (request.request_by ?? '');
    const endUser = request.endUser !== undefined ? request.endUser : (request.end_user ?? '');
    const tenderCode = request.tenderCode !== undefined ? request.tenderCode : (request.tender_code ?? '');
    return {
      ...task,
      requestId: request.id, request_id: request.id,
      subjectRequest: request.subject ?? '', subject_request: request.subject ?? '',
      requestBy, request_by: requestBy,
      customer: request.customer ?? '',
      endUser, end_user: endUser,
      tenderCode, tender_code: tenderCode
    };
  },

  _cascadeTaskIdentity(request) {
    const tasks = this.getTasks();
    let changed = false;
    const updatedTasks = tasks.map(task => {
      if ((task.requestId ?? task.request_id) !== request.id) return task;
      const updated = this._taskWithRequestIdentity(task, request);
      const identityChanged = ['subjectRequest', 'requestBy', 'customer', 'endUser', 'tenderCode']
        .some(key => task[key] !== updated[key]);
      if (!identityChanged) return task;
      changed = true;
      return { ...updated, updatedAt: new Date().toISOString() };
    });
    if (!changed) return;
    this.saveTasks(updatedTasks);
    updatedTasks.filter(task => (task.requestId ?? task.request_id) === request.id)
      .forEach(task => this._cloudPush('updTask', task));
  },

  /* Cascade request status change → update all linked task pipeline status */
  _cascadeTaskStatus(requestId, newPipeline, _oldReqStatus) {
    const tasks = this.getTasks();
    let changed = false;
    tasks.forEach(t => {
      if ((t.requestId ?? t.request_id) === requestId && t.pipelineStatus !== newPipeline) {
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
      tasks.filter(t => (t.requestId ?? t.request_id) === requestId).forEach(t => {
        this._cloudPush('updTask', t);
      });
    }
  },
  deleteRequest(id) {
    const taskIds = this.getTasks().filter(t => (t.requestId ?? t.request_id) === id).map(t => t.id);
    const estimates = this.getEstimates();
    const wbs = this.getWbs();
    this.saveRequests(this.getRequests().filter(r => r.id !== id));
    this.saveTasks(this.getTasks().filter(t => (t.requestId ?? t.request_id) !== id));
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
    const request = this.getRequests().find(r => r.id === (t.requestId ?? t.request_id));
    t = request ? this._taskWithRequestIdentity(t, request) : t;
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
      const requestId = u.requestId ?? u.request_id ?? a[i].requestId ?? a[i].request_id;
      const request = this.getRequests().find(r => r.id === requestId);
      a[i] = {...a[i], ...u, requestId, updatedAt:new Date().toISOString()};
      // A task cannot overwrite tender identity: its linked request is the source of truth.
      if (request) a[i] = this._taskWithRequestIdentity(a[i], request);
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
  getTasksByRequest(rid) { return this.getTasks().filter(t => (t.requestId ?? t.request_id) === rid); },

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

  // Settings — reserved only for non-sensitive interface preferences.
  getSettings() {
    const d = { theme: 'dark' };
    try {
      const saved = JSON.parse(localStorage.getItem('ep2_settings')) || {};
      const { supabaseUrl, supabaseKey, ...safeSettings } = saved;
      return {...d, ...safeSettings};
    } catch(e) { return d; }
  },
  saveSettings(s) {
    const { supabaseUrl, supabaseKey, ...safeSettings } = s || {};
    this._save('ep2_settings', safeSettings);
  },

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
