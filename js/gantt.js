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
      const wbs = Storage.getWbsByTask(task.id);
      const act = wbs.filter(w => w.level === 3 && w.startDate && w.durationDays);
      if (act.length) {
        bodyHtml = this._renderGantt(task, wbs, act);
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

    // Group activities by their Level-2 deliverable
    const L2 = wbs.filter(w => w.level === 2);
    const groups = L2.map(d => ({
      deliverable: d,
      activities: acts.filter(a => a.parentId === d.id)
    })).filter(g => g.activities.length);

    // Compute date range
    let minT = Infinity, maxT = -Infinity;
    acts.forEach(a => {
      const s = parse(a.startDate);
      const e = s + (a.durationDays - 1) * dayMs;
      if (s < minT) minT = s;
      if (e > maxT) maxT = e;
    });
    // pad 2 days each side
    minT -= 2 * dayMs; maxT += 2 * dayMs;
    const totalDays = Math.round((maxT - minT) / dayMs);
    const labelW = 230;
    const dayW = Math.max(8, Math.min(22, Math.round(720 / Math.max(totalDays, 1))));
    const barH = 18, rowGap = 20;
    const totalW = labelW + totalDays * dayW;

    // Build rows: each activity = one row
    let rows = [];
    groups.forEach(g => {
      g.activities.forEach(a => {
        rows.push({ group: g.deliverable, act: a });
      });
    });

    const svgH = rows.length * rowGap + 40;
    const durDays = totalDays - 4; // exclude padding
    const startLabel = new Date(minT + 2 * dayMs).toISOString().slice(0, 10);
    const endLabel = new Date(maxT - 2 * dayMs).toISOString().slice(0, 10);

    // header: weekday ticks every ~5 days
    let headerCells = '';
    for (let i = 0; i <= totalDays; i += Math.max(1, Math.round(5 / (dayW / 8)))) {
      headerCells += `
        <rect x="${labelW + i * dayW}" y="0" width="${(i + Math.max(1, Math.round(5 / (dayW / 8)))) * dayW - (labelW + i * dayW) > dayW * 4 ? dayW * 5 : 0}" height="26" fill="rgba(127,127,127,0.06)" stroke="#3a3a4a" stroke-width="0.5"></rect>`;
    }
    // simpler: uniform grid lines every 5 days
    headerCells = '';
    const tickStep = Math.max(1, Math.ceil(5 / (dayW / 8)));
    for (let i = 0; i <= totalDays; i += tickStep) {
      headerCells += `<line x1="${labelW + i * dayW}" y1="0" x2="${labelW + i * dayW}" y2="${svgH}" stroke="rgba(127,127,127,0.12)" stroke-width="1"></line>`;
      const d = new Date(minT + i * dayMs);
      headerCells += `<text x="${labelW + i * dayW + 2}" y="17" font-size="10" fill="var(--text-muted)">${d.getDate()}/${d.getMonth() + 1}</text>`;
    }

    let bodyRows = '';
    let y = 30;
    rows.forEach((r, idx) => {
      const a = r.act;
      const s = parse(a.startDate);
      const e = s + (a.durationDays - 1) * dayMs;
      const x = labelW + (s - minT) / dayMs * dayW;
      const w = Math.max(((e - s) / dayMs) * dayW + dayW, 8);
      const col = this._ganttColor(idx);
      bodyRows += `
        <g>
          <text x="8" y="${y + barH / 2 + 3.5}" font-size="11" fill="var(--text-primary)">${Utils.escapeHtml(a.name)}</text>
          <text x="215" y="${y + barH / 2 + 3.5}" font-size="9.5" fill="var(--text-muted)" text-anchor="end">${Utils.formatDateShort(a.startDate)}</text>
          <rect x="${x}" y="${y}" width="${w}" height="${barH - 4}" rx="3" fill="${col}" opacity="0.88"></rect>
          <text x="${x + Math.min(w, 60) / 2}" y="${y + barH / 2}" font-size="9" fill="#fff" text-anchor="middle" dominant-baseline="middle" style="pointer-events:none">${a.durationDays}d</text>
        </g>
      `;
      y += rowGap;
    });

    return `
      <div class="card gantt-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <h3 style="font-size:1.05rem;margin:0">${Utils.escapeHtml(task.subjectTask)}</h3>
            <div style="font-size:0.74rem;color:var(--text-muted)">${Utils.formatDateShort(startLabel)} → ${Utils.formatDateShort(endLabel)} · ${durDays} hari estimasi</div>
          </div>
          <div class="gantt-stats">
            <span class="gantt-stat">${rows.length} aktivitas</span>
            <span class="gantt-stat">${groups.length} deliverable</span>
          </div>
        </div>
        <div class="gantt-scroll" style="overflow-x:auto">
          <svg width="${Math.max(totalW, labelW + 400)}" height="${svgH}" style="min-width:100%;background:var(--card-bg)">
            <rect x="0" y="0" width="${labelW}" height="26" fill="rgba(127,127,127,0.10)"></rect>
            <text x="8" y="17" font-size="10.5" font-weight="700" fill="var(--text-primary)">Aktivitas</text>
            ${headerCells}
            ${bodyRows}
          </svg>
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
