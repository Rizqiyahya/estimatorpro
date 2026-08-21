/* ============================================================
   EstimatorPro v3 — WBS Builder (Work Breakdown Structure)
   Hierarchy: Level 1 (Fase) → Level 2 (Deliverable) → Level 3 (Aktivitas)
   Each Aktivitas carries startDate + durationDays → feeds Gantt Chart
   ============================================================ */

const Wbs = {
  selectedTaskId: null,
  presentationMode: false,

  /* Quick-open scoped to a task (called from Tasks / Kanban) */
  openForTask(taskId) {
    this.selectedTaskId = taskId;
    App.navigate('#wbs');
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
          label: `${t.subjectTask || 'Untitled'} [${r?.division || '—'}]${t.category ? ' · ' + (Utils.toolLabel(t.category) || t.category) : ''}`,
          group: r?.subject ? `${r.subject} — ${r.division}` : (r?.division || 'Tanpa Request')
        };
      });

    // WBS tree for the selected task
    let treeHtml = '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">🧩</div><div class="empty-state-title">Select a task</div><div class="empty-state-desc">Pick a task above to build its Work Breakdown Structure.</div></div>';

    if (task) {
      const wbs = Storage.getWbsByTask(task.id);
      if (wbs.length) {
        treeHtml = this._renderTree(wbs, task);
      } else {
        treeHtml = '<div class="empty-state" style="padding:24px"><div class="empty-state-icon">🧩</div><div class="empty-state-title">No WBS yet</div><div class="empty-state-desc">Start by adding a Phase (Level 1), then Deliverables, then Activities.</div><button class="btn btn-primary" onclick="Wbs.addItem(1)">+ Add Phase</button></div>';
      }
    }

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">🧩 WBS Builder</h1>
          <p class="page-subtitle">Work Breakdown Structure — Fase → Deliverable → Aktivitas</p>
        </div>
        <div class="page-actions">
          ${task ? `
            <a class="btn btn-secondary" href="#gantt" onclick="Gantt.openForTask('${task.id}')">📅 Lihat Timeline</a>
            <button class="btn btn-secondary" onclick="Wbs.presentationMode=!Wbs.presentationMode;Wbs.refresh()">${this.presentationMode ? '✏️ Mode Builder' : '🖥 Mode Presentasi'}</button>
            ${this.presentationMode ? '<div class="export-menu"><button class="btn btn-primary" onclick="Wbs.toggleExportMenu(event)">⬇ Unduh <span>⌄</span></button><div class="export-menu-list" id="wbsExportMenu"><button onclick="Wbs.printPresentation()">🖨 PDF <small>Format proposal A4</small></button></div></div>' : '<button class="btn btn-primary" onclick="Wbs.addItem(1)">+ Add Phase</button>'}
          ` : ''}
        </div>
      </div>

      <div class="card" style="padding:14px;margin-bottom:16px">
        <label class="form-label">Select Task</label>
        ${Utils.combobox({
          options: taskOptions,
          selected: this.selectedTaskId || '',
          placeholder: 'Ketik untuk mencari task…',
          onChange: 'Wbs.selectedTaskId=v;Wbs.refresh()'
        })}
      </div>

      <div id="wbsTree">${this.presentationMode && task && Storage.getWbsByTask(task.id).length ? this._renderPresentation(Storage.getWbsByTask(task.id), task) : treeHtml}</div>
      <div id="printArea" style="display:none"></div>
    `;
  },

  refresh() { document.getElementById('mainContent').innerHTML = this.render(); Utils.initComboboxes(document.getElementById('mainContent')); },

  _renderPresentation(wbs, task) {
    const phases = wbs.filter(w => w.level === 1);
    const deliverables = wbs.filter(w => w.level === 2);
    const activities = wbs.filter(w => w.level === 3);
    const palette = ['#3b82c4', '#368b72', '#8170bd', '#b78332', '#b46260', '#40859a'];
    const totalDuration = activities.reduce((sum, a) => sum + (Number(a.durationDays) || 0), 0);

    return `<section class="wbs-presentation">
      <div class="wbs-present-hero">
        <div><div class="wbs-present-kicker">PROJECT SCOPE · WORK BREAKDOWN STRUCTURE</div><h2>${Utils.escapeHtml(task.subjectTask || 'Untitled Task')}</h2><p>${Utils.escapeHtml(task.description || 'Struktur ruang lingkup pekerjaan proyek.')}</p></div>
        <div class="wbs-present-summary"><strong>${phases.length}</strong><span>Fase</span><strong>${deliverables.length}</strong><span>Deliverable</span><strong>${activities.length}</strong><span>Aktivitas</span><strong>${totalDuration || '—'}</strong><span>Total hari</span></div>
      </div>
      <div class="wbs-present-grid">${phases.map((phase, pIdx) => {
        const color = palette[pIdx % palette.length];
        const dels = deliverables.filter(d => d.parentId === phase.id);
        return `<article class="wbs-present-phase" style="--wbs-color:${color}">
          <header><span class="wbs-present-num">${pIdx + 1}.0</span><h3>${Utils.escapeHtml(phase.name)}</h3></header>
          <div class="wbs-present-deliverables">${dels.length ? dels.map((del, dIdx) => {
            const acts = activities.filter(a => a.parentId === del.id);
            const duration = acts.reduce((sum, a) => sum + (Number(a.durationDays) || 0), 0);
            return `<div class="wbs-present-deliverable"><div class="wbs-present-deliv-title"><span>${pIdx + 1}.${dIdx + 1}</span><strong>${Utils.escapeHtml(del.name)}</strong><em>${acts.length} aktivitas${duration ? ' · ' + duration + ' hari' : ''}</em></div>${acts.length ? `<ol>${acts.map((a, aIdx) => `<li><span class="wbs-present-act-num">${pIdx + 1}.${dIdx + 1}.${aIdx + 1}</span><span>${Utils.escapeHtml(a.name)}</span>${a.durationDays ? `<b>${a.durationDays} hari</b>` : ''}</li>`).join('')}</ol>` : '<div class="wbs-present-empty">Aktivitas belum ditentukan</div>'}</div>`;
          }).join('') : '<div class="wbs-present-empty">Deliverable belum ditentukan</div>'}</div>
        </article>`;
      }).join('')}</div>
      <footer class="wbs-present-footer"><span>PT. Starcom Solusindo · EstimatorPro</span><span>Dicetak ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></footer>
    </section>`;
  },

  toggleExportMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('wbsExportMenu');
    document.querySelectorAll('.export-menu-list.is-open').forEach(m => { if (m !== menu) m.classList.remove('is-open'); });
    menu?.classList.toggle('is-open');
  },

  printPresentation() {
    const content = document.querySelector('.wbs-presentation');
    if (!content) return;
    const win = window.open('', '_blank', 'width=1200,height=800');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>WBS — ${document.title}</title><style>${this._presentationPrintCss()}</style></head><body>${content.outerHTML}<script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
  },

  _presentationPrintCss() {
    return `*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1f2937;margin:0;padding:26px;background:#fff}.wbs-present-hero{display:flex;justify-content:space-between;gap:28px;border-bottom:3px solid #34495e;padding-bottom:18px;margin-bottom:22px}.wbs-present-kicker{font-size:10px;letter-spacing:1.2px;color:#64748b;font-weight:bold}.wbs-present-hero h2{margin:7px 0;font-size:25px}.wbs-present-hero p{margin:0;color:#64748b;font-size:12px;max-width:620px}.wbs-present-summary{display:grid;grid-template-columns:repeat(4,auto);gap:2px 12px;align-content:center;text-align:center}.wbs-present-summary strong{font-size:20px;color:#334155}.wbs-present-summary span{font-size:9px;color:#64748b;text-transform:uppercase}.wbs-present-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wbs-present-phase{border:1px solid #dbe3ea;border-top:4px solid var(--wbs-color);break-inside:avoid;padding:14px}.wbs-present-phase header{display:flex;gap:9px;align-items:center;margin-bottom:12px}.wbs-present-num{background:var(--wbs-color);color:#fff;border-radius:3px;padding:4px 7px;font-size:11px;font-weight:bold}.wbs-present-phase h3{font-size:15px;margin:0}.wbs-present-deliverable{padding:9px 0;border-top:1px solid #e5e7eb}.wbs-present-deliv-title{display:grid;grid-template-columns:36px 1fr auto;gap:7px;font-size:11px}.wbs-present-deliv-title>span{color:var(--wbs-color);font-weight:bold}.wbs-present-deliv-title em{font-size:9px;color:#64748b;font-style:normal;white-space:nowrap}.wbs-present-deliverable ol{list-style:none;margin:7px 0 0;padding:0}.wbs-present-deliverable li{display:grid;grid-template-columns:43px 1fr auto;gap:6px;font-size:10px;padding:3px 0}.wbs-present-act-num{color:#94a3b8}.wbs-present-deliverable li b{font-size:9px;color:#475569;white-space:nowrap}.wbs-present-empty{font-size:10px;color:#94a3b8;padding:8px 0}.wbs-present-footer{display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;margin-top:22px;padding-top:9px;font-size:9px;color:#64748b}@page{size:A4 landscape;margin:10mm}@media print{body{padding:0}.wbs-present-grid{gap:10px}.wbs-present-phase{padding:10px}}`;
  },

  /* Recursive tree rendering */
  _renderTree(wbs, task) {
    const L1 = wbs.filter(w => w.level === 1);
    const L2 = wbs.filter(w => w.level === 2);
    const L3 = wbs.filter(w => w.level === 3);

    if (!L1.length) {
      return `
        <div class="empty-state" style="padding:24px">
          <div class="empty-state-icon">🧩</div>
          <div class="empty-state-title">No WBS yet</div>
          <div class="empty-state-desc">Start by adding a Phase (Level 1).</div>
          <button class="btn btn-primary" onclick="Wbs.addItem(1)">+ Add Phase</button>
        </div>
      `;
    }

    const phaseColors = ['var(--pipe-inprog)', 'var(--pipe-review)', 'var(--pipe-done)', 'var(--netco)', 'var(--omg)', 'var(--itsol)'];

    return `<div class="wbs-tree">${L1.map((p, idx) => {
      const color = phaseColors[idx % phaseColors.length];
      const dels = L2.filter(d => d.parentId === p.id);
      return `
        <div class="wbs-phase" style="border-left:3px solid ${color}">
          <div class="wbs-phase-head">
            <div class="wbs-phase-title">
              <span class="wbs-level-tag" style="background:${color}">Fase ${idx + 1}</span>
              <span style="font-weight:600">${Utils.escapeHtml(p.name)}</span>
            </div>
            <div class="wbs-actions">
              <button class="btn btn-xs btn-secondary" onclick="Wbs.addItem(2,'${p.id}')">+ Deliverable</button>
              <button class="btn btn-xs btn-secondary" onclick="Wbs.editItem('${p.id}')">✏️</button>
              <button class="btn btn-xs btn-danger" onclick="Wbs.deleteItem('${p.id}')">🗑</button>
            </div>
          </div>
          ${dels.length ? `<div class="wbs-deliverables">${dels.map(d => {
            const acts = L3.filter(a => a.parentId === d.id);
            return `
              <div class="wbs-deliverable">
                <div class="wbs-deliverable-head">
                  <div class="wbs-deliverable-title">
                    <span class="wbs-level-tag wbs-level-2">Deliverable</span>
                    <span style="font-weight:500">${Utils.escapeHtml(d.name)}</span>
                  </div>
                  <div class="wbs-actions">
                    <button class="btn btn-xs btn-secondary" onclick="Wbs.addItem(3,'${d.id}')">+ Aktivitas</button>
                    <button class="btn btn-xs btn-secondary" onclick="Wbs.editItem('${d.id}')">✏️</button>
                    <button class="btn btn-xs btn-danger" onclick="Wbs.deleteItem('${d.id}')">🗑</button>
                  </div>
                </div>
                ${acts.length ? `<div class="wbs-activities">${acts.map(a => `
                  <div class="wbs-activity">
                    <span class="wbs-activity-dot"></span>
                    <span style="flex:1">${Utils.escapeHtml(a.name)}</span>
                    ${a.startDate ? `<span class="wbs-date">📅 ${Utils.formatDateShort(a.startDate)}</span>` : ''}
                    ${a.durationDays ? `<span class="wbs-dur">${a.durationDays}d</span>` : ''}
                    <div class="wbs-actions">
                      <button class="btn btn-xs btn-secondary" onclick="Wbs.editItem('${a.id}')">✏️</button>
                      <button class="btn btn-xs btn-danger" onclick="Wbs.deleteItem('${a.id}')">🗑</button>
                    </div>
                  </div>`).join('')}</div>` : `<div class="wbs-none">No activities — <a href="javascript:void(0)" onclick="Wbs.addItem(3,'${d.id}')">add one</a></div>`}
              </div>
            `;
          }).join('')}</div>` : `<div class="wbs-none" style="margin-left:22px">No deliverables — <a href="javascript:void(0)" onclick="Wbs.addItem(2,'${p.id}')">add one</a></div>`}
        </div>
      `;
    }).join('')}</div>`;
  },

  /* ---- Item modal ---- */
  addItem(level, parentId) {
    this._openItemModal(null, level, parentId || null);
  },

  editItem(id) {
    const w = Storage.getWbs().find(x => x.id === id);
    if (!w) return;
    this._openItemModal(w, w.level, w.parentId);
  },

  _openItemModal(item, level, parentId) {
    if (!this.selectedTaskId) return Utils.showToast('Select a task first','error');
    const isEdit = !!item;
    const wbs = Storage.getWbsByTask(this.selectedTaskId);

    // Parent options depend on level
    let parentOptions = '<option value="">(none)</option>';
    if (level === 2) parentOptions += wbs.filter(w => w.level === 1).map(p => `<option value="${p.id}" ${parentId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('');
    if (level === 3) parentOptions += wbs.filter(w => w.level === 2).map(d => `<option value="${d.id}" ${parentId === d.id ? 'selected' : ''}>${Utils.escapeHtml(d.name)}</option>`).join('');

    const levelLabel = level === 1 ? 'Fase (Level 1)' : level === 2 ? 'Deliverable (Level 2)' : 'Aktivitas (Level 3)';

    App.openModal(`
      <div class="modal-header"><h2 class="modal-title">${isEdit ? 'Edit' : 'Add'} ${levelLabel}</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <form id="wbsForm" onsubmit="Wbs.saveItem(event,${isEdit ? `'${item.id}'` : 'null'},${level},${parentId ? `'${parentId}'` : 'null'})">
        <div class="form-group">
          <label class="form-label">Nama ${levelLabel}</label>
          <input type="text" class="form-input" name="name" required value="${isEdit ? Utils.escapeHtml(item.name) : ''}" placeholder="${level === 1 ? 'e.g. Tahap Survey & Desain' : level === 2 ? 'e.g. Dokumen Desain Instalasi' : 'e.g. Survey lokasi site'}" autofocus>
        </div>
        ${level > 1 ? `
        <div class="form-group">
          <label class="form-label">Induk (Parent)</label>
          <select class="form-select" name="parentId">${parentOptions}</select>
        </div>` : ''}
        ${level === 3 ? `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" class="form-input" name="startDate" value="${isEdit && item.startDate ? item.startDate : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Durasi (hari)</label>
            <input type="number" class="form-input" name="durationDays" min="1" value="${isEdit && item.durationDays ? item.durationDays : ''}" placeholder="e.g. 5">
          </div>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:12px">💡 Aktivitas dengan tanggal + durasi akan muncul di Gantt Chart.</div>` : ''}
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'}</button>
        </div>
      </form>
    `, 'wide');
  },

  saveItem(e, id, level, parentId) {
    e.preventDefault();
    const f = document.getElementById('wbsForm');
    const data = {
      name: f.name.value.trim(),
      level: level,
      parentId: f.parentId ? (f.parentId.value || null) : (parentId || null),
      startDate: f.startDate ? (f.startDate.value || null) : null,
      durationDays: f.durationDays ? (parseInt(f.durationDays.value) || null) : null,
      taskId: this.selectedTaskId,
      seq: Storage.getWbsByTask(this.selectedTaskId).length
    };
    if (id) {
      Storage.updateWbsItem(id, data);
      Utils.showToast('WBS item updated','success');
    } else {
      Storage.addWbsItem(data);
      Utils.showToast('WBS item added','success');
    }
    App.closeModal();
    this.refresh();
  },

  deleteItem(id) {
    if (!confirm('Hapus item WBS ini? Semua sub-item akan ikut terhapus.')) return;
    // Delete item + children recursively
    const all = Storage.getWbs();
    const idsToDelete = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const w of all) {
        if (w.parentId && idsToDelete.has(w.parentId) && !idsToDelete.has(w.id)) {
          idsToDelete.add(w.id); changed = true;
        }
      }
    }
    Storage.saveWbs(all.filter(w => !idsToDelete.has(w.id)));
    Utils.showToast('WBS item deleted','info');
    this.refresh();
  }
};
