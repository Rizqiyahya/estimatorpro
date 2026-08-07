/* ============================================================
   EstimatorPro v3 — Utils
   Division: NETCO=Biru  OMG=Hijau  ITSOL=Ungu
   ============================================================ */

const Utils = {
  genId() {
    // Use proper UUID v4 for Supabase compatibility
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  formatCurrency(amount, symbol = 'Rp') {
    if (amount == null || isNaN(amount)) return symbol + ' 0';
    return symbol + ' ' + parseInt(amount).toLocaleString('id-ID');
  },

  formatDate(ds) {
    if (!ds) return '—';
    return new Date(ds).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  formatDateShort(ds) {
    if (!ds) return '—';
    return new Date(ds).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  },

  todayStr() { return new Date().toISOString().split('T')[0]; },

  escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
  },

  truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
  },

	capitalize(str) {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
	},

  // Debounce — solves search "stuck" bug
  debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // Division helpers
  divClass(div) {
    const m = { NETCO: 'badge-netco', OMG: 'badge-omg', ITSOL: 'badge-itsol' };
    return m[div] || 'badge-neutral';
  },

  divColor(div) {
    const m = { NETCO: 'var(--netco)', OMG: 'var(--omg)', ITSOL: 'var(--itsol)' };
    return m[div] || 'var(--text-muted)';
  },

  // Status badges
  reqStatusBadge(s) {
    const m = { open: 'badge-blue', win: 'badge-green', lose: 'badge-red' };
    const l = { open: 'Open', win: 'Win', lose: 'Lose/Drop' };
    return `<span class="badge ${m[s] || 'badge-neutral'}">${l[s] || s}</span>`;
  },

  pipeBadge(s) {
    const m = { todo: 'badge-neutral', in_progress: 'badge-orange', review: 'badge-blue', done: 'badge-green', revisi: 'badge-pink' };
    const l = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done', revisi: 'Revisi' };
    return `<span class="badge ${m[s] || 'badge-neutral'}">${l[s] || s}</span>`;
  },

  /* Sort array of objects by a field or getter function. Type-aware (date/number/string).
     dir: 'asc' | 'desc' — returns a NEW sorted array (does not mutate). */
  sortBy(arr, key, dir = 'asc') {
    const mul = dir === 'desc' ? -1 : 1;
    const getter = typeof key === 'function' ? key : (o) => o[key];
    return arr.slice().sort((a, b) => {
      const va = getter(a), vb = getter(b);
      // Date fields
      if (key === 'date' || key === 'createdAt' || key === 'startDate') {
        const ta = va ? new Date(va).getTime() : 0;
        const tb = vb ? new Date(vb).getTime() : 0;
        return (ta - tb) * mul;
      }
      // Numbers (including string numbers)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb) && key !== 'noId' && String(va).trim() !== '' && String(vb).trim() !== '') {
        return (na - nb) * mul;
      }
      // Strings (case-insensitive)
      return String(va || '').localeCompare(String(vb || ''), 'id', { sensitivity: 'base' }) * mul;
    });
  },

  /* Sortable table header cell with arrow indicator */
  sortableTh(label, key, sortKey, sortDir, ns) {
    const active = sortKey === key;
    const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
    return `<th class="sortable ${active ? 'sort-active' : ''}" onclick="${ns}.sort('${key}')" title="Urutkan ${label}">${label}<span class="sort-arrow">${arrow}</span></th>`;
  },

  /* Normalize legacy category keys to new tool-aligned keys */
  normalizeCat(c) {
    const map = { pembuatan_boq:'boq', ajuan_solusi_teknis:'wbs', proposal_teknis:'proptek' };
    return map[c] || c;
  },

  /* Map task category → tool view route */
  toolForCategory(cat) {
    const map = { boq:'#estimates', wbs:'#wbs', timeline:'#gantt', sto:'#sto', proptek:'#proptek' };
    return map[this.normalizeCat(cat)] || null;
  },

  /* Human label of the tool for a category */
  toolLabel(cat) {
    const map = { boq:'Estimasi', wbs:'WBS Builder', timeline:'Gantt Chart', sto:'STO', proptek:'Proptek' };
    return map[this.normalizeCat(cat)] || null;
  },

  /* Task category badge */
  catBadge(c) {
    c = this.normalizeCat(c);
    const m = {
      boq: 'badge-amber',
      wbs: 'badge-purple',
      timeline: 'badge-blue',
      sto: 'badge-green',
      proptek: 'badge-cyan'
    };
    const l = {
      boq: 'BoQ',
      wbs: 'WBS',
      timeline: 'Timeline',
      sto: 'STO',
      proptek: 'Proptek'
    };
    if (!c) return '<span class="badge badge-neutral">—</span>';
    return `<span class="badge ${m[c] || 'badge-neutral'}">${l[c] || c}</span>`;
  },

  /* All category options for dropdowns */
  catOptions(selected) {
    const cats = ['boq','wbs','timeline','sto','proptek'];
    const labels = ['BoQ','WBS','Timeline','STO','Proptek'];
    const none = '<option value="">— Semua Kategori —</option>';
    const opts = cats.map((c,i) => `<option value="${c}" ${c===selected?'selected':''}>${labels[i]}</option>`).join('');
    return none + opts;
  },

  catOptionsNoAll(selected) {
    const cats = ['boq','wbs','timeline','sto','proptek'];
    const labels = ['BoQ','WBS','Timeline','STO','Proptek'];
    return '<option value="">— Pilih —</option>' + cats.map((c,i) => `<option value="${c}" ${c===selected?'selected':''}>${labels[i]}</option>`).join('');
  },

  showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  },

  /* Format duration: milliseconds -> "2h 30m" or "1d 4h" */
  formatDuration(ms) {
    if (!ms || ms < 0) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h < 24) return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return d + 'd' + (rh > 0 ? ' ' + rh + 'h' : '');
  },

  /* Get total cycle time from pipeline history (ms) */
  calcCycleTime(history) {
    if (!history || history.length < 2) return null;
    const start = new Date(history[0].at).getTime();
    const doneEntry = history.find(h => h.status === 'done');
    const end = doneEntry ? new Date(doneEntry.at).getTime() : new Date(history[history.length - 1].at).getTime();
    return end - start;
  },

  /* Indonesian cities + industrial estates + landmarks for location autocomplete */
  locationList: [
    'Multi Site','Jakarta','Surabaya','Bandung','Medan','Semarang','Makassar','Palembang',
    'Denpasar','Balikpapan','Pekanbaru','Yogyakarta','Manado','Banjarmasin','Pontianak','Jayapura',
    'Batam','Padang','Malang','Bogor','Tangerang','Bekasi','Depok','Cikarang',
    'Karawang','Purwakarta','Cirebon','Tegal','Solo','Madiun','Kediri','Jember',
    'Banyuwangi','Probolinggo','Pasuruan','Mojokerto','Sidoarjo','Gresik','Lamongan','Tuban',
    'Bojonegoro','Ngawi','Magetan','Ponorogo','Pacitan','Trenggalek','Tulungagung','Blitar',
    'Lumajang','Bondowoso','Situbondo','Sumenep','Pamekasan','Sampang','Bangkalan','Batu',
    'Serang','Cilegon','Pandeglang','Lebak','Tigaraksa','BSD','Alam Sutera','Kelapa Gading',
    'Kuningan','Sudirman','Thamrin','Gatot Subroto','Mampang','Tebet','Pancoran','Cilandak',
    'Kebayoran','Senayan','Slipi','Grogol','Sunter','Pulo Gadung','Cakung','Daan Mogot',
    'Cengkareng','Tangerang Selatan','Cibinong','Cianjur','Sukabumi','Tasikmalaya','Garut','Sumedang',
    'Majalengka','Indramayu','Subang','Ciamis','Pangandaran','Banjar','Cilacap',
    'Purwokerto','Banyumas','Purbalingga','Banjarnegara','Kebumen','Wonosobo','Temanggung','Magelang',
    'Boyolali','Klaten','Sragen','Karanganyar','Wonogiri','Grobogan','Blora','Rembang',
    'Pati','Kudus','Jepara','Demak','Kendal','Batang','Pekalongan','Pemalang',
    'Brebes','Salatiga','Banda Aceh','Lhokseumawe','Langsa','Binjai',
    'Pematang Siantar','Tebing Tinggi','Tanjung Balai','Sibolga','Padang Sidempuan','Gunungsitoli','Bukittinggi','Payakumbuh',
    'Solok','Sawahlunto','Padang Panjang','Pariaman','Dumai','Bengkulu','Jambi','Prabumulih',
    'Lubuklinggau','Pangkal Pinang','Tanjung Pinang','Bandar Lampung','Metro','Singkawang',
    'Palangkaraya','Banjarbaru','Samarinda','Bontang','Tarakan','Nunukan','Tenggarong','Berau',
    'Palu','Gorontalo','Kendari','Bau-Bau','Mamuju','Majene','Ambon','Ternate',
    'Sofifi','Manokwari','Sorong','Timika','Merauke','Biak','Nabire','Wamena',
    'Mataram','Bima','Sumbawa','Kupang','Atambua','Maumere','Ende','Ruteng',
    'Labuan Bajo','Waingapu','Tambolaka','Kefamenanu','Soe','Dili','Baucau','Maliana',
    'Tabanan','Gianyar','Klungkung','Bangli','Jembrana','Buleleng','Singaraja','Negara',
    'Kuta','Sanur','Nusa Dua','Jimbaran','Ubud','Canggu','Seminyak','Uluwatu',
    'Nusa Penida','Nusa Lembongan','Praya','Selong','Dompu','Lombok Barat','Lombok Utara','Lombok Timur',
    /* Kecamatan praktis — Bandung Raya & sekitarnya (sering jadi site proyek) */
    'Jatinangor','Cileunyi','Rancaekek','Cicalengka','Soreang','Baleendah','Dayeuhkolot','Margahayu',
    'Banjaran','Majalaya','Paseh','Ciparay','Pangalengan','Lembang','Cisarua','Padalarang',
    'Cimahi','Batujajar','Cililin','Cikalong Wetan','Cibeber','Rajamandala','Parongpong','Ngamprah',
    'Ujung Berung','Gedebage','Cibiru','Antapani','Arcamanik','Kiaracondong','Buah Batu','Bojongsoang',
    'Rancasari','Coblong','Sukajadi','Dago','Setiabudi Bandung','Cidadap','Mandalajati','Cinambo',
    'Sapan','Cilembang','Tanah Tinggi','Cicadas','Sukarno Hatta','Soekarno Hatta','Buahbatu','Panyileukan',
    'Pamulang','Serpong','Ciputat','Pondok Aren','Setu','Cisauk','Pagedangan','Legok',
    'Karang Tengah','Larangan','Ciledug','Benda','Kunciran','Jatake','Cikupa','Pasar Kemis',
    'Sindang Jaya','Sukamulya','Balaraja Timur','Sepatan','Curug','Panongan','Jayanti','Solear',
    'Cikarang Utara','Cikarang Selatan','Cikarang Pusat','Cikarang Barat','Cikarang Timur','Tambun Utara','Tambun Selatan','Setu Bekasi',
    'Kedung Waringin','Babelan','Tarumajaya','Cabangbungin','Sukatani','Cikampek','Telukjambe','Klari',
    'Jatiasih','Jatisampurna','Pondok Melati','Bantar Gebang','Cipayung','Cilodong','Sukmajaya','Beji',
    'Cinere','Limo','Cisalak','Gunung Putri','Cileungsi','Jonggol','Cariu','Sukamakmur',
    /* Jakarta neighborhoods */
    'Jakarta Utara','Jakarta Barat','Jakarta Selatan','Jakarta Timur','Jakarta Pusat','Kepulauan Seribu',
    'Pluit','Penjaringan','Ancol','Koja','Cilincing','Tanjung Priok','Pademangan','Kemayoran',
    'Sawah Besar','Gambir','Senen','Menteng','Johar Baru','Cempaka Putih','Tanah Abang','Bendungan Hilir',
    'Setiabudi','Karet','Palmerah','Kebon Jeruk','Kembangan','Meruya','Pesanggrahan','Cipulir',
    'Blok M','Kemang','Pondok Indah','Fatmawati','Lebak Bulus','Ragunan','Pasar Minggu','Jagakarsa',
    'Kalibata','Rawa Mangun','Salemba','Utan Kayu','Ciganjur','Cipedak','Pancoran Mas','Jatinegara',
    'Matraman','Duren Sawit','Jatiwaringin','Kramat Jati','Makasar','Cawang','Halim','Pasar Rebo',
    'Ciracas','Cililitan','Rawa Bunga','Cikini','Menteng','Sudirman Central Business District','SCBD','Mega Kuningan',
    'Kuningan City','Rasuna Said','Casablanca','TB Simatupang','Wijaya','Gandaria','Pondok Labu','Cilandak KKO',
    'Pasar Jumat','Keerom','Kalideres','Duri','Meruya','Pesing','Kebon Jeruk','Cipete',
    'Pakubuwono','Bundaran HI','Senopati','Gatot Soebroto','Jalan Asia Afrika','Thamrin City','Sarinah','Grand Indonesia',
    'Plaza Indonesia','Citywalk Sudirman','Senayan City','Pacific Place','Kota Kasablanka','Menara BCA','Menara Astra','Blok S Plaza',
    'Gelora Bung Karno','AEON BSD','AEON Jakarta Garden','Lippo Mall Puri','Mall Taman Anggrek','Central Park','Kuningan City','WTC Mangga Dua',
    /* Industrial estates / kawasan industri */
    'MM2100','EJIP','KIIC','Delta Silicon','Jababeka','Lippo Cikarang','Hyundai Cikarang','Greenland International',
    'KBN Berikat Nusantara','Batamindo','Bintan Eco','Rempang','KEK Mandalika','Kota Deltamas','Merak Armada','Balaraja',
    'Foresta','BSD City','Cikunir','Cibubur','Bintaro','Parung','Sawangan','Lengkong',
    'Jatiasih','Tambun','Cibitung','Pondok Gede','Klp Muncang','Gandaria City','Kemang Village','Senayan Golf'
  ],

  /* ---- Adaptive location memory ----
     Custom locations typed by the user are remembered and injected
     into the datalist so suggestions grow with real site names. */
  _locationKey: 'ep2_custom_locations',
  getCustomLocations() {
    try { return JSON.parse(localStorage.getItem(this._locationKey)) || []; } catch(e) { return []; }
  },
  addLocation(str) {
    if (!str) return;
    const s = String(str).trim();
    if (!s) return;
    const list = this.getCustomLocations();
    if (list.includes(s)) return;
    list.push(s);
    if (list.length > 100) list.splice(0, list.length - 100);
    try { localStorage.setItem(this._locationKey, JSON.stringify(list)); } catch(e) {}
  },
  getLocations() {
    const custom = this.getCustomLocations().filter(c => !this.locationList.includes(c));
    return custom.length ? this.locationList.concat(custom) : this.locationList;
  },

  /* Render datalist for location autocomplete */
  locationDatalist(id) {
    return `<datalist id="${id}">${this.getLocations().map(c => `<option value="${Utils.escapeHtml(c)}">`).join('')}</datalist>`;
  },

  /* ---- Searchable Combobox ----
     Replaces a plain <select> with a type-to-filter input + dropdown.
     cfg: {
       id,            // unique id (optional, auto-generated)
       name,          // hidden input name (for forms: f.requestId.value works)
       options,       // [{ value, label, group? }]
       selected,      // current value
       placeholder,   // input placeholder
       onChange       // JS expression; the chosen value is passed as `v`
     } */
  combobox(cfg) {
    const opts = cfg.options || [];
    const sel = cfg.selected || '';
    const selOpt = opts.find(o => String(o.value) === String(sel));
    const uid = 'cb_' + (cfg.id || this.genId().replace(/[^a-z0-9]/gi, '').slice(0, 10));
    const data = JSON.stringify(opts.map(o => ({ value: String(o.value), label: o.label, group: o.group || '' })))
      .replace(/</g, '\\u003c');
    return `
    <div class="combobox" id="${uid}" data-onchange="${this.escapeAttr(cfg.onChange || '')}">
      <input type="hidden" name="${cfg.name || ''}" value="${this.escapeAttr(sel)}" class="combobox-value">
      <div class="combobox-field" tabindex="0">
        <input type="text" class="form-input combobox-search" placeholder="${this.escapeAttr(cfg.placeholder || 'Ketik untuk mencari…')}" autocomplete="off" value="${this.escapeAttr(selOpt ? selOpt.label : '')}">
        <span class="combobox-caret">▾</span>
      </div>
      <div class="combobox-panel" style="display:none"></div>
      <script type="application/json" class="combobox-data">${data}</script>
    </div>`;
  },

  escapeAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  /* Wire up every .combobox widget inside `root` (document by default).
     Call after innerHTML is injected (view render / modal open). */
  initComboboxes(root) {
    const scope = root || document;
    if (!document.__cbDocInit) {
      document.__cbDocInit = true;
      document.addEventListener('click', (ev) => {
        document.querySelectorAll('.combobox.open').forEach(box => {
          if (!box.contains(ev.target)) {
            box.classList.remove('open');
            const p = box.querySelector('.combobox-panel');
            if (p) p.style.display = 'none';
          }
        });
      });
    }
    scope.querySelectorAll('.combobox').forEach(box => {
      if (box.__cbInit) return;
      box.__cbInit = true;
      const search = box.querySelector('.combobox-search');
      const hidden = box.querySelector('.combobox-value');
      const panel = box.querySelector('.combobox-panel');
      const dataEl = box.querySelector('.combobox-data');
      let options = [];
      try { options = JSON.parse(dataEl.textContent || '[]'); } catch (e) { options = []; }
      const onChangeExpr = box.getAttribute('data-onchange') || '';
      const fireChange = (id) => {
        if (!onChangeExpr) return;
        try { (new Function('v', onChangeExpr))(id); } catch (e) { console.error('combobox onChange:', e); }
      };
      const renderItems = (q) => {
        const query = String(q || '').toLowerCase().trim();
        const filtered = options.filter(o =>
          !query || String(o.label).toLowerCase().includes(query) || String(o.value).toLowerCase().includes(query));
        let html = '';
        let lastGroup = null;
        filtered.forEach(o => {
          if (o.group && o.group !== lastGroup) {
            html += `<div class="combobox-group">${Utils.escapeHtml(o.group)}</div>`;
            lastGroup = o.group;
          }
          html += `<div class="combobox-item" data-value="${Utils.escapeAttr(o.value)}" data-label="${Utils.escapeAttr(o.label)}">${Utils.escapeHtml(o.label)}</div>`;
        });
        panel.innerHTML = html || '<div class="combobox-empty">Tidak ditemukan — coba kata kunci lain</div>';
      };
      const open = () => { renderItems(''); box.classList.add('open'); panel.style.display = 'block'; };
      const close = () => { box.classList.remove('open'); panel.style.display = 'none'; };
      const apply = (item) => {
        hidden.value = item.dataset.value;
        search.value = item.dataset.label;
        close();
        fireChange(item.dataset.value);
      };
      search.addEventListener('focus', open);
      search.addEventListener('input', () => renderItems(search.value));
      search.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { close(); search.blur(); return; }
        const isOpen = box.classList.contains('open');
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          if (!isOpen) { open(); return; }
          const items = [...panel.querySelectorAll('.combobox-item')];
          if (!items.length) return;
          const idx = items.findIndex(i => i.classList.contains('hl'));
          let next = ev.key === 'ArrowDown' ? idx + 1 : (idx < 0 ? items.length - 1 : idx - 1);
          if (next >= items.length) next = 0;
          items.forEach((i, k) => i.classList.toggle('hl', k === next));
          items[next].scrollIntoView({ block: 'nearest' });
        } else if (ev.key === 'Enter') {
          if (isOpen) {
            ev.preventDefault();
            const items = [...panel.querySelectorAll('.combobox-item')];
            const idx = items.findIndex(i => i.classList.contains('hl'));
            if (idx >= 0) apply(items[idx]);
            else if (items.length === 1) apply(items[0]);
            else close();
          }
        }
      });
      panel.addEventListener('mousedown', (ev) => {
        const item = ev.target.closest('.combobox-item');
        if (item) { ev.preventDefault(); apply(item); }
      });
    });
  }
};
