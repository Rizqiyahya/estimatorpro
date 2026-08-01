/* ============================================================
   EstimatorPro v3 — Tasks View (Flat Master To-Do List)
   ============================================================ */

const Tasks = {
  filterDiv: 'all',
  filterPipe: 'all',
  filterCat: 'all',
  filterScope: 'all',
  searchText: '',

  render() {
    let tasks = Storage.getTasks();
    const requests = Storage.getRequests();

    if (this.filterDiv !== 'all') {
      const reqIds = requests.filter(r => r.division === this.filterDiv).map(r => r.id);
      tasks = tasks.filter(t => reqIds.includes(t.requestId));
    }
    if (this.filterPipe !== 'all') tasks = tasks.filter(t => t.pipelineStatus === this.filterPipe);
    if (this.filterCat !== 'all') tasks = tasks.filter(t => (t.category || '') === this.filterCat);
    if (this.filterScope !== 'all') tasks = tasks.filter(t => {
      if (this.filterScope === 'PL') return t.scopePL;
      if (this.filterScope === 'PS') return t.scopePS;
      if (this.filterScope === 'MS') return t.scopeMS;
      return true;
    });
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      tasks = tasks.filter(t =>
        (t.subjectTask||'').toLowerCase().includes(q) ||
        (t.subjectRequest||'').toLowerCase().includes(q) ||
        (t.requestBy||'').toLowerCase().includes(q) ||
        (t.customer||'').toLowerCase().includes(q)
      );
    }

    const activeCount = Storage.getTasks().filter(t => t.pipelineStatus !== 'done').length;
    const divPills = [
      { id:'all', label:'All', style:'' },
      { id:'NETCO', label:'NETCO', style:`color:var(--netco);border-color:${this.filterDiv==='NETCO'?'var(--netco)':'var(--border)'}` },
      { id:'OMG', label:'OMG', style:`color:var(--omg);border-color:${this.filterDiv==='OMG'?'var(--omg)':'var(--border)'}` },
      { id:'ITSOL', label:'ITSOL', style:`color:var(--itsol);border-color:${this.filterDiv==='ITSOL'?'var(--itsol)':'var(--border)'}` },
    ];

    const html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Task Breakdown</h1>
          <p class="page-subtitle">All tasks across requests — ${tasks.length} of ${Storage.getTasks().length}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Tasks.openModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Task
          </button>
        </div>
      </div>

      <div class="filter-pills">
        ${divPills.map(d => `<button class="filter-pill ${this.filterDiv===d.id?'active':''}" style="${d.style}" onclick="Tasks.filterDiv='${d.id}';Tasks.refresh()">${d.label}</button>`).join('')}
        <span style="flex:1"></span>
        <select class="form-select" style="width:auto;padding:6px 10px;font-size:0.78rem" onchange="Tasks.filterCat=this.value;Tasks.refresh()">
          ${Utils.catOptions(this.filterCat === 'all' ? '' : this.filterCat).replace('— Semua Kategori —','📂 All Category')}
        </select>
        <button class="filter-pill ${this.filterPipe==='all'?'active':''}" onclick="Tasks.filterPipe='all';Tasks.refresh()">All</button>
        <button class="filter-pill ${this.filterPipe==='todo'?'active':''}" onclick="Tasks.filterPipe='todo';Tasks.refresh()">To Do</button>
        <button class="filter-pill ${this.filterPipe==='in_progress'?'active':''}" onclick="Tasks.filterPipe='in_progress';Tasks.refresh()">In Progress</button>
        <button class="filter-pill ${this.filterPipe==='review'?'active':''}" onclick="Tasks.filterPipe='review';Tasks.refresh()">Review</button>
        <button class="filter-pill ${this.filterPipe==='done'?'active':''}" onclick="Tasks.filterPipe='done';Tasks.refresh()">Done</button>
        <button class="filter-pill ${this.filterPipe==='revisi'?'active':''}" onclick="Tasks.filterPipe='revisi';Tasks.refresh()">Revisi</button>
        <span style="margin:0 4px;color:var(--border);font-size:0.7rem">|</span>
        <button class="filter-pill ${this.filterScope==='all'?'active':''}" onclick="Tasks.filterScope='all';Tasks.refresh()">🔍 All</button>
        <button class="filter-pill ${this.filterScope==='PL'?'active':''}" style="border-color:${this.filterScope==='PL'?'var(--accent)':'var(--border)'}" onclick="Tasks.filterScope='PL';Tasks.refresh()">PL</button>
        <button class="filter-pill ${this.filterScope==='PS'?'active':''}" style="border-color:${this.filterScope==='PS'?'var(--accent)':'var(--border)'}" onclick="Tasks.filterScope='PS';Tasks.refresh()">PS</button>
        <button class="filter-pill ${this.filterScope==='MS'?'active':''}" style="border-color:${this.filterScope==='MS'?'var(--accent)':'var(--border)'}" onclick="Tasks.filterScope='MS';Tasks.refresh()">MS</button>
      </div>

      <div class="search-bar">
        <input type="text" class="search-input" placeholder="🔍 Cari task, request, sales..." id="taskSearchInput" value="${Utils.escapeHtml(this.searchText)}">
      </div>

      ${tasks.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No tasks found</div>
          <div class="empty-state-desc">${Storage.getTasks().length===0?'Create your first task from a request.':'Try adjusting filters.'}</div>
          <button class="btn btn-primary" onclick="Tasks.openModal()">Add Task</button>
        </div>
      ` : `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No</th><th>Date</th><th>Request</th><th>Subject Task</th>
                <th>Sales</th><th>Customer</th><th>End User</th>
                <th>Division</th><th>Category</th><th>Scope</th><th>Location</th>
                <th>Priority</th><th>Pipeline</th><th>🔗 BoQ</th><th></th>
              </tr>
            </thead>
            <tbody id="taskTableBody">
              ${tasks.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map((t,i) => this.renderRow(t,i)).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    setTimeout(() => {
      const b = document.getElementById('navTaskActive');
      if (b) b.textContent = activeCount;
      const si = document.getElementById('taskSearchInput');
      if (si) {
        si.addEventListener('input', Utils.debounce((e) => {
          Tasks.searchText = e.target.value;
          Tasks.filterAndShow();
        }, 200));
      }
      // Auto-open Add Task if redirected from Requests with no tasks
      const addReqId = sessionStorage.getItem('addTaskForRequest');
      if (addReqId) {
        sessionStorage.removeItem('addTaskForRequest');
        Tasks.openModalForRequest(addReqId);
      }
    }, 50);

    return html;
  },

  renderRow(t, i) {
    const req = Storage.getRequests().find(r => r.id === t.requestId);
    const scopes = [];
    if (t.scopePL) scopes.push('<span class="badge badge-blue" style="font-size:0.62rem">PL</span>');
    if (t.scopePS) scopes.push('<span class="badge badge-purple" style="font-size:0.62rem">PS</span>');
    if (t.scopeMS) scopes.push('<span class="badge badge-cyan" style="font-size:0.62rem">MS</span>');

    return `
      <tr data-tid="${t.id}" data-divid="${req?.division||''}" data-pipe="${t.pipelineStatus}">
        <td style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted)">#${i+1}</td>
        <td>${Utils.formatDateShort(t.date)}</td>
        <td>
          <span class="badge ${Utils.divClass(req?.division)}" style="font-size:0.65rem">${req?.division||'—'}</span>
          <div style="font-size:0.74rem;color:var(--text-secondary);margin-top:2px">${Utils.truncate(Utils.escapeHtml(t.subjectRequest||'—'),25)}</div>
        </td>
        <td><strong style="color:var(--text-primary)">${Utils.escapeHtml(t.subjectTask||'—')}</strong></td>
        <td>${Utils.escapeHtml(t.requestBy||'—')}</td>
        <td>${Utils.escapeHtml(t.customer||'—')}</td>
        <td>${Utils.escapeHtml(t.endUser||'—')}</td>
        <td><span class="badge ${Utils.divClass(req?.division)}">${req?.division||'—'}</span></td>
        <td>${Utils.catBadge(t.category)}</td>
        <td>${scopes.join(' ')||'—'}</td>
        <td>${Utils.escapeHtml(t.location||'—')}</td>
        <td>${t.priority==='High'?'<span class="badge badge-red">High</span>':'<span class="badge badge-neutral">Normal</span>'}</td>
        <td>${Utils.pipeBadge(t.pipelineStatus)}</td>
        <td>
          ${t.boqLink?`<a href="${Utils.escapeHtml(t.boqLink)}" target="_blank" class="link-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Open</a>`:'<span style="color:var(--text-muted);font-size:0.72rem">—</span>'}
        </td>
        <td class="actions">
          <button class="btn-icon btn-xs" onclick="Tasks.openModal('${t.id}')" title="Edit">✏️</button>
          <button class="btn-icon btn-xs" style="color:var(--red)" onclick="Tasks.confirmDelete('${t.id}')" title="Delete">🗑️</button>
        </td>
      </tr>`;
  },

  filterAndShow() {
    const rows = document.querySelectorAll('#taskTableBody tr');
    if (!rows.length) return this.refresh();
    const q = this.searchText.toLowerCase();

    rows.forEach(row => {
      const tid = row.dataset.tid;
      const t = Storage.getTasks().find(tk => tk.id === tid);
      if (!t) { row.style.display = ''; return; }
      const req = Storage.getRequests().find(r => r.id === t.requestId);

      let match = true;
      if (this.filterDiv !== 'all' && req?.division !== this.filterDiv) match = false;
      if (this.filterPipe !== 'all' && t.pipelineStatus !== this.filterPipe) match = false;
      if (this.filterCat !== 'all' && (t.category || '') !== this.filterCat) match = false;
      if (this.filterScope !== 'all') {
        if (this.filterScope === 'PL' && !t.scopePL) match = false;
        if (this.filterScope === 'PS' && !t.scopePS) match = false;
        if (this.filterScope === 'MS' && !t.scopeMS) match = false;
      }
      if (q) {
        const hay = [t.subjectTask, t.subjectRequest, t.requestBy, t.customer].join(' ').toLowerCase();
        if (!hay.includes(q)) match = false;
      }
      row.style.display = match ? '' : 'none';
    });
  },

  refresh() { document.getElementById('mainContent').innerHTML = this.render(); },

  openModal(editId = null) {
    const task = editId ? Storage.getTasks().find(t => t.id === editId) : null;
    this._renderModal(task);
  },

  /* Open Add Task modal pre-filled with a specific request */
  openModalForRequest(reqId) {
    const req = Storage.getRequests().find(r => r.id === reqId);
    if (!req) return;
    // Create a shell task with pre-filled request data
    const shell = {
      requestId: req.id,
      subjectRequest: req.subject || '',
      requestBy: req.requestBy || '',
      customer: req.customer || '',
      endUser: req.endUser || '',
      scopePL: req.scopePL || false,
      scopePS: req.scopePS || false,
      scopeMS: req.scopeMS || false
    };
    this._renderModal(shell);
  },

  _renderModal(task) {
    const isEdit = !!(task && task.id);
    const editId = task?.id || '';
    const requests = Storage.getRequests().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    const html = `
      <div class="modal-header">
        <h2 class="modal-title">${isEdit?'Edit Task':'New Task'}</h2>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <form id="taskForm" onsubmit="Tasks.save(event,'${editId||''}')">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Subject Task *</label>
            <input type="text" class="form-input" name="subjectTask" required value="${Utils.escapeHtml(task?.subjectTask||'')}" placeholder="e.g. BoQ Material Switch + Jasa Instalasi">
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" name="date" value="${task?.date||Utils.todayStr()}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Linked Request *</label>
            <select class="form-select" name="requestId" required onchange="Tasks.onReqChange(this.value)">
              <option value="">— Select Request —</option>
              ${requests.map(r => `<option value="${r.id}" ${(task?.requestId||'')===r.id?'selected':''}>${Utils.escapeHtml(r.subject||'Untitled')} [${r.division}]</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Subject Request</label>
            <input type="text" class="form-input" name="subjectRequest" id="taskSubjReq" value="${Utils.escapeHtml(task?.subjectRequest||'')}" readonly style="opacity:0.7">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Request By (Sales)</label><input type="text" class="form-input" name="requestBy" id="taskReqBy" value="${Utils.escapeHtml(task?.requestBy||'')}" readonly style="opacity:0.7"></div>
          <div class="form-group"><label class="form-label">Customer</label><input type="text" class="form-input" name="customer" id="taskCustomer" value="${Utils.escapeHtml(task?.customer||'')}" readonly style="opacity:0.7"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">End User</label><input type="text" class="form-input" name="endUser" id="taskEndUser" value="${Utils.escapeHtml(task?.endUser||'')}" readonly style="opacity:0.7"></div>
          <div class="form-group"><label class="form-label">Location / Site</label><input type="text" class="form-input" name="location" list="locList" value="${Utils.escapeHtml(task?.location||'')}" placeholder="e.g. Jakarta">${Utils.locationDatalist("locList")}</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" name="category">
              ${Utils.catOptionsNoAll(task?.category||'')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-select" name="priority">
              <option value="Normal" ${task?.priority==='Normal'||!task?'selected':''}>Normal</option>
              <option value="High" ${task?.priority==='High'?'selected':''}>High</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Scope of Work</label>
          <div style="display:flex;gap:14px;padding:4px 0">
            <label class="form-inline"><input type="checkbox" name="scopePL" id="taskPL" ${task?.scopePL?'checked':''} style="accent-color:var(--accent)"> PL</label>
            <label class="form-inline"><input type="checkbox" name="scopePS" id="taskPS" ${task?.scopePS?'checked':''} style="accent-color:var(--accent)"> PS</label>
            <label class="form-inline"><input type="checkbox" name="scopeMS" id="taskMS" ${task?.scopeMS?'checked':''} style="accent-color:var(--accent)"> MS</label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Pipeline Status</label>
            <select class="form-select" name="pipelineStatus">
              <option value="todo" ${task?.pipelineStatus==='todo'||!task?'selected':''}>To Do</option>
              <option value="in_progress" ${task?.pipelineStatus==='in_progress'?'selected':''}>In Progress</option>
              <option value="review" ${task?.pipelineStatus==='review'?'selected':''}>Review</option>
              <option value="done" ${task?.pipelineStatus==='done'?'selected':''}>Done</option>
              <option value="revisi" ${task?.pipelineStatus==='revisi'?'selected':''}>Revisi</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">🔗 Link BoQ (Google Drive)</label>
          <input type="url" class="form-input" name="boqLink" value="${Utils.escapeHtml(task?.boqLink||'')}" placeholder="https://drive.google.com/...">
          <div class="form-hint">Paste share link untuk akses cepat saat revisi.</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit?'Save Changes':'Create Task'}</button>
        </div>
      </form>`;
    App.openModal(html, 'wide');
  },

  onReqChange(reqId) {
    const req = Storage.getRequests().find(r => r.id === reqId);
    if (req) {
      const sf = (id,v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
      sf('taskSubjReq', req.subject);
      sf('taskReqBy', req.requestBy);
      sf('taskCustomer', req.customer);
      sf('taskEndUser', req.endUser);
      ['taskPL','taskPS','taskMS'].forEach((id,i) => {
        const el = document.getElementById(id);
        if (el) el.checked = [req.scopePL, req.scopePS, req.scopeMS][i];
      });
    }
  },

  save(e, editId) {
    e.preventDefault();
    const f = document.getElementById('taskForm');
    const d = {
      subjectTask:f.subjectTask.value.trim(), date:f.date.value,
      requestId:f.requestId.value, subjectRequest:f.subjectRequest.value.trim(),
      requestBy:f.requestBy.value.trim(), customer:f.customer.value.trim(),
      endUser:f.endUser.value.trim(), scopePL:f.scopePL.checked,
      scopePS:f.scopePS.checked, scopeMS:f.scopeMS.checked,
      location:f.location.value.trim(), priority:f.priority.value,
      pipelineStatus:f.pipelineStatus.value, boqLink:f.boqLink.value.trim(),
      category:f.category.value
    };
    if (!d.subjectTask) return Utils.showToast('Subject Task wajib diisi','error');
    if (!d.requestId) return Utils.showToast('Pilih Request','error');

    if (editId) { Storage.updateTask(editId,d); Utils.showToast('Task updated','success'); }
    else { Storage.addTask(d); Utils.showToast('Task created','success'); }
    App.closeModal(); this.refresh();
  },

  confirmDelete(id) {
    const t = Storage.getTasks().find(tk=>tk.id===id);
    App.openModal(`
      <div class="modal-header"><h2 class="modal-title">Delete Task</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <p>Delete <strong>"${Utils.escapeHtml(t?.subjectTask||'')}"</strong>?</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="Storage.deleteTask('${id}');App.closeModal();Tasks.refresh()">Delete</button>
      </div>`);
  }
};
