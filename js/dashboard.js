/* ============================================================
   EstimatorPro v3 — Dashboard (DAL: High Contrast & Interactivity)
   ============================================================ */

const Dashboard = {
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

    // Pipeline
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

    // 7-day activity
    const wkAgo = new Date(Date.now() - 7*24*60*60*1000);
    const newThisWeek = reqs.filter(r => new Date(r.createdAt) >= wkAgo).length;
    const doneThisWeek = tasks.filter(t => t.pipelineStatus === 'done' && new Date(t.updatedAt) >= wkAgo).length;

    // High priority count
    const highPrio = tasks.filter(t => t.priority === 'High').length;

    // Recent activity items
    const recent = tasks.filter(t => new Date(t.updatedAt) >= wkAgo).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);

    const pipeItems = [
      { key:'todo', label:'To Do', color:'var(--pipe-todo)', count:pipes.todo },
      { key:'in_progress', label:'In Progress', color:'var(--pipe-inprog)', count:pipes.in_progress },
      { key:'review', label:'Review', color:'var(--pipe-review)', count:pipes.review },
      { key:'done', label:'Done', color:'var(--pipe-done)', count:pipes.done },
      { key:'revisi', label:'Revisi', color:'var(--pipe-revisi)', count:pipes.revisi }
    ];

    const html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Weekly Pipeline Report — ${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
      </div>

      <!-- KPI Row — High Contrast Anchoring -->
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
          <div class="kpi-label">7-Day Activity</div>
          <div class="kpi-value" style="font-size:1.6rem">+${newThisWeek} / ✓${doneThisWeek}</div>
          <div class="kpi-sub">New requests / Tasks completed</div>
        </div>
      </div>

      <!-- Pipeline + Division -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Pipeline Status</h3>
            <span style="font-size:0.76rem;color:var(--text-muted)">${totalTasks} total tasks</span>
          </div>
          <div class="pipeline-bar" style="margin-bottom:16px">
            ${pipeItems.map(p => {
              const pct = (p.count / totalPipe) * 100;
              return pct > 0 ? `<div class="pipeline-segment ${p.key}" style="width:${pct}%" title="${p.label}: ${p.count}"></div>` : '';
            }).join('')}
          </div>
          ${pipeItems.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:0.85rem">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="width:10px;height:10px;border-radius:2px;background:${p.color};display:inline-block;flex-shrink:0"></span>
                <span style="color:var(--text-primary)">${p.label}</span>
              </div>
              <span style="font-weight:700;font-family:var(--font-mono);font-size:0.9rem;color:var(--text-primary)">${p.count}</span>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Task by Division</h3>
            <span style="font-size:0.76rem;color:var(--text-muted)">${totalTasks} tasks</span>
          </div>
          <div class="bar-chart" style="margin-top:4px">
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
        </div>
      </div>

      <!-- Bottom: Priority + Recent -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Priority & Request Status</h3></div>
          <div style="display:flex;gap:24px;align-items:center;padding:4px 0">
            <div style="text-align:center;flex:1">
              <div style="font-size:2rem;font-weight:700;color:var(--red)">${highPrio}</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px">High Priority</div>
            </div>
            <div style="width:1px;height:40px;background:var(--border)"></div>
            <div style="text-align:center;flex:1">
              <div style="font-size:2rem;font-weight:700;color:var(--text-primary)">${tasks.length - highPrio}</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px">Normal</div>
            </div>
          </div>
          <div style="margin-top:14px;display:flex;gap:12px;font-size:0.82rem">
            <span class="badge badge-blue">${open} Open</span>
            <span class="badge badge-green">${win} Win</span>
            <span class="badge badge-red">${lose} Lose</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Recent Activity (7 Days)</h3></div>
          ${recent.length === 0 ? '<p style="color:var(--text-muted);font-size:0.84rem;text-align:center;padding:20px">No recent activity</p>' : `
            <div style="display:flex;flex-direction:column;gap:8px;font-size:0.83rem">
              ${recent.map(t => {
                const req = reqs.find(r => r.id === t.requestId);
                const ago = Math.max(0, Math.floor((Date.now() - new Date(t.updatedAt)) / (1000*60*60*24)));
                return `
                  <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border-light)">
                    <span style="color:${Utils.divColor(req?.division)};font-weight:600;font-size:0.72rem;width:44px">${req?.division||'—'}</span>
                    <span style="flex:1">${Utils.escapeHtml(Utils.truncate(t.subjectTask,30))}</span>
                    ${Utils.pipeBadge(t.pipelineStatus)}
                    <span style="color:var(--text-muted);font-size:0.7rem;white-space:nowrap">${ago}d ago</span>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
    return html;
  }
};
