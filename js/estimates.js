/* ============================================================
   EstimatorPro v3 — Estimates (Summary + CRUD BoQ Builder)
   ============================================================ */

const Estimates = {
  selectedTaskId: null,

  render() {
    const tasks = Storage.getTasks();
    const requests = Storage.getRequests();
    const task = tasks.find(t => t.id === this.selectedTaskId);
    const estimates = this.selectedTaskId ? Storage.getEstimatesByTask(this.selectedTaskId) : [];

    // Calculate summary from ALL estimates
    const allEstimates = Storage.getEstimates();
    const calcTotal = (cat) => allEstimates.filter(e => e.category === cat).reduce((s, e) => {
      return s + (parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0);
    }, 0);
    const totalUtama = calcTotal('utama');
    const totalMaterial = calcTotal('material');
    const totalJasa = calcTotal('jasa');
    const totalMS = calcTotal('ms');
    const grand = totalUtama + totalMaterial + totalJasa + totalMS;

    // Group tasks by request for dropdown
    const requestMap = {};
    tasks.forEach(t => {
      const req = requests.find(r => r.id === t.requestId);
      if (req && !requestMap[req.id]) requestMap[req.id] = req;
    });

    // Local task estimates
    const localCalc = (cat) => estimates.filter(e => e.category === cat).reduce((s, e) => {
      return s + (parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0);
    }, 0);
    const localGrand = localCalc('utama') + localCalc('material') + localCalc('jasa') + localCalc('ms');

    // All tasks with estimates for breakdown
    const taskEstMap = {};
    allEstimates.forEach(e => {
      if (!taskEstMap[e.taskId]) taskEstMap[e.taskId] = { utama: 0, material: 0, jasa: 0, ms: 0 };
      taskEstMap[e.taskId][e.category] += parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0;
    });
    const tasksWithEst = tasks.filter(t => taskEstMap[t.id]).map(t => {
      const req = requests.find(r => r.id === t.requestId);
      const e = taskEstMap[t.id];
      return { ...t, req, est: e, total: e.utama + e.material + e.jasa + e.ms };
    }).sort((a, b) => b.total - a.total);

    const html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Estimasi (BoQ)</h1>
          <p class="page-subtitle">${task ? Utils.escapeHtml(task.subjectTask) : 'Build & review cost estimates'}</p>
        </div>
        <div class="page-actions">
          <select class="form-select" style="max-width:320px" onchange="Estimates.setTask(this.value)">
            <option value="">— Select Task to Edit —</option>
            ${Object.values(requestMap).map(req => {
              const reqTasks = tasks.filter(t => t.requestId === req.id);
              return `<optgroup label="${Utils.escapeHtml(req.subject || 'Untitled')} — ${req.division}">
                ${reqTasks.map(t => `<option value="${t.id}" ${t.id === this.selectedTaskId ? 'selected' : ''}>${Utils.escapeHtml(t.subjectTask)} [${t.pipelineStatus}]</option>`).join('')}
              </optgroup>`;
            }).join('')}
          </select>
          ${this.selectedTaskId ? `
            <button class="btn btn-primary" onclick="Estimates.openModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Item
            </button>
          ` : ''}
          ${allEstimates.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="Estimates.exportBoQ()">📊 Export Excel</button>` : ''}
        </div>
      </div>

      <!-- Global Summary -->
      ${allEstimates.length > 0 ? `
      <div class="est-summary-grid">
        <div class="est-summary-card"><div class="est-summary-label">💻 Perangkat Utama</div><div class="est-summary-value">${Utils.formatCurrency(totalUtama)}</div></div>
        <div class="est-summary-card"><div class="est-summary-label">📦 Material Pendukung</div><div class="est-summary-value">${Utils.formatCurrency(totalMaterial)}</div></div>
        <div class="est-summary-card"><div class="est-summary-label">🔧 Jasa / Implementasi</div><div class="est-summary-value">${Utils.formatCurrency(totalJasa)}</div></div>
        <div class="est-summary-card"><div class="est-summary-label">🔄 Manage Service</div><div class="est-summary-value">${Utils.formatCurrency(totalMS)}</div></div>
        <div class="est-summary-card grand"><div class="est-summary-label">💎 Grand Total</div><div class="est-summary-value grand">${Utils.formatCurrency(grand)}</div></div>
      </div>
      ` : ''}

      ${!this.selectedTaskId ? `
        ${allEstimates.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <div class="empty-state-title">Belum ada data estimasi</div>
          <div class="empty-state-desc">Pilih task dari dropdown di atas untuk mulai membuat BoQ. Tambahkan item biaya per kategori (Perangkat Utama, Material, Jasa, Manage Service).</div>
        </div>
        ` : `
        <div class="card" style="margin-top:8px">
          <div class="card-header"><h3 class="card-title">💡 Pilih task untuk edit BoQ items</h3></div>
          <p style="color:var(--text-secondary);font-size:0.85rem">Gunakan dropdown di atas untuk memilih task dan menambahkan/mengedit item BoQ-nya.</p>
        </div>
        `}
      ` : `
        <!-- Local Task Estimate -->
        ${estimates.length > 0 ? `
        <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:8px">
          <div class="kpi-card"><div class="kpi-label">Perangkat Utama</div><div class="kpi-value" style="font-size:1.2rem">${Utils.formatCurrency(localCalc('utama'))}</div></div>
          <div class="kpi-card"><div class="kpi-label">Material</div><div class="kpi-value" style="font-size:1.2rem">${Utils.formatCurrency(localCalc('material'))}</div></div>
          <div class="kpi-card"><div class="kpi-label">Jasa</div><div class="kpi-value" style="font-size:1.2rem">${Utils.formatCurrency(localCalc('jasa'))}</div></div>
          <div class="kpi-card"><div class="kpi-label">MS</div><div class="kpi-value" style="font-size:1.2rem">${Utils.formatCurrency(localCalc('ms'))}</div></div>
          <div class="kpi-card" style="border-color:var(--accent)"><div class="kpi-label">Task Total</div><div class="kpi-value" style="font-size:1.3rem;color:var(--accent)">${Utils.formatCurrency(localGrand)}</div></div>
        </div>
        ` : ''}

        ${estimates.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No BoQ items for this task</div>
            <div class="empty-state-desc">Click "Add Item" to start building the Bill of Quantity.</div>
            <button class="btn btn-primary" onclick="Estimates.openModal()">Add First Item</button>
          </div>
        ` : `
        <div class="table-container" style="margin-top:8px">
          <table>
            <thead>
              <tr>
                <th>Item</th><th>Category</th><th>Qty</th><th>Unit</th>
                <th>Unit Price</th><th>Total</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${estimates.map(e => {
                const total = parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0;
                const catLabels = { utama:'💻 Perangkat Utama', material:'📦 Material', jasa:'🔧 Jasa', ms:'🔄 MS' };
                return `
                  <tr>
                    <td><strong style="color:var(--text-primary)">${Utils.escapeHtml(e.item)}</strong></td>
                    <td><span class="badge badge-neutral">${catLabels[e.category]||e.category}</span></td>
                    <td>${e.quantity||'—'}</td><td>${Utils.escapeHtml(e.unit||'—')}</td>
                    <td style="font-family:var(--font-mono)">${Utils.formatCurrency(e.unitPrice)}</td>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--text-primary)">${Utils.formatCurrency(total)}</td>
                    <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.78rem;color:var(--text-muted)">${Utils.truncate(Utils.escapeHtml(e.notes||''),20)}</td>
                    <td class="actions">
                      <button class="btn-icon btn-xs" onclick="Estimates.openModal('${e.id}')" title="Edit">✏️</button>
                      <button class="btn-icon btn-xs" style="color:var(--red)" onclick="Estimates.confirmDelete('${e.id}')" title="Delete">🗑️</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        `}
      `}

      <!-- All Tasks Breakdown -->
      ${tasksWithEst.length > 0 ? `
      <div class="card" style="margin-top:20px">
        <div class="card-header"><h3 class="card-title">📊 All Tasks Summary</h3><span style="font-size:0.76rem;color:var(--text-muted)">${tasksWithEst.length} tasks with estimates</span></div>
        <div class="table-container" style="border:none">
          <table>
            <thead><tr><th>Task</th><th>Division</th><th>Perangkat Utama</th><th>Material</th><th>Jasa</th><th>MS</th><th>Total</th></tr></thead>
            <tbody>
              ${tasksWithEst.map(t => `
                <tr>
                  <td><strong style="color:var(--text-primary)">${Utils.escapeHtml(t.subjectTask)}</strong></td>
                  <td><span class="badge ${Utils.divClass(t.req?.division)}">${t.req?.division||'—'}</span></td>
                  <td style="font-family:var(--font-mono)">${Utils.formatCurrency(t.est.utama)}</td>
                  <td style="font-family:var(--font-mono)">${Utils.formatCurrency(t.est.material)}</td>
                  <td style="font-family:var(--font-mono)">${Utils.formatCurrency(t.est.jasa)}</td>
                  <td style="font-family:var(--font-mono)">${Utils.formatCurrency(t.est.ms)}</td>
                  <td style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">${Utils.formatCurrency(t.total)}</td>
                </tr>
              `).join('')}
              <tr style="background:var(--bg-secondary);font-weight:700">
                <td colspan="2" style="text-align:right">Grand Total:</td>
                <td style="font-family:var(--font-mono)">${Utils.formatCurrency(totalUtama)}</td>
                <td style="font-family:var(--font-mono)">${Utils.formatCurrency(totalMaterial)}</td>
                <td style="font-family:var(--font-mono)">${Utils.formatCurrency(totalJasa)}</td>
                <td style="font-family:var(--font-mono)">${Utils.formatCurrency(totalMS)}</td>
                <td style="font-family:var(--font-mono);color:var(--accent);font-size:0.9rem">${Utils.formatCurrency(grand)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    `;
    return html;
  },

  setTask(taskId) {
    this.selectedTaskId = taskId;
    document.getElementById('mainContent').innerHTML = this.render();
  },

  openForTask(taskId) {
    this.selectedTaskId = taskId;
    App.navigate('#estimates');
  },

  refresh() { document.getElementById('mainContent').innerHTML = this.render(); },

  openModal(editId = null) {
    const est = editId ? Storage.getEstimates().find(e => e.id === editId) : null;
    const isEdit = !!est;

    const html = `
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit BoQ Item' : 'Add BoQ Item'}</h2>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <form id="estForm" onsubmit="Estimates.save(event,'${editId||''}')">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">Item Name *</label>
            <input type="text" class="form-input" name="item" required value="${Utils.escapeHtml(est?.item||'')}" placeholder="e.g. Switch Industrial Ruijie RG-S2910">
          </div>
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select class="form-select" name="category">
              <option value="utama" ${est?.category==='utama'||!est?'selected':''}>Perangkat Utama</option>
              <option value="material" ${est?.category==='material'?'selected':''}>Material Pendukung</option>
              <option value="jasa" ${est?.category==='jasa'?'selected':''}>Jasa / Implementasi</option>
              <option value="ms" ${est?.category==='ms'?'selected':''}>Manage Service</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Quantity</label><input type="number" class="form-input" name="quantity" value="${est?.quantity||''}" placeholder="e.g. 10" step="0.01" oninput="Estimates.autoCalc()"></div>
          <div class="form-group"><label class="form-label">Unit</label><input type="text" class="form-input" name="unit" value="${Utils.escapeHtml(est?.unit||'')}" placeholder="e.g. unit, sak, m"></div>
          <div class="form-group"><label class="form-label">Unit Price (IDR)</label><input type="number" class="form-input" name="unitPrice" value="${est?.unitPrice||''}" placeholder="e.g. 15000000" oninput="Estimates.autoCalc()"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Total Price (IDR)</label>
          <input type="number" class="form-input" name="totalPrice" value="${est?.totalPrice||''}" placeholder="Auto-calculated" style="font-weight:600">
          <div class="form-hint" id="calcHint"></div>
        </div>
        <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" name="notes" rows="2" placeholder="Vendor info, specs...">${Utils.escapeHtml(est?.notes||'')}</textarea></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit?'Save Changes':'Add Item'}</button>
        </div>
      </form>`;
    App.openModal(html, 'wide');
    setTimeout(() => this.autoCalc(), 100);
  },

  autoCalc() {
    const f = document.getElementById('estForm');
    if (!f) return;
    const qty = parseFloat(f.quantity.value) || 0;
    const price = parseFloat(f.unitPrice.value) || 0;
    const hint = document.getElementById('calcHint');
    if (qty > 0 && price > 0) {
      f.totalPrice.value = qty * price;
      if (hint) hint.textContent = `${qty} × ${Utils.formatCurrency(price)} = ${Utils.formatCurrency(qty * price)}`;
    }
  },

  save(event, editId) {
    event.preventDefault();
    const f = document.getElementById('estForm');
    const data = {
      item: f.item.value.trim(),
      category: f.category.value,
      quantity: f.quantity.value,
      unit: f.unit.value.trim(),
      unitPrice: f.unitPrice.value,
      totalPrice: f.totalPrice.value,
      notes: f.notes.value.trim(),
      taskId: this.selectedTaskId
    };
    if (!data.item) return Utils.showToast('Item name wajib diisi', 'error');

    if (editId) { Storage.updateEstimate(editId, data); Utils.showToast('Item updated', 'success'); }
    else { Storage.addEstimate(data); Utils.showToast('Item added', 'success'); }
    App.closeModal(); this.refresh();
  },

  confirmDelete(id) {
    const e = Storage.getEstimates().find(es => es.id === id);
    App.openModal(`
      <div class="modal-header"><h2 class="modal-title">Delete Item</h2><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <p style="color:var(--text-primary)">Delete <strong>"${Utils.escapeHtml(e?.item||'')}"</strong>?</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="Storage.deleteEstimate('${id}');App.closeModal();Estimates.refresh()">Delete</button>
      </div>`);
  },

  exportBoQ() {
    const allEstimates = Storage.getEstimates();
    if (allEstimates.length === 0) return Utils.showToast('No data to export', 'error');
    if (typeof XLSX === 'undefined') return Utils.showToast('Excel library belum termuat. Cek koneksi internet.', 'error');

    const tasks = Storage.getTasks();
    const requests = Storage.getRequests();
    const calc = (cat) => allEstimates.filter(e => e.category === cat).reduce((s, e) => s + (parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0), 0);
    const totalUtama = calc('utama'), totalMaterial = calc('material'), totalJasa = calc('jasa'), totalMS = calc('ms');
    const grand = totalUtama + totalMaterial + totalJasa + totalMS;
    const catLabels = { utama: 'Perangkat Utama', material: 'Material Pendukung', jasa: 'Jasa / Implementasi', ms: 'Manage Service' };
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    /* ============ Sheet 1: Summary ============ */
    const summaryRows = [
      ['BILL OF QUANTITY (BoQ) — SUMMARY'],
      ['Tanggal', today],
      [],
      ['Perangkat Utama', totalUtama],
      ['Material Pendukung', totalMaterial],
      ['Jasa / Implementasi', totalJasa],
      ['Manage Service', totalMS],
      ['GRAND TOTAL', grand],
      [],
      ['RINCIAN PER TASK'],
      ['Task', 'Division', 'Perangkat Utama', 'Material', 'Jasa', 'MS', 'Total']
    ];

    // Per-task breakdown
    const taskEstMap = {};
    allEstimates.forEach(e => {
      if (!taskEstMap[e.taskId]) taskEstMap[e.taskId] = { utama: 0, material: 0, jasa: 0, ms: 0 };
      taskEstMap[e.taskId][e.category] += parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0;
    });
    Object.entries(taskEstMap).forEach(([tid, est]) => {
      const t = tasks.find(x => x.id === tid);
      const req = requests.find(r => r.id === t?.requestId);
      summaryRows.push([
        t?.subjectTask || tid, req?.division || '—',
        est.utama, est.material, est.jasa, est.ms,
        est.utama + est.material + est.jasa + est.ms
      ]);
    });
    summaryRows.push(['TOTAL', '', totalUtama, totalMaterial, totalJasa, totalMS, grand]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }];
    wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

    /* ============ Sheet 2: Detail Items ============ */
    const detailRows = [
      ['BILL OF QUANTITY (BoQ) — DETAIL ITEMS'],
      ['Tanggal', today],
      [],
      ['No', 'Item', 'Kategori', 'Task', 'Qty', 'Unit', 'Harga Satuan (Rp)', 'Total (Rp)', 'Notes']
    ];
    allEstimates.forEach((e, i) => {
      const t = tasks.find(x => x.id === e.taskId);
      const total = parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0;
      detailRows.push([
        i + 1, e.item, catLabels[e.category] || e.category, t?.subjectTask || '—',
        e.quantity || 0, e.unit || '', parseInt(e.unitPrice) || 0, total, e.notes || ''
      ]);
    });
    detailRows.push([]);
    detailRows.push(['TOTAL', '', '', '', '', '', '', grand, '']);
    detailRows.push(['', '', '', 'Perangkat Utama', totalUtama]);
    detailRows.push(['', '', '', 'Material', totalMaterial]);
    detailRows.push(['', '', '', 'Jasa', totalJasa]);
    detailRows.push(['', '', '', 'MS', totalMS]);

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetail['!cols'] = [
      { wch: 5 }, { wch: 45 }, { wch: 20 }, { wch: 35 },
      { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 30 }
    ];

    /* ============ Styling (header bold + number format) ============ */
    const HDR_FILL = { patternType: 'solid', fgColor: { rgb: '1F4E79' } };
    const HDR_FONT = { bold: true, color: { rgb: 'FFFFFF' } };
    const TOTAL_FILL = { patternType: 'solid', fgColor: { rgb: 'D9E2F3' } };

    // Sheet 1: title row + summary + table header
    [wsSummary, wsDetail].forEach((ws, wi) => {
      if (!ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      const titleRow = wi === 0 ? 0 : 0;
      if (ws[`A${titleRow + 1}`]) ws[`A${titleRow + 1}`].s = { font: { bold: true, sz: 14 } };
      // table header rows
      const headerRow = wi === 0 ? 11 : 3; // 0-based
      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: headerRow, c });
        if (ws[addr]) ws[addr].s = { fill: HDR_FILL, font: HDR_FONT, alignment: { horizontal: 'center' } };
      }
    });
    // number format for money columns
    const moneyColsS1 = [1, 2, 3, 4, 5, 6];
    const s1Range = XLSX.utils.decode_range(wsSummary['!ref']);
    for (let r = 3; r <= s1Range.e.r; r++) {
      moneyColsS1.forEach(c => {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (wsSummary[addr] && typeof wsSummary[addr].v === 'number') {
          wsSummary[addr].z = '#,##0';
        }
      });
    }
    // bold grand total row (row 7 = index 6, 0-based)
    const s1TotalIdx = summaryRows.findIndex(r => r[0] === 'GRAND TOTAL');
    for (let c = 0; c <= 1; c++) {
      const addr = XLSX.utils.encode_cell({ r: s1TotalIdx, c });
      if (wsSummary[addr]) wsSummary[addr].s = { font: { bold: true }, fill: TOTAL_FILL };
    }
    const s1GrandIdx = summaryRows.findIndex(r => r[0] === 'TOTAL');
    for (let c = 0; c <= s1Range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: s1GrandIdx, c });
      if (wsSummary[addr]) wsSummary[addr].s = { font: { bold: true }, fill: TOTAL_FILL };
    }

    // Sheet 2: number formats for qty/money
    const dRange = XLSX.utils.decode_range(wsDetail['!ref']);
    for (let r = 4; r <= dRange.e.r; r++) {
      [6, 7].forEach(c => {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (wsDetail[addr] && typeof wsDetail[addr].v === 'number') wsDetail[addr].z = '#,##0';
      });
    }
    const dTotalIdx = detailRows.findIndex(r => r[0] === 'TOTAL');
    for (let c = 0; c <= 8; c++) {
      const addr = XLSX.utils.encode_cell({ r: dTotalIdx, c });
      if (wsDetail[addr]) wsDetail[addr].s = { font: { bold: true }, fill: TOTAL_FILL };
    }

    /* ============ Write file ============ */
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Items');
    XLSX.writeFile(wb, `BoQ_${new Date().toISOString().split('T')[0]}.xlsx`);
    Utils.showToast('BoQ exported as Excel (.xlsx)', 'success');
  }
};
