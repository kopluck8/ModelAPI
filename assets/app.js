/* Work Page FlamMap Tambora: tampilan GitHub Pages yang tersambung ke spreadsheet lewat Apps Script. */
(() => {
  'use strict';

  const C = window.CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const state = {
    api: null,          // hasil ?view=semua
    geo: [],            // titik rencana dari GeoJSON
    map: null,
    layer: null,
    fitted: false,
    addMode: false,
    current: null,      // plot yang sedang dibuka di panel
    detailLoaded: false,
  };

  /* ---------------- utilitas ---------------- */

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => (v === '' || v === null || v === undefined) ? NaN : Number(String(v).trim().replace(',', '.'));
  const fmt = (v, d = 2) => (v === '' || v === null || v === undefined || !isFinite(Number(v))) ? '–'
    : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d });
  const pct = v => Math.max(0, Math.min(100, Number(v) || 0));
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ID_OK = /^[\w.\-]{1,40}$/;

  function banner(msg, kind = 'error') {
    const b = $('#banner');
    if (!msg) { b.hidden = true; return; }
    b.className = 'banner ' + kind;
    b.textContent = msg;
    b.hidden = false;
  }

  function bar(value, label) {
    return `<div class="bar" role="progressbar" aria-valuenow="${pct(value)}" aria-valuemin="0" aria-valuemax="100"
      aria-label="${esc(label || 'progres')}"><span style="width:${pct(value)}%"></span></div>`;
  }

  function pill(status) {
    const cls = { Selesai: 'ok', Proses: 'run', Terkendala: 'warn', Belum: 'idle', Lengkap: 'ok', 'Belum lengkap': 'warn' }[status] || 'idle';
    return `<span class="pill ${cls}">${esc(status || 'Belum diisi')}</span>`;
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------------- API ---------------- */

  async function apiGet(params) {
    const u = new URL(C.API_URL);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u.toString());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j && j.error) throw new Error(j.error);
    return j;
  }

  async function apiPost(body) {
    const r = await fetch(C.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ---------------- data ---------------- */

  async function loadGeo() {
    try {
      const r = await fetch(C.GEOJSON, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const g = await r.json();
      state.geo = (g.features || [])
        .filter(f => f.geometry && f.geometry.type === 'Point' && f.properties && f.properties.Plot_ID)
        .map(f => ({
          id: String(f.properties.Plot_ID),
          strata: f.properties.Strata || '',
          tim: f.properties.Tim || '',
          lon: Number(f.geometry.coordinates[0]),
          lat: Number(f.geometry.coordinates[1]),
        }));
    } catch (e) {
      state.geo = [];
      console.warn('GeoJSON gagal dimuat', e);
    }
  }

  async function loadApi() {
    try {
      state.api = await apiGet({ view: 'semua' });
      banner(null);
    } catch (e) {
      banner('Data spreadsheet belum bisa dimuat (' + e.message + '). Periksa URL web app di assets/config.js ' +
        'dan pastikan akses web app "Anyone".');
    }
  }

  async function refresh() {
    $('#btnRefresh').disabled = true;
    await Promise.all([loadGeo(), loadApi()]);
    renderAll();
    $('#btnRefresh').disabled = false;
  }

  const api = k => (state.api && Array.isArray(state.api[k])) ? state.api[k] : [];
  const strataNames = () => {
    const s = api('strata').map(r => r.Strata).filter(Boolean);
    return s.length ? s : [...new Set(state.geo.map(g => g.strata).filter(Boolean))];
  };

  function renderAll() {
    renderTop();
    renderLive();
    renderMarkers();
    renderTugas();
    renderRekap();
    const f = $('#filterStrata');
    const cur = f.value;
    f.innerHTML = '<option value="">Semua strata</option>' + strataNames().map(s => `<option>${esc(s)}</option>`).join('');
    f.value = cur;
  }

  /* ---------------- header ---------------- */

  function renderTop() {
    const total = api('ringkasan').find(r => r.Tahap === 'TOTAL');
    const strata = api('strata');
    const target = strata.reduce((a, r) => a + (Number(r.Target_plot) || 0), 0);
    const lengkap = strata.reduce((a, r) => a + (Number(r.Plot_lengkap) || 0), 0);
    const upd = state.api && state.api.diperbarui ? new Date(state.api.diperbarui) : null;
    $('#topStats').innerHTML = !state.api ? '<span class="sub">Spreadsheet belum tersambung</span>' : `
      <div class="stat"><b>${fmt(total ? total['Progres_%'] : 0, 0)}%</b><span>progres tugas</span></div>
      <div class="stat"><b>${fmt(lengkap, 0)}/${fmt(target, 0)}</b><span>plot lengkap</span></div>
      <div class="stat"><b>${upd ? upd.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–'}</b><span>dimuat</span></div>`;
  }

  /* ---------------- work page ---------------- */

  async function loadWorkpage() {
    try {
      const md = await fetch('content/workpage.md', { cache: 'no-store' }).then(r => r.text());
      $('#workpage').innerHTML = marked.parse(md);
    } catch (e) {
      $('#workpage').innerHTML = '<p>Work page gagal dimuat.</p>';
      return;
    }
    const toc = $('#toc');
    toc.innerHTML = '';
    $$('#workpage h2').forEach(h => {
      h.id = slug(h.textContent);
      // cari blok progres di bagian ini (sampai h2 berikutnya)
      let el = h.nextElementSibling, tahap = '';
      while (el && el.tagName !== 'H2') {
        const live = el.matches('.live') ? el : $('.live', el);
        if (live) { tahap = live.dataset.tahap; break; }
        el = el.nextElementSibling;
      }
      const li = document.createElement('li');
      li.innerHTML = `<a href="#${h.id}">${esc(h.textContent)}</a>` +
        (tahap ? `<span class="toc-prog" data-tahap="${esc(tahap)}"></span>` : '');
      li.querySelector('a').addEventListener('click', ev => {
        ev.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      toc.appendChild(li);
    });
    renderLive();
  }

  function renderLive() {
    const ring = api('ringkasan');
    const tugas = api('tugas');
    $$('#workpage .live').forEach(box => {
      const t = box.dataset.tahap;
      const r = ring.find(x => x.Tahap === t);
      const list = tugas.filter(x => x.Tahap === t);
      if (!state.api) { box.innerHTML = '<p class="sub">Progres dari spreadsheet belum termuat.</p>'; return; }
      if (!list.length) { box.innerHTML = `<p class="sub">Belum ada tugas untuk tahap "${esc(t)}" di sheet Tugas.</p>`; return; }
      const prog = r ? r['Progres_%'] : 0;
      const telat = list.filter(x => x.Terlambat === 'Ya').length;
      box.innerHTML = `
        <div class="live-head">
          <span class="live-label">Progres tahap ${esc(t)}</span>
          <span><b>${fmt(prog, 0)}%</b> · ${list.filter(x => x.Status === 'Selesai').length} dari ${list.length} tugas selesai
          ${telat ? `· <span class="late">${telat} terlambat</span>` : ''}</span>
        </div>
        ${bar(prog, 'Progres ' + t)}
        <details><summary>Lihat tugas</summary>
          <ul class="tasks">${list.map(x => `<li>${pill(x.Status)} <span>${esc(x.Tugas)}</span>
            <span class="meta">${x.PJ ? esc(x.PJ) : 'PJ belum ditentukan'}${x.Tenggat ? ' · tenggat ' + esc(x.Tenggat) : ''}
            ${x.Terlambat === 'Ya' ? ' · <span class="late">terlambat</span>' : ''}</span></li>`).join('')}</ul>
        </details>`;
    });
    $$('#toc .toc-prog').forEach(s => {
      const r = ring.find(x => x.Tahap === s.dataset.tahap);
      s.innerHTML = state.api ? `${bar(r ? r['Progres_%'] : 0)}<em>${fmt(r ? r['Progres_%'] : 0, 0)}%</em>` : '';
    });
    $$('#workpage .live-plot').forEach(box => {
      if (!state.api) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="live-head"><span class="live-label">Plot per strata</span>
        <span>${state.geo.length} titik rencana di peta</span></div>` +
        api('strata').map(s => `<div class="strata-row"><span>${esc(s.Strata)}</span>
          ${bar(s['Progres_plot_%'], s.Strata)}<span class="meta">${fmt(s.Plot_lengkap, 0)} lengkap · ${fmt(s.Plot_terisi, 0)} terisi · target ${fmt(s.Target_plot, 0)}</span></div>`).join('');
    });
    $$('#workpage .live-fuel').forEach(box => renderFuel(box));
  }

  /* ---------------- fuel model (.FMD / .FMS) ---------------- */

  function buildFMD() {
    const lines = ['METRIC'], warn = [];
    api('fuel').forEach(r => {
      if (r.Strata === '' || r.No === '') return;
      const need = { 'muatan 1-hr': r.Muatan1h_tha, kedalaman: r.Kedalaman_cm, 'SAV 1-hr': r.SAV1h_per_cm, Mx: r['Mx_%'], panas: r.Panas_mati_kJkg };
      const kosong = Object.keys(need).filter(k => !isFinite(num(need[k])));
      if (kosong.length) { warn.push(`${r.Strata}: ${kosong.join(', ')} belum ada`); return; }
      const f = (v, d) => (isFinite(num(v)) ? num(v) : 0).toFixed(d);
      lines.push([Number(r.No), String(r.Kode).replace(/\s+/g, '_'), f(r.Muatan1h_tha, 2), f(r.Muatan10h_tha, 2),
        f(r.Muatan100h_tha, 2), f(r.HerbaHidup_tha, 2), f(r.KayuHidup_tha, 2), String(r.Tipe || 'dynamic').toLowerCase(),
        f(r.SAV1h_per_cm, 0), f(r.SAVherba_per_cm || r.SAV1h_per_cm, 0), f(r.SAVkayu_per_cm, 0), f(r.Kedalaman_cm, 1),
        f(r['Mx_%'], 0), f(r.Panas_mati_kJkg, 0), f(r.Panas_hidup_kJkg || r.Panas_mati_kJkg, 0),
        String(r.Nama || r.Strata).replace(/\s+/g, '_')].join(' '));
    });
    return { text: lines.join('\n') + '\n', warn, n: lines.length - 1 };
  }

  function buildFMS() {
    const keys = ['No', 'KA_1h', 'KA_10h', 'KA_100h', 'KA_herba', 'KA_kayu', 'KA_1000h'];
    const lines = api('fms').filter(r => keys.every(k => isFinite(num(r[k]))))
      .map(r => keys.map(k => Math.round(num(r[k]))).join(' '));
    return { text: lines.join('\n') + '\n', n: lines.length };
  }

  function renderFuel(box) {
    if (!state.api) { box.innerHTML = '<p class="sub">Data fuel model dari spreadsheet belum termuat.</p>'; return; }
    const fmd = buildFMD(), fms = buildFMS();
    box.innerHTML = `
      ${fmd.warn.length ? `<p class="warnbox">Belum bisa diekspor: ${fmd.warn.map(esc).join('; ')}</p>` : ''}
      <p class="file-label">tambora.fmd (${fmd.n} model)</p><pre class="code">${esc(fmd.text)}</pre>
      <p class="file-label">tambora.fms (${fms.n} baris)</p><pre class="code">${esc(fms.text)}</pre>
      <div class="export-row">
        <button class="btn" type="button" data-dl="fmd">Unduh tambora.fmd</button>
        <button class="btn" type="button" data-dl="fms">Unduh tambora.fms</button>
      </div>`;
    $('[data-dl="fmd"]', box).onclick = () => download('tambora.fmd', buildFMD().text);
    $('[data-dl="fms"]', box).onclick = () => download('tambora.fms', buildFMS().text);
  }

  /* ---------------- peta ---------------- */

  function initMap() {
    const map = L.map('map', { zoomControl: true }).setView(C.CENTER, C.ZOOM);
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Citra: Esri, Maxar, Earthstar Geographics',
    });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: '&copy; OpenTopoMap (CC-BY-SA)',
    });
    sat.addTo(map);
    L.control.layers({ 'Citra satelit': sat, 'OpenStreetMap': osm, 'Topografi': topo }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => { const d = L.DomUtil.create('div', 'legend'); d.id = 'legend'; return d; };
    legend.addTo(map);

    state.layer = L.layerGroup().addTo(map);
    map.on('click', ev => {
      if (!state.addMode) return;
      setAddMode(false);
      const id = (prompt('Plot_ID untuk titik baru (huruf, angka, titik, - atau _):') || '').trim();
      if (!id) return;
      if (!ID_OK.test(id)) { alert('Plot_ID tidak valid.'); return; }
      if (plotItems().some(p => p.id === id)) { alert('Plot_ID sudah ada. Klik titiknya di peta untuk mengedit.'); return; }
      openPanel({ id, lat: ev.latlng.lat, lon: ev.latlng.lng, strata: $('#filterStrata').value, baru: true });
    });
    map.on('locationfound', e => {
      L.circleMarker(e.latlng, { radius: 6, color: '#1c7ed6', fillOpacity: 0.9 }).addTo(map)
        .bindTooltip('Lokasi saya (±' + Math.round(e.accuracy) + ' m)').openTooltip();
    });
    map.on('locationerror', e => banner('Lokasi tidak tersedia: ' + e.message, 'info'));
    state.map = map;
  }

  function plotItems() {
    const byId = new Map(api('plot').map(p => [String(p.Plot_ID), p]));
    const items = state.geo.map(g => {
      const p = byId.get(g.id);
      return { ...g, strata: (p && p.Strata) || g.strata, status: p ? p.Status_data : '', row: p || null };
    });
    const seen = new Set(items.map(i => i.id));
    api('plot').forEach(p => {
      const id = String(p.Plot_ID);
      if (seen.has(id) || !isFinite(num(p.Lat)) || !isFinite(num(p.Lon))) return;
      items.push({ id, strata: p.Strata, tim: p.Tim, lat: num(p.Lat), lon: num(p.Lon), status: p.Status_data, row: p, luar: true });
    });
    return items;
  }

  const WARNA = { Lengkap: '#2f9e44', 'Belum lengkap': '#f08c00', '': '#868e96' };

  function renderMarkers() {
    if (!state.map) return;
    state.layer.clearLayers();
    const fs = $('#filterStrata').value, q = $('#cariPlot').value.trim().toLowerCase();
    const items = plotItems().filter(i => (!fs || i.strata === fs) && (!q || i.id.toLowerCase().includes(q)));
    const n = { Lengkap: 0, 'Belum lengkap': 0, '': 0 };
    const pts = [];
    items.forEach(i => {
      if (!isFinite(i.lat) || !isFinite(i.lon)) return;
      const st = i.status === 'Lengkap' || i.status === 'Belum lengkap' ? i.status : '';
      n[st]++;
      pts.push([i.lat, i.lon]);
      L.circleMarker([i.lat, i.lon], {
        radius: 8, color: '#fff', weight: 2, fillColor: WARNA[st], fillOpacity: 0.95,
        dashArray: i.luar ? '3 3' : null,
      }).addTo(state.layer)
        .bindTooltip(`<b>${esc(i.id)}</b><br>${esc(i.strata || '')}<br>${esc(st || 'Belum diisi')}`)
        .on('click', () => openPanel(i));
    });
    $('#legend').innerHTML = `<b>Status plot</b>
      <div><i style="background:${WARNA.Lengkap}"></i>Lengkap (${n.Lengkap})</div>
      <div><i style="background:${WARNA['Belum lengkap']}"></i>Belum lengkap (${n['Belum lengkap']})</div>
      <div><i style="background:${WARNA['']}"></i>Belum diisi (${n['']})</div>`;
    if (!state.fitted && pts.length) {
      state.map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
      state.fitted = true;
    }
  }

  function setAddMode(on) {
    state.addMode = on;
    $('#modeTambah').hidden = !on;
    $('#map').classList.toggle('adding', on);
  }

  /* ---------------- formulir plot ---------------- */

  const PLOT_FIELDS = [
    ['Plot_ID', 'Plot_ID', 'text'], ['Strata', 'Strata', 'strata'], ['Tanggal', 'Tanggal', 'date'], ['Tim', 'Tim', 'text'],
    ['Lat', 'Lintang (Lat)', 'num'], ['Lon', 'Bujur (Lon)', 'num'], ['Elevasi_m', 'Elevasi (m)', 'num'],
    ['Lereng_%', 'Lereng (%)', 'num'], ['Aspek_deg', 'Arah lereng (°)', 'num'], ['CanopyCover_%', 'Canopy cover (%)', 'num'],
    ['CBH_m', 'Tinggi dasar tajuk (m)', 'num'], ['Jml_subplot', 'Jumlah sub-plot', 'num'],
    ['Luas_subplot_m2', 'Luas sub-plot (m²)', 'num'], ['Catatan', 'Catatan', 'area'],
  ];

  const ROWS = {
    subplot: {
      table: '#rowsSubplot',
      cols: [['Sub_ID', 'Sub', 'num'], ['Fraksi', 'Fraksi', 'fraksi'], ['Berat_basah_g', 'Basah (g)', 'num'],
        ['Berat_kering_g', 'Kering (g)', 'num'], ['Catatan', 'Catatan', 'text']],
    },
    transek: {
      table: '#rowsTransek',
      cols: [['Transek_ID', 'No', 'num'], ['Panjang_m', 'Panjang (m)', 'num'], ['Lereng_%', 'Lereng (%)', 'num'],
        ['n_1h', 'n 1-hr', 'num'], ['n_10h', 'n 10-hr', 'num'], ['n_100h', 'n 100-hr', 'num']],
    },
    sav: {
      table: '#rowsSav',
      cols: [['Spesies', 'Spesies', 'text'], ['Lebar_mm', 'Lebar (mm)', 'num'], ['Tebal_mm', 'Tebal (mm)', 'num']],
    },
  };

  function inputHtml(k, type, value) {
    const v = esc(value ?? '');
    if (type === 'strata') {
      return `<select data-k="${esc(k)}"><option value="">Pilih strata</option>${strataNames()
        .map(s => `<option ${s === value ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
    }
    if (type === 'fraksi') {
      return `<select data-k="${esc(k)}">${C.FRAKSI.map(f => `<option ${f === value ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>`;
    }
    if (type === 'area') return `<textarea data-k="${esc(k)}" rows="2">${v}</textarea>`;
    if (type === 'date') return `<input type="date" data-k="${esc(k)}" value="${v}">`;
    if (type === 'num') return `<input type="text" inputmode="decimal" data-k="${esc(k)}" value="${v}">`;
    return `<input type="text" data-k="${esc(k)}" value="${v}">`;
  }

  function buildPlotFields(values) {
    $('#fieldsPlot').innerHTML = PLOT_FIELDS.map(([k, label, type]) =>
      `<label class="${type === 'area' ? 'full' : ''}"><span>${esc(label)}</span>${inputHtml(k, type, values[k])}</label>`).join('');
    const idInput = $('[data-k="Plot_ID"]', $('#fieldsPlot'));
    idInput.readOnly = true;
  }

  function buildRows(key, rows) {
    const def = ROWS[key];
    const t = $(def.table);
    t.innerHTML = `<thead><tr>${def.cols.map(c => `<th>${esc(c[1])}</th>`).join('')}<th></th></tr></thead><tbody></tbody>`;
    rows.forEach(r => addRow(key, r));
  }

  function addRow(key, values = {}) {
    const def = ROWS[key];
    const tr = document.createElement('tr');
    tr.innerHTML = def.cols.map(([k, , type]) => `<td class="c-${slug(k)}">${inputHtml(k, type, values[k])}</td>`).join('') +
      '<td><button type="button" class="icon" aria-label="Hapus baris">×</button></td>';
    $('button', tr).onclick = () => { tr.remove(); calc(); };
    $('tbody', $(def.table)).appendChild(tr);
  }

  function readRows(key) {
    const def = ROWS[key];
    return $$('tbody tr', $(def.table)).map(tr => {
      const o = {};
      def.cols.forEach(([k]) => { o[k] = $(`[data-k="${CSS.escape(k)}"]`, tr).value.trim(); });
      return o;
    }).filter(o => def.cols.some(([k, , type]) => type !== 'fraksi' && k !== 'Sub_ID' && k !== 'Transek_ID' && o[k] !== ''));
  }

  function readPlot() {
    const o = {};
    PLOT_FIELDS.forEach(([k]) => { o[k] = $(`[data-k="${CSS.escape(k)}"]`, $('#fieldsPlot')).value.trim(); });
    return o;
  }

  function buildDepth(vals) {
    $('#fieldsKedalaman').innerHTML = Array.from({ length: 10 }, (_, i) =>
      `<label><span>T${i + 1}</span><input type="text" inputmode="decimal" data-depth="${i}" value="${esc(vals[i] ?? '')}"></label>`).join('');
  }

  const readDepth = () => $$('[data-depth]').map(i => i.value.trim());

  async function openPanel(item) {
    state.current = item;
    state.detailLoaded = false;
    $('#panel').hidden = false;
    document.body.classList.add('panel-open');
    $('#panelJudul').textContent = 'Plot ' + item.id;
    $('#pesanSimpan').textContent = '';
    const base = {
      Plot_ID: item.id, Strata: item.strata || '', Tim: item.tim || '',
      Lat: isFinite(item.lat) ? item.lat.toFixed(6) : '', Lon: isFinite(item.lon) ? item.lon.toFixed(6) : '',
      Jml_subplot: 4, Luas_subplot_m2: 1, Tanggal: new Date().toISOString().slice(0, 10),
    };
    buildPlotFields(base);
    buildRows('subplot', []);
    buildRows('transek', []);
    buildRows('sav', []);
    buildDepth([]);
    calc();

    const adaDiSheet = !!item.row;
    if (!adaDiSheet || !state.api) {
      state.detailLoaded = true;
      $('#panelStatus').textContent = state.api ? 'Belum ada data di spreadsheet. Isi lalu simpan.'
        : 'Spreadsheet belum tersambung; data belum bisa disimpan.';
      return;
    }
    $('#panelStatus').textContent = 'Memuat data plot dari spreadsheet...';
    $('#btnSimpan').disabled = true;
    try {
      const d = await apiGet({ view: 'detail', id: item.id });
      if (state.current !== item) return;
      const p = Object.assign({}, base, d.plot || {});
      buildPlotFields(p);
      buildRows('subplot', d.subplot || []);
      buildRows('transek', d.transek || []);
      buildRows('sav', d.sav || []);
      buildDepth(d.kedalaman || []);
      state.detailLoaded = true;
      $('#panelStatus').innerHTML = 'Status: ' + pill(p.Status_data) + ' Data terakhir dari spreadsheet sudah dimuat.';
      calc();
    } catch (e) {
      $('#panelStatus').textContent = 'Gagal memuat data plot (' + e.message + '). Simpan dinonaktifkan agar data lama tidak tertimpa.';
    } finally {
      $('#btnSimpan').disabled = !state.detailLoaded;
    }
  }

  function closePanel() {
    $('#panel').hidden = true;
    document.body.classList.remove('panel-open');
    state.current = null;
  }

  function templateSubplot() {
    const n = Math.max(1, Math.min(10, Math.round(num(readPlot().Jml_subplot)) || 4));
    const ada = new Set(readRows('subplot').map(r => r.Sub_ID + '|' + r.Fraksi));
    // hapus baris kosong dulu
    $$('#rowsSubplot tbody tr').forEach(tr => {
      const vals = $$('input', tr).map(i => i.value.trim());
      if (vals.slice(1).every(v => v === '')) tr.remove();
    });
    for (let s = 1; s <= n; s++) {
      ['Rumput mati', 'Rumput hidup', 'Serasah'].forEach(f => {
        if (!ada.has(s + '|' + f)) addRow('subplot', { Sub_ID: s, Fraksi: f });
      });
    }
  }

  /* Pratinjau hitungan, rumus sama dengan spreadsheet. */
  function calc() {
    const p = readPlot();
    const area = num(p.Jml_subplot) * num(p.Luas_subplot_m2);
    const sub = readRows('subplot');
    const sum = (f, k) => sub.filter(r => r.Fraksi === f).reduce((a, r) => a + (isFinite(num(r[k])) ? num(r[k]) : 0), 0);
    const load = f => (area > 0 && sum(f, 'Berat_kering_g') > 0) ? sum(f, 'Berat_kering_g') / area / 100 : NaN;
    const ka = fs => {
      const bb = fs.reduce((a, f) => a + sum(f, 'Berat_basah_g'), 0);
      const bk = fs.reduce((a, f) => a + sum(f, 'Berat_kering_g'), 0);
      return bk > 0 ? (bb - bk) / bk * 100 : NaN;
    };
    const tr = readRows('transek');
    const W = cls => {
      const P = C.PARAM, key = { '1h': 'n_1h', '10h': 'n_10h', '100h': 'n_100h' }[cls];
      const vals = tr.filter(r => num(r.Panjang_m) > 0).map(r => {
        const c = Math.sqrt(1 + Math.pow((num(r['Lereng_%']) || 0) / 100, 2));
        return 1.234 * P.G[cls] * P.A[cls] * c * (num(r[key]) || 0) * P.D2[cls] / num(r.Panjang_m);
      });
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    };
    const depth = readDepth().map(num).filter(isFinite);
    const sav = readRows('sav').map(r => {
      const w = num(r.Lebar_mm), t = num(r.Tebal_mm);
      return w > 0 && t > 0 ? 20 * (w + t) / (w * t) : NaN;
    }).filter(isFinite);
    const rm = load('Rumput mati'), se = load('Serasah'), w1 = W('1h');
    const total1h = isFinite(rm) ? rm + (isFinite(se) ? se : 0) + (isFinite(w1) ? w1 : 0) : NaN;
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

    const warn = [];
    sub.forEach(r => { if (num(r.Berat_kering_g) > num(r.Berat_basah_g)) warn.push(`Sub-plot ${r.Sub_ID} ${r.Fraksi}: berat kering lebih besar dari basah`); });
    if (sub.length && sub.some(r => r.Berat_kering_g === '')) warn.push('Sebagian berat kering belum diisi (normal sebelum dioven).');
    if (!(area > 0)) warn.push('Isi jumlah dan luas sub-plot.');

    const rows = [
      ['Muatan 1-hr total', total1h, 't/ha'], ['  rumput mati', rm, 't/ha'], ['  serasah', se, 't/ha'], ['  ranting 1-hr', w1, 't/ha'],
      ['Muatan 10-hr', W('10h'), 't/ha'], ['Muatan 100-hr', W('100h'), 't/ha'],
      ['Herba hidup', load('Rumput hidup'), 't/ha'], ['Kayu hidup', load('Semak hidup'), 't/ha'],
      ['Kadar air mati', ka(['Rumput mati', 'Serasah']), '%'], ['Kadar air herba', ka(['Rumput hidup']), '%'],
      ['Kadar air kayu', ka(['Semak hidup']), '%'], ['Kedalaman rata-rata', avg(depth), 'cm'], ['SAV rata-rata', avg(sav), '1/cm'],
    ];
    $('#hasilHitung').innerHTML = `<table class="calc-table">${rows.map(([l, v, u]) =>
      `<tr><td>${esc(l)}</td><td class="r">${fmt(v, 2)}</td><td>${u}</td></tr>`).join('')}</table>` +
      (warn.length ? `<ul class="warnlist">${warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '');
  }

  async function save() {
    if (!state.current) return;
    if (!state.detailLoaded) { $('#pesanSimpan').textContent = 'Data lama belum termuat, simpan dibatalkan.'; return; }
    const plot = readPlot();
    if (!plot.Strata) { $('#pesanSimpan').textContent = 'Pilih strata dulu.'; return; }
    const body = {
      plot,
      subplot: readRows('subplot'),
      transek: readRows('transek'),
      kedalaman: readDepth(),
      sav: readRows('sav'),
    };
    const btn = $('#btnSimpan');
    btn.disabled = true;
    $('#pesanSimpan').textContent = 'Menyimpan...';
    try {
      const res = await apiPost(body);
      if (!res.ok) throw new Error(res.error || 'gagal');
      $('#pesanSimpan').textContent = 'Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      await loadApi();
      renderAll();
      const row = api('plot').find(p => String(p.Plot_ID) === plot.Plot_ID);
      if (state.current) {
        state.current.row = row || state.current.row;
        state.current.baru = false;
        $('#panelStatus').innerHTML = 'Status: ' + pill(row ? row.Status_data : '') + ' Tersimpan di spreadsheet.';
      }
    } catch (e) {
      $('#pesanSimpan').textContent = 'Gagal menyimpan: ' + e.message;
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------------- tab tugas ---------------- */

  function renderTugas() {
    const ring = api('ringkasan');
    $('#ringkasanTahap').innerHTML = ring.length ? ring.map(r => `
      <div class="card ${r.Tahap === 'TOTAL' ? 'total' : ''}">
        <div class="card-head"><b>${esc(r.Tahap)}</b><span>${fmt(r['Progres_%'], 0)}%</span></div>
        ${bar(r['Progres_%'], r.Tahap)}
        <p class="meta">${fmt(r.Selesai, 0)} dari ${fmt(r.Jumlah_tugas, 0)} selesai${Number(r.Terlambat) ? ` · <span class="late">${fmt(r.Terlambat, 0)} terlambat</span>` : ''}</p>
      </div>`).join('') : '<p class="sub">Belum ada data ringkasan.</p>';

    const f = $('#filterStatus').value;
    const rows = api('tugas').filter(t => !f || (f === '__telat' ? t.Terlambat === 'Ya' : t.Status === f));
    $('#tabelTugas').innerHTML = `<thead><tr><th>No</th><th>Tahap</th><th>Tugas</th><th>PJ</th><th>Tenggat</th><th>Status</th><th>Catatan</th></tr></thead>
      <tbody>${rows.map(t => `<tr class="${t.Terlambat === 'Ya' ? 'is-late' : ''}"><td>${esc(t.No)}</td><td>${esc(t.Tahap)}</td>
        <td>${esc(t.Tugas)}${t.Link_bukti ? ` <a href="${esc(t.Link_bukti)}" target="_blank" rel="noopener">bukti</a>` : ''}</td>
        <td>${esc(t.PJ)}</td><td>${esc(t.Tenggat)}${t.Terlambat === 'Ya' ? ' <span class="late">terlambat</span>' : ''}</td>
        <td>${pill(t.Status)}</td><td>${esc(t.Catatan)}</td></tr>`).join('')}</tbody>`;
  }

  /* ---------------- tab rekap ---------------- */

  const REKAP = [
    ['Muatan1h_tha', 'Muatan 1-hr', 't/ha'], ['Muatan10h_tha', 'Muatan 10-hr', 't/ha'], ['HerbaHidup_tha', 'Herba hidup', 't/ha'],
    ['KayuHidup_tha', 'Kayu hidup', 't/ha'], ['Kedalaman_cm', 'Kedalaman', 'cm'], ['KA_mati_%', 'KA mati', '%'],
    ['KA_herba_%', 'KA herba', '%'], ['CanopyCover_%', 'Canopy cover', '%'],
  ];

  function renderRekap() {
    $('#rekapStrata').innerHTML = api('strata').map(s => `
      <div class="card">
        <div class="card-head"><b>${esc(s.Strata)}</b><span>${fmt(s.Plot_lengkap, 0)}/${fmt(s.Target_plot, 0)} plot</span></div>
        ${bar(s['Progres_plot_%'], s.Strata)}
        <table class="mini">${REKAP.map(([k, l, u]) => `<tr><td>${l}</td>
          <td class="r">${fmt(s[k + '_rata'])}${s[k + '_SD'] !== '' && s[k + '_SD'] !== undefined ? ' ± ' + fmt(s[k + '_SD']) : ''}</td><td>${u}</td></tr>`).join('')}
          <tr><td>SAV</td><td class="r">${fmt(s.SAV_per_cm_rata, 0)}</td><td>1/cm</td></tr></table>
        ${s.Peringatan ? `<p class="warnbox">${esc(s.Peringatan)}</p>` : ''}
      </div>`).join('') || '<p class="sub">Belum ada data strata.</p>';

    const fuel = api('fuel');
    const cols = [['No', 'No'], ['Kode', 'Kode'], ['Strata', 'Strata'], ['Muatan1h_tha', '1-hr'], ['Muatan10h_tha', '10-hr'],
      ['Muatan100h_tha', '100-hr'], ['HerbaHidup_tha', 'Herba'], ['KayuHidup_tha', 'Kayu'], ['Tipe', 'Tipe'],
      ['SAV1h_per_cm', 'SAV 1-hr'], ['Kedalaman_cm', 'Kedalaman'], ['Mx_%', 'Mx'], ['Panas_mati_kJkg', 'Panas']];
    $('#tabelFuel').innerHTML = `<thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead>
      <tbody>${fuel.map(r => `<tr>${cols.map(([k]) => `<td>${typeof r[k] === 'number' ? fmt(r[k]) : esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody>`;
    const fmd = buildFMD(), fms = buildFMS();
    $('#pratinjauFile').textContent = state.api ? '--- tambora.fmd ---\n' + fmd.text + '\n--- tambora.fms ---\n' + fms.text : '';
  }

  /* ---------------- tab & event ---------------- */

  function showTab(name) {
    $$('.tab').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $$('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'peta' && state.map) setTimeout(() => state.map.invalidateSize(), 50);
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  function bind() {
    $$('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('#btnRefresh').onclick = refresh;
    $('#filterStrata').onchange = renderMarkers;
    $('#cariPlot').oninput = renderMarkers;
    $('#filterStatus').onchange = renderTugas;
    $('#btnTambah').onclick = () => setAddMode(!state.addMode);
    $('#batalTambah').onclick = () => setAddMode(false);
    $('#btnLokasi').onclick = () => state.map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
    $('#tutupPanel').onclick = closePanel;
    $('#btnSimpan').onclick = save;
    $('#unduhFmd').onclick = () => download('tambora.fmd', buildFMD().text);
    $('#unduhFms').onclick = () => download('tambora.fms', buildFMS().text);
    $('#templateSubplot').onclick = () => { templateSubplot(); calc(); };
    $$('[data-add]').forEach(b => b.onclick = () => addRow(b.dataset.add, b.dataset.add === 'subplot'
      ? { Sub_ID: '', Fraksi: C.FRAKSI[0] } : b.dataset.add === 'transek' ? { Transek_ID: $$('#rowsTransek tbody tr').length + 1, Panjang_m: 10 } : {}));
    $('#formPlot').addEventListener('input', calc);
    $('#formPlot').addEventListener('change', calc);
    $('#pakaiGps').onclick = () => {
      if (!navigator.geolocation) { alert('GPS tidak tersedia di perangkat ini.'); return; }
      $('#pesanSimpan').textContent = 'Mengambil lokasi GPS...';
      navigator.geolocation.getCurrentPosition(pos => {
        $('[data-k="Lat"]').value = pos.coords.latitude.toFixed(6);
        $('[data-k="Lon"]').value = pos.coords.longitude.toFixed(6);
        if (pos.coords.altitude != null && $('[data-k="Elevasi_m"]').value === '') {
          $('[data-k="Elevasi_m"]').value = Math.round(pos.coords.altitude);
        }
        $('#pesanSimpan').textContent = 'Koordinat GPS diisi (akurasi ±' + Math.round(pos.coords.accuracy) + ' m).';
      }, err => { $('#pesanSimpan').textContent = 'GPS gagal: ' + err.message; }, { enableHighAccuracy: true, timeout: 20000 });
    };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#panel').hidden) closePanel(); });
  }

  async function start() {
    bind();
    initMap();
    const tab = (location.hash || '').slice(1);
    showTab(['workpage', 'peta', 'tugas', 'rekap'].includes(tab) ? tab : 'workpage');
    await Promise.all([loadWorkpage(), loadGeo(), loadApi()]);
    renderAll();
  }

  start();
})();
