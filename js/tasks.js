/* ============================================================
   EstimatorPro v3 — Tasks View (Flat Master To-Do List)
   ============================================================ */

const Tasks = {
  filterDiv: 'all',
  filterPipe: 'all',
  filterCat: 'all',
  filterScope: 'all',
  filterRequest: sessionStorage.getItem('tasksFilterRequest') || 'all',
  searchText: '',
  sortKey: 'date',
  sortDir: 'desc',

  sort(key) {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = key; this.sortDir = 'asc'; }
    this.refresh();
  },

  render() {
    const persistedRequestFilter = sessionStorage.getItem('tasksFilterRequest') || 'all';
    if (this.filterRequest !== persistedRequestFilter) this.filterRequest = persistedRequestFilter;
    let tasks = Storage.getTasks();
    const requests = Storage.getRequests();

    if (this.filterDiv !== 'all') {
      const reqIds = requests.filter(r => r.division === this.filterDiv).map(r => r.id);
      tasks = tasks.filter(t => reqIds.includes(t.requestId));
    }
    if (this.filterPipe !== 'all') tasks = tasks.filter(t => t.pipelineStatus === this.filterPipe);
    if (this.filterCat !== 'all') tasks = tasks.filter(t => Utils.normalizeCat(t.category || '') === this.filterCat);
    if (this.filterScope !== 'all') tasks = tasks.filter(t => {
      if (this.filterScope === 'PL') return t.scopePL;
      if (this.filterScope === 'PS') return t.scopePS;
      if (this.filterScope === 'MS') return t.scopeMS;
      return true;
    });
    if (this.filterRequest !== 'all') tasks = tasks.filter(t => t.requestId === this.filterRequest);
    const activeRequest = requests.find(r => r.id === this.filterRequest);
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      tasks = tasks.filter(t =>
        (t.subjectTask||'').toLowerCase().includes(q) ||
        (t.subjectRequest||'').toLowerCase().includes(q) ||
        (t.requestBy||'').toLowerCase().includes(q) ||
        (t.customer||'').toLowerCase().includes(q)
      );
    }
    // Apply column sort (default: newest first)
    if (this.sortKey === 'scope') {
      tasks = Utils.sortBy(tasks, t => [t.scopePL?'PL':'',t.scopePS?'PS':'',t.scopeMS?'MS':''].filter(Boolean).join(','), this.sortDir);
    } else {
      tasks = Utils.sortBy(tasks, this.sortKey, this.sortDir);
    }

    const activeCount = Storage.getTasks().filter(t => t.pipelineStatus !== 'done').length;
    const divPills = [
      { id:'all', label:'All', style:'' },
      { id:'NETCO', label:'NETCO', style:`color:var(--netco);border-color:${this.filterDiv==='NETCO'?'var(--netco)':'var(--border)'}` },
      { id:'OMG', label:'OMG', style:`color:var(--omg);border-color:${this.filterDiv==='OMG'?'var(--omg)':'var(--border)'}` },
      { id:'ITSOL', label:'ITSOL', style:`color:var(--itsol);border-color:${this.filterDiv==='ITSOL'?'var(--itsol)':'var(--border)'}` },
    ];

    const html = `
      <div class="page-header workspace-page-header">
        <div><div class="workspace-eyebrow">Delivery workflow</div><h1 class="page-title">Task Breakdown</h1><p class="page-subtitle">${tasks.length} dari ${Storage.getTasks().length} task sesuai filter <span>·</span> ${activeCount} masih aktif</p></div>
        <div class="page-actions"><button class="btn btn-primary" onclick="Tasks.openModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task</button></div>
      </div>

      <section class="workspace-toolbar tasks-toolbar">
        <div class="workspace-filter-block"><span class="workspace-filter-label">Division</span><div class="filter-pills">${divPills.map(d => `<button class="filter-pill ${this.filterDiv===d.id?'active':''}" style="${d.style}" onclick="Tasks.filterDiv='${d.id}';Tasks.refresh()">${d.label}</button>`).join('')}</div></div>
        <div class="workspace-filter-block"><span class="workspace-filter-label">Pipeline</span><div class="filter-pills"><button class="filter-pill ${this.filterPipe==='all'?'active':''}" onclick="Tasks.filterPipe='all';Tasks.refresh()">All</button><button class="filter-pill ${this.filterPipe==='todo'?'active':''}" onclick="Tasks.filterPipe='todo';Tasks.refresh()">To Do</button><button class="filter-pill ${this.filterPipe==='in_progress'?'active':''}" onclick="Tasks.filterPipe='in_progress';Tasks.refresh()">In Progress</button><button class="filter-pill ${this.filterPipe==='review'?'active':''}" onclick="Tasks.filterPipe='review';Tasks.refresh()">Review</button><button class="filter-pill ${this.filterPipe==='done'?'active':''}" onclick="Tasks.filterPipe='done';Tasks.refresh()">Done</button><button class="filter-pill ${this.filterPipe==='revisi'?'active':''}" onclick="Tasks.filterPipe='revisi';Tasks.refresh()">Revisi</button></div></div>
        <div class="workspace-filter-block workspace-filter-select"><span class="workspace-filter-label">Request & category</span><div class="workspace-select-row"><div class="workspace-combobox">${Utils.combobox({id:'taskFilterReqCb',name:'tasksFilterRequest',options:[{value:'all',label:'All Requests'},...requests.slice().sort((a,b)=>(a.subject||'').localeCompare(b.subject||'','id')).map(r=>({value:r.id,label:`${Utils.truncate(r.subject||'Untitled',40)} [${r.division}]`,group:r.division}))],selected:this.filterRequest||'all',placeholder:'Cari request…',onChange:"Tasks.filterRequest=v;sessionStorage.setItem('tasksFilterRequest',v);Tasks.refresh()"})}</div><select class="form-select workspace-category-select" onchange="Tasks.filterCat=this.value;Tasks.refresh()">${Utils.catOptions(this.filterCat === 'all' ? '' : this.filterCat).replace('— Semua Kategori —','All Category')}</select></div></div>
        <div class="workspace-filter-block"><span class="workspace-filter-label">Scope</span><div class="filter-pills"><button class="filter-pill ${this.filterScope==='all'?'active':''}" onclick="Tasks.filterScope='all';Tasks.refresh()">All</button><button class="filter-pill ${this.filterScope==='PL'?'active':''}" onclick="Tasks.filterScope='PL';Tasks.refresh()">PL</button><button class="filter-pill ${this.filterScope==='PS'?'active':''}" onclick="Tasks.filterScope='PS';Tasks.refresh()">PS</button><button class="filter-pill ${this.filterScope==='MS'?'active':''}" onclick="Tasks.filterScope='MS';Tasks.refresh()">MS</button></div></div>
        <div class="search-bar workspace-search"><input type="text" class="search-input" placeholder="Cari task, request, sales..." id="taskSearchInput" value="${Utils.escapeHtml(this.searchText)}"></div>
      </section>

      ${activeRequest ? `
        <div class="workspace-context-card">
          <div><div class="workspace-context-kicker">Filtered by request</div><div class="workspace-context-title">${Utils.escapeHtml(activeRequest.subject||'—')}</div><div class="workspace-context-meta">${activeRequest.division||'—'} <span>·</span> ${Utils.escapeHtml(activeRequest.customer||'')} <span>·</span> ${Utils.escapeHtml(activeRequest.endUser||'')} <span>·</span> ${Utils.formatDateShort(activeRequest.date)}</div></div>
          <div class="workspace-context-actions"><span class="workspace-context-count">${tasks.length} task</span><button class="btn btn-xs btn-secondary" onclick="Tasks.filterRequest='all';sessionStorage.removeItem('tasksFilterRequest');Tasks.refresh()">Clear filter</button></div>
        </div>
      ` : ''}

      ${tasks.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No tasks found</div>
          <div class="empty-state-desc">${Storage.getTasks().length===0?'Create your first task from a request.':'Try adjusting filters.'}</div>
          <button class="btn btn-primary" onclick="Tasks.openModal()">Add Task</button>
        </div>
      ` : `
        <div class="workspace-table-card">
          <div class="workspace-table-meta"><span>${tasks.length} task ditampilkan</span><span>Gunakan header kolom untuk mengurutkan data</span></div>
          <div class="table-container workspace-table-container">
          <table>
            <thead>
              <tr>
                <th>No</th>${Utils.sortableTh('Date','date',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Request','subjectRequest',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Subject Task','subjectTask',this.sortKey,this.sortDir,'Tasks')}
                ${Utils.sortableTh('Sales','requestBy',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Customer','customer',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('End User','endUser',this.sortKey,this.sortDir,'Tasks')}
                ${Utils.sortableTh('Division','division',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Category','category',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Scope','scope',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Location','location',this.sortKey,this.sortDir,'Tasks')}
                ${Utils.sortableTh('Priority','priority',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Pipeline','pipelineStatus',this.sortKey,this.sortDir,'Tasks')}${Utils.sortableTh('Target','targetDate',this.sortKey,this.sortDir,'Tasks')}<th></th>
              </tr>
            </thead>
            <tbody id="taskTableBody">
              ${tasks.map((t,i) => this.renderRow(t,i)).join('')}
            </tbody>
          </table>
          </div>
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
        <td data-label="No" style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted)">#${i+1}</td>
        <td data-label="Date">${Utils.formatDateShort(t.date)}</td>
        <td data-label="Request">
          <button class="workspace-request-link" type="button" onclick="Tasks.openRequest('${t.requestId}')" title="Buka request terkait">
            <span>${Utils.truncate(Utils.escapeHtml(t.subjectRequest || req?.subject || '—'), 32)}</span><i aria-hidden="true">↗</i>
          </button>
        </td>
        <td data-label="Subject Task"><strong style="color:var(--text-primary)">${Utils.escapeHtml(t.subjectTask||'—')}</strong></td>
        <td data-label="Sales">${Utils.escapeHtml(t.requestBy||'—')}</td>
        <td data-label="Customer">${Utils.escapeHtml(t.customer||'—')}</td>
        <td data-label="End User">${Utils.escapeHtml(t.endUser||'—')}</td>
        <td data-label="Division"><span class="badge ${Utils.divClass(req?.division)}">${req?.division||'—'}</span></td>
        <td data-label="Category">${Utils.catBadge(t.category)}</td>
        <td data-label="Scope">${scopes.join(' ')||'—'}</td>
        <td data-label="Location">${Utils.escapeHtml(t.location||'—')}</td>
        <td data-label="Priority">${t.priority==='High'?'<span class="badge badge-red">High</span>':'<span class="badge badge-neutral">Normal</span>'}</td>
        <td data-label="Pipeline">${Utils.pipeBadge(t.pipelineStatus)}</td>
        <td data-label="Target">${this.targetBadge(t)}</td>
        <td class="actions" data-label="">
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

  refresh() { document.getElementById('mainContent').innerHTML = this.render(); Utils.initComboboxes(document.getElementById('mainContent')); },

  openRequest(requestId) {
    if (!requestId) return;
    sessionStorage.setItem('viewRequestId', requestId);
    App.navigate('#requests');
  },

  /* Badge Target Done: merah = overdue & belum done, oranye = ≤3 hari, hijau = done */
  targetBadge(t) {
    if (!t.targetDate) return '<span style="color:var(--text-muted);font-size:0.72rem">—</span>';
    const target = new Date(t.targetDate + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((target - today) / 86400000);
    const d = Utils.formatDateShort(t.targetDate);
    if (t.pipelineStatus === 'done') return `<span class="badge badge-green" style="font-size:0.62rem">✓ ${d}</span>`;
    if (diff < 0) return `<span class="badge badge-red" style="font-size:0.62rem" title="Terlambat ${-diff} hari">⚠ ${d} (+${-diff}h)</span>`;
    if (diff <= 3) return `<span class="badge badge-orange" style="font-size:0.62rem" title="Tersisa ${diff} hari">🎯 ${d}</span>`;
    return `<span class="badge badge-neutral" style="font-size:0.62rem">${d}</span>`;
  },

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
            ${Utils.combobox({
              name: 'requestId',
              options: requests.map(r => ({ value: r.id, label: `${r.subject||'Untitled'} [${r.division}]`, group: r.division })),
              selected: task?.requestId || '',
              placeholder: 'Ketik untuk mencari request…',
              onChange: 'Tasks.onReqChange(v)'
            })}
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
          <div class="form-group">
            <label class="form-label">🎯 Target Done</label>
            <input type="date" class="form-input" name="targetDate" value="${Utils.escapeHtml(task?.targetDate||'')}">
            <div class="form-hint">Tanggal target penyelesaian (opsional).</div>
          </div>
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
      pipelineStatus:f.pipelineStatus.value,
      category:f.category.value, targetDate:f.targetDate.value || ''
    };
    if (!d.subjectTask) return Utils.showToast('Subject Task wajib diisi','error');
    if (!d.requestId) return Utils.showToast('Pilih Request','error');

    // Auto-set High priority when target date is overdue
    if (d.targetDate && d.pipelineStatus !== 'done' && d.targetDate < Utils.todayStr()) {
      d.priority = 'High';
    }

    // Remember custom location for future autocomplete suggestions
    Utils.addLocation(d.location);

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
  },

};
