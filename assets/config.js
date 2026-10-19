// Ubah nilai di sini saja.
window.CONFIG = {
  // URL web app Apps Script (Deploy → Web app)
  API_URL: 'https://script.google.com/macros/s/AKfycbywr5-bB3rWSJAn7wtZ5uNgNgw_044fmxXF9fg5xQSlHlwnHJdaoUihLRhy7UiLV7IU7Q/exec',

  // Titik rencana plot (GeoJSON Point, properti Plot_ID dan Strata)
  GEOJSON: 'data/plot_rencana.geojson',

  // Posisi awal peta (lat, lon) dan zoom
  CENTER: [-8.25, 118.0],
  ZOOM: 11,

  // Fraksi sub-plot, harus sama dengan Code.gs
  FRAKSI: ['Rumput mati', 'Rumput hidup', 'Serasah', 'Semak hidup'],

  // Parameter pratinjau hitungan (sama dengan sheet Parameter, nilai baku Brown 1974)
  PARAM: {
    G: { '1h': 0.48, '10h': 0.48, '100h': 0.40 },
    D2: { '1h': 0.0974, '10h': 1.865, '100h': 17.81 },
    A: { '1h': 1.13, '10h': 1.13, '100h': 1.13 },
  },
};
