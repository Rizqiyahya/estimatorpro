/* ============================================================
   EstimatorPro v4 — Dashboard (DAL Layout: Map + Full Grid)
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
      segments += `<circle r="${r}" cx="${cx}" cy="${cy}" fill="none" stroke="${colors[i]}" stroke-width="${sw}" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" stroke-linecap="butt" transform="rotate(-90 ${cx} ${cy})" />`;
      offset += dash;
    });
    const pct = total > 0 ? Math.round((data[0]?.value||0)/total*100) : 0;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart">${segments}<text x="${cx}" y="${cy}" text-anchor="middle" dy="0.35em" class="donut-center">${pct}%</text></svg>`;
  },

  /* ---- Legend ---- */
  _legend(items, colors) {
    return items.map((item, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-label">${item.label}</span>
        <span class="legend-value">${item.value}</span>
      </div>`).join('');
  },

  /* ---- All Data ---- */
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
    const pipes = { todo:0, in_progress:0, review:0, done:0, revisi:0 };
    tasks.forEach(t => { if (pipes[t.pipelineStatus] !== undefined) pipes[t.pipelineStatus]++; });
    const totalPipe = Math.max(Object.values(pipes).reduce((s,v)=>s+v,0), 1);

    // Per division - tasks
    const divs = { NETCO:0, OMG:0, ITSOL:0 };
    tasks.forEach(t => { const r = reqs.find(rr=>rr.id===t.requestId); if (r&&divs[r.division]!==undefined) divs[r.division]++; });
    const maxDiv = Math.max(...Object.values(divs), 1);

    // Per division - win rate
    const divStats = { NETCO:{total:0,win:0,lose:0,open:0}, OMG:{total:0,win:0,lose:0,open:0}, ITSOL:{total:0,win:0,lose:0,open:0} };
    reqs.forEach(r => { if (divStats[r.division]) { divStats[r.division].total++; if (r.status==='win')divStats[r.division].win++; if (r.status==='lose')divStats[r.division].lose++; if (r.status==='open')divStats[r.division].open++; }});
    const divWR = Object.entries(divStats).map(([div,s]) => ({ div, total:s.total, win:s.win, lose:s.lose, open:s.open, winRate:s.total>0?Math.round((s.win/Math.max(s.win+s.lose,1))*100):0, color:div==='NETCO'?'var(--netco)':div==='OMG'?'var(--omg)':'var(--itsol)' }));

    // 7-day
    const wkAgo = new Date(Date.now() - 7*24*60*60*1000);
    const newThisWeek = reqs.filter(r => new Date(r.createdAt) >= wkAgo).length;
    const doneThisWeek = tasks.filter(t => t.pipelineStatus==='done' && new Date(t.updatedAt)>=wkAgo).length;
    const highPrio = tasks.filter(t => t.priority==='High').length;

    // Cycle time
    const cycleTimes = tasks.filter(t=>t.pipelineHistory&&t.pipelineHistory.length>1).map(t=>Utils.calcCycleTime(t.pipelineHistory)).filter(ms=>ms!==null);
    const avgCycle = cycleTimes.length ? Math.round(cycleTimes.reduce((a,b)=>a+b,0)/cycleTimes.length) : 0;
    const stuckTasks = tasks.filter(t=>{ if(!t.pipelineHistory||t.pipelineStatus==='done')return false; const la=new Date(t.pipelineHistory[t.pipelineHistory.length-1].at).getTime(); return (Date.now()-la)>3*24*60*60*1000; }).length;

    // Customer breakdown
    const custMap = {};
    reqs.forEach(r => { const c=(r.customer||'Unknown').trim(); if(!custMap[c])custMap[c]={total:0,open:0,win:0,lose:0}; custMap[c].total++; if(r.status==='open')custMap[c].open++; if(r.status==='win')custMap[c].win++; if(r.status==='lose')custMap[c].lose++; });
    const topCust = Object.entries(custMap).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
    const maxCust = topCust.length ? topCust[0][1].total : 1;
    const uniqueCust = Object.keys(custMap).length;
    const custColors = ['var(--accent)','var(--blue)','var(--green)','var(--purple)','var(--orange)','var(--cyan)','var(--netco)','var(--pipe-inprog)'];

    // Location breakdown
    const locMap = {};
    reqs.forEach(r => {
      const raw = r.endUser || '';
      if (!raw.trim()) return;
      raw.split(',').forEach(s => {
        const city = s.trim();
        if (!city || city.length < 2) return;
        if (!locMap[city]) locMap[city] = { count:0, divisi:{} };
        locMap[city].count++;
        const div = r.division || 'NETCO';
        locMap[city].divisi[div] = (locMap[city].divisi[div]||0) + 1;
      });
    });
    const topLoc = Object.entries(locMap).sort((a,b) => b[1].count - a[1].count).slice(0,10);
    const maxLoc = topLoc.length ? topLoc[0][1].count : 1;

    // Recent activity
    const recent = tasks.filter(t => new Date(t.updatedAt)>=wkAgo).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5);

    const reqStatus = [{ value: win, label: 'Win' },{ value: open, label: 'Open' },{ value: lose, label: 'Lose' }];
    const reqColors = ['var(--green)','var(--blue)','var(--red)'];
    const divData = [{ value:divs.NETCO,label:'NETCO' },{ value:divs.OMG,label:'OMG' },{ value:divs.ITSOL,label:'ITSOL' }];
    const divColors = ['var(--netco)','var(--omg)','var(--itsol)'];

    const pipeItems = [
      { key:'todo',label:'To Do',color:'var(--pipe-todo)',count:pipes.todo },
      { key:'in_progress',label:'In Progress',color:'var(--pipe-inprog)',count:pipes.in_progress },
      { key:'review',label:'Review',color:'var(--pipe-review)',count:pipes.review },
      { key:'done',label:'Done',color:'var(--pipe-done)',count:pipes.done },
      { key:'revisi',label:'Revisi',color:'var(--pipe-revisi)',count:pipes.revisi }
    ];

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Weekly Pipeline Report — ${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
      </div>

      <!-- ======== ROW 1: KPI (1:1:1:1) ======== -->
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
          <div class="kpi-sub">${cycleTimes.length} tasks · ${stuckTasks>0?`<span style="color:var(--orange)">⚠${stuckTasks} stuck >3d</span>`:'No stuck'}</div>
        </div>
      </div>

      <!-- ======== ROW 2: Pipeline (2) + Req Status (1) + Task Div (1) ======== -->
      <div class="dash-grid-211">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Pipeline Status</h3>
            <span style="font-size:0.76rem;color:var(--text-muted)">${totalTasks} total tasks</span>
          </div>
          <div class="pipeline-bar">
            ${pipeItems.map(p => { const pct=(p.count/totalPipe)*100; return pct>0?`<div class="pipeline-segment ${p.key}" style="width:${pct}%" title="${p.label}: ${p.count}"></div>`:''; }).join('')}
          </div>
          ${pipeItems.map(p => `
            <div class="pipe-legend-row">
              <div style="display:flex;align-items:center;gap:10px"><span class="pipe-dot" style="background:${p.color}"></span><span class="pipe-label">${p.label}</span></div>
              <span class="pipe-count">${p.count}</span>
            </div>`).join('')}
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Request Status</h3></div>
          <div class="donut-wrap" style="justify-content:center">
            ${this._donut(reqStatus, reqColors, 150)}
            <div class="donut-legend">${this._legend(reqStatus, reqColors)}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Tasks / Division</h3></div>
          <div class="donut-wrap" style="justify-content:center">
            ${this._donut(divData, divColors, 150)}
            <div class="donut-legend">${this._legend(divData, divColors)}</div>
          </div>
        </div>
      </div>

      <!-- ======== ROW 3: Division Breakdown (2) + Win Rate (1) + Summary (1) ======== -->
      <div class="dash-grid-211">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Division Breakdown — Tasks</h3></div>
          <div class="bar-chart" style="margin-top:8px">
            ${[{ div:'NETCO',color:'netco',col:'var(--netco)' },{ div:'OMG',color:'omg',col:'var(--omg)' },{ div:'ITSOL',color:'itsol',col:'var(--itsol)' }].map(d => {
              const c = divs[d.div]; const pct = maxDiv>0?(c/maxDiv)*100:0;
              return `<div class="bar-row">
                <div class="bar-label" style="color:${d.col}">${d.div}</div>
                <div class="bar-track"><div class="bar-fill ${d.color}" style="width:${pct}%">${pct>25?`<span class="bar-value">${c}</span>`:''}</div></div>
                <div class="bar-count">${c}</div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Win Rate / Division</h3></div>
          ${divWR.map(d => {
            const wrPct = d.winRate; const decided = d.win+d.lose;
            const wrColor = wrPct>=60?'var(--green)':wrPct>=30?'var(--orange)':'var(--red)';
            return `<div class="bar-row" style="margin-bottom:6px">
              <div class="bar-label" style="color:${d.color};font-weight:600">${d.div}</div>
              <div class="bar-track" style="background:var(--bg-input)"><div class="bar-fill" style="width:${wrPct}%;background:${wrColor};border-radius:3px">${wrPct>25?`<span class="bar-value">${wrPct}%</span>`:''}</div></div>
              <div style="font-size:0.68rem;color:var(--text-muted);min-width:50px;text-align:right">${d.win}W/${decided}D</div>
            </div>`;
          }).join('')}
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Summary</h3></div>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
            <div style="padding:10px;background:var(--bg-input);border-radius:8px;text-align:center">
              <div style="color:var(--text-muted);font-size:0.72rem">High Priority</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--red)">${highPrio}</div>
            </div>
            <div style="padding:10px;background:var(--bg-input);border-radius:8px;text-align:center">
              <div style="color:var(--text-muted);font-size:0.72rem">Done This Week</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--green)">${doneThisWeek}</div>
            </div>
            <div style="padding:10px;background:var(--bg-input);border-radius:8px;text-align:center">
              <div style="color:var(--text-muted);font-size:0.72rem">Overall WR</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--accent)">${winRate}%</div>
            </div>
            <div style="padding:10px;background:var(--bg-input);border-radius:8px;text-align:center">
              <div style="color:var(--text-muted);font-size:0.72rem">Unique Customers</div>
              <div style="font-size:1.3rem;font-weight:700;color:var(--text-primary)">${uniqueCust}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ======== ROW 4: Customer (1) + Location Map (2) + Recent (1) ======== -->
      <div class="dash-grid-121">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Customer Breakdown</h3>
            <span style="font-size:0.72rem;color:var(--text-muted)">Top ${topCust.length} of ${uniqueCust}</span>
          </div>
          ${topCust.length===0?`<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:16px">No customer data</p>`:`
            <div class="bar-chart" style="margin-top:4px">
              ${topCust.map(([name,stats],i) => {
                const pct = (stats.total/maxCust)*100;
                return `<div class="bar-row">
                  <div class="bar-label" style="width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.75rem;font-weight:500" title="${Utils.escapeHtml(name)}">${Utils.escapeHtml(Utils.truncate(name,16))}</div>
                  <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${custColors[i]||'var(--accent)'}">${pct>35?`<span class="bar-value">${stats.total}</span>`:''}</div></div>
                  <span style="font-weight:600;font-size:0.78rem">${stats.total}</span>
                </div>
                <div style="display:flex;gap:8px;font-size:0.64rem;color:var(--text-muted);margin:-2px 0 6px 98px">
                  🟢${stats.win}W 🔴${stats.lose}L
                </div>`;
              }).join('')}
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">End User Breakdown</h3>
            <span style="font-size:0.72rem;color:var(--text-muted)">${topLoc.length} end users · ${reqs.length} requests</span>
          </div>
          
          ${topLoc.length===0?`<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:16px">No end user data</p>`:`
            <div class="bar-chart" style="margin-top:4px">
              ${topLoc.map(([city, data], i) => {
                const pct = (data.count/maxLoc)*100;
                const topDiv = Object.entries(data.divisi).sort((a,b)=>b[1]-a[1])[0];
                const dColor = topDiv ? (topDiv[0]==='NETCO'?'var(--netco)':topDiv[0]==='OMG'?'var(--omg)':'var(--itsol)') : 'var(--accent)';
                return `<div class="bar-row">
                  <div class="bar-label" style="width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.75rem;font-weight:500;color:${dColor}" title="${Utils.escapeHtml(city)}">${Utils.escapeHtml(Utils.truncate(city,18))}</div>
                  <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${dColor};opacity:0.7">${pct>35?`<span class="bar-value">${data.count}</span>`:''}</div></div>
                  <span style="font-weight:600;font-size:0.78rem">${data.count}</span>
                </div>`;
              }).join('')}
            </div>
          `}
        </div>
      </div>


        <div class="card">
          <div class="card-header"><h3 class="card-title">Recent Activity</h3></div>
          ${recent.length===0?`<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:16px">No recent activity</p>`:`
            <div class="recent-list">
              ${recent.map(t => {
                const req = reqs.find(r=>r.id===t.requestId);
                const ago = Math.max(0,Math.floor((Date.now()-new Date(t.updatedAt))/(1000*60*60*24)));
                return `<div class="recent-row">
                  <span class="recent-div" style="color:${Utils.divColor(req?.division)}">${req?.division||'—'}</span>
                  <span class="recent-subject">${Utils.escapeHtml(Utils.truncate(t.subjectTask,30))}</span>
                  ${Utils.pipeBadge(t.pipelineStatus)}
                  <span class="recent-ago">${ago}d</span>
                </div>`;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  /* ---- SVG Peta Indonesia dengan Bubble Kota ---- */
  _indoMap(locations, maxCount) {
    // Simplified Indonesia outline + key cities with coordinates
    // Map viewBox: 94..141 x -11..6  → scaled to 400x250
    const mapW = 400, mapH = 250;

    // Scale function: lon,lat → x,y
    const sx = (lon) => ((lon - 95) / 46) * mapW;
    const sy = (lat) => ((6 - lat) / 17) * mapH;

    // Simplified outline path (Sumatra, Java, Kalimantan, Sulawesi, Papua)
    const outline = `M${sx(95.5)},${sy(5.5)}L${sx(105)},${sy(5)}L${sx(106)},${sy(-6)}L${sx(100)},${sy(-7)}L${sx(96)},${sy(-6)}L${sx(95.5)},${sy(5.5)}Z M${sx(105.5)},${sy(5.5)}L${sx(109)},${sy(4)}L${sx(114)},${sy(4)}L${sx(117)},${sy(0)}L${sx(117)},${sy(-4)}L${sx(115)},${sy(-5)}L${sx(109)},${sy(-4)}L${sx(106)},${sy(-7)}L${sx(105.5)},${sy(5.5)}Z M${sx(119)},${sy(4.5)}L${sx(122)},${sy(1)}L${sx(125)},${sy(-2)}L${sx(125)},${sy(-5)}L${sx(120)},${sy(-5)}L${sx(119)},${sy(4.5)}Z M${sx(127)},${sy(0.5)}L${sx(141)},${sy(-3)}L${sx(141)},${sy(-8)}L${sx(130)},${sy(-6)}L${sx(127)},${sy(0.5)}Z`;

    // City database: name, lon, lat
    const cities = [
      { name:'Jakarta', lon:106.8, lat:-6.2 },
      { name:'Surabaya', lon:112.7, lat:-7.2 },
      { name:'Bandung', lon:107.6, lat:-6.9 },
      { name:'Medan', lon:98.7, lat:3.6 },
      { name:'Semarang', lon:110.4, lat:-7.0 },
      { name:'Makassar', lon:119.4, lat:-5.1 },
      { name:'Palembang', lon:104.8, lat:-3.0 },
      { name:'Denpasar', lon:115.2, lat:-8.7 },
      { name:'Balikpapan', lon:116.8, lat:-1.2 },
      { name:'Pekanbaru', lon:101.5, lat:0.5 },
      { name:'Yogyakarta', lon:110.4, lat:-7.8 },
      { name:'Manado', lon:124.8, lat:1.5 },
      { name:'Banjarmasin', lon:114.6, lat:-3.3 },
      { name:'Pontianak', lon:109.3, lat:-0.0 },
      { name:'Jayapura', lon:140.7, lat:-2.5 }
    ];

    // Match locations to city coordinates (case-insensitive)
    const mappedCities = cities.map(c => {
      const match = locations.find(([loc]) => loc.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(loc.toLowerCase()));
      return { ...c, count: match ? match[1].count : 0, divisi: match ? match[1].divisi : {} };
    }).filter(c => c.count > 0);

    // Generate city bubbles
    const bubbles = mappedCities.map(c => {
      const r = 5 + (c.count / maxCount) * 16;
      const x = sx(c.lon), y = sy(c.lat);
      const topDiv = Object.entries(c.divisi).sort((a,b) => b[1]-a[1])[0];
      const fill = topDiv ? (topDiv[0]==='NETCO'?'#3b82f6':topDiv[0]==='OMG'?'#22c55e':'#a855f7') : '#f59e0b';
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="0.85" stroke="var(--bg-card)" stroke-width="2"/><text x="${x}" y="${y}" text-anchor="middle" dy="0.35em" fill="#fff" font-size="${r>10?'10':'8'}px" font-weight="600" style="pointer-events:none">${c.count}</text>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${mapW} ${mapH}" class="indo-map">
        <path d="${outline}" fill="var(--bg-input)" stroke="var(--border)" stroke-width="1.5" />
        ${bubbles}
      </svg>`;
  }
};
