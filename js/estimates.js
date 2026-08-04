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
          ${allEstimates.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="Estimates.exportBoQ()">📄 Export</button>` : ''}
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

    const calc = (cat) => allEstimates.filter(e => e.category === cat).reduce((s, e) => s + (parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0), 0);
    const lines = [
      `========================================`,
      `  BILL OF QUANTITY (BoQ) — SUMMARY`,
      `========================================`,
      `Date: ${new Date().toLocaleDateString('id-ID')}`,
      `----------------------------------------`,
    ];
    allEstimates.forEach(e => {
      const total = parseInt(e.totalPrice) || (parseInt(e.quantity) * parseInt(e.unitPrice)) || 0;
      lines.push(`${Utils.truncate(e.item, 30).padEnd(30)} | ${String(e.quantity||'-').padEnd(6)} ${String(e.unit||'').padEnd(5)} | ${String(Utils.formatCurrency(e.unitPrice)).padEnd(14)} | ${Utils.formatCurrency(total)}`);
    });
    lines.push(`----------------------------------------`);
    lines.push(`Perangkat Utama   : ${Utils.formatCurrency(calc('utama'))}`);
    lines.push(`Material Pendukung: ${Utils.formatCurrency(calc('material'))}`);
    lines.push(`Jasa/Implementasi : ${Utils.formatCurrency(calc('jasa'))}`);
    lines.push(`Manage Service    : ${Utils.formatCurrency(calc('ms'))}`);
    lines.push(`GRAND TOTAL       : ${Utils.formatCurrency(calc('utama') + calc('material') + calc('jasa') + calc('ms'))}`);
    lines.push(`========================================`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `BoQ_Summary_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    Utils.showToast('BoQ exported', 'success');
  }
};
