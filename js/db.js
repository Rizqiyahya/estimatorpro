/* ============================================================
   EstimatorPro — Supabase Client + Local Cache Data Layer
   Connection details are deployment-managed, never user-configurable.
   ============================================================ */

const DB = {
  _mode: 'local', // 'local' | 'supabase'
  _supabase: null,

  /* ---- Init ---- */
  async init() {
    // Deployment-managed Supabase configuration. Never expose a service-role key in this client.
    const SUPABASE_URL = 'https://utvewmncpzibfetdfhat.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dmV3bW5jcHppYmZldGRmaGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MzQ4NjEsImV4cCI6MjEwMTAxMDg2MX0.IQemxJvjb8ZISkAGoiFfkJoHgyIUgZK5Z6jVQfJaPbo';

    // Legacy browser overrides are intentionally removed while safe interface preferences remain.
    Storage.saveSettings(Storage.getSettings());

    try {
      if (!window.supabase) {
        await this._loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
      }
      this._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      this._mode = 'supabase';
      console.log('✅ DB mode: managed cloud workspace');
      return true;
    } catch (e) {
      console.warn('Managed cloud unavailable, using local cache:', e.message);
      this._mode = 'local';
      return false;
    }
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(script);
    });
  },

  isCloud() { return this._mode === 'supabase'; },

  /* ---- Requests ---- */
  async getRequests() {
    if (this._mode === 'local') return Storage.getRequests();
    const { data, error } = await this._supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      scopePL: r.scope_pl, scopePS: r.scope_ps, scopeMS: r.scope_ms,
      emailBy: r.email_by, requestBy: r.request_by, endUser: r.end_user,
      noId: r.no_id, tenderCode: r.tender_code,
      createdAt: r.created_at, updatedAt: r.updated_at
    }));
  },

  async addRequest(r) {
    if (this._mode === 'local') return Storage.addRequest(r);
    const row = {
      // Keep the local UUID so queued/offline children always retain a stable request_id.
      // PostgreSQL still owns the immutable EP code through its insert trigger.
      ...(r.id ? { id: r.id } : {}),
      no_id: r.noId || 1,
      date: r.date || Utils.todayStr(),
      subject: r.subject || '',
      email_by: r.emailBy || '',
      request_by: r.requestBy || '',
      customer: r.customer || '',
      end_user: r.endUser || '',
      division: r.division || 'NETCO',
      scope_pl: r.scopePL || false,
      scope_ps: r.scopePS || false,
      scope_ms: r.scopeMS || false,
      note: r.note || '',
      status: r.status || 'open',
      created_by: await this._getUserId()
    };
    // Inserts force the database trigger to allocate the immutable EP code.
    // Do not derive it from the form's Date Received: the code identifies when
    // EstimatorPro registered the request, using Jakarta time in PostgreSQL.
    // Do not use `.single()` here: an INSERT may succeed but a restrictive
    // SELECT/RLS policy can return zero visible rows, which PostgREST reports as
    // "Cannot coerce the result to a single JSON object" and blocks the queue.
    const { data, error } = await this._supabase.from('requests').insert(row).select();
    if (error) throw error;
    const saved = data?.[0];
    if (!saved?.tender_code) {
      // The write can already be committed even when its returning row is not
      // visible. Treat the stable-ID retry as idempotent rather than creating a
      // duplicate request; the next cloud refresh will hydrate its EP Code.
      return { ...r, tenderCode: r.tenderCode || '', pendingTenderCode: true };
    }
    return { ...saved, scopePL: saved.scope_pl, scopePS: saved.scope_ps, scopeMS: saved.scope_ms, emailBy: saved.email_by, requestBy: saved.request_by, endUser: saved.end_user, noId: saved.no_id, tenderCode: saved.tender_code, createdAt: saved.created_at, updatedAt: saved.updated_at };
  },

  async updateRequest(id, u) {
    if (this._mode === 'local') return Storage.updateRequest(id, u);
    const row = { updated_at: new Date().toISOString() };
    if (u.subject !== undefined) row.subject = u.subject;
    if (u.date !== undefined) row.date = u.date;
    if (u.emailBy !== undefined) row.email_by = u.emailBy;
    if (u.requestBy !== undefined) row.request_by = u.requestBy;
    if (u.customer !== undefined) row.customer = u.customer;
    if (u.endUser !== undefined) row.end_user = u.endUser;
    if (u.division !== undefined) row.division = u.division;
    if (u.scopePL !== undefined) row.scope_pl = u.scopePL;
    if (u.scopePS !== undefined) row.scope_ps = u.scopePS;
    if (u.scopeMS !== undefined) row.scope_ms = u.scopeMS;
    if (u.note !== undefined) row.note = u.note;
    if (u.status !== undefined) row.status = u.status;
    const { data, error } = await this._supabase.from('requests').update(row).eq('id', id).select();
    if (error) throw error;
    const saved = data?.[0];
    // Database trigger is the atomic guarantee; also support deployments awaiting migration.
    // Use the local payload as fallback if a valid UPDATE has no visible returning row.
    const taskIdentity = saved || { subject: u.subject, customer: u.customer, end_user: u.endUser };
    const { error: syncError } = await this._supabase.from('tasks').update({
      subject_request: taskIdentity.subject, customer: taskIdentity.customer, end_user: taskIdentity.end_user
    }).eq('request_id', id);
    if (syncError) throw new Error('Request tersimpan, tetapi sinkronisasi Task gagal: ' + syncError.message);
    return saved || { ...u, id };
  },

  async deleteRequest(id) {
    if (this._mode === 'local') return Storage.deleteRequest(id);
    // Foreign key ON DELETE CASCADE membersihkan tasks, estimates, dan wbs secara atomik.
    const { error } = await this._supabase.from('requests').delete().eq('id', id);
    if (error) throw error;
  },

  async _inheritTaskIdentity(row, taskId) {
    let requestId = row.request_id;
    if (requestId === undefined && taskId) {
      const { data, error } = await this._supabase.from('tasks').select('request_id').eq('id', taskId).limit(1);
      if (error) throw error;
      requestId = data?.[0]?.request_id;
    }
    if (!requestId) return;
    const { data, error } = await this._supabase.from('requests').select('subject,customer,end_user').eq('id', requestId).limit(1);
    if (error) throw error;
    const request = data?.[0];
    if (!request) return;
    row.subject_request = request.subject;
    row.customer = request.customer;
    row.end_user = request.end_user;
  },

  /* ---- Tasks ---- */
  async getTasks() {
    if (this._mode === 'local') return Storage.getTasks();
    const { data, error } = await this._supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const requests = await this.getRequests();
    return Storage._resolveTaskParents(data || [], requests).map(t => ({
      ...t,
      requestId: t.request_id,
      subjectRequest: t.subject_request,
      subjectTask: t.subject_task,
      requestBy: t.request_by,
      endUser: t.end_user,
      scopePL: t.scope_pl, scopePS: t.scope_ps, scopeMS: t.scope_ms,
      pipelineStatus: t.pipeline_status,
      category: t.category,
      pipelineHistory: t.pipeline_history,
      boqLink: t.boq_link,
      createdAt: t.created_at, updatedAt: t.updated_at
    }));
  },

  async addTask(t) {
    if (this._mode === 'local') return Storage.addTask(t);
    const row = {
      id: t.id || undefined,
      request_id: t.requestId,
      date: t.date || new Date().toISOString().split('T')[0],
      subject_request: t.subjectRequest || '',
      subject_task: t.subjectTask || '',
      request_by: t.requestBy || '',
      customer: t.customer || '',
      end_user: t.endUser || '',
      scope_pl: t.scopePL || false,
      scope_ps: t.scopePS || false,
      scope_ms: t.scopeMS || false,
      location: t.location || '',
      priority: t.priority || 'Normal',
      pipeline_status: t.pipelineStatus || 'todo',
      boq_link: t.boqLink || '',
      category: t.category || '',
      pipeline_history: t.pipelineHistory || [],
      created_by: await this._getUserId()
    };
    // Upsert menjaga proses bootstrap dari cache lokal tetap aman bila ID telah ada.
    await this._inheritTaskIdentity(row);
    const { data, error } = await this._supabase.from('tasks').upsert(row, { onConflict: 'id' }).select();
    if (error) throw error;
    const saved = data?.[0];
    return saved
      ? { ...saved, requestId: saved.request_id, subjectRequest: saved.subject_request, subjectTask: saved.subject_task, requestBy: saved.request_by, endUser: saved.end_user, scopePL: saved.scope_pl, scopePS: saved.scope_ps, scopeMS: saved.scope_ms, pipelineStatus: saved.pipeline_status, boqLink: saved.boq_link, category: saved.category, pipelineHistory: saved.pipeline_history }
      : t;
  },

  async updateTask(id, u) {
    if (this._mode === 'local') return Storage.updateTask(id, u);
    const row = { updated_at: new Date().toISOString() };
    const map = {
      requestId: 'request_id', subjectRequest: 'subject_request', subjectTask: 'subject_task',
      requestBy: 'request_by', endUser: 'end_user', scopePL: 'scope_pl', scopePS: 'scope_ps',
      scopeMS: 'scope_ms', pipelineStatus: 'pipeline_status', boqLink: 'boq_link', category: 'category', pipelineHistory: 'pipeline_history'
    };
    for (const [k, v] of Object.entries(u)) {
      if (map[k]) row[map[k]] = v;
      else if (['date', 'customer', 'location', 'priority'].includes(k)) row[k] = v;
    }
    await this._inheritTaskIdentity(row, id);
    const { data, error } = await this._supabase.from('tasks').update(row).eq('id', id).select();
    if (error) throw error;
    const saved = data?.[0];
    return saved
      ? { ...saved, requestId: saved.request_id, subjectRequest: saved.subject_request, subjectTask: saved.subject_task, requestBy: saved.request_by, endUser: saved.end_user, scopePL: saved.scope_pl, scopePS: saved.scope_ps, scopeMS: saved.scope_ms, pipelineStatus: saved.pipeline_status, boqLink: saved.boq_link, category: saved.category, pipelineHistory: saved.pipeline_history }
      : { ...u, id };
  },

  async deleteTask(id) {
    if (this._mode === 'local') return Storage.deleteTask(id);
    await this._supabase.from('estimates').delete().eq('task_id', id);
    await this._supabase.from('wbs').delete().eq('task_id', id);
    const { error } = await this._supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  async getTasksByRequest(rid) {
    if (this._mode === 'local') return Storage.getTasksByRequest(rid);
    return (await this.getTasks()).filter(t => t.requestId === rid);
  },

  /* ---- Estimates ---- */
  async getEstimates() {
    if (this._mode === 'local') return Storage.getEstimates();
    const { data, error } = await this._supabase.from('estimates').select('*');
    if (error) throw error;
    return (data || []).map(e => ({
      ...e, taskId: e.task_id, unitPrice: e.unit_price, totalPrice: e.total_price,
      createdAt: e.created_at, updatedAt: e.updated_at || e.created_at
    }));
  },

  async addEstimate(e) {
    if (this._mode === 'local') return Storage.addEstimate(e);
    const row = {
      id: e.id || undefined,
      task_id: e.taskId, item: e.item || '', category: e.category || 'utama',
      quantity: e.quantity || null, unit: e.unit || '',
      unit_price: e.unitPrice || null, total_price: e.totalPrice || null,
      notes: e.notes || '', created_by: await this._getUserId()
    };
    // Upsert berdasarkan ID membuat pengiriman ulang antrean offline idempoten.
    const { data, error } = await this._supabase.from('estimates').upsert(row, { onConflict: 'id' }).select();
    if (error) throw error;
    const saved = data?.[0];
    return saved
      ? { ...saved, taskId: saved.task_id, unitPrice: saved.unit_price, totalPrice: saved.total_price }
      : e;
  },

  async updateEstimate(id, u) {
    if (this._mode === 'local') return Storage.updateEstimate(id, u);
    const row = { updated_at: new Date().toISOString() };
    const map = { taskId: 'task_id', unitPrice: 'unit_price', totalPrice: 'total_price' };
    for (const [k, v] of Object.entries(u)) {
      if (map[k]) row[map[k]] = v;
      else if (['item', 'category', 'quantity', 'unit', 'notes'].includes(k)) row[k] = v;
    }
    const { data, error } = await this._supabase.from('estimates').update(row).eq('id', id).select();
    if (error) throw error;
    const saved = data?.[0];
    return saved
      ? { ...saved, taskId: saved.task_id, unitPrice: saved.unit_price, totalPrice: saved.total_price }
      : { ...u, id };
  },

  async deleteEstimate(id) {
    if (this._mode === 'local') return Storage.deleteEstimate(id);
    const { error } = await this._supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
  },

  async getEstimatesByTask(tid) {
    if (this._mode === 'local') return Storage.getEstimatesByTask(tid);
    const { data, error } = await this._supabase.from('estimates').select('*').eq('task_id', tid);
    if (error) throw error;
    return (data || []).map(e => ({
      ...e, taskId: e.task_id, unitPrice: e.unit_price, totalPrice: e.total_price,
      createdAt: e.created_at, updatedAt: e.updated_at || e.created_at
    }));
  },

  /* ---- WBS (Work Breakdown Structure) ---- */
  async getWbs() {
    if (this._mode === 'local') return Storage.getWbs();
    const { data, error } = await this._supabase.from('wbs').select('*').order('seq', { ascending: true });
    if (error) throw error;
    return (data || []).map(w => ({
      ...w, taskId: w.task_id, parentId: w.parent_id, startDate: w.start_date, durationDays: w.duration_days,
      createdAt: w.created_at, updatedAt: w.updated_at || w.created_at
    }));
  },

  async addWbsItem(w) {
    if (this._mode === 'local') return Storage.addWbsItem(w);
    const row = {
      id: w.id || undefined,
      task_id: w.taskId, parent_id: w.parentId || null, level: w.level || 1,
      name: w.name || '', start_date: w.startDate || null, duration_days: w.durationDays || null,
      seq: w.seq || 0, created_by: await this._getUserId()
    };
    // Upsert berdasarkan ID membuat pengiriman ulang antrean offline idempoten.
    const { data, error } = await this._supabase.from('wbs').upsert(row, { onConflict: 'id' }).select();
    if (error) throw error;
    const saved = data?.[0];
    return saved
      ? { ...saved, taskId: saved.task_id, parentId: saved.parent_id, startDate: saved.start_date, durationDays: saved.duration_days }
      : w;
  },

  async updateWbsItem(id, u) {
    if (this._mode === 'local') return Storage.updateWbsItem(id, u);
    const row = { updated_at: new Date().toISOString() };
    const map = { taskId: 'task_id', parentId: 'parent_id', startDate: 'start_date', durationDays: 'duration_days' };
    for (const [k, v] of Object.entries(u)) {
      if (map[k]) row[map[k]] = v;
      else if (['name', 'level', 'seq'].includes(k)) row[k] = v;
    }
    const { data, error } = await this._supabase.from('wbs').update(row).eq('id', id).select();
    if (error) throw error;
    const saved = data?.[0];
    return saved
      ? { ...saved, taskId: saved.task_id, parentId: saved.parent_id, startDate: saved.start_date, durationDays: saved.duration_days }
      : { ...u, id };
  },

  async deleteWbsItem(id) {
    if (this._mode === 'local') return Storage.deleteWbsItem(id);
    const { error } = await this._supabase.from('wbs').delete().eq('id', id);
    if (error) throw error;
  },

  async getWbsByTask(tid) {
    if (this._mode === 'local') return Storage.getWbsByTask(tid);
    const { data, error } = await this._supabase.from('wbs').select('*').eq('task_id', tid).order('seq', { ascending: true });
    if (error) throw error;
    return (data || []).map(w => ({
      ...w, taskId: w.task_id, parentId: w.parent_id, startDate: w.start_date, durationDays: w.duration_days,
      createdAt: w.created_at, updatedAt: w.updated_at || w.created_at
    }));
  },

  /* ---- Utils ---- */
  async _getUserId() {
    if (this._mode === 'supabase' && this._supabase) {
      try { const { data: { session } } = await this._supabase.auth.getSession(); return session?.user?.id || null; } catch(e) { return null; }
    }
    return null;
  }
};
