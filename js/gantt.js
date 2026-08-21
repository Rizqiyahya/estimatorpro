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
          ${task ? `<a class="btn btn-secondary" href="#wbs" onclick="Wbs.openForTask('${task.id}')">🧩 Kelola WBS</a>` : ''}
          ${task ? `<div class="export-menu"><button class="btn btn-primary" onclick="Gantt.toggleExportMenu(event)">⬇ Unduh <span>⌄</span></button><div class="export-menu-list" id="ganttExportMenu"><button onclick="Gantt.downloadSvg()">◈ SVG <small>Untuk PowerPoint</small></button><button onclick="Gantt.downloadPng()">▣ PNG <small>Gambar resolusi tinggi</small></button><button onclick="Gantt.printChart()">🖨 PDF <small>Cetak / Save as PDF</small></button></div></div>` : ''}
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
    // Satu warna tenang untuk satu deliverable, bukan satu warna per aktivitas.
    const pal = ['#4f8fd9', '#4fae91', '#8c7ac8', '#c9963e', '#c87572', '#5b9eb0'];
    return pal[idx % pal.length];
  },

  _wrapActivityLabel(label, maxChars = 27) {
    // SVG tidak mendukung word-wrap otomatis. Pecah per kata agar seluruh
    // keterangan tetap terbaca dan tinggi baris dapat disesuaikan.
    const words = String(label || 'Tanpa keterangan').trim().split(/\s+/);
    const lines = []; let current = '';
    words.forEach(word => {
      if (!current) { current = word; return; }
      if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
      else { lines.push(current); current = word; }
    });
    if (current) lines.push(current);
    return lines;
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
    let deliverableColorIdx = 0;
    L1.forEach(fase => {
      rows.push({ type: 'fase', name: '📁 ' + fase.name });
      (L2byL1[fase.id] || []).forEach(dlv => {
        const dlvActs = actsByL2[dlv.id] || [];
        const color = this._ganttColor(deliverableColorIdx++);
        rows.push({ type: 'deliv', id: dlv.id, name: '📦 ' + dlv.name, activities: dlvActs, color });
        dlvActs.forEach(a => rows.push({ type: 'act', act: a, deliverableId: dlv.id, color }));
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

    // Cukup tampilkan durasi: tanggal mulai/selesai sudah terlihat langsung
    // pada grid kalender. Area aktivitas dibuat lebih luas untuk keterangan.
    const activityW = 300;
    const durationW = 56;
    const labelW = activityW + durationW;
    const durationX = activityW;
    const dayW = Math.max(18, Math.min(32, Math.round(800 / Math.max(totalDays, 1))));
    const timeW = totalDays * dayW;
    const totalW = labelW + timeW;
    const rowH = 22, faseH = 26, delivH = 22;
    const headerH = 44;
    rows.forEach(r => {
      if (r.type === 'act') r.labelLines = this._wrapActivityLabel(r.act.name, 38);
    });
    const activityRowH = r => r.type === 'act'
      ? Math.max(rowH, r.labelLines.length * 13 + 8)
      : (r.type === 'fase' ? faseH : delivH);

    const svgH = rows.reduce((s, r) => s + activityRowH(r), headerH + 8);
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
      // Tampilkan semua tanggal dan nama hari; lebar hari minimum dijaga agar
      // header tetap terbaca pada layar maupun saat export PDF.
      gridHdr += `<line x1="${x}" y1="16" x2="${x}" y2="${svgH}" stroke="rgba(127,127,127,0.18)" stroke-width="1"/>`;
      gridHdr += `<text x="${x + dayW / 2}" y="38" font-size="8.5" fill="${isWE ? 'var(--text-muted)' : 'var(--text-secondary)'}" text-anchor="middle">${DAYS[dow]}</text>`;
      gridHdr += `<text x="${x + dayW / 2}" y="27" font-size="8.5" fill="var(--text-muted)" text-anchor="middle">${d.getDate()}</text>`;
      if (i === todayOff) {
        const tx = x + dayW / 2;
        todayLine = `<line x1="${tx}" y1="${headerH}" x2="${tx}" y2="${svgH}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="8,4" opacity="0.85"/>
          <polygon points="${tx - 5},${headerH} ${tx + 5},${headerH} ${tx},${headerH + 6}" fill="#f59e0b"/>
          <text x="${tx}" y="${headerH - 5}" font-size="9.5" fill="#f59e0b" text-anchor="middle" font-weight="700">◆ SEKARANG</text>`;
      }
    }

    // --- Body rows ---
    let bodyRows = ''; let y = headerH; let activityCount = 0; let zebraIdx = 0;
    const delivRanges = {};
    rows.forEach(r => {
      if (r.type === 'deliv' && r.activities && r.activities.length) {
        let dMin = Infinity, dMax = -Infinity;
        r.activities.forEach(a => { const s = parse(a.startDate); const e = s + (a.durationDays - 1) * dayMs; if (s < dMin) dMin = s; if (e > dMax) dMax = e; });
        if (isFinite(dMin)) delivRanges[r.id] = { min: dMin, max: dMax };
      }
    });

    rows.forEach(r => {
      let h, midY;
      if (r.type === 'fase') { h = faseH; midY = y + h / 2 + 4; }
      else if (r.type === 'deliv') { h = delivH; midY = y + h / 2 + 4; }
      else { h = activityRowH(r); midY = y + h / 2 + 4; }

      if (r.type === 'fase') {
        bodyRows += `<rect x="0" y="${y}" width="${totalW}" height="${h}" fill="rgba(79,156,249,0.08)"/><text x="10" y="${midY}" font-size="11" font-weight="700" fill="var(--text-primary)">${Utils.escapeHtml(r.name)}</text><line x1="0" y1="${y + h}" x2="${totalW}" y2="${y + h}" stroke="rgba(127,127,127,0.22)" stroke-width="1"/>`;
      } else if (r.type === 'deliv') {
        const dr = delivRanges[r.id]; let dbar = '';
        if (dr) { const sx = labelW + (dr.min - minT) / dayMs * dayW; const sw = Math.max(((dr.max - dr.min) / dayMs) * dayW + dayW, 8); dbar = `<rect x="${sx + 4}" y="${y + h / 2 - 3}" width="${Math.max(sw - 8, 8)}" height="6" rx="3" fill="${r.color}" opacity="0.42"/>`; }
        bodyRows += `<rect x="0" y="${y}" width="${labelW}" height="${h}" fill="rgba(127,127,127,0.03)"/>${dbar}<text x="16" y="${midY}" font-size="10" fill="${r.color}" font-weight="600">${Utils.escapeHtml(r.name)}</text><line x1="0" y1="${y + h}" x2="${totalW}" y2="${y + h}" stroke="rgba(127,127,127,0.16)" stroke-width="1"/>`;
      } else {
        const a = r.act; const s = parse(a.startDate); const e = s + (a.durationDays - 1) * dayMs;
        const bx = labelW + (s - minT) / dayMs * dayW;
        const bw = Math.max(((e - s) / dayMs) * dayW + dayW, 16);
        const col = r.color;
        const barH = 16, barY = y + (h - barH) / 2;
        const endDate = new Date(parse(a.startDate) + (a.durationDays - 1) * dayMs);
        const altBg = zebraIdx % 2 === 0 ? '' : `<rect x="0" y="${y}" width="${labelW}" height="${h}" fill="rgba(127,127,127,0.025)"/>`;
        const metadataGrid = `
          <line x1="${durationX}" y1="${y}" x2="${durationX}" y2="${y + h}" stroke="rgba(127,127,127,0.18)" stroke-width="1"/>`;
        const labelLines = r.labelLines.map((line, idx) => `<tspan x="8" dy="${idx ? 13 : 0}">${idx === 0 ? '⚡ ' : ''}${Utils.escapeHtml(line)}</tspan>`).join('');
        const labelY = y + (h - (r.labelLines.length - 1) * 13) / 2 + 4;

        bodyRows += `${altBg}${metadataGrid}
          <text x="8" y="${labelY}" font-size="10.5" fill="var(--text-primary)"><title>${Utils.escapeHtml(a.name)}</title>${labelLines}</text>
          <text x="${durationX + durationW / 2}" y="${midY}" font-size="8.5" fill="var(--text-muted)" text-anchor="middle">${a.durationDays}d</text>
          <rect x="${bx + 4}" y="${barY}" width="${Math.max(bw - 8, 10)}" height="${barH}" rx="4" fill="${col}" opacity="0.92">
            <title>${Utils.escapeHtml(a.name)} · ${a.durationDays}d</title>
          </rect>
          <text x="${bx + bw / 2}" y="${midY - 0.5}" font-size="9" fill="#fff" font-weight="600" text-anchor="middle" dominant-baseline="middle">${a.durationDays}d</text>
          <line x1="0" y1="${y + h}" x2="${totalW}" y2="${y + h}" stroke="rgba(127,127,127,0.16)" stroke-width="1"/>`;
        activityCount++;
        zebraIdx++;
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
            <span class="gantt-stat">${activityCount} aktivitas</span>
          </div>
        </div>
        <div class="gantt-scroll" style="overflow-x:auto;border:1px solid var(--border);border-radius:8px">
          <svg width="${Math.max(totalW + 20, 700)}" height="${svgH}" style="display:block;min-width:100%;background:var(--card-bg)">
            <!-- Label header -->
            <rect x="0.5" y="0.5" width="${totalW - 1}" height="${svgH - 1}" fill="none" stroke="rgba(127,127,127,0.28)" stroke-width="1"/>
            <rect x="0" y="0" width="${labelW}" height="${headerH}" fill="rgba(127,127,127,0.08)"/>
            <text x="8" y="18" font-size="10" font-weight="700" fill="var(--text-primary)">Aktivitas</text>
            <text x="${durationX + durationW / 2}" y="18" font-size="8.5" fill="var(--text-muted)" text-anchor="middle">Durasi</text>
            <line x1="${durationX}" y1="0" x2="${durationX}" y2="${svgH}" stroke="rgba(127,127,127,0.20)" stroke-width="1"/>
            <line x1="${labelW}" y1="0" x2="${labelW}" y2="${svgH}" stroke="rgba(127,127,127,0.28)" stroke-width="1.5"/>
            <!-- Timeline headers -->
            <rect x="${labelW}" y="0" width="${timeW}" height="20" fill="rgba(127,127,127,0.06)"/>
            ${monthHdr}
            <rect x="${labelW}" y="20" width="${timeW}" height="${headerH - 20}" fill="rgba(127,127,127,0.04)"/>
            ${gridHdr}
            ${weekendShades}
            ${todayLine}
            ${bodyRows}
            <line x1="0" y1="${svgH - 1}" x2="${totalW}" y2="${svgH - 1}" stroke="rgba(127,127,127,0.28)" stroke-width="1"/>
          </svg>
        </div>
        <div style="display:flex;align-items:center;gap:16px;margin-top:8px;font-size:0.7rem;color:var(--text-muted);flex-wrap:wrap">
          <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);margin-right:4px;vertical-align:middle"></span>Weekend</span>
          <span><span style="display:inline-block;width:14px;border-top:2px dashed #f59e0b;margin-right:4px;vertical-align:middle"></span>Hari ini</span>
        </div>
      </div>
    `;
  },

  toggleExportMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('ganttExportMenu');
    document.querySelectorAll('.export-menu-list.is-open').forEach(m => { if (m !== menu) m.classList.remove('is-open'); });
    menu?.classList.toggle('is-open');
  },

  _exportMeta() {
    const task = Storage.getTasks().find(t => t.id === this.selectedTaskId) || {};
    const source = document.querySelector('#ganttBody .gantt-card');
    const svg = source?.querySelector('svg');
    return { task, source, svg };
  },

  _fileName(ext) {
    const task = Storage.getTasks().find(t => t.id === this.selectedTaskId) || {};
    const safe = (task.subjectTask || 'Gantt-Chart').replace(/[\\/:*?"<>|]/g, '').trim();
    return `Gantt — ${safe}.${ext}`;
  },

  _serializedSvg(svg) {
    const copy = svg.cloneNode(true);
    // CSS variable tidak tersedia pada file SVG mandiri; tetapkan warna cetak.
    copy.querySelectorAll('[fill="var(--text-primary)"]').forEach(el => el.setAttribute('fill', '#1f2937'));
    copy.querySelectorAll('[fill="var(--text-secondary)"]').forEach(el => el.setAttribute('fill', '#475569'));
    copy.querySelectorAll('[fill="var(--text-muted)"]').forEach(el => el.setAttribute('fill', '#64748b'));
    copy.querySelectorAll('[fill="var(--bg-secondary)"]').forEach(el => el.setAttribute('fill', '#f8fafc'));
    copy.querySelectorAll('[fill="var(--card-bg)"]').forEach(el => el.setAttribute('fill', '#ffffff'));
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(copy);
  },

  downloadSvg() {
    const { svg } = this._exportMeta();
    if (!svg) return;
    const blob = new Blob([this._serializedSvg(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = this._fileName('svg'); a.click(); URL.revokeObjectURL(url);
    Utils.toast('Gantt SVG berhasil diunduh.', 'success');
  },

  downloadPng() {
    const { svg } = this._exportMeta();
    if (!svg) return;
    const width = Number(svg.getAttribute('width')) || 1000;
    const height = Number(svg.getAttribute('height')) || 500;
    const scale = 2;
    const image = new Image();
    const url = URL.createObjectURL(new Blob([this._serializedSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = width * scale; canvas.height = height * scale;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => { const pngUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = pngUrl; a.download = this._fileName('png'); a.click(); URL.revokeObjectURL(pngUrl); Utils.toast('Gantt PNG resolusi tinggi berhasil diunduh.', 'success'); }, 'image/png');
    };
    image.onerror = () => { URL.revokeObjectURL(url); Utils.toast('Gagal membuat PNG Gantt.', 'error'); };
    image.src = url;
  },

  printChart() {
    const task = Storage.getTasks().find(t => t.id === this.selectedTaskId) || {};
    const source = document.querySelector('#ganttBody .gantt-card');
    const svg = source?.querySelector('svg');
    if (!svg) return;

    // Cetak pada dokumen tersendiri agar tidak mewarisi layout SPA/scroll area.
    // Skala SVG dihitung dari lebar kertas A4 landscape sehingga proporsional.
    const svgWidth = Number(svg.getAttribute('width')) || 1000;
    const svgHeight = Number(svg.getAttribute('height')) || 500;
    // A4 landscape @ 96dpi, setelah margin 8mm. Sisakan ruang untuk header,
    // legend, dan jarak aman sehingga SVG tidak terpecah ke halaman berikutnya.
    const printableW = 1060;
    const printableH = 625;
    const printScale = Math.min(printableW / svgWidth, printableH / svgHeight);
    const printedW = Math.floor(svgWidth * printScale);
    const printedH = Math.floor(svgHeight * printScale);
    const title = Utils.escapeHtml(task.subjectTask || 'Gantt Chart');
    const subtitle = source.querySelector('div[style*="font-size:0.74rem"]')?.textContent || '';
    // Tetapkan kedua dimensi secara eksplisit. `max-height` saja dapat membuat
    // SVG melewati area cetak dan browser memecah baris bawah ke halaman baru.
    const svgMarkup = svg.outerHTML.replace('<svg ', `<svg style="width:${printedW}px;height:${printedH}px" `);
    const win = window.open('', '_blank', 'width=1280,height=820');
    if (!win) { Utils.toast('Popup diblokir browser. Izinkan popup untuk export PDF.', 'error'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Gantt — ${title}</title><style>
      /* Dimensi eksplisit A4 landscape lebih konsisten pada Chrome/Edge. */
      @page{size:297mm 210mm;margin:8mm}*{box-sizing:border-box}html,body{width:100%;height:auto;margin:0;padding:0;color:#1f2937;font-family:Arial,sans-serif;background:#fff}.gantt-print-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #334155;padding-bottom:8px;margin-bottom:8px}.gantt-print-head h1{margin:0;font-size:18px}.gantt-print-head p{margin:4px 0 0;font-size:10px;color:#64748b}.gantt-print-note{font-size:9px;color:#64748b;text-align:right}.gantt-print-frame{width:281mm;max-width:281mm;height:${printedH}px;overflow:hidden;break-inside:avoid;page-break-inside:avoid}.gantt-print-frame svg{display:block;width:${printedW}px!important;height:${printedH}px!important;max-width:none;max-height:none}.gantt-print-legend{display:flex;gap:14px;margin-top:6px;font-size:9px;color:#64748b}.key{display:inline-block;width:11px;height:11px;border:1px solid #e2a2a2;background:#fff1f1;margin-right:4px;vertical-align:middle}.today{display:inline-block;width:14px;border-top:2px dashed #f59e0b;margin-right:4px;vertical-align:middle}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.gantt-print-head,.gantt-print-frame,.gantt-print-legend{break-inside:avoid;page-break-inside:avoid}}
    </style></head><body><header class="gantt-print-head"><div><h1>Gantt Chart — ${title}</h1><p>${Utils.escapeHtml(subtitle)}</p></div><div class="gantt-print-note">PT. Starcom Solusindo · EstimatorPro<br>${new Date().toLocaleDateString('id-ID')}</div></header><main class="gantt-print-frame" data-svg-width="${svgWidth}" data-svg-height="${svgHeight}">${svgMarkup}</main><footer class="gantt-print-legend"><span><i class="key"></i>Akhir pekan</span><span><i class="today"></i>Hari ini</span></footer><script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
  }
};
