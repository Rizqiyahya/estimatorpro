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
    App.closeModal();
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
    App.closeModal();
    this.refresh();
  },

  useWeek(period) {
    this.period = period;
    this.startDate = '';
    this.endDate = '';
    this.detail = null;
    App.closeModal();
    this.refresh();
  },

  _dashboardTabs() {
    return `<div class="dashboard-tabs" role="tablist" aria-label="Dashboard mode">
      <button class="dashboard-tab ${this.activeTab === 'summary' ? 'active' : ''}" role="tab" aria-selected="${this.activeTab === 'summary'}" onclick="Dashboard.setTab('summary')"><span>Executive Summary</span><small>Portfolio overview</small></button>
      <button class="dashboard-tab ${this.activeTab === 'interactive' ? 'active' : ''}" role="tab" aria-selected="${this.activeTab === 'interactive'}" onclick="Dashboard.setTab('interactive')"><span>Interactive Analysis</span><small>Weekly review</small></button>
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

    return `<div class="dashboard-summary-head"><div><div class="dashboard-eyebrow">Portfolio overview</div><h2>Executive Summary</h2><p>Data keseluruhan hingga ${new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p></div><span class="dashboard-head-status"><i></i>All time</span></div>
      <div class="kpi-grid dashboard-kpi-grid">
        <div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">Total Requests</div><span class="kpi-card-marker neutral">All</span></div><div class="kpi-value">${totalReq}</div><div class="kpi-sub"><span class="kpi-trend neutral">${newThisWeek ? `+${newThisWeek}` : '0'}</span> tender masuk 7 hari terakhir</div></div>
        <div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">Win Rate</div><span class="kpi-card-marker success">${win + lose} decided</span></div><div class="kpi-value" style="color:${winRate >= 50 ? 'var(--green)' : 'var(--orange)'}">${winRate}%</div><div class="kpi-sub"><span style="color:var(--green)">${win} Won</span><span class="kpi-separator">·</span><span style="color:var(--red)">${lose} Lost</span><span class="kpi-separator">·</span><span style="color:var(--blue)">${open} Open</span></div></div>
        <div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">Active Pipeline</div><span class="kpi-card-marker ${overdue ? 'danger' : 'neutral'}">${overdue ? `${overdue} overdue` : 'On track'}</span></div><div class="kpi-value">${active}</div><div class="kpi-sub">${done} Done <span class="kpi-separator">·</span> ${revisi} Revisi <span class="kpi-separator">·</span> ${highPrio} <span style="color:var(--red)">High</span></div><div class="kpi-scope-row">${scope.map(s => `<span style="color:${s.color}">${s.key} <b>${s.active}</b></span>`).join('')}</div></div>
        <div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">Avg. Cycle Time</div><span class="kpi-card-marker ${stuck ? 'warning' : 'success'}">${stuck ? `${stuck} stuck` : 'Healthy'}</span></div><div class="kpi-value kpi-duration">${Utils.formatDuration(avgCycle)}</div><div class="kpi-sub">Median ${Utils.formatDuration(medianCycle)} <span class="kpi-separator">·</span> ${cycleTimes.length} task terukur</div><div class="kpi-footnote">${stuck ? 'Perlu review task tanpa perubahan >3 hari.' : 'Tidak ada task stagnan lebih dari 3 hari.'}</div></div>
      </div>
      <div class="dash-grid-211 dashboard-summary-grid">
        <section class="card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">01</span><h3 class="card-title">Pipeline Status</h3><span class="dashboard-card-hint">Distribusi task pada seluruh pipeline</span></div><span class="dashboard-total">${totalTasks} task</span></div><div class="pipeline-bar">${pipeItems.map(item => pipes[item.key] ? `<div class="pipeline-segment ${item.key}" style="width:${pipes[item.key] / totalPipe * 100}%" title="${item.label}: ${pipes[item.key]}"></div>` : '').join('')}</div><div class="dashboard-summary-legend">${pipeItems.map(item => `<div class="pipe-legend-row"><div style="display:flex;align-items:center;gap:10px"><span class="pipe-dot" style="background:${item.color}"></span><span class="pipe-label">${item.label}</span></div><span class="pipe-count">${pipes[item.key]}</span></div>`).join('')}</div></section>
        <section class="card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">02</span><h3 class="card-title">Request Status</h3><span class="dashboard-card-hint">Hasil tender seluruh periode</span></div></div><div class="donut-wrap dashboard-summary-donut">${this._donut(requestStatus, requestColors, 150)}<div class="donut-legend">${this._legend(requestStatus, requestColors)}</div></div></section>
        <section class="card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">03</span><h3 class="card-title">Scope Pipeline</h3><span class="dashboard-card-hint">Task aktif dibanding yang selesai</span></div><span class="dashboard-total">Aktif / Done</span></div><div class="bar-chart dashboard-summary-bars">${scope.map(item => { const doneCount = item.total-item.active, activePercent = item.total ? item.active / item.total * 100 : 0; return `<div class="bar-row"><div class="bar-label" style="color:${item.color};font-weight:700">${item.key}</div><div class="bar-track" style="display:flex"><div class="bar-fill" style="width:${activePercent}%;background:${item.color}"><span class="bar-value">${item.active}</span></div><div class="bar-fill" style="width:${100-activePercent}%;background:var(--green);opacity:.28"><span class="bar-value" style="text-shadow:none;color:var(--green)">${doneCount}</span></div></div><div class="dashboard-bar-detail">${item.active} aktif<br><span>${doneCount} done</span></div></div>`; }).join('')}</div></section>
      </div>
      <div class="dash-grid-2 dashboard-summary-grid">
        <section class="card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">04</span><h3 class="card-title">Division Breakdown</h3><span class="dashboard-card-hint">Porsi task menurut divisi</span></div><span class="dashboard-total">Jumlah / porsi</span></div><div class="bar-chart dashboard-summary-bars">${['NETCO','OMG','ITSOL'].map(div => { const count=divs[div], width=count/maxDiv*100, portion=totalTasks ? Math.round(count/totalTasks*100) : 0; return `<div class="bar-row"><div class="bar-label" style="color:${Utils.divColor(div)}">${div}</div><div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${Utils.divColor(div)}"><span class="bar-value">${count}</span></div></div><div class="bar-count">${portion}%</div></div>`; }).join('')}</div></section>
        <section class="card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">05</span><h3 class="card-title">Win Rate per Division</h3><span class="dashboard-card-hint">Rasio win dari tender yang diputuskan</span></div></div><div class="bar-chart dashboard-summary-bars">${divStats.map(item => { const color=item.rate>=60?'var(--green)':item.rate>=30?'var(--orange)':'var(--red)'; return `<div class="bar-row"><div class="bar-label" style="color:${item.color};font-weight:700">${item.div}</div><div class="bar-track"><div class="bar-fill" style="width:${item.rate}%;background:${color}">${item.rate>25?`<span class="bar-value">${item.rate}%</span>`:''}</div></div><div class="dashboard-bar-detail">${item.win}W/${item.decided}D</div></div>`; }).join('')}</div><div class="dashboard-rate-guide"><span>≥60% good</span><span>30–59% caution</span><span>&lt;30% critical</span></div></section>
      </div>
      <div class="kpi-grid dashboard-summary-mini dashboard-kpi-grid"><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">High Priority</div><span class="kpi-card-marker danger">Attention</span></div><div class="kpi-value" style="color:var(--red)">${highPrio}</div><div class="kpi-sub">Task yang membutuhkan fokus segera</div></div><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">Done This Week</div><span class="kpi-card-marker success">Completed</span></div><div class="kpi-value" style="color:var(--green)">${doneThisWeek}</div><div class="kpi-sub">Task selesai dalam 7 hari terakhir</div></div><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">Overall Win Rate</div><span class="kpi-card-marker neutral">All time</span></div><div class="kpi-value" style="color:var(--accent)">${winRate}%</div><div class="kpi-sub">${win} won <span class="kpi-separator">·</span> ${win+lose} decided</div></div><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">Unique Customers</div><span class="kpi-card-marker neutral">Portfolio</span></div><div class="kpi-value">${Object.keys(customers).length}</div><div class="kpi-sub">Customer pada seluruh divisi</div></div></div>
      <section class="card dashboard-target-card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index attention">06</span><h3 class="card-title">Target Done Pipeline</h3><span class="dashboard-card-hint">Kesiapan task terhadap target penyelesaian</span></div><span class="dashboard-total">${hasTarget} / ${totalTasks} bertarget</span></div>${hasTarget ? `<div class="kpi-grid dashboard-kpi-grid dashboard-target-kpis"><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label" style="color:var(--red)">Overdue</div><span class="kpi-card-marker danger">Review</span></div><div class="kpi-value" style="color:var(--red)">${overdue}</div><div class="kpi-sub">Lewat target dan belum Done</div></div><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label" style="color:var(--orange)">Due ≤3 Hari</div><span class="kpi-card-marker warning">Deadline</span></div><div class="kpi-value" style="color:var(--orange)">${dueSoon}</div><div class="kpi-sub">Target penyelesaian mendekat</div></div><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label">On Track</div><span class="kpi-card-marker neutral">Planned</span></div><div class="kpi-value">${Math.max(0, hasTarget - overdue - dueSoon - tasks.filter(t => t.targetDate && t.pipelineStatus === 'done').length)}</div><div class="kpi-sub">Target lebih dari 3 hari, belum Done</div></div><div class="kpi-card dashboard-kpi-card"><div class="kpi-card-head"><div class="kpi-label" style="color:var(--green)">Selesai</div><span class="kpi-card-marker success">Done</span></div><div class="kpi-value" style="color:var(--green)">${tasks.filter(t => t.targetDate && t.pipelineStatus === 'done').length}</div><div class="kpi-sub">Task dengan target yang telah Done</div></div></div>` : `<div class="dashboard-empty">Belum ada task dengan Target Done.</div>`}</section>
      <div class="dash-grid-2 dashboard-summary-grid"><section class="card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">07</span><h3 class="card-title">Customer Breakdown</h3><span class="dashboard-card-hint">Konsentrasi tender menurut customer</span></div><span class="dashboard-total">Top ${topCustomers.length} / ${Object.keys(customers).length}</span></div>${topCustomers.length ? `<div class="bar-chart dashboard-summary-bars">${topCustomers.map(([name, value], i) => `<div class="bar-row"><div class="bar-label dashboard-truncate" title="${Utils.escapeHtml(name)}">${Utils.escapeHtml(this._truncate(name,16))}</div><div class="bar-track"><div class="bar-fill" style="width:${value.total/maxCustomer*100}%;background:${['var(--accent)','var(--blue)','var(--green)','var(--purple)','var(--orange)','var(--cyan)'][i%6]}">${value.total/maxCustomer>0.35?`<span class="bar-value">${value.total}</span>`:''}</div></div><span class="dashboard-bar-detail">${value.total}</span></div><div class="dashboard-row-note"><span>${value.win} won</span><span>${value.lose} lost</span></div>`).join('')}</div>` : `<div class="dashboard-empty">Belum ada data customer.</div>`}</section><section class="card dashboard-panel dashboard-summary-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">08</span><h3 class="card-title">End User Breakdown</h3><span class="dashboard-card-hint">End user dengan volume tender tertinggi</span></div><span class="dashboard-total">Top ${topEndUsers.length}</span></div>${topEndUsers.length ? `<div class="bar-chart dashboard-summary-bars">${topEndUsers.map(([name, value]) => { const topDiv=Object.entries(value.divs).sort((a,b)=>b[1]-a[1])[0]?.[0]; return `<div class="bar-row"><div class="bar-label dashboard-truncate" style="color:${Utils.divColor(topDiv)}" title="${Utils.escapeHtml(name)}">${Utils.escapeHtml(this._truncate(name,18))}</div><div class="bar-track"><div class="bar-fill" style="width:${value.count/maxEndUser*100}%;background:${Utils.divColor(topDiv)}"><span class="bar-value">${value.count}</span></div></div><span class="dashboard-bar-detail">${value.count}</span></div>`; }).join('')}</div>` : `<div class="dashboard-empty">Belum ada data end user.</div>`}</section></div>
      <section class="card dashboard-panel dashboard-summary-panel dashboard-activity-panel"><div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">09</span><h3 class="card-title">Recent Activity</h3><span class="dashboard-card-hint">Pembaruan task dalam 7 hari terakhir</span></div><span class="dashboard-total">${recent.length} update</span></div>${recent.length ? `<div class="recent-list">${recent.map(task => { const request=reqs.find(r=>r.id===task.requestId); const age=Math.max(0,Math.floor((Date.now()-new Date(task.updatedAt))/86400000)); return `<div class="recent-row"><span class="recent-div" style="color:${Utils.divColor(request?.division)}">${request?.division || '—'}</span><span class="recent-subject">${Utils.escapeHtml(this._truncate(task.subjectTask,30))}</span>${Utils.pipeBadge(task.pipelineStatus)}<span class="recent-ago">${age}d</span></div>`; }).join('')}</div>` : `<div class="dashboard-empty">Belum ada aktivitas 7 hari terakhir.</div>`}</section>`;
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

  _statusLabel(status) {
    return ({ todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done', revisi: 'Revisi' })[status] || '—';
  },

  _scopeLabel(task) {
    return ['PL', 'PS', 'MS'].filter(scope => task[`scope${scope}`]).join(', ') || '—';
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
    App.closeModal();
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
    App.closeModal();
    this.refresh();
  },

  showDetails(type, value = '') {
    const { info, tasks } = this._data();
    const today = this._dateOnly(new Date());
    let title = 'Semua Task Dalam Scope';
    let description = `Task sesuai filter aktif · ${info.display}`;
    let tone = 'neutral';
    let filtered = tasks;

    if (type === 'status') { title = `Pipeline: ${this._statusLabel(value)}`; description = `Task dengan status ${this._statusLabel(value)}`; filtered = tasks.filter(task => task.pipelineStatus === value); tone = value === 'done' ? 'success' : value === 'revisi' ? 'warning' : 'neutral'; }
    else if (type === 'division') { title = `Divisi: ${value}`; description = `Task ${value} dalam filter aktif`; filtered = tasks.filter(task => task.division === value); }
    else if (type === 'sales') { title = `Sales PIC: ${value}`; description = 'Request By (Sales) adalah owner tender'; filtered = tasks.filter(task => task.sales === value); }
    else if (type === 'done-week') { title = 'Task Done'; description = `Selesai pada ${info.display}`; filtered = tasks.filter(task => this._inRange(this._doneAt(task), info)); tone = 'success'; }
    else if (type === 'overdue') { title = 'Task Overdue'; description = 'Melewati target penyelesaian dan belum Done'; filtered = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today); tone = 'danger'; }
    else if (type === 'due-week') { title = 'Target Done'; description = `Target penyelesaian pada ${info.display}`; filtered = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && this._inRange(new Date(`${task.targetDate}T00:00:00`), info)); tone = 'warning'; }
    else if (type === 'high') { title = 'Task High Priority'; description = 'Task aktif dengan prioritas tinggi'; filtered = tasks.filter(task => task.priority === 'High' && task.pipelineStatus !== 'done'); tone = 'danger'; }
    else if (type === 'revisi') { title = 'Task Revisi'; description = 'Task yang membutuhkan revisi'; filtered = tasks.filter(task => task.pipelineStatus === 'revisi'); tone = 'warning'; }

    filtered = filtered.slice().sort((a, b) => (a.targetDate || '9999-12-31').localeCompare(b.targetDate || '9999-12-31'));
    this.detail = { type, value };
    const countLabel = filtered.length === 1 ? '1 task ditemukan' : `${filtered.length} task ditemukan`;
    App.openModal(`<div class="dashboard-detail-modal" data-tone="${tone}">
      <div class="modal-header dashboard-detail-modal-header">
        <div><div class="dashboard-detail-modal-kicker"><span></span>Drill-down detail</div><h2 class="modal-title">${Utils.escapeHtml(title)}</h2><p>${Utils.escapeHtml(description)}</p></div>
        <button class="modal-close" type="button" onclick="Dashboard.closeDetails()" aria-label="Tutup detail">×</button>
      </div>
      <div class="dashboard-detail-modal-summary"><span class="dashboard-detail-result-count">${countLabel}</span><span>${Utils.escapeHtml(info.display)}</span></div>
      ${filtered.length ? `<div class="table-container dashboard-detail-table"><table><thead><tr><th>Task / Request</th><th>Divisi</th><th>Sales PIC</th><th>Status</th><th>Target</th><th>Done</th><th></th></tr></thead><tbody>${filtered.map(task => this._taskRow(task, info)).join('')}</tbody></table></div>` : `<div class="dashboard-empty">Tidak ada task pada pilihan ini.</div>`}
      <div class="modal-footer dashboard-detail-modal-footer"><span>Klik <b>Open Task</b> untuk melihat detail task lengkap.</span><button class="btn btn-secondary btn-sm" type="button" onclick="Dashboard.closeDetails()">Tutup</button></div>
    </div>`, 'wide dashboard-detail-modal-box');
  },

  closeDetails() {
    this.detail = null;
    App.closeModal();
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

  openTask(taskId) {
    const task = Storage.getTasks().find(item => item.id === taskId);
    const requestId = task?.requestId || '';
    App.navigate('#tasks');
    if (requestId) setTimeout(() => Tasks?.filterByRequest?.(requestId), 0);
  },

  exportReport() {
    if (typeof XLSX === 'undefined') {
      Utils.showToast('Library Excel belum siap. Silakan coba lagi beberapa saat.', 'error');
      return;
    }
    const { info, scopedRequests, tasks } = this._data();
    const today = this._dateOnly(new Date());
    const statusItems = [
      { key: 'todo', label: 'To Do' }, { key: 'in_progress', label: 'In Progress' },
      { key: 'review', label: 'Review' }, { key: 'done', label: 'Done' }, { key: 'revisi', label: 'Revisi' }
    ];
    const doneThisPeriod = tasks.filter(task => this._inRange(this._doneAt(task), info));
    const overdue = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today);
    const dueInPeriod = tasks.filter(task => task.targetDate && task.pipelineStatus !== 'done' && this._inRange(new Date(`${task.targetDate}T00:00:00`), info));
    const high = tasks.filter(task => task.priority === 'High' && task.pipelineStatus !== 'done');
    const revisi = tasks.filter(task => task.pipelineStatus === 'revisi');
    const taskRows = tasks.slice().sort((a, b) => (a.targetDate || '9999-12-31').localeCompare(b.targetDate || '9999-12-31')).map(task => ({
      'Request Date': task.request.date || '',
      'Request / Tender': task.subjectRequest || task.request.subject || '',
      'Sales PIC': task.sales,
      'Customer': task.request.customer || '',
      'End User': task.request.endUser || '',
      'Division': task.division,
      'Task': task.subjectTask || '',
      'Category': task.category || '',
      'Scope': this._scopeLabel(task),
      'Priority': task.priority || '',
      'Pipeline Status': this._statusLabel(task.pipelineStatus),
      'Target Done': task.targetDate || '',
      'Done Date': this._doneAt(task) ? this._dateKey(this._doneAt(task)) : '',
      'Last Updated': task.updatedAt ? this._dateKey(task.updatedAt) : '',
      'Notes': task.notes || ''
    }));
    const reqIdsInTasks = new Set(tasks.map(task => task.requestId));
    const requestRows = scopedRequests.filter(request => reqIdsInTasks.has(request.id) || !tasks.length).map(request => ({
      'Request Date': request.date || '',
      'Request / Tender': request.subject || '',
      'Sales PIC': request.requestBy || 'Belum diisi',
      'Customer': request.customer || '',
      'End User': request.endUser || '',
      'Division': request.division || '',
      'Status': request.status || '',
      'Scope': ['PL', 'PS', 'MS'].filter(scope => request[`scope${scope}`]).join(', ') || '—',
      'Last Updated': request.updatedAt ? this._dateKey(request.updatedAt) : ''
    }));
    const divisionRows = ['NETCO', 'OMG', 'ITSOL'].map(division => {
      const rows = tasks.filter(task => task.division === division);
      return { Division: division, 'Total Task': rows.length, Done: rows.filter(task => task.pipelineStatus === 'done').length, Active: rows.filter(task => task.pipelineStatus !== 'done').length, Overdue: rows.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today).length };
    });
    const salesRows = [...new Set(tasks.map(task => task.sales))].sort((a,b) => a.localeCompare(b, 'id')).map(sales => {
      const rows = tasks.filter(task => task.sales === sales);
      return { 'Sales PIC': sales, 'Total Task': rows.length, Done: rows.filter(task => task.pipelineStatus === 'done').length, Active: rows.filter(task => task.pipelineStatus !== 'done').length, Overdue: rows.filter(task => task.targetDate && task.pipelineStatus !== 'done' && new Date(`${task.targetDate}T00:00:00`) < today).length };
    });
    const pipelineRows = statusItems.map(item => ({ Status: item.label, 'Jumlah Task': tasks.filter(task => task.pipelineStatus === item.key).length }));
    const attentionRows = [
      ...overdue.map(task => ({ Jenis: 'Overdue', ...this._exportAttentionTask(task) })),
      ...dueInPeriod.map(task => ({ Jenis: 'Target dalam periode', ...this._exportAttentionTask(task) })),
      ...high.map(task => ({ Jenis: 'High Priority', ...this._exportAttentionTask(task) })),
      ...revisi.map(task => ({ Jenis: 'Revisi', ...this._exportAttentionTask(task) }))
    ];
    const summaryRows = [
      ['EstimatorPro — Interactive Analysis Report'],
      ['Periode', info.display],
      ['Filter Divisi', this.division === 'all' ? 'Semua Divisi' : this.division],
      ['Filter Sales PIC', this.sales === 'all' ? 'Semua Sales' : this.sales],
      ['Filter Status', this.status === 'all' ? 'Semua Status' : this._statusLabel(this.status)],
      ['Dibuat pada', new Date().toLocaleString('id-ID')],
      [],
      ['KPI', 'Nilai'],
      ['Tender dalam scope', scopedRequests.length],
      ['Task dalam scope', tasks.length],
      ['Done dalam periode', doneThisPeriod.length],
      ['Task aktif saat ini', tasks.filter(task => task.pipelineStatus !== 'done').length],
      ['Overdue', overdue.length],
      ['Target dalam periode', dueInPeriod.length],
      ['High Priority', high.length],
      ['Revisi', revisi.length]
    ];
    const workbook = XLSX.utils.book_new();
    const addSheet = (name, rows, json = true) => {
      const sheet = json ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet(rows);
      if (json && rows.length) {
        sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: Object.keys(rows[0]).length - 1, r: rows.length } }) };
        sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
        sheet['!cols'] = Object.keys(rows[0]).map(key => ({ wch: Math.min(42, Math.max(12, key.length + 2, ...rows.map(row => String(row[key] ?? '').length + 2))) }));
      } else if (!json) {
        sheet['!cols'] = [{ wch: 26 }, { wch: 34 }];
      }
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    };
    addSheet('Summary', summaryRows, false);
    addSheet('Division Summary', divisionRows);
    addSheet('Sales PIC Summary', salesRows);
    addSheet('Pipeline Status', pipelineRows);
    addSheet('Attention Items', attentionRows);
    addSheet('Task Detail', taskRows);
    addSheet('Request Detail', requestRows);
    const safeStart = info.startKey.replaceAll('-', '');
    const safeEnd = info.endKey.replaceAll('-', '');
    XLSX.writeFile(workbook, `EstimatorPro_Report_${safeStart}_to_${safeEnd}.xlsx`);
    Utils.showToast('Excel report berhasil diunduh.', 'success');
  },

  _exportAttentionTask(task) {
    return {
      'Request / Tender': task.subjectRequest || task.request.subject || '',
      Task: task.subjectTask || '',
      Division: task.division,
      'Sales PIC': task.sales,
      Status: this._statusLabel(task.pipelineStatus),
      Priority: task.priority || '',
      'Target Done': task.targetDate || ''
    };
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
        <div><div class="dashboard-eyebrow">Weekly review workspace</div><h2>Interactive Analysis</h2><p>Periode analisis <span>·</span> ${info.display}</p></div>
        <div class="dashboard-analysis-actions"><span class="dashboard-period-badge"><i></i>${info.label}</span><button class="btn btn-primary btn-sm dashboard-export-btn" onclick="Dashboard.exportReport()">⇩ <span>Export Excel</span></button></div>
      </div>

      <section class="dashboard-filters card">
        <div class="dashboard-filter-intro"><span class="dashboard-filter-kicker">Scope analysis</span><span class="dashboard-filter-summary">Atur periode dan fokus review</span></div>
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

      <div class="kpi-grid dashboard-kpis dashboard-kpi-grid">
        <button class="kpi-card dashboard-kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('all')"><div class="kpi-card-head"><div class="kpi-label">Task Dalam Scope</div><span class="dashboard-kpi-action">Detail ↗</span></div><div class="kpi-value">${tasks.length}</div><div class="kpi-sub">${scopedRequests.length} tender dalam filter aktif</div></button>
        <button class="kpi-card dashboard-kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('done-week')"><div class="kpi-card-head"><div class="kpi-label">Done Periode Ini</div><span class="kpi-card-marker success">Completed</span></div><div class="kpi-value" style="color:var(--green)">${doneThisPeriod.length}</div><div class="kpi-sub">Selesai pada ${info.display}</div></button>
        <button class="kpi-card dashboard-kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('overdue')"><div class="kpi-card-head"><div class="kpi-label">Perlu Tindak Lanjut</div><span class="kpi-card-marker ${overdue.length ? 'danger' : 'success'}">${overdue.length ? 'Needs review' : 'Clear'}</span></div><div class="kpi-value" style="color:${overdue.length ? 'var(--red)' : 'var(--green)'}">${overdue.length}</div><div class="kpi-sub">Task overdue dan belum Done</div></button>
        <button class="kpi-card dashboard-kpi-card dashboard-kpi-button" onclick="Dashboard.showDetails('status','done')"><div class="kpi-card-head"><div class="kpi-label">Progress Saat Ini</div><span class="dashboard-kpi-action">Detail ↗</span></div><div class="kpi-value" style="color:var(--accent)">${completionRate}%</div><div class="kpi-sub">${counts.done} Done <span class="kpi-separator">·</span> ${active} masih aktif</div></button>
      </div>

      <div class="dash-grid-2">
        <section class="card dashboard-panel">
          <div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">01</span><h3 class="card-title">Pipeline Status</h3><span class="dashboard-card-hint">Klik status untuk membuka daftar task</span></div><span class="dashboard-total">${tasks.length} task</span></div>
          <div class="dashboard-pipeline-list">${statusItems.map(item => `<button class="dashboard-pipeline-row" onclick="Dashboard.showDetails('status','${item.key}')"><span class="pipe-dot" style="background:${item.color}"></span><span>${item.label}</span><span class="dashboard-pipeline-meter"><i style="width:${tasks.length ? (counts[item.key] / tasks.length) * 100 : 0}%;background:${item.color}"></i></span><span class="dashboard-pipeline-count">${counts[item.key]}</span><span class="dashboard-pipeline-percent">${tasks.length ? Math.round((counts[item.key] / tasks.length) * 100) : 0}%</span></button>`).join('')}</div>
        </section>
        <section class="card dashboard-panel dashboard-attention-panel">
          <div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index attention">02</span><h3 class="card-title">Perlu Perhatian</h3><span class="dashboard-card-hint">Prioritas untuk dibahas dalam weekly review</span></div></div>
          <div class="dashboard-attention-grid">
            <button class="dashboard-attention danger" onclick="Dashboard.showDetails('overdue')"><strong>${overdue.length}</strong><span>Overdue</span></button>
            <button class="dashboard-attention warning" onclick="Dashboard.showDetails('due-week')"><strong>${dueInPeriod.length}</strong><span>Target minggu ini</span></button>
            <button class="dashboard-attention high" onclick="Dashboard.showDetails('high')"><strong>${high.length}</strong><span>High priority</span></button>
            <button class="dashboard-attention revisi" onclick="Dashboard.showDetails('revisi')"><strong>${revisi.length}</strong><span>Revisi</span></button>
          </div>
        </section>
      </div>

      <div class="dash-grid-2">
        <section class="card dashboard-panel">
          <div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">03</span><h3 class="card-title">Progress per Divisi</h3><span class="dashboard-card-hint">Klik baris untuk melihat task divisi</span></div></div>
          <div class="dashboard-breakdown">${divisionStats.map(item => {
            const percent = tasks.length ? Math.round((item.done / item.total) * 100) || 0 : 0;
            return `<button class="dashboard-breakdown-row" onclick="Dashboard.showDetails('division','${item.division}')"><div class="dashboard-breakdown-head"><span style="color:${Utils.divColor(item.division)}">${item.division}</span><strong>${item.total} task</strong></div><div class="dashboard-progress-track"><span style="width:${(item.total / maxDivision) * 100}%;background:${Utils.divColor(item.division)}"></span></div><div class="dashboard-breakdown-meta"><span>${item.done} Done · ${item.active} aktif</span><span class="${item.overdue ? 'dash-overdue-text' : ''}">${item.overdue ? `⚠ ${item.overdue} overdue` : `${percent}% selesai`}</span></div></button>`;
          }).join('')}</div>
        </section>
        <section class="card dashboard-panel">
          <div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">04</span><h3 class="card-title">Progress per Sales PIC</h3><span class="dashboard-card-hint">Request By (Sales) adalah owner tender</span></div></div>
          ${salesStats.length ? `<div class="dashboard-sales-list">${salesStats.map(item => `<button class="dashboard-sales-row" onclick="Dashboard.showDetails('sales','${Utils.escapeHtml(item.sales).replace(/'/g, '&#39;')}')"><span class="dashboard-sales-name">${Utils.escapeHtml(item.sales)}</span><span class="dashboard-sales-meta"><b>${item.done}</b> Done · ${item.active} aktif${item.overdue ? ` · <em>⚠ ${item.overdue}</em>` : ''}</span><span class="dashboard-sales-total">${item.total}</span></button>`).join('')}</div>` : `<div class="dashboard-empty">Belum ada Sales PIC pada task yang difilter.</div>`}
        </section>
      </div>

      <section class="card dashboard-panel dashboard-activity-panel">
        <div class="card-header dashboard-panel-header"><div><span class="dashboard-section-index">05</span><h3 class="card-title">Aktivitas pada Periode</h3><span class="dashboard-card-hint">Perubahan task ${info.display}</span></div></div>
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
