/* ============================================================
   EstimatorPro — Supabase Client + Dual-Mode Data Layer
   Works with localStorage (offline) OR Supabase (cloud)
   Set SUPABASE_URL + SUPABASE_KEY in settings to activate cloud mode
   ============================================================ */

const DB = {
  _mode: 'local', // 'local' | 'supabase'
  _supabase: null,

  /* ---- Init ---- */
  async init() {
    // Hardcoded Supabase config — works on any PC without manual setup
    const SUPABASE_URL = 'https://utvewmncpzibfetdfhat.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dmV3bW5jcHppYmZldGRmaGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MzQ4NjEsImV4cCI6MjEwMTAxMDg2MX0.IQemxJvjb8ZISkAGoiFfkJoHgyIUgZK5Z6jVQfJaPbo';

    // Allow Settings page override
    const settings = Storage.getSettings();
    const url = settings.supabaseUrl || SUPABASE_URL;
    const key = settings.supabaseKey || SUPABASE_KEY;

    try {
      if (!window.supabase) {
        await this._loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
      }
      this._supabase = window.supabase.createClient(url, key);
      this._mode = 'supabase';
      console.log('✅ DB mode: Supabase cloud');
      return true;
    } catch (e) {
      console.warn('Supabase init failed, falling back to localStorage:', e.message);
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
    const { data } = await this._supabase.from('requests').select('*').order('created_at', { ascending: false });
    return (data || []).map(r => ({
      ...r,
      scopePL: r.scope_pl, scopePS: r.scope_ps, scopeMS: r.scope_ms,
      emailBy: r.email_by, requestBy: r.request_by, endUser: r.end_user,
      noId: r.no_id
    }));
  },

  async addRequest(r) {
    if (this._mode === 'local') return Storage.addRequest(r);
    const all = await this.getRequests();
    const row = {
      no_id: all.length + 1,
      date: r.date || new Date().toISOString().split('T')[0],
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
      created_by: this._getUserId()
    };
    const { data, error } = await this._supabase.from('requests').insert(row).select().single();
    if (error) throw error;
    return { ...data, scopePL: data.scope_pl, scopePS: data.scope_ps, scopeMS: data.scope_ms, emailBy: data.email_by, requestBy: data.request_by, endUser: data.end_user, noId: data.no_id };
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
    const { data } = await this._supabase.from('requests').update(row).eq('id', id).select().single();
    return data;
  },

  async deleteRequest(id) {
    if (this._mode === 'local') return Storage.deleteRequest(id);
    await this._supabase.from('tasks').delete().eq('request_id', id);
    await this._supabase.from('requests').delete().eq('id', id);
  },

  /* ---- Tasks ---- */
  async getTasks() {
    if (this._mode === 'local') return Storage.getTasks();
    const { data } = await this._supabase.from('tasks').select('*').order('created_at', { ascending: false });
    return (data || []).map(t => ({
      ...t,
      requestId: t.request_id,
      subjectRequest: t.subject_request,
      subjectTask: t.subject_task,
      requestBy: t.request_by,
      endUser: t.end_user,
      scopePL: t.scope_pl, scopePS: t.scope_ps, scopeMS: t.scope_ms,
      pipelineStatus: t.pipeline_status,
      boqLink: t.boq_link
    }));
  },

  async addTask(t) {
    if (this._mode === 'local') return Storage.addTask(t);
    const row = {
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
      created_by: this._getUserId()
    };
    const { data } = await this._supabase.from('tasks').insert(row).select().single();
    return { ...data, requestId: data.request_id, subjectRequest: data.subject_request, subjectTask: data.subject_task, requestBy: data.request_by, endUser: data.end_user, scopePL: data.scope_pl, scopePS: data.scope_ps, scopeMS: data.scope_ms, pipelineStatus: data.pipeline_status, boqLink: data.boq_link };
  },

  async updateTask(id, u) {
    if (this._mode === 'local') return Storage.updateTask(id, u);
    const row = { updated_at: new Date().toISOString() };
    const map = {
      requestId: 'request_id', subjectRequest: 'subject_request', subjectTask: 'subject_task',
      requestBy: 'request_by', endUser: 'end_user', scopePL: 'scope_pl', scopePS: 'scope_ps',
      scopeMS: 'scope_ms', pipelineStatus: 'pipeline_status', boqLink: 'boq_link'
    };
    for (const [k, v] of Object.entries(u)) {
      if (map[k]) row[map[k]] = v;
      else if (['date', 'customer', 'location', 'priority'].includes(k)) row[k] = v;
    }
    await this._supabase.from('tasks').update(row).eq('id', id);
    return u;
  },

  async deleteTask(id) {
    if (this._mode === 'local') return Storage.deleteTask(id);
    await this._supabase.from('estimates').delete().eq('task_id', id);
    await this._supabase.from('tasks').delete().eq('id', id);
  },

  async getTasksByRequest(rid) {
    if (this._mode === 'local') return Storage.getTasksByRequest(rid);
    const { data } = await this._supabase.from('tasks').select('*').eq('request_id', rid).order('created_at', { ascending: false });
    return (data || []).map(t => ({
      ...t, requestId: t.request_id, subjectRequest: t.subject_request,
      subjectTask: t.subject_task, requestBy: t.request_by, endUser: t.end_user,
      scopePL: t.scope_pl, scopePS: t.scope_ps, scopeMS: t.scope_ms,
      pipelineStatus: t.pipeline_status, boqLink: t.boq_link
    }));
  },

  /* ---- Estimates ---- */
  async getEstimates() {
    if (this._mode === 'local') return Storage.getEstimates();
    const { data } = await this._supabase.from('estimates').select('*');
    return (data || []).map(e => ({
      ...e, taskId: e.task_id, unitPrice: e.unit_price, totalPrice: e.total_price
    }));
  },

  async addEstimate(e) {
    if (this._mode === 'local') return Storage.addEstimate(e);
    const row = {
      task_id: e.taskId, item: e.item || '', category: e.category || 'utama',
      quantity: e.quantity || null, unit: e.unit || '',
      unit_price: e.unitPrice || null, total_price: e.totalPrice || null,
      notes: e.notes || '', created_by: this._getUserId()
    };
    const { data } = await this._supabase.from('estimates').insert(row).select().single();
    return { ...data, taskId: data.task_id, unitPrice: data.unit_price, totalPrice: data.total_price };
  },

  async updateEstimate(id, u) {
    if (this._mode === 'local') return Storage.updateEstimate(id, u);
    const row = {};
    const map = { taskId: 'task_id', unitPrice: 'unit_price', totalPrice: 'total_price' };
    for (const [k, v] of Object.entries(u)) {
      if (map[k]) row[map[k]] = v;
      else if (['item', 'category', 'quantity', 'unit', 'notes'].includes(k)) row[k] = v;
    }
    await this._supabase.from('estimates').update(row).eq('id', id);
    return u;
  },

  async deleteEstimate(id) {
    if (this._mode === 'local') return Storage.deleteEstimate(id);
    await this._supabase.from('estimates').delete().eq('id', id);
  },

  async getEstimatesByTask(tid) {
    if (this._mode === 'local') return Storage.getEstimatesByTask(tid);
    const { data } = await this._supabase.from('estimates').select('*').eq('task_id', tid);
    return (data || []).map(e => ({
      ...e, taskId: e.task_id, unitPrice: e.unit_price, totalPrice: e.total_price
    }));
  },

  /* ---- Utils ---- */
  _getUserId() {
    if (this._mode === 'supabase' && this._supabase) {
      return this._supabase.auth.getUser()?.id || null;
    }
    return null;
  }
};
