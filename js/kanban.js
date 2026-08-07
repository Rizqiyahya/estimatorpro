/* ============================================================
   EstimatorPro v3 — Kanban (5 Pipeline Columns, Division-Colored Cards)
   Columns: To Do | In Progress | Review | Done | Revisi
   Card border color = division color (NETCO=Biru, OMG=Hijau, ITSOL=Ungu)
   All cards = compact mode (title + division + category + priority + cycle time)
   Division filter tabs: All | NETCO | OMG | ITSOL
   ============================================================ */

const Kanban = {
  filterDiv: 'all',

  setDiv(div) {
    this.filterDiv = div;
    this.refresh();
  },

  render() {
    const tasks = Storage.getTasks();
    const requests = Storage.getRequests();

    const getDivColor = (div) => {
      const m = { NETCO: 'var(--netco)', OMG: 'var(--omg)', ITSOL: 'var(--itsol)' };
      return m[div] || 'var(--border)';
    };

    // Count tasks per division (via linked request)
    const divCounts = { NETCO: 0, OMG: 0, ITSOL: 0 };
    tasks.forEach(t => {
      const r = requests.find(rr => rr.id === t.requestId);
      if (r && divCounts[r.division] !== undefined) divCounts[r.division]++;
    });

    const filteredTasks = this.filterDiv === 'all'
      ? tasks
      : tasks.filter(t => {
          const r = requests.find(rr => rr.id === t.requestId);
          return r && r.division === this.filterDiv;
        });

    const divs = [
      { id: 'all', label: 'All', color: 'var(--text-secondary)', count: tasks.length },
      { id: 'NETCO', label: 'NETCO', color: 'var(--netco)', count: divCounts.NETCO },
      { id: 'OMG', label: 'OMG', color: 'var(--omg)', count: divCounts.OMG },
      { id: 'ITSOL', label: 'ITSOL', color: 'var(--itsol)', count: divCounts.ITSOL }
    ];

    const columns = [
      { id:'todo', title:'To Do', color:'var(--pipe-todo)', borderColor:'var(--pipe-todo)' },
      { id:'in_progress', title:'In Progress', color:'var(--pipe-inprog)', borderColor:'var(--pipe-inprog)' },
      { id:'review', title:'Review', color:'var(--pipe-review)', borderColor:'var(--pipe-review)' },
      { id:'done', title:'Done', color:'var(--pipe-done)', borderColor:'var(--pipe-done)' },
      { id:'revisi', title:'Revisi', color:'var(--pipe-revisi)', borderColor:'var(--pipe-revisi)' }
    ];

    const html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Kanban Board</h1>
          <p class="page-subtitle">Pipeline overview — drag & drop to update task status</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Kanban.quickAdd()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Quick Add
          </button>
        </div>
      </div>

      <!-- Division filter tabs -->
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        ${divs.map(d => `
          <button class="filter-pill ${this.filterDiv===d.id?'active':''}"
            style="border-color:${this.filterDiv===d.id?d.color:'var(--border)'};color:${this.filterDiv===d.id?d.color:'var(--text-secondary)'}"
            onclick="Kanban.setDiv('${d.id}')">
            ${d.label} <span style="font-weight:400;opacity:0.7">(${d.count})</span>
          </button>
        `).join('')}
      </div>

      ${filteredTasks.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📌</div>
          <div class="empty-state-title">No tasks${this.filterDiv!=='all'?' for '+this.filterDiv:''}</div>
          <div class="empty-state-desc">Create tasks in the Tasks view to see them on the Kanban board.</div>
          <button class="btn btn-primary" onclick="App.navigate('#tasks');setTimeout(()=>Tasks.openModal(),200)">Go to Tasks</button>
        </div>
      ` : `
        <div class="kanban-wrapper" style="display:flex;flex-direction:row;gap:14px">
          ${columns.map(col => {
            const colTasks = filteredTasks.filter(t => t.pipelineStatus === col.id);
            return `
              <div class="kanban-column" style="flex:1;min-width:240px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;display:flex;flex-direction:column"
                data-status="${col.id}"
                ondragover="Kanban.handleDragOver(event)"
                ondragleave="Kanban.handleDragLeave(event)"
                ondrop="Kanban.handleDrop(event, '${col.id}')">
                <div class="kanban-col-header" style="border-bottom:2px solid ${col.borderColor};margin-bottom:10px;padding-bottom:10px">
                  <span class="kanban-col-title" style="color:${col.color};font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${col.title}</span>
                  <span style="font-size:0.72rem;color:var(--text-muted);background:var(--bg-tertiary);padding:2px 8px;border-radius:10px">${colTasks.length}</span>
                </div>
                <div class="kanban-cards" style="display:flex;flex-direction:column;gap:7px;min-height:60px;flex:1">
                  ${colTasks.map(t => {
                    const req = requests.find(r => r.id === t.requestId);
                    const divColor = getDivColor(req?.division);
                    const cycleTime = Utils.calcCycleTime(t.pipelineHistory);
                    return `
                      <div class="kanban-card" style="border-left:3px solid ${divColor};padding:8px 10px"
                        data-task-id="${t.id}"
                        draggable="true"
                        ondragstart="Kanban.handleDragStart(event)"
                        ondragend="Kanban.handleDragEnd(event)"
                        onclick="Kanban.viewTask('${t.id}')">
                        <div style="font-weight:600;font-size:0.78rem;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.escapeHtml(t.subjectTask)}</div>
                        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                          <span class="badge ${Utils.divClass(req?.division)}" style="font-size:0.6rem">${req?.division||'—'}</span>
                          ${t.priority==='High'?`<span style="font-size:0.6rem;color:var(--red);font-weight:600">⚠</span>`:''}
                          ${t.category?Utils.catBadge(t.category):''}
                          ${cycleTime?`<span style="font-size:0.62rem;color:var(--text-muted)">⏱ ${Utils.formatDuration(cycleTime)}</span>`:''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                  ${colTasks.length===0?'<div class="kanban-empty" style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.74rem">Drop here</div>':''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
    return html;
  },

  refresh() { document.getElementById('mainContent').innerHTML = this.render(); },

  handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
    e.dataTransfer.effectAllowed = 'move';
  },

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
  },

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  },

  handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); },

  handleDrop(e, newStatus) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      Storage.updateTask(taskId, { pipelineStatus: newStatus });
      this.refresh();
      Utils.showToast('Task → ' + newStatus.replace('_',' '), 'info');
    }
  },

  quickAdd() {
    const requests = Storage.getRequests().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    App.openModal(`
      <div class="modal-header"><h2 class="modal-title">Quick Add Task</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <form id="quickForm" onsubmit="Kanban.saveQuick(event)">
        <div class="form-group"><label class="form-label">Subject Task *</label><input type="text" class="form-input" name="subjectTask" required placeholder="Task description..." autofocus></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Linked Request *</label>
            ${Utils.combobox({
              name: 'requestId',
              options: requests.map(r => ({ value: r.id, label: `${r.subject||'Untitled'} [${r.division}]`, group: r.division })),
              placeholder: 'Ketik untuk mencari request…'
            })}
          </div>
          <div class="form-group"><label class="form-label">Pipeline</label>
            <select class="form-select" name="pipelineStatus">
              <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="done">Done</option><option value="revisi">Revisi</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Priority</label><select class="form-select" name="priority"><option value="Normal" selected>Normal</option><option value="High">High</option></select></div>
          <div class="form-group"><label class="form-label">Location</label><input type="text" class="form-input" name="location" placeholder="e.g. Jakarta" list="locList">${Utils.locationDatalist('locList')}</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Task</button>
        </div>
      </form>
    `, 'wide');
  },

  saveQuick(e) {
    e.preventDefault();
    const f = document.getElementById('quickForm');
    const req = Storage.getRequests().find(r => r.id === f.requestId.value);
    if (!req) return Utils.showToast('Select a request','error');
    Utils.addLocation(f.location.value);
    Storage.addTask({
      subjectTask:f.subjectTask.value.trim(), pipelineStatus:f.pipelineStatus.value,
      priority:f.priority.value, location:f.location.value.trim(),
      subjectRequest:req.subject, requestBy:req.requestBy, customer:req.customer,
      endUser:req.endUser, scopePL:req.scopePL, scopePS:req.scopePS, scopeMS:req.scopeMS,
      date:Utils.todayStr(), requestId:req.id
    });
    App.closeModal(); this.refresh(); Utils.showToast('Task added','success');
  },

  viewTask(taskId) {
    const t = Storage.getTasks().find(tk => tk.id === taskId);
    if (!t) return;
    const req = Storage.getRequests().find(r => r.id === t.requestId);
    App.openModal(`
      <div class="modal-header"><h2 class="modal-title">${Utils.escapeHtml(t.subjectTask)}</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${Utils.pipeBadge(t.pipelineStatus)} ${t.priority==='High'?'<span class="badge badge-red">High</span>':'<span class="badge badge-neutral">Normal</span>'}
        <span class="badge ${Utils.divClass(req?.division)}">${req?.division||'—'}</span>
        ${Utils.catBadge(t.category)}
      </div>
      <div style="font-size:0.84rem;display:flex;flex-direction:column;gap:6px;color:var(--text-secondary)">
        ${t.subjectRequest?`<div><span style="color:var(--text-muted)">Request:</span> <span style="color:var(--text-primary)">${Utils.escapeHtml(t.subjectRequest)}</span></div>`:''}
        ${t.requestBy?`<div><span style="color:var(--text-muted)">Sales:</span> <span style="color:var(--text-primary)">${Utils.escapeHtml(t.requestBy)}</span></div>`:''}
        ${t.customer?`<div><span style="color:var(--text-muted)">Customer:</span> <span style="color:var(--text-primary)">${Utils.escapeHtml(t.customer)}</span></div>`:''}
        ${t.location?`<div><span style="color:var(--text-muted)">📍 Location:</span> <span style="color:var(--text-primary)">${Utils.escapeHtml(t.location)}</span></div>`:''}
        ${t.boqLink?`<div><span style="color:var(--text-muted)">🔗 BoQ:</span> <a href="${Utils.escapeHtml(t.boqLink)}" target="_blank" class="link-btn">Open Drive</a></div>`:''}
      </div>
      <!-- Pipeline Timeline -->
      ${t.pipelineHistory && t.pipelineHistory.length > 1 ? `
      <div class="timeline-section">
        <div class="timeline-title">⏱ Pipeline History</div>
        <div class="timeline">
          ${t.pipelineHistory.map((h, idx) => {
            const next = t.pipelineHistory[idx + 1];
            const duration = next ? Utils.formatDuration(new Date(next.at).getTime() - new Date(h.at).getTime()) : 'Active';
            return `
              <div class="timeline-item">
                <div class="timeline-dot ${h.status}"></div>
                <div class="timeline-info">
                  <div class="timeline-status">${Utils.capitalize(h.status.replace('_',' '))} ${idx === 0 ? '<span style="font-weight:400;font-size:0.7rem">(start)</span>' : ''}</div>
                  <div class="timeline-meta">${duration} · ${new Date(h.at).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
            `;
          }).join('')}
          <div class="timeline-line"></div>
        </div>
      </div>
      ` : ''}
      <div class="modal-footer">
        ${Utils.toolForCategory(t.category) ? `<button class="btn btn-primary btn-sm" onclick="Tasks.openTool('${t.id}')">🧰 ${Utils.toolLabel(t.category)}</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="Storage.deleteTask('${t.id}');App.closeModal();Kanban.refresh()">Delete</button>
        <button class="btn btn-secondary" onclick="App.closeModal()">Close</button>
      </div>
    `);
  }
};
