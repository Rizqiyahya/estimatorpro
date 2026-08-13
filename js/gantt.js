/* ============================================================
   EstimatorPro v3 — Gantt Chart Builder (Timeline tool)
   Reads Level-3 Aktivitas from WBS (startDate + durationDays)
   Renders a pure-SVG Gantt chart — no external library
   ============================================================ */

const Gantt = {
  selectedTaskId: null,

  openForTask(taskId) {
    this.selectedTaskId = taskId;
    App.navigate('#gantt');
  },

  render() {
    const tasks = Storage.getTasks();
    const requests = Storage.getRequests();
    const task = tasks.find(t => t.id === this.selectedTaskId) || null;

    const taskOptions = tasks
      .slice()
      .sort((a, b) => (a.subjectTask || '').localeCompare(b.subjectTask || ''))
      .map(t => {
        const r = requests.find(rr => rr.id === t.requestId);
        return {
          value: t.id,
          label: `${t.subjectTask || 'Untitled'} [${r?.division || '—'}]`,
          group: r?.subject ? `${r.subject} — ${r.division}` : (r?.division || 'Tanpa Request')
        };
      });

    let bodyHtml = '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">📅</div><div class="empty-state-title">Select a task</div><div class="empty-state-desc">Pick a task above to build its Gantt chart from the WBS activities.</div></div>';

    if (task) {
      const allWbs = Storage.getWbsByTask(task.id);
      const acts = allWbs.filter(w => w.level === 3 && w.startDate && w.durationDays);
      if (acts.length) {
        bodyHtml = this._renderGantt(task, allWbs, acts);
      } else {
        bodyHtml = `
          <div class="empty-state" style="padding:24px">
            <div class="empty-state-icon">📅</div>
            <div class="empty-state-title">No schedulable activities</div>
            <div class="empty-state-desc">Add Level-3 Aktivitas with Start Date + Duration in the WBS Builder to populate this chart.</div>
            <a class="btn btn-primary" href="#wbs" onclick="Wbs.openForTask('${task.id}')">Go to WBS Builder</a>
          </div>
        `;
      }
    }

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">📅 Gantt Chart Builder</h1>
          <p class="page-subtitle">Visual schedule dari aktivitas WBS (Level 3)</p>
        </div>
        <div class="page-actions">
          ${task ? `<a class="btn btn-secondary" href="#wbs" onclick="Wbs.openForTask('${task.id}')">🧩 To WBS</a>` : ''}
          ${task ? `<button class="btn btn-primary" onclick="Gantt.printChart()">🖨 Print / PDF</button>` : ''}
        </div>
      </div>

      <div class="card" style="padding:14px;margin-bottom:16px">
        <label class="form-label">Select Task</label>
        ${Utils.combobox({
          options: taskOptions,
          selected: this.selectedTaskId || '',
          placeholder: 'Ketik untuk mencari task…',
          onChange: 'Gantt.selectedTaskId=v;Gantt.refresh()'
        })}
      </div>

      <div id="ganttBody">${bodyHtml}</div>
      <div id="printArea" style="display:none"></div>
    `;
  },

  refresh() { document.getElementById('mainContent').innerHTML = this.render(); Utils.initComboboxes(document.getElementById('mainContent')); },

  _ganttColor(idx) {
    const pal = ['#4f9cf9', '#6fcf97', '#bb8cf2', '#f2c94c', '#f2994a', '#eb5757'];
    return pal[idx % pal.length];
  },

  _renderGantt(task, wbs, acts) {
    const dayMs = 86400000;
    const parse = d => new Date(d + 'T00:00:00').getTime();
    const DAYS = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

    // Build hierarchy: L1 (Fase) → L2 (Deliverable) → Activities
    const L1 = wbs.filter(w => w.level === 1);
    const L2 = wbs.filter(w => w.level === 2);
    const L2byL1 = {}; L2.forEach(d => { const p = d.parentId; if (!L2byL1[p]) L2byL1[p] = []; L2byL1[p].push(d); });
    const actsByL2 = {}; acts.forEach(a => { const p = a.parentId; if (!actsByL2[p]) actsByL2[p] = []; actsByL2[p].push(a); });

    // Flatten rows: Fase → Deliverable → Activity
    let rows = [];
    L1.forEach(fase => {
      rows.push({ type: 'fase', name: '📁 ' + fase.name });
      (L2byL1[fase.id] || []).forEach(dlv => {
        const dlvActs = actsByL2[dlv.id] || [];
        rows.push({ type: 'deliv', name: '📦 ' + dlv.name, activities: dlvActs });
        dlvActs.forEach(a => rows.push({ type: 'act', act: a }));
      });
    });

    // Compute date range
    let minT = Infinity, maxT = -Infinity;
    acts.forEach(a => {
      const s = parse(a.startDate);
      const e = s + (a.durationDays - 1) * dayMs;
      if (s < minT) minT = s;
      if (e > maxT) maxT = e;
    });
    minT -= 2 * dayMs; maxT += 2 * dayMs;
    const totalDays = Math.round((maxT - minT) / dayMs);
    const todayTs = new Date().setHours(0, 0, 0, 0);

    const labelW = 300;
    const dayW = Math.max(18, Math.min(32, Math.round(800 / Math.max(totalDays, 1))));
    const timeW = totalDays * dayW;
    const totalW = labelW + timeW;
    const rowH = 22, faseH = 26, delivH = 22;
    const headerH = 44;

    const svgH = rows.reduce((s, r) => s + (r.type === 'fase' ? faseH : r.type === 'deliv' ? delivH : rowH), headerH + 8);
    const startLabel = new Date(minT + 2 * dayMs).toISOString().slice(0, 10);
    const endLabel = new Date(maxT - 2 * dayMs).toISOString().slice(0, 10);

    // --- Month header ---
    let monthHdr = ''; let lastM = null;
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(minT + i * dayMs);
      const mk = d.getFullYear() + '-' + d.getMonth();
      if (mk !== lastM) {
        lastM = mk; const x = labelW + i * dayW;
        monthHdr += `<text x="${x + 4}" y="13" font-size="10" font-weight="700" fill="var(--text-secondary)">${MONTHS[d.getMonth()]} ${d.getFullYear()}</text>`;
        if (i > 0) monthHdr += `<line x1="${x}" y1="0" x2="${x}" y2="${headerH}" stroke="rgba(127,127,127,0.22)" stroke-width="1"/>`;
      }
    }

    // --- Day header + weekend + today ---
    let gridHdr = '', weekendShades = '', todayLine = '';
    const todayOff = Math.round((todayTs - minT) / dayMs);
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(minT + i * dayMs); const dow = d.getDay(); const isWE = (dow === 0 || dow === 6);
      const x = labelW + i * dayW;
      if (isWE) weekendShades += `<rect x="${x}" y="${headerH}" width="${dayW}" height="${svgH - headerH}" fill="rgba(239,68,68,0.04)"/>`;
      if (i % 2 === 0 || i === totalDays) {
        gridHdr += `<line x1="${x}" y1="16" x2="${x}" y2="${svgH}" stroke="rgba(127,127,127,0.07)" stroke-width="1" stroke-dasharray="4,4"/>`;
        gridHdr += `<text x="${x + dayW / 2}" y="38" font-size="9" fill="${isWE ? 'var(--text-muted)' : 'var(--text-secondary)'}" text-anchor="middle">${DAYS[dow]}</text>`;
      }
      if (i % 4 === 0 || i === totalDays) gridHdr += `<text x="${x + dayW / 2}" y="27" font-size="8.5" fill="var(--text-muted)" text-anchor="middle">${d.getDate()}</text>`;
      if (i === todayOff) {
        const tx = x + dayW / 2;
        todayLine = `<line x1="${tx}" y1="${headerH}" x2="${tx}" y2="${svgH}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="8,4" opacity="0.85"/>
          <polygon points="${tx - 5},${headerH} ${tx + 5},${headerH} ${tx},${headerH + 6}" fill="#f59e0b"/>
          <text x="${tx}" y="${headerH - 5}" font-size="9.5" fill="#f59e0b" text-anchor="middle" font-weight="700">◆ SEKARANG</text>`;
      }
    }

    // --- Body rows ---
    let bodyRows = ''; let y = headerH; let colorIdx = 0;
    const delivRanges = {};
    rows.forEach(r => {
      if (r.type === 'deliv' && r.activities && r.activities.length) {
        let dMin = Infinity, dMax = -Infinity;
        r.activities.forEach(a => { const s = parse(a.startDate); const e = s + (a.durationDays - 1) * dayMs; if (s < dMin) dMin = s; if (e > dMax) dMax = e; });
        if (isFinite(dMin)) delivRanges[r.name] = { min: dMin, max: dMax };
      }
    });

    rows.forEach(r => {
      let h, midY;
      if (r.type === 'fase') { h = faseH; midY = y + h / 2 + 4; }
      else if (r.type === 'deliv') { h = delivH; midY = y + h / 2 + 4; }
      else { h = rowH; midY = y + h / 2 + 4; }

      if (r.type === 'fase') {
        bodyRows += `<rect x="0" y="${y}" width="${totalW}" height="${h}" fill="rgba(79,156,249,0.08)"/><text x="10" y="${midY}" font-size="11" font-weight="700" fill="var(--text-primary)">${Utils.escapeHtml(r.name)}</text><line x1="0" y1="${y + h}" x2="${totalW}" y2="${y + h}" stroke="rgba(79,156,249,0.15)" stroke-width="1"/>`;
      } else if (r.type === 'deliv') {
        const dr = delivRanges[r.name]; let dbar = '';
        if (dr) { const sx = labelW + (dr.min - minT) / dayMs * dayW; const sw = Math.max(((dr.max - dr.min) / dayMs) * dayW + dayW, 8); dbar = `<rect x="${sx + 4}" y="${y + h / 2 - 3}" width="${Math.max(sw - 8, 8)}" height="6" rx="3" fill="rgba(127,127,127,0.14)"/>`; }
        bodyRows += `<rect x="0" y="${y}" width="${labelW}" height="${h}" fill="rgba(127,127,127,0.03)"/>${dbar}<text x="16" y="${midY}" font-size="10" fill="var(--text-secondary)" font-style="italic">${Utils.escapeHtml(r.name)}</text>`;
      } else {
        const a = r.act; const s = parse(a.startDate); const e = s + (a.durationDays - 1) * dayMs;
        const bx = labelW + (s - minT) / dayMs * dayW;
        const bw = Math.max(((e - s) / dayMs) * dayW + dayW, 16);
        const col = this._ganttColor(colorIdx);
        const barH = 16, barY = y + (h - barH) / 2;
        const endDate = new Date(parse(a.startDate) + (a.durationDays - 1) * dayMs);
        const altBg = colorIdx % 2 === 0 ? '' : `<rect x="0" y="${y}" width="${labelW}" height="${h}" fill="rgba(127,127,127,0.025)"/>`;

        bodyRows += `${altBg}
          <text x="8" y="${midY}" font-size="10.5" fill="var(--text-primary)"><title>${Utils.escapeHtml(a.name)}</title>⚡ ${Utils.escapeHtml(Utils.truncate(a.name, 28))}</text>
          <text x="${labelW - 118}" y="${midY}" font-size="9" fill="var(--text-muted)">${Utils.formatDateShort(a.startDate)}</text>
          <text x="${labelW - 82}" y="${midY}" font-size="9" fill="var(--text-muted)">${a.durationDays}d</text>
          <text x="${labelW - 48}" y="${midY}" font-size="9" fill="var(--text-muted)">${Utils.formatDateShort(endDate.toISOString().slice(0, 10))}</text>
          <rect x="${bx + 4}" y="${barY}" width="${Math.max(bw - 8, 10)}" height="${barH}" rx="4" fill="${col}" opacity="0.92">
            <title>${Utils.escapeHtml(a.name)} · ${a.durationDays}d</title>
          </rect>
          <text x="${bx + bw / 2}" y="${midY - 0.5}" font-size="9" fill="#fff" font-weight="600" text-anchor="middle" dominant-baseline="middle">${a.durationDays}d</text>`;
        colorIdx++;
      }
      y += h;
    });

    const phaseCount = rows.filter(r => r.type === 'fase').length;

    return `
      <div class="card gantt-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="font-size:1.05rem;margin:0">${Utils.escapeHtml(task.subjectTask)}</h3>
            <div style="font-size:0.74rem;color:var(--text-muted)">${Utils.formatDateShort(startLabel)} → ${Utils.formatDateShort(endLabel)} · ${totalDays - 4} hari</div>
          </div>
          <div class="gantt-stats">
            <span class="gantt-stat">${phaseCount} fase</span>
            <span class="gantt-stat">${colorIdx} aktivitas</span>
          </div>
        </div>
        <div class="gantt-scroll" style="overflow-x:auto;border:1px solid var(--border);border-radius:8px">
          <svg width="${Math.max(totalW + 20, 700)}" height="${svgH}" style="display:block;min-width:100%;background:var(--card-bg)">
            <!-- Label header -->
            <rect x="0" y="0" width="${labelW}" height="${headerH}" fill="rgba(127,127,127,0.08)"/>
            <text x="8" y="18" font-size="10" font-weight="700" fill="var(--text-primary)">Aktivitas</text>
            <text x="${labelW - 118}" y="18" font-size="8.5" fill="var(--text-muted)">Mulai</text>
            <text x="${labelW - 82}" y="18" font-size="8.5" fill="var(--text-muted)">Dur</text>
            <text x="${labelW - 48}" y="18" font-size="8.5" fill="var(--text-muted)">Selesai</text>
            <line x1="${labelW}" y1="0" x2="${labelW}" y2="${svgH}" stroke="rgba(127,127,127,0.18)" stroke-width="1.5"/>
            <!-- Timeline headers -->
            <rect x="${labelW}" y="0" width="${timeW}" height="20" fill="rgba(127,127,127,0.06)"/>
            ${monthHdr}
            <rect x="${labelW}" y="20" width="${timeW}" height="${headerH - 20}" fill="rgba(127,127,127,0.04)"/>
            ${gridHdr}
            ${weekendShades}
            ${todayLine}
            ${bodyRows}
            <line x1="0" y1="${svgH - 1}" x2="${totalW}" y2="${svgH - 1}" stroke="rgba(127,127,127,0.12)" stroke-width="1"/>
          </svg>
        </div>
        <div style="display:flex;align-items:center;gap:16px;margin-top:8px;font-size:0.7rem;color:var(--text-muted);flex-wrap:wrap">
          <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);margin-right:4px;vertical-align:middle"></span>Weekend</span>
          <span><span style="display:inline-block;width:14px;border-top:2px dashed #f59e0b;margin-right:4px;vertical-align:middle"></span>Hari ini</span>
        </div>
      </div>
    `;
  },

  printChart() {
    const main = document.getElementById('mainContent');
    const print = document.getElementById('printArea');
    const task = Storage.getTasks().find(t => t.id === this.selectedTaskId) || {};
    print.innerHTML = `<div class="print-title">Gantt Chart — ${Utils.escapeHtml(task.subjectTask || '')}</div>` + main.querySelector('#ganttBody').innerHTML;
    print.style.display = 'block';
    window.print();
    print.style.display = 'none';
    print.innerHTML = '';
  }
};
