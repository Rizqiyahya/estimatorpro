/* ============================================================
   EstimatorPro v3 — Dashboard (DAL: Pie Chart + High Contrast)
   ============================================================ */

const Dashboard = {
  /* ---- SVG Donut Chart ---- */
  _donut(data, colors, size) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const cx = size / 2, cy = size / 2, r = size / 2 - 16, sw = 20;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    let segments = '';
    data.forEach((d, i) => {
      if (d.value === 0) return;
      const dash = (d.value / total) * circ;
      const dashArr = `${dash} ${circ - dash}`;
      segments += `<circle r="${r}" cx="${cx}" cy="${cy}" fill="none" stroke="${colors[i]}" stroke-width="${sw}" stroke-dasharray="${dashArr}" stroke-dashoffset="${-offset}" stroke-linecap="butt" transform="rotate(-90 ${cx} ${cy})" />`;
      offset += dash;
    });
    // Center text
    const centerText = total > 0 ? `${Math.round((data[0]?.value||0)/total*100)}%` : '—';
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart">${segments}<text x="${cx}" y="${cy}" text-anchor="middle" dy="0.35em" class="donut-center">${centerText}</text></svg>`;
  },

  /* ---- Legend ---- */
  _legend(items, colors) {
    return items.map((item, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-label">${item.label}</span>
        <span class="legend-value">${item.value}</span>
      </div>
    `).join('');
  },

  render() {
    const reqs = Storage.getRequests();
    const tasks = Storage.getTasks();

    const totalReq = reqs.length;
    const totalTasks = tasks.length;
    const open = reqs.filter(r => r.status === 'open').length;
    const win = reqs.filter(r => r.status === 'win').length;
    const lose = reqs.filter(r => r.status === 'lose').length;
    const winRate = totalReq > 0 ? Math.round((win / totalReq) * 100) : 0;

    const active = tasks.filter(t => t.pipelineStatus !== 'done').length;
    const done = tasks.filter(t => t.pipelineStatus === 'done').length;
    const revisi = tasks.filter(t => t.pipelineStatus === 'revisi').length;

    // Pipeline counts
    const pipes = {
      todo: tasks.filter(t => t.pipelineStatus === 'todo').length,
      in_progress: tasks.filter(t => t.pipelineStatus === 'in_progress').length,
      review: tasks.filter(t => t.pipelineStatus === 'review').length,
      done: done,
      revisi: revisi
    };
    const totalPipe = Object.values(pipes).reduce((s,v) => s+v, 0) || 1;

    // Per division
    const divs = { NETCO: 0, OMG: 0, ITSOL: 0 };
    tasks.forEach(t => { const r = reqs.find(rr => rr.id === t.requestId); if (r && divs[r.division] !== undefined) divs[r.division]++; });
    const maxDiv = Math.max(...Object.values(divs), 1);

    // 7-day
    const wkAgo = new Date(Date.now() - 7*24*60*60*1000);
    const newThisWeek = reqs.filter(r => new Date(r.createdAt) >= wkAgo).length;
    const doneThisWeek = tasks.filter(t => t.pipelineStatus === 'done' && new Date(t.updatedAt) >= wkAgo).length;
    const highPrio = tasks.filter(t => t.priority === 'High').length;

    // Cycle time (avg total duration from created to done/revisi)
    const cycleTimes = tasks
      .filter(t => t.pipelineHistory && t.pipelineHistory.length > 1)
      .map(t => Utils.calcCycleTime(t.pipelineHistory))
      .filter(ms => ms !== null);
    const avgCycle = cycleTimes.length ? Math.round(cycleTimes.reduce((a,b) => a+b, 0) / cycleTimes.length) : 0;
    const stuckTasks = tasks.filter(t => {
      if (!t.pipelineHistory || t.pipelineStatus === 'done') return false;
      const lastAt = new Date(t.pipelineHistory[t.pipelineHistory.length - 1].at).getTime();
      return (Date.now() - lastAt) > 3 * 24 * 60 * 60 * 1000; // stuck > 3 hari
    }).length;

    // Recent activity
    const recent = tasks.filter(t => new Date(t.updatedAt) >= wkAgo).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);

    // Pipeline bar items
    const pipeItems = [
      { key:'todo', label:'To Do', color:'var(--pipe-todo)', count:pipes.todo },
      { key:'in_progress', label:'In Progress', color:'var(--pipe-inprog)', count:pipes.in_progress },
      { key:'review', label:'Review', color:'var(--pipe-review)', count:pipes.review },
      { key:'done', label:'Done', color:'var(--pipe-done)', count:pipes.done },
      { key:'revisi', label:'Revisi', color:'var(--pipe-revisi)', count:pipes.revisi }
    ];

    // Donut: Request Status
    const reqStatus = [
      { value: win, label: 'Win' },
      { value: open, label: 'Open' },
      { value: lose, label: 'Lose' }
    ];
    const reqColors = ['var(--green)', 'var(--blue)', 'var(--red)'];

    // Donut: Division
    const divData = [
      { value: divs.NETCO, label: 'NETCO' },
      { value: divs.OMG, label: 'OMG' },
      { value: divs.ITSOL, label: 'ITSOL' }
    ];
    const divColors = ['var(--netco)', 'var(--omg)', 'var(--itsol)'];

    const html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Weekly Pipeline Report — ${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
      </div>

      <!-- KPI Row -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Requests</div>
          <div class="kpi-value">${totalReq}</div>
          <div class="kpi-sub">+${newThisWeek} this week</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Win Rate</div>
          <div class="kpi-value" style="color:${winRate>=50?'var(--green)':'var(--orange)'}">${winRate}%</div>
          <div class="kpi-sub">${win} Won · ${lose} Lost · <span style="color:var(--blue)">${open} Open</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Active Pipeline</div>
          <div class="kpi-value">${active}</div>
          <div class="kpi-sub">${done} Done · ${revisi} Revisi · ${highPrio} <span style="color:var(--red)">High</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Avg. Cycle Time</div>
          <div class="kpi-value" style="font-size:1.6rem">${Utils.formatDuration(avgCycle)}</div>
          <div class="kpi-sub">${cycleTimes.length} tasks · ${stuckTasks > 0 ? `<span style="color:var(--orange)">⚠ ${stuckTasks} stuck >3d</span>` : 'No tasks stuck'}</div>
        </div>
      </div>

      <!-- Row 2: Pipeline + Request Status Donut -->
      <div class="dash-grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Pipeline Status</h3>
            <span style="font-size:0.76rem;color:var(--text-muted)">${totalTasks} total tasks</span>
          </div>
          <div class="pipeline-bar">
            ${pipeItems.map(p => {
              const pct = (p.count / totalPipe) * 100;
              return pct > 0 ? `<div class="pipeline-segment ${p.key}" style="width:${pct}%" title="${p.label}: ${p.count}"></div>` : '';
            }).join('')}
          </div>
          ${pipeItems.map(p => `
            <div class="pipe-legend-row">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="pipe-dot" style="background:${p.color}"></span>
                <span class="pipe-label">${p.label}</span>
              </div>
              <span class="pipe-count">${p.count}</span>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Request Status</h3>
            <span style="font-size:0.76rem;color:var(--text-muted)">${totalReq} requests</span>
          </div>
          <div class="donut-wrap">
            ${this._donut(reqStatus, reqColors, 160)}
            <div class="donut-legend">
              ${this._legend(reqStatus, reqColors)}
            </div>
          </div>
        </div>
      </div>

      <!-- Row 3: Division Donut + Bar -->
      <div class="dash-grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Tasks by Division</h3>
            <span style="font-size:0.76rem;color:var(--text-muted)">${totalTasks} tasks</span>
          </div>
          <div class="donut-wrap">
            ${this._donut(divData, divColors, 160)}
            <div class="donut-legend">
              ${this._legend(divData, divColors)}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Division Breakdown</h3>
          </div>
          <div class="bar-chart" style="margin-top:8px">
            ${[
              { div:'NETCO', color:'netco', col:'var(--netco)' },
              { div:'OMG', color:'omg', col:'var(--omg)' },
              { div:'ITSOL', color:'itsol', col:'var(--itsol)' }
            ].map(d => {
              const c = divs[d.div];
              const pct = maxDiv > 0 ? (c/maxDiv)*100 : 0;
              return `
                <div class="bar-row">
                  <div class="bar-label" style="color:${d.col}">${d.div}</div>
                  <div class="bar-track">
                    <div class="bar-fill ${d.color}" style="width:${pct}%">
                      ${pct>20?`<span class="bar-value">${c}</span>`:''}
                    </div>
                  </div>
                  <div class="bar-count" style="color:var(--text-primary);font-weight:600">${c}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div style="margin-top:20px;display:flex;gap:16px;font-size:0.82rem">
            <div style="flex:1;text-align:center;padding:10px;background:var(--bg-input);border-radius:8px">
              <div style="color:var(--text-muted)">High Priority</div>
              <div style="font-size:1.5rem;font-weight:700;color:var(--red)">${highPrio}</div>
            </div>
            <div style="flex:1;text-align:center;padding:10px;background:var(--bg-input);border-radius:8px">
              <div style="color:var(--text-muted)">Done This Week</div>
              <div style="font-size:1.5rem;font-weight:700;color:var(--green)">${doneThisWeek}</div>
            </div>
            <div style="flex:1;text-align:center;padding:10px;background:var(--bg-input);border-radius:8px">
              <div style="color:var(--text-muted)">Win Rate</div>
              <div style="font-size:1.5rem;font-weight:700;color:var(--accent)">${winRate}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 4: Recent Activity -->
      <div class="card">
        <div class="card-header"><h3 class="card-title">Recent Activity (7 Days)</h3></div>
        ${recent.length === 0 ? '<p style="color:var(--text-muted);font-size:0.84rem;text-align:center;padding:20px">No recent activity</p>' : `
          <div class="recent-list">
            ${recent.map(t => {
              const req = reqs.find(r => r.id === t.requestId);
              const ago = Math.max(0, Math.floor((Date.now() - new Date(t.updatedAt)) / (1000*60*60*24)));
              return `
                <div class="recent-row">
                  <span class="recent-div" style="color:${Utils.divColor(req?.division)}">${req?.division||'—'}</span>
                  <span class="recent-subject">${Utils.escapeHtml(Utils.truncate(t.subjectTask,40))}</span>
                  ${Utils.pipeBadge(t.pipelineStatus)}
                  <span class="recent-ago">${ago}d ago</span>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
    return html;
  }
};
