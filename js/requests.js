/* ============================================================
   EstimatorPro v3 — Requests View (3 Divisi: NETCO/Biru, OMG/Hijau, ITSOL/Ungu)
   ============================================================ */

const Requests = {
  filterDiv: 'all',
  filterStatus: 'all',
  searchText: '',

  render() {
    let reqs = Storage.getRequests();

    if (this.filterDiv !== 'all') reqs = reqs.filter(r => r.division === this.filterDiv);
    if (this.filterStatus !== 'all') reqs = reqs.filter(r => r.status === this.filterStatus);
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      reqs = reqs.filter(r =>
        (r.subject||'').toLowerCase().includes(q) ||
        (r.requestBy||'').toLowerCase().includes(q) ||
        (r.customer||'').toLowerCase().includes(q) ||
        (r.endUser||'').toLowerCase().includes(q) ||
        (r.emailBy||'').toLowerCase().includes(q)
      );
    }

    const openCount = Storage.getRequests().filter(r => r.status === 'open').length;

    const divPills = [
      { id:'all', label:'All', style:'' },
      { id:'NETCO', label:'NETCO', style:`color:var(--netco);border-color:${this.filterDiv==='NETCO'?'var(--netco)':'var(--border)'}` },
      { id:'OMG', label:'OMG', style:`color:var(--omg);border-color:${this.filterDiv==='OMG'?'var(--omg)':'var(--border)'}` },
      { id:'ITSOL', label:'ITSOL', style:`color:var(--itsol);border-color:${this.filterDiv==='ITSOL'?'var(--itsol)':'var(--border)'}` },
    ];

    const html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Requests</h1>
          <p class="page-subtitle">Incoming estimation requests from 3 divisions</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Requests.openModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Request
          </button>
        </div>
      </div>

      <div class="filter-pills">
        ${divPills.map(d => `
          <button class="filter-pill ${this.filterDiv===d.id?'active':''}"
            style="${d.style}" onclick="Requests.setFilter('${d.id}')">${d.label}</button>
        `).join('')}
        <span style="flex:1"></span>
        <button class="filter-pill ${this.filterStatus==='all'?'active':''}" onclick="Requests.setStatusFilter('all')">All Status</button>
        <button class="filter-pill ${this.filterStatus==='open'?'active':''}" onclick="Requests.setStatusFilter('open')">Open</button>
        <button class="filter-pill ${this.filterStatus==='win'?'active':''}" onclick="Requests.setStatusFilter('win')">Win</button>
        <button class="filter-pill ${this.filterStatus==='lose'?'active':''}" onclick="Requests.setStatusFilter('lose')">Lose/Drop</button>
      </div>

      <div class="search-bar">
        <input type="text" class="search-input" placeholder="🔍 Cari subject, sales, customer..." id="reqSearchInput"
          value="${Utils.escapeHtml(this.searchText)}">
      </div>

      ${reqs.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📥</div>
          <div class="empty-state-title">No requests found</div>
          <div class="empty-state-desc">${Storage.getRequests().length===0?'Start by creating your first estimation request.':'Try adjusting your filters.'}</div>
        </div>
      ` : `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>No</th><th>Date</th><th>Subject</th><th>Email</th><th>Sales</th>
                <th>Customer</th><th>End User</th><th>Division</th><th>Scope</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody id="reqTableBody">
              ${reqs.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(r => this.renderRow(r)).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    // Update badge
    setTimeout(() => {
      const b = document.getElementById('navReqOpen');
      if (b) b.textContent = openCount;
      // Attach debounced search
      const si = document.getElementById('reqSearchInput');
      if (si) {
        const handler = Utils.debounce((e) => {
          Requests.searchText = e.target.value;
          Requests.filterAndShow();
        }, 200);
        si.addEventListener('input', handler);
      }
    }, 50);

    return html;
  },

  renderRow(r) {
    const scopes = [];
    if (r.scopePL) scopes.push('<span class="badge badge-blue" style="font-size:0.65rem">PL</span>');
    if (r.scopePS) scopes.push('<span class="badge badge-purple" style="font-size:0.65rem">PS</span>');
    if (r.scopeMS) scopes.push('<span class="badge badge-cyan" style="font-size:0.65rem">MS</span>');
    const tc = Storage.getTasksByRequest(r.id).length;
    return `
      <tr data-rid="${r.id}" data-div="${r.division}" data-status="${r.status}">
        <td style="font-family:var(--font-mono);font-size:0.74rem;color:var(--text-muted)">#${r.noId||'—'}</td>
        <td>${Utils.formatDateShort(r.date)}</td>
        <td>
          <strong style="cursor:pointer;color:var(--accent)" onclick="App.navigate('#tasks')">${Utils.escapeHtml(r.subject||'—')}</strong>
          ${tc>0?`<div style="font-size:0.7rem;color:var(--text-muted)">${tc} tasks</div>`:''}
        </td>
        <td>${Utils.escapeHtml(r.emailBy||'—')}</td>
        <td>${Utils.escapeHtml(r.requestBy||'—')}</td>
        <td>${Utils.escapeHtml(r.customer||'—')}</td>
        <td>${Utils.escapeHtml(r.endUser||'—')}</td>
        <td><span class="badge ${Utils.divClass(r.division)}">${r.division||'—'}</span></td>
        <td>${scopes.join(' ')||'—'}</td>
        <td>${Utils.reqStatusBadge(r.status)}</td>
        <td class="actions">
          <button class="btn-icon btn-xs" onclick="Requests.openModal('${r.id}')" title="Edit">✏️</button>
          <button class="btn-icon btn-xs" onclick="App.navigate('#tasks')" title="Tasks">📋</button>
          <button class="btn-icon btn-xs" style="color:var(--red)" onclick="Requests.confirmDelete('${r.id}')" title="Delete">🗑️</button>
        </td>
      </tr>`;
  },

  /* Fast JS filter — no re-render, just hide/show rows */
  filterAndShow() {
    const rows = document.querySelectorAll('#reqTableBody tr');
    if (!rows.length) return this.refresh();
    const q = this.searchText.toLowerCase();

    rows.forEach(row => {
      const rid = row.dataset.rid;
      const req = Storage.getRequests().find(r => r.id === rid);
      if (!req) { row.style.display = ''; return; }

      let match = true;
      if (this.filterDiv !== 'all' && req.division !== this.filterDiv) match = false;
      if (this.filterStatus !== 'all' && req.status !== this.filterStatus) match = false;
      if (q) {
        const hay = [req.subject, req.requestBy, req.customer, req.endUser, req.emailBy].join(' ').toLowerCase();
        if (!hay.includes(q)) match = false;
      }
      row.style.display = match ? '' : 'none';
    });
  },

  setFilter(d) { this.filterDiv = d; this.refresh(); },
  setStatusFilter(s) { this.filterStatus = s; this.refresh(); },
  refresh() { document.getElementById('mainContent').innerHTML = this.render(); },

  openModal(editId = null) {
    const req = editId ? Storage.getRequests().find(r => r.id === editId) : null;
    const isEdit = !!req;

    const html = `
      <div class="modal-header">
        <h2 class="modal-title">${isEdit?'Edit Request':'New Request'}</h2>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <form id="reqForm" onsubmit="Requests.save(event,'${editId||''}')">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Subject / Project Name *</label>
            <input type="text" class="form-input" name="subject" required value="${Utils.escapeHtml(req?.subject||'')}" placeholder="e.g. Pengadaan Switch Industrial">
          </div>
          <div class="form-group">
            <label class="form-label">Date Received *</label>
            <input type="date" class="form-input" name="date" required value="${req?.date||Utils.todayStr()}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Email By</label><input type="text" class="form-input" name="emailBy" value="${Utils.escapeHtml(req?.emailBy||'')}"></div>
          <div class="form-group"><label class="form-label">Request By (Sales)</label><input type="text" class="form-input" name="requestBy" value="${Utils.escapeHtml(req?.requestBy||'')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Customer</label><input type="text" class="form-input" name="customer" value="${Utils.escapeHtml(req?.customer||'')}"></div>
          <div class="form-group"><label class="form-label">End User</label><input type="text" class="form-input" name="endUser" value="${Utils.escapeHtml(req?.endUser||'')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Division *</label>
            <select class="form-select" name="division">
              <option value="">— Select —</option>
              <option value="NETCO" ${req?.division==='NETCO'||!req?'selected':''}>NETCO (Network & Communication)</option>
              <option value="OMG" ${req?.division==='OMG'?'selected':''}>OMG (Oil, Mining & Government)</option>
              <option value="ITSOL" ${req?.division==='ITSOL'?'selected':''}>ITSOL (IT Solutions)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" name="status">
              <option value="open" ${req?.status==='open'||!req?'selected':''}>Open</option>
              <option value="win" ${req?.status==='win'?'selected':''}>Win</option>
              <option value="lose" ${req?.status==='lose'?'selected':''}>Lose/Drop</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Scope of Work</label>
          <div style="display:flex;gap:16px;padding:4px 0">
            <label class="form-inline"><input type="checkbox" name="scopePL" ${req?.scopePL?'checked':''} style="accent-color:var(--accent)"> PL (Procurement)</label>
            <label class="form-inline"><input type="checkbox" name="scopePS" ${req?.scopePS?'checked':''} style="accent-color:var(--accent)"> PS (Solutions)</label>
            <label class="form-inline"><input type="checkbox" name="scopeMS" ${req?.scopeMS?'checked':''} style="accent-color:var(--accent)"> MS (Service)</label>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Note</label><textarea class="form-textarea" name="note" rows="2">${Utils.escapeHtml(req?.note||'')}</textarea></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit?'Save Changes':'Create Request'}</button>
        </div>
      </form>`;
    App.openModal(html, 'wide');
  },

  save(e, editId) {
    e.preventDefault();
    const f = document.getElementById('reqForm');
    const d = {
      subject:f.subject.value.trim(), date:f.date.value, emailBy:f.emailBy.value.trim(),
      requestBy:f.requestBy.value.trim(), customer:f.customer.value.trim(), endUser:f.endUser.value.trim(),
      division:f.division.value, scopePL:f.scopePL.checked, scopePS:f.scopePS.checked,
      scopeMS:f.scopeMS.checked, note:f.note.value.trim(), status:f.status.value
    };
    if (!d.subject) return Utils.showToast('Subject wajib diisi','error');
    if (!d.division) return Utils.showToast('Division wajib dipilih','error');
    if (editId) { Storage.updateRequest(editId,d); Utils.showToast('Request updated','success'); }
    else { Storage.addRequest(d); Utils.showToast('Request created','success'); }
    App.closeModal(); this.refresh(); App.setActiveNav();
  },

  confirmDelete(id) {
    const r = Storage.getRequests().find(rr=>rr.id===id);
    App.openModal(`
      <div class="modal-header"><h2 class="modal-title">Delete Request</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <p style="color:var(--text-primary)">Delete <strong>"${Utils.escapeHtml(r?.subject||'')}"</strong>? All linked tasks will also be deleted.</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="Storage.deleteRequest('${id}');App.closeModal();Requests.refresh();App.setActiveNav()">Delete</button>
      </div>`);
  }
};
