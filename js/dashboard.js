/* ============================================================
   EstimatorPro — Interactive Weekly Dashboard
   Weekly period is Monday 00:00 through Sunday 23:59.
   ============================================================ */

const Dashboard = {
  period: null,
  division: 'all',
  sales: 'all',
  status: 'all',
  detail: null,

  _dateOnly(date) {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },

  _dateKey(date) {
    const d = this._dateOnly(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  _weekRange(offset = 0) {
    const today = this._dateOnly(new Date());
    const weekday = today.getDay(); // Sunday 0, Monday 1
    const sinceMonday = weekday === 0 ? 6 : weekday - 1;
    const start = new Date(today);
    start.setDate(today.getDate() - sinceMonday + (offset * 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  },

  _periodInfo() {
    const period = this.period || (new Date().getDay() === 1 ? 'previous' : 'current');
    const range = period === 'previous' ? this._weekRange(-1) : this._weekRange(0);
    const label = period === 'previous' ? 'Minggu lalu' : 'Minggu ini';
    return {
      period,
      label,
      start: range.start,
      end: range.end,
      startKey: this._dateKey(range.start),
      endKey: this._dateKey(range.end),
      display: `${range.start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} – ${range.end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
    };
  },

  _salesOf(task, requestById) {
    return (task.requestBy || requestById || 'Belum diisi').trim() || 'Belum diisi';
  },

  _doneAt(task) {
    const history = Array.isArray(task.pipelineHistory) ? task.pipelineHistory : [];
    const doneEvents = history.filter(item => item.status === 'done' && item.at);
    if (doneEvents.length) return new Date(doneEvents[doneEvents.length - 1].at);
    // Data lama yang belum memiliki pipeline history memakai updatedAt sebagai pendekatan.
    return task.pipelineStatus === 'done' && task.updatedAt ? new Date(task.updatedAt) : null;
  },

  _inRange(date, info) {
    if (!date || Number.isNaN(date.getTime())) return false;
    const day = this._dateOnly(date).getTime();
    return day >= info.start.getTime() && day <= info.end.getTime();
  },

  _data() {
    const info = this._periodInfo();
    const requests = Storage.getRequests();
    const reqMap = new Map(requests.map(request => [request.id, request]));
    const enriched = Storage.getTasks().map(task => {
      const request = reqMap.get(task.requestId) || {};
      return { ...task, request, division: request.division || '—', sales: this._salesOf(task, request.requestBy) };
    });
    const salesList = [...new Set(enriched.map(task => task.sales).filter(s => s !== 'Belum diisi'))]
      .sort((a, b) => a.localeCompare(b, 'id'));
    const scoped = enriched.filter(task =>
      (this.division === 'all' || task.division === this.division) &&
      (this.sales === 'all' || task.sales === this.sales) &&
      (this.status === 'all' || task.pipelineStatus === this.status)
    );
    const scopedRequests = requests.filter(request =>
      (this.division === 'all' || request.division === this.division) &&
      (this.sales === 'all' || (request.requestBy || 'Belum diisi') === this.sales)
    );
    return { info, requests, scopedRequests, tasks: scoped, salesList };
  },

  setFilter(key, value) {
    this[key] = value;
    this.detail = null;
    this.refresh();
  },

  resetFilters() {
    this.period = new Date().getDay() === 1 ? 'previous' : 'current';
    this.division = 'all';
    this.sales = 'all';
    this.status = 'all';
    this.detail = null;
    this.refresh();
  },

  showDetails(type, value = '') {
    this.detail = { type, value };
    this.refresh();
    requestAnimationFrame(() => document.getElementById('dashboardDetail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  },

  closeDetails() {
    this.detail = null;
    this.refresh();
  },

  _filterButton(label, key, value, active) {
    return `<button class="filter-pill ${active ? 'active' : ''}" onclick="Dashboard.setFilter('${key}','${value}')">${label}</button>`;
  },

  _taskRow(task, info) {
    const target = task.targetDate ? new Date(`${task.targetDate}T00:00:00`) : null;
    const today = this._dateOnly(new Date());
    const overdue = target && task.pipelineStatus !== 'done' && target < today;
    const doneAt = this._doneAt(task);
    return `<tr>
      <td data-label="Task"><strong>${Utils.escapeHtml(task.subjectTask || '—')}</strong><div class="dash-detail-subject">${Utils.escapeHtml(task.subjectRequest || task.request.subject || '—')}</div></td>
      <td data-label="Divisi"><span class="badge ${Utils.divClass(task.division)}">${Utils.escapeHtml(task.division)}</span></td>
      <td data-label="Sales PIC">${Utils.escapeHtml(task.sales)}</td>
      <td data-label="Status">${Utils.pipeBadge(task.pipelineStatus)}</td>
      <td data-label="Target">${target ? `<span class="${overdue ? 'dash-overdue-text' : ''}">${Utils.formatDateShort(task.targetDate)}${overdue ? ' ⚠' : ''}</span>` : '—'}</td>
      <td data-label="Done">${doneAt ? Utils.formatDateShort(doneAt) : '—'}</td>
      <td data-label="Aksi"><button class="btn btn-secondary btn-xs" onclick="Dashboard.openTask('${task.id}')">Open Task</button></td>
    </tr>`;
  },

  _detailPanel(tasks, info) {
    if (!this.detail) return '';
    const { type, value } = this.detail;
    const today = this._dateOnly(new Date());
    let title = 'Semua Task Dalam Scope';
    let filtered = tasks;

    if (type === 'status') {
      title = `Pipeline: ${Utils.capitalize(value.replace('_', ' '))}`;
      filtered = tasks.filter(task => task.pipelineStatus === value);
    } else if (type === 'division') {
      title = `Divisi ${value}`;
      filtered = tasks.filter(task => task.division === value);
    } else if (type === 'sales') {
      title = `Sales PIC: ${value}`;
      filtered = tasks.filter(task => task.sales === value);
    } else if (type === 'done-week') {
      title = `Selesai pada periode ${info.display}`;
      filtered = tasks.filter(task => this._inRange(this._doneAt(task), info));
    } else if (type === 'overdue') {
      title = 'Task Overdue';
      filtered = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today);
    } else if (type === 'due-week') {
      title = `Target selesai ${info.display}`;
      filtered = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && this._inRange(new Date(`${task.targetDate}T00:00:00`), info));
    } else if (type === 'high') {
      title = 'High Priority';
      filtered = tasks.filter(task => task.priority === 'High' && task.pipelineStatus !== 'done');
    } else if (type === 'revisi') {
      title = 'Task Revisi';
      filtered = tasks.filter(task => task.pipelineStatus === 'revisi');
    }

    filtered = filtered.slice().sort((a, b) => {
      const aTarget = a.targetDate || '9999-12-31';
      const bTarget = b.targetDate || '9999-12-31';
      return aTarget.localeCompare(bTarget);
    });

    return `<section id="dashboardDetail" class="card dashboard-detail-card">
      <div class="card-header">
        <div><h3 class="card-title">${Utils.escapeHtml(title)}</h3><span class="dashboard-detail-count">${filtered.length} task ditemukan</span></div>
        <button class="btn btn-secondary btn-xs" onclick="Dashboard.closeDetails()">✕ Close</button>
      </div>
      ${filtered.length ? `<div class="table-container dashboard-detail-table"><table><thead><tr><th>Task / Request</th><th>Divisi</th><th>Sales PIC</th><th>Status</th><th>Target</th><th>Done</th><th></th></tr></thead><tbody>${filtered.map(task => this._taskRow(task, info)).join('')}</tbody></table></div>` : `<div class="dashboard-empty">Tidak ada task pada pilihan ini.</div>`}
    </section>`;
  },

  openTask(taskId) {
    const task = Storage.getTasks().find(item => item.id === taskId);
    const requestId = task?.requestId || '';
    App.navigate('#tasks');
    if (requestId) setTimeout(() => Tasks?.filterByRequest?.(requestId), 0);
  },

  render() {
    const { info, scopedRequests, tasks, salesList } = this._data();
    const today = this._dateOnly(new Date());
    const statusItems = [
      { key: 'todo', label: 'To Do', color: 'var(--yellow)' },
      { key: 'in_progress', label: 'In Progress', color: 'var(--blue)' },
      { key: 'review', label: 'Review', color: 'var(--purple)' },
      { key: 'done', label: 'Done', color: 'var(--green)' },
      { key: 'revisi', label: 'Revisi', color: 'var(--orange)' }
    ];
    const counts = Object.fromEntries(statusItems.map(item => [item.key, tasks.filter(task => task.pipelineStatus === item.key).length]));
    const active = tasks.filter(task => task.pipelineStatus !== 'done').length;
    const doneThisPeriod = tasks.filter(task => this._inRange(this._doneAt(task), info));
    const overdue = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today);
    const dueInPeriod = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && this._inRange(new Date(`${task.targetDate}T00:00:00`), info));
    const high = tasks.filter(task => task.priority === 'High' && task.pipelineStatus !== 'done');
    const revisi = tasks.filter(task => task.pipelineStatus === 'revisi');
    const completionRate = tasks.length ? Math.round((counts.done / tasks.length) * 100) : 0;
    const divisionStats = ['NETCO', 'OMG', 'ITSOL'].map(division => {
      const items = tasks.filter(task => task.division === division);
      return { division, total: items.length, done: items.filter(task => task.pipelineStatus === 'done').length, active: items.filter(task => task.pipelineStatus !== 'done').length, overdue: items.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today).length };
    });
    const salesStats = [...new Map(tasks.map(task => [task.sales, task])).keys()].sort((a,b) => a.localeCompare(b, 'id')).map(sales => {
      const items = tasks.filter(task => task.sales === sales);
      return { sales, total: items.length, done: items.filter(task => task.pipelineStatus === 'done').length, active: items.filter(task => task.pipelineStatus !== 'done').length, overdue: items.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today).length };
    });
    const maxDivision = Math.max(...divisionStats.map(item => item.total), 1);
    const recent = tasks.filter(task => task.updatedAt && this._inRange(new Date(task.updatedAt), info)).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 7);

    return `
      <div class="page-header">
        <div><h1 class="page-title">Dashboard</h1><p class="page-subtitle">Weekly Pipeline Review · ${info.display}</p></div>
        <span class="dashboard-period-badge">${info.label}</span>
      </div>

      <section class="dashboard-filters card">
        <div class="dashboard-filter-group"><span class="dashboard-filter-label">Periode</span>
          ${this._filterButton('Minggu ini', 'period', 'current', info.period === 'current')}
          ${this._filterButton('Minggu lalu', 'period', 'previous', info.period === 'previous')}
        </div>
        <div class="dashboard-filter-group"><span class="dashboard-filter-label">Divisi</span>
          ${this._filterButton('Semua', 'division', 'all', this.division === 'all')}
          ${['NETCO','OMG','ITSOL'].map(division => this._filterButton(division, 'division', division, this.division === division)).join('')}
        </div>
        <div class="dashboard-filter-group"><label class="dashboard-filter-label" for="dashboardSales">Sales PIC</label>
          <select id="dashboardSales" class="form-select dashboard-select" onchange="Dashboard.setFilter('sales',this.value)"><option value="all">Semua Sales</option>${salesList.map(sales => `<option value="${Utils.escapeHtml(sales)}" ${this.sales === sales ? 'selected' : ''}>${Utils.escapeHtml(sales)}</option>`).join('')}</select>
        </div>
        <div class="dashboard-filter-group"><label class="dashboard-filter-label" for="dashboardStatus">Status</label>
          <select id="dashboardStatus" class="form-select dashboard-select" onchange="Dashboard.setFilter('status',this.value)"><option value="all">Semua Status</option>${statusItems.map(item => `<option value="${item.key}" ${this.status === item.key ? 'selected' : ''}>${item.label}</option>`).join('')}</select>
        </div>
        <button class="btn btn-secondary btn-xs dashboard-reset" onclick="Dashboard.resetFilters()">Reset</button>
      </section>

      <div class="kpi-grid dashboard-kpis">
        <button class="kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('all')"><div class="kpi-label">Task Dalam Scope</div><div class="kpi-value">${tasks.length}</div><div class="kpi-sub">${scopedRequests.length} tender · klik untuk detail</div></button>
        <button class="kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('done-week')"><div class="kpi-label">Done Periode Ini</div><div class="kpi-value" style="color:var(--green)">${doneThisPeriod.length}</div><div class="kpi-sub">Masuk Done ${info.display}</div></button>
        <button class="kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('overdue')"><div class="kpi-label">Perlu Tindak Lanjut</div><div class="kpi-value" style="color:${overdue.length ? 'var(--red)' : 'var(--green)'}">${overdue.length}</div><div class="kpi-sub">Overdue dan belum Done</div></button>
        <button class="kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('status','done')"><div class="kpi-label">Progress Saat Ini</div><div class="kpi-value" style="color:var(--accent)">${completionRate}%</div><div class="kpi-sub">${counts.done} Done · ${active} aktif</div></button>
      </div>

      <div class="dash-grid-2">
        <section class="card">
          <div class="card-header"><div><h3 class="card-title">Pipeline Status</h3><span class="dashboard-card-hint">Klik status untuk membuka daftar task</span></div><span class="dashboard-total">${tasks.length} task</span></div>
          <div class="dashboard-pipeline-list">${statusItems.map(item => `<button class="dashboard-pipeline-row" onclick="Dashboard.showDetails('status','${item.key}')"><span class="pipe-dot" style="background:${item.color}"></span><span>${item.label}</span><span class="dashboard-pipeline-count">${counts[item.key]}</span><span class="dashboard-pipeline-percent">${tasks.length ? Math.round((counts[item.key] / tasks.length) * 100) : 0}%</span></button>`).join('')}</div>
        </section>
        <section class="card">
          <div class="card-header"><div><h3 class="card-title">⚠ Perlu Perhatian</h3><span class="dashboard-card-hint">Prioritas untuk dibahas dalam weekly review</span></div></div>
          <div class="dashboard-attention-grid">
            <button class="dashboard-attention danger" onclick="Dashboard.showDetails('overdue')"><strong>${overdue.length}</strong><span>Overdue</span></button>
            <button class="dashboard-attention warning" onclick="Dashboard.showDetails('due-week')"><strong>${dueInPeriod.length}</strong><span>Target minggu ini</span></button>
            <button class="dashboard-attention high" onclick="Dashboard.showDetails('high')"><strong>${high.length}</strong><span>High priority</span></button>
            <button class="dashboard-attention revisi" onclick="Dashboard.showDetails('revisi')"><strong>${revisi.length}</strong><span>Revisi</span></button>
          </div>
        </section>
      </div>

      ${this._detailPanel(tasks, info)}

      <div class="dash-grid-2">
        <section class="card">
          <div class="card-header"><div><h3 class="card-title">Progress per Divisi</h3><span class="dashboard-card-hint">Klik baris untuk melihat task divisi</span></div></div>
          <div class="dashboard-breakdown">${divisionStats.map(item => {
            const percent = tasks.length ? Math.round((item.done / item.total) * 100) || 0 : 0;
            return `<button class="dashboard-breakdown-row" onclick="Dashboard.showDetails('division','${item.division}')"><div class="dashboard-breakdown-head"><span style="color:${Utils.divColor(item.division)}">${item.division}</span><strong>${item.total} task</strong></div><div class="dashboard-progress-track"><span style="width:${(item.total / maxDivision) * 100}%;background:${Utils.divColor(item.division)}"></span></div><div class="dashboard-breakdown-meta"><span>${item.done} Done · ${item.active} aktif</span><span class="${item.overdue ? 'dash-overdue-text' : ''}">${item.overdue ? `⚠ ${item.overdue} overdue` : `${percent}% selesai`}</span></div></button>`;
          }).join('')}</div>
        </section>
        <section class="card">
          <div class="card-header"><div><h3 class="card-title">Progress per Sales PIC</h3><span class="dashboard-card-hint">Request By (Sales) adalah owner tender</span></div></div>
          ${salesStats.length ? `<div class="dashboard-sales-list">${salesStats.map(item => `<button class="dashboard-sales-row" onclick="Dashboard.showDetails('sales','${Utils.escapeHtml(item.sales).replace(/'/g, '&#39;')}')"><span class="dashboard-sales-name">${Utils.escapeHtml(item.sales)}</span><span class="dashboard-sales-meta"><b>${item.done}</b> Done · ${item.active} aktif${item.overdue ? ` · <em>⚠ ${item.overdue}</em>` : ''}</span><span class="dashboard-sales-total">${item.total}</span></button>`).join('')}</div>` : `<div class="dashboard-empty">Belum ada Sales PIC pada task yang difilter.</div>`}
        </section>
      </div>

      <section class="card">
        <div class="card-header"><div><h3 class="card-title">Aktivitas pada Periode</h3><span class="dashboard-card-hint">Perubahan task ${info.display}</span></div></div>
        ${recent.length ? `<div class="recent-list">${recent.map(task => `<button class="recent-row dashboard-recent-button" onclick="Dashboard.openTask('${task.id}')"><span class="recent-div" style="color:${Utils.divColor(task.division)}">${task.division}</span><span class="recent-subject">${Utils.escapeHtml(task.subjectTask || '—')}<small>${Utils.escapeHtml(task.sales)}</small></span>${Utils.pipeBadge(task.pipelineStatus)}<span class="recent-ago">${Utils.formatDateShort(task.updatedAt)}</span></button>`).join('')}</div>` : `<div class="dashboard-empty">Tidak ada pembaruan task pada periode ini.</div>`}
      </section>`;
  },

  refresh() {
    const content = document.getElementById('mainContent');
    if (content) content.innerHTML = this.render();
  }
};
