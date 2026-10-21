/* ============================================================
   EstimatorPro — Indonesia location master service
   Uses a bundled, official-style administrative reference snapshot so location
   search works immediately and offline. The Supabase table mirrors this source
   for governance, reporting, and future centralized maintenance.
   ============================================================ */

const Locations = {
  _assetUrl: 'assets/indonesia-locations.json?v=1',
  _master: null,
  _loading: null,

  async load() {
    if (this._master) return this._master;
    if (this._loading) return this._loading;
    this._loading = fetch(this._assetUrl, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Location master tidak dapat dimuat (${response.status}).`);
        return response.json();
      })
      .then(data => {
        const districts = Array.isArray(data?.districts) ? data.districts : [];
        const provinces = Array.isArray(data?.provinces) ? data.provinces : [];
        this._master = { provinces, districts };
        return this._master;
      })
      .catch(error => {
        console.warn('Indonesia location master unavailable:', error.message);
        this._master = { provinces: [], districts: [] };
        return this._master;
      })
      .finally(() => { this._loading = null; });
    return this._loading;
  },

  async provinces() {
    const { provinces } = await this.load();
    return provinces.slice().sort((a, b) => a.name.localeCompare(b.name, 'id'));
  },

  async regencies(provinceCode) {
    const { districts } = await this.load();
    const unique = new Map();
    districts.filter(row => !provinceCode || row.provinceCode === provinceCode).forEach(row => {
      unique.set(row.regencyCode, { code: row.regencyCode, name: row.regency, provinceCode: row.provinceCode });
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  },

  async districts(regencyCode) {
    const { districts } = await this.load();
    return districts
      .filter(row => !regencyCode || row.regencyCode === regencyCode)
      .slice()
      .sort((a, b) => a.district.localeCompare(b.district, 'id'));
  },

  async formOptions({ provinceCode = '', regencyCode = '' } = {}) {
    const [provinces, regencies, districts] = await Promise.all([
      this.provinces(), this.regencies(provinceCode), this.districts(regencyCode)
    ]);
    return { provinces, regencies, districts };
  },

  formatSelection({ province = '', regency = '', district = '', detail = '' } = {}) {
    return [detail, district, regency, province].map(part => String(part || '').trim()).filter(Boolean).join(', ');
  },

  findByLocation(location) {
    const value = String(location || '').toLocaleLowerCase('id').trim();
    if (!value || !this._master?.districts?.length) return null;
    return this._master.districts.find(row => [row.district, row.regency, row.province].some(part => String(part).toLocaleLowerCase('id') === value)) || null;
  }
};
