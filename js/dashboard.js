/* ============================================================
   EstimatorPro — Interactive Weekly Dashboard
   Weekly period is Monday 00:00 through Sunday 23:59.
   ============================================================ */

const Dashboard = {
  activeTab: 'summary',
  period: null,
  startDate: '',
  endDate: '',
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

  _truncate(text, max) {
    const value = String(text || '');
    return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
  },

  _donut(items, colors, size = 150) {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const segments = total ? items.map((item, index) => {
      const length = item.value / total * circumference;
      const segment = `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${colors[index]}" stroke-width="14" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)" />`;
      offset += length;
      return segment;
    }).join('') : `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--border)" stroke-width="14" />`;
    return `<svg class="donut-chart" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="Total ${total}">${segments}<text x="50" y="55" text-anchor="middle" class="donut-center">${total}</text></svg>`;
  },

  _legend(items, colors) {
    return items.map((item, index) => `<div class="legend-item"><span class="legend-dot" style="background:${colors[index]}"></span><span class="legend-label">${item.label}</span><span class="legend-value">${item.value}</span></div>`).join('');
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
    let range;
    let label;
    if (this.startDate && this.endDate) {
      range = {
        start: new Date(`${this.startDate}T00:00:00`),
        end: new Date(`${this.endDate}T00:00:00`)
      };
      label = 'Rentang kustom';
    } else {
      range = period === 'previous' ? this._weekRange(-1) : this._weekRange(0);
      label = period === 'previous' ? 'Minggu lalu' : 'Minggu ini';
    }
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

  setTab(tab) {
    this.activeTab = tab === 'interactive' ? 'interactive' : 'summary';
    this.detail = null;
    this.refresh();
  },

  setDateRange() {
    const start = document.getElementById('dashboardStartDate')?.value || '';
    const end = document.getElementById('dashboardEndDate')?.value || '';
    if (start && end && start > end) {
      Utils.showToast('Tanggal mulai tidak boleh melebihi tanggal akhir.', 'error');
      return;
    }
    this.startDate = start;
    this.endDate = end;
    this.detail = null;
    this.refresh();
  },

  useWeek(period) {
    this.period = period;
    this.startDate = '';
    this.endDate = '';
    this.detail = null;
    this.refresh();
  },

  _dashboardTabs() {
    return `<div class="dashboard-tabs" role="tablist" aria-label="Dashboard mode">
      <button class="dashboard-tab ${this.activeTab === 'summary' ? 'active' : ''}" role="tab" aria-selected="${this.activeTab === 'summary'}" onclick="Dashboard.setTab('summary')">Executive Summary <small>All time</small></button>
      <button class="dashboard-tab ${this.activeTab === 'interactive' ? 'active' : ''}" role="tab" aria-selected="${this.activeTab === 'interactive'}" onclick="Dashboard.setTab('interactive')">Interactive Analysis <small>Filter & detail</small></button>
    </div>`;
  },

  _summaryRender() {
    const reqs = Storage.getRequests();
    const tasks = Storage.getTasks();
    const totalReq = reqs.length, totalTasks = tasks.length;
    const open = reqs.filter(r => r.status === 'open').length, win = reqs.filter(r => r.status === 'win').length, lose = reqs.filter(r => r.status === 'lose').length;
    const winRate = totalReq ? Math.round((win / totalReq) * 100) : 0;
    const active = tasks.filter(t => t.pipelineStatus !== 'done').length, done = tasks.filter(t => t.pipelineStatus === 'done').length, revisi = tasks.filter(t => t.pipelineStatus === 'revisi').length;
    const pipes = { todo: 0, in_progress: 0, review: 0, done: 0, revisi: 0 };
    tasks.forEach(t => { if (pipes[t.pipelineStatus] !== undefined) pipes[t.pipelineStatus]++; });
    const pipeItems = [{ key:'todo', label:'To Do', color:'var(--yellow)' }, { key:'in_progress', label:'In Progress', color:'var(--blue)' }, { key:'review', label:'Review', color:'var(--purple)' }, { key:'done', label:'Done', color:'var(--green)' }, { key:'revisi', label:'Revisi', color:'var(--orange)' }];
    const totalPipe = Math.max(totalTasks, 1);
    const divs = { NETCO: 0, OMG: 0, ITSOL: 0 };
    tasks.forEach(t => { const request = reqs.find(r => r.id === t.requestId); if (request && divs[request.division] !== undefined) divs[request.division]++; });
    const maxDiv = Math.max(...Object.values(divs), 1);
    const scope = ['PL', 'PS', 'MS'].map(key => ({ key, total: tasks.filter(t => t[`scope${key}`]).length, active: tasks.filter(t => t[`scope${key}`] && t.pipelineStatus !== 'done').length, color: key === 'PL' ? 'var(--blue)' : key === 'PS' ? 'var(--purple)' : 'var(--cyan)' }));
    const divStats = ['NETCO', 'OMG', 'ITSOL'].map(div => { const items = reqs.filter(r => r.division === div); const decided = items.filter(r => r.status !== 'open'); const wins = items.filter(r => r.status === 'win').length; return { div, total:items.length, win:wins, decided:decided.length, rate: decided.length ? Math.round((wins / decided.length) * 100) : 0, color: Utils.divColor(div) }; });
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const newThisWeek = reqs.filter(r => new Date(r.createdAt) >= weekAgo).length;
    const doneThisWeek = tasks.filter(t => t.pipelineStatus === 'done' && new Date(t.updatedAt) >= weekAgo).length;
    const highPrio = tasks.filter(t => t.priority === 'High').length;
    const cycleTimes = tasks.filter(t => t.pipelineHistory?.length > 1).map(t => Utils.calcCycleTime(t.pipelineHistory)).filter(v => v !== null);
    const avgCycle = cycleTimes.length ? Math.round(cycleTimes.reduce((a,b) => a + b, 0) / cycleTimes.length) : 0;
    const sortedCycles = [...cycleTimes].sort((a,b) => a-b), medianCycle = sortedCycles.length ? sortedCycles[Math.floor(sortedCycles.length / 2)] : 0;
    const stuck = tasks.filter(t => t.pipelineHistory?.length && t.pipelineStatus !== 'done' && Date.now() - new Date(t.pipelineHistory[t.pipelineHistory.length - 1].at) > 3 * 86400000).length;
    const today = this._dateOnly(new Date()), soon = new Date(today); soon.setDate(today.getDate() + 3);
    const overdue = tasks.filter(t => t.targetDate && t.pipelineStatus !== 'done' && new Date(`${t.targetDate}T00:00:00`) < today).length;
    const dueSoon = tasks.filter(t => t.targetDate && t.pipelineStatus !== 'done' && new Date(`${t.targetDate}T00:00:00`) >= today && new Date(`${t.targetDate}T00:00:00`) <= soon).length;
    const hasTarget = tasks.filter(t => t.targetDate).length;
    const customers = {};
    reqs.forEach(r => { const key = (r.customer || 'Unknown').trim(); customers[key] ??= { total:0, win:0, lose:0 }; customers[key].total++; if (r.status === 'win') customers[key].win++; if (r.status === 'lose') customers[key].lose++; });
    const topCustomers = Object.entries(customers).sort((a,b) => b[1].total - a[1].total).slice(0, 8), maxCustomer = topCustomers[0]?.[1].total || 1;
    const endUsers = {};
    reqs.forEach(r => (r.endUser || '').split(',').map(v => v.trim()).filter(v => v.length > 1).forEach(name => { endUsers[name] ??= { count:0, divs:{} }; endUsers[name].count++; endUsers[name].divs[r.division] = (endUsers[name].divs[r.division] || 0) + 1; }));
    const topEndUsers = Object.entries(endUsers).sort((a,b) => b[1].count - a[1].count).slice(0, 8), maxEndUser = topEndUsers[0]?.[1].count || 1;
    const recent = tasks.filter(t => new Date(t.updatedAt) >= weekAgo).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
    const requestStatus = [{ value:win, label:'Win' }, { value:open, label:'Open' }, { value:lose, label:'Lose' }];
    const requestColors = ['var(--green)', 'var(--blue)', 'var(--red)'];

    return `<div class="dashboard-summary-head"><div><h2>Executive Summary</h2><p>Data keseluruhan hingga ${new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p></div><span>All time</span></div>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Total Requests</div><div class="kpi-value">${totalReq}</div><div class="kpi-sub">+${newThisWeek} this week</div></div>
        <div class="kpi-card"><div class="kpi-label">Win Rate</div><div class="kpi-value" style="color:${winRate >= 50 ? 'var(--green)' : 'var(--orange)'}">${winRate}%</div><div class="kpi-sub">${win} Won · ${lose} Lost · <span style="color:var(--blue)">${open} Open</span></div></div>
        <div class="kpi-card"><div class="kpi-label">Active Pipeline</div><div class="kpi-value">${active}</div><div class="kpi-sub">${done} Done · ${revisi} Revisi · ${highPrio} <span style="color:var(--red)">High</span></div><div class="kpi-sub" style="margin-top:3px;font-size:.66rem">${scope.map(s => `<span style="color:${s.color};font-weight:600">${s.key} ${s.active}</span>`).join(' · ')} <span style="color:var(--text-muted)">aktif</span>${overdue ? ` · <span style="color:var(--red);font-weight:600">⚠ ${overdue} overdue</span>` : ''}</div></div>
        <div class="kpi-card"><div class="kpi-label">Avg. Cycle Time ⓘ</div><div class="kpi-value" style="font-size:1.6rem">${Utils.formatDuration(avgCycle)}</div><div class="kpi-sub">median ${Utils.formatDuration(medianCycle)} · dari ${cycleTimes.length} task</div><div class="kpi-sub" style="font-size:.66rem">${stuck ? `<span style="color:var(--orange)">⚠ ${stuck} stuck >3d</span>` : 'No stuck'}</div></div>
      </div>
      <div class="dash-grid-211">
        <section class="card"><div class="card-header"><h3 class="card-title">Pipeline Status</h3><span class="dashboard-total">${totalTasks} total tasks</span></div><div class="pipeline-bar">${pipeItems.map(item => pipes[item.key] ? `<div class="pipeline-segment ${item.key}" style="width:${pipes[item.key] / totalPipe * 100}%" title="${item.label}: ${pipes[item.key]}"></div>` : '').join('')}</div>${pipeItems.map(item => `<div class="pipe-legend-row"><div style="display:flex;align-items:center;gap:10px"><span class="pipe-dot" style="background:${item.color}"></span><span class="pipe-label">${item.label}</span></div><span class="pipe-count">${pipes[item.key]}</span></div>`).join('')}</section>
        <section class="card"><div class="card-header"><h3 class="card-title">Request Status</h3></div><div class="donut-wrap" style="justify-content:center">${this._donut(requestStatus, requestColors, 150)}<div class="donut-legend">${this._legend(requestStatus, requestColors)}</div></div></section>
        <section class="card"><div class="card-header"><h3 class="card-title">Scope Pipeline</h3><span class="dashboard-total">Aktif vs Done</span></div><div class="bar-chart" style="margin-top:8px">${scope.map(item => { const doneCount = item.total-item.active, activePercent = item.total ? item.active / item.total * 100 : 0; return `<div class="bar-row"><div class="bar-label" style="color:${item.color};font-weight:600">${item.key}</div><div class="bar-track" style="display:flex"><div class="bar-fill" style="width:${activePercent}%;background:${item.color}"><span class="bar-value">${item.active}</span></div><div class="bar-fill" style="width:${100-activePercent}%;background:var(--green);opacity:.28"><span class="bar-value" style="text-shadow:none;color:var(--green)">${doneCount}</span></div></div><div style="font-size:.68rem;min-width:74px;text-align:right">${item.active} aktif<br><span style="color:var(--green)">${doneCount} done</span></div></div>`; }).join('')}</div></section>
      </div>
      <div class="dash-grid-2">
        <section class="card"><div class="card-header"><h3 class="card-title">Division Breakdown — Tasks</h3><span class="dashboard-total">angka = jumlah · % = porsi</span></div><div class="bar-chart" style="margin-top:8px">${['NETCO','OMG','ITSOL'].map(div => { const count=divs[div], width=count/maxDiv*100, portion=totalTasks ? Math.round(count/totalTasks*100) : 0; return `<div class="bar-row"><div class="bar-label" style="color:${Utils.divColor(div)}">${div}</div><div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${Utils.divColor(div)}"><span class="bar-value">${count}</span></div></div><div class="bar-count">${portion}%</div></div>`; }).join('')}</div></section>
        <section class="card"><div class="card-header"><h3 class="card-title">Win Rate / Division</h3></div>${divStats.map(item => { const color=item.rate>=60?'var(--green)':item.rate>=30?'var(--orange)':'var(--red)'; return `<div class="bar-row" style="margin-bottom:10px"><div class="bar-label" style="color:${item.color};font-weight:600">${item.div}</div><div class="bar-track"><div class="bar-fill" style="width:${item.rate}%;background:${color}">${item.rate>25?`<span class="bar-value">${item.rate}%</span>`:''}</div></div><div style="font-size:.68rem;min-width:50px;text-align:right">${item.win}W/${item.decided}D</div></div>`; }).join('')}<div style="margin-top:12px;font-size:.7rem;color:var(--text-muted)">🟢 ≥60% good · 🟠 30-59% caution · 🔴 &lt;30% critical</div></section>
      </div>
      <div class="kpi-grid dashboard-summary-mini"><div class="kpi-card"><div class="kpi-label">High Priority</div><div class="kpi-value" style="color:var(--red)">${highPrio}</div><div class="kpi-sub">Tasks needing attention</div></div><div class="kpi-card"><div class="kpi-label">Done This Week</div><div class="kpi-value" style="color:var(--green)">${doneThisWeek}</div><div class="kpi-sub">Tasks completed</div></div><div class="kpi-card"><div class="kpi-label">Overall WR</div><div class="kpi-value" style="color:var(--accent)">${winRate}%</div><div class="kpi-sub">${win}W / ${win+lose}D decided</div></div><div class="kpi-card"><div class="kpi-label">Unique Customers</div><div class="kpi-value">${Object.keys(customers).length}</div><div class="kpi-sub">Across divisions</div></div></div>
      <section class="card dashboard-target-card"><div class="card-header"><h3 class="card-title">🎯 Target Done Pipeline</h3><span class="dashboard-total">${hasTarget} dari ${totalTasks} task punya target</span></div>${hasTarget ? `<div class="kpi-grid"><div class="kpi-card"><div class="kpi-label" style="color:var(--red)">Overdue</div><div class="kpi-value" style="color:var(--red)">${overdue}</div><div class="kpi-sub">Lewat target & belum done</div></div><div class="kpi-card"><div class="kpi-label" style="color:var(--orange)">Due ≤3 hari</div><div class="kpi-value" style="color:var(--orange)">${dueSoon}</div><div class="kpi-sub">Target mendekat</div></div><div class="kpi-card"><div class="kpi-label">On Track</div><div class="kpi-value">${Math.max(0, hasTarget - overdue - dueSoon - tasks.filter(t => t.targetDate && t.pipelineStatus === 'done').length)}</div><div class="kpi-sub">Target >3 hari, belum done</div></div><div class="kpi-card"><div class="kpi-label" style="color:var(--green)">Selesai</div><div class="kpi-value" style="color:var(--green)">${tasks.filter(t => t.targetDate && t.pipelineStatus === 'done').length}</div><div class="kpi-sub">Done tepat/lebih awal</div></div></div>` : `<div class="dashboard-empty">Belum ada task dengan Target Done.</div>`}</section>
      <div class="dash-grid-2"><section class="card"><div class="card-header"><h3 class="card-title">Customer Breakdown</h3><span class="dashboard-total">Top ${topCustomers.length} of ${Object.keys(customers).length}</span></div>${topCustomers.length ? `<div class="bar-chart">${topCustomers.map(([name, value], i) => `<div class="bar-row"><div class="bar-label dashboard-truncate" title="${Utils.escapeHtml(name)}">${Utils.escapeHtml(this._truncate(name,16))}</div><div class="bar-track"><div class="bar-fill" style="width:${value.total/maxCustomer*100}%;background:${['var(--accent)','var(--blue)','var(--green)','var(--purple)','var(--orange)','var(--cyan)'][i%6]}">${value.total/maxCustomer>0.35?`<span class="bar-value">${value.total}</span>`:''}</div></div><span style="font-weight:600;font-size:.78rem">${value.total}</span></div><div class="dashboard-row-note">🟢${value.win}W 🔴${value.lose}L</div>`).join('')}</div>` : `<div class="dashboard-empty">No customer data</div>`}</section><section class="card"><div class="card-header"><h3 class="card-title">End User Breakdown</h3><span class="dashboard-total">Top ${topEndUsers.length} end users</span></div>${topEndUsers.length ? `<div class="bar-chart">${topEndUsers.map(([name, value]) => { const topDiv=Object.entries(value.divs).sort((a,b)=>b[1]-a[1])[0]?.[0]; return `<div class="bar-row"><div class="bar-label dashboard-truncate" style="color:${Utils.divColor(topDiv)}" title="${Utils.escapeHtml(name)}">${Utils.escapeHtml(this._truncate(name,18))}</div><div class="bar-track"><div class="bar-fill" style="width:${value.count/maxEndUser*100}%;background:${Utils.divColor(topDiv)}"><span class="bar-value">${value.count}</span></div></div><span style="font-weight:600;font-size:.78rem">${value.count}</span></div>`; }).join('')}</div>` : `<div class="dashboard-empty">No end user data</div>`}</section></div>
      <section class="card"><div class="card-header"><h3 class="card-title">Recent Activity (7 Days)</h3></div>${recent.length ? `<div class="recent-list">${recent.map(task => { const request=reqs.find(r=>r.id===task.requestId); const age=Math.max(0,Math.floor((Date.now()-new Date(task.updatedAt))/86400000)); return `<div class="recent-row"><span class="recent-div" style="color:${Utils.divColor(request?.division)}">${request?.division || '—'}</span><span class="recent-subject">${Utils.escapeHtml(this._truncate(task.subjectTask,30))}</span>${Utils.pipeBadge(task.pipelineStatus)}<span class="recent-ago">${age}d</span></div>`; }).join('')}</div>` : `<div class="dashboard-empty">No recent activity</div>`}</section>`;
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
    if (key === 'period') {
      this.startDate = '';
      this.endDate = '';
    }
    this.detail = null;
    this.refresh();
  },

  resetFilters() {
    this.period = new Date().getDay() === 1 ? 'previous' : 'current';
    this.startDate = '';
    this.endDate = '';
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

  _interactiveRender() {
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
      <div class="dashboard-analysis-head">
        <div><h2>Interactive Analysis</h2><p>Periode analisis · ${info.display}</p></div>
        <span class="dashboard-period-badge">${info.label}</span>
      </div>

      <section class="dashboard-filters card">
        <div class="dashboard-filter-group"><span class="dashboard-filter-label">Shortcut periode</span>
          ${this._filterButton('Minggu ini', 'period', 'current', !this.startDate && info.period === 'current')}
          ${this._filterButton('Minggu lalu', 'period', 'previous', !this.startDate && info.period === 'previous')}
        </div>
        <div class="dashboard-filter-group dashboard-date-range"><label class="dashboard-filter-label" for="dashboardStartDate">Tanggal mulai</label><input id="dashboardStartDate" class="form-input dashboard-date-input" type="date" value="${this.startDate}"><label class="dashboard-filter-label" for="dashboardEndDate">s.d.</label><input id="dashboardEndDate" class="form-input dashboard-date-input" type="date" value="${this.endDate}"><button class="btn btn-primary btn-xs" onclick="Dashboard.setDateRange()">Apply</button></div>
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

  render() {
    return `<div class="page-header"><div><h1 class="page-title">Dashboard</h1><p class="page-subtitle">Pipeline management overview & reporting</p></div></div>
      ${this._dashboardTabs()}
      ${this.activeTab === 'interactive' ? this._interactiveRender() : this._summaryRender()}`;
  },

  refresh() {
    const content = document.getElementById('mainContent');
    if (content) content.innerHTML = this.render();
  }
};
