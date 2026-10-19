# Work Page FlamMap Tambora

Situs statis (GitHub Pages) untuk work page pemodelan arah rambatan api FlamMap di savana TN Tambora.
Halaman ini tersambung ke Google Sheets tim lewat Apps Script, jadi progres tugas, data plot, rekap strata,
dan file `.fmd` / `.fms` selalu mengikuti isi spreadsheet.

| Tab | Isi |
| --- | --- |
| Work Page | Metode lengkap (dari `content/workpage.md`) dengan progres tiap tahap, daftar tugas, progres plot per strata, dan isi `tambora.fmd`/`tambora.fms` terbaru |
| Peta & Input Plot | Titik plot di peta citra satelit. Klik titik untuk mengisi data lapangan dan langsung menyimpannya ke spreadsheet |
| Progres Tugas | Progres per tahap dan semua tugas (status, PJ, tenggat, terlambat) |
| Rekap & Fuel Model | Rata-rata ± SD per strata, tabel fuel model, unduh `tambora.fmd` dan `tambora.fms` |

## Struktur

```
index.html              halaman utama
assets/config.js        URL Apps Script, posisi awal peta, parameter
assets/app.js           logika halaman
assets/style.css        tampilan
assets/alur.svg         diagram alur kerja
content/workpage.md     isi work page (edit di sini, tampil otomatis)
data/plot_rencana.geojson  titik plot rencana
```

## Memasang di GitHub Pages

1. Buat repo baru di GitHub, misalnya `flammap-tambora`.
2. Ekstrak zip ini dan unggah semua isinya ke repo (Add file → Upload files), termasuk file `.nojekyll`.
3. Repo → **Settings → Pages** → Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)` → Save.
4. Beberapa menit kemudian situs aktif di `https://<username>.github.io/flammap-tambora/`.

## Menyambungkan ke spreadsheet

URL web app sudah diisi di `assets/config.js`. Agar semua fitur jalan, Apps Script di spreadsheet harus memakai
`Code.gs` versi terbaru (tanpa token, dengan data `fms`):

1. Buka spreadsheet → Extensions → Apps Script → ganti isi `Code.gs` dengan versi terbaru.
2. **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy.**
   URL tetap sama. Tanpa langkah ini, web app masih menjalankan kode lama.
3. Pastikan akses web app: Execute as **Me**, Who has access **Anyone**.

## Titik plot

Ganti `data/plot_rencana.geojson` dengan titik plot rencana timmu (koordinat di contoh hanya ilustrasi).
Formatnya GeoJSON Point WGS 84 (lon, lat), dengan properti:

```json
{ "type": "Feature",
  "properties": { "Plot_ID": "RP-01", "Strata": "Rumput pendek", "Tim": "Tim A" },
  "geometry": { "type": "Point", "coordinates": [117.9902, -8.2401] } }
```

- `Plot_ID` hanya huruf, angka, `.`, `-`, `_`, dan harus unik.
- `Strata` harus sama persis dengan nama di sheet **Rekap Strata**.
- Dari QGIS: klik kanan layer titik → Export → Save Features As → format GeoJSON, CRS EPSG:4326.

Titik juga bisa ditambah langsung dari peta (tombol **+ Titik baru**). Titik itu tersimpan di spreadsheet
dan tampil bergaris putus-putus, tapi tidak masuk ke file GeoJSON.

Warna titik: abu-abu = belum diisi, oranye = belum lengkap, hijau = lengkap (kedalaman, sub-plot, transek,
dan koordinat sudah ada).

## Mengisi data dari lapangan

1. Buka tab **Peta & Input Plot** di HP, klik titik plot.
2. Isi data plot. Tombol **Isi koordinat dari GPS HP** mengambil posisi sebenarnya.
3. **Buat baris untuk semua sub-plot** menyiapkan baris rumput mati, rumput hidup, dan serasah untuk tiap sub-plot.
   Berat kering boleh diisi belakangan setelah sampel dioven.
4. Isi transek, 10 titik kedalaman, dan helai rumput untuk SAV.
5. Kotak **Hasil hitung** menampilkan pratinjau muatan, kadar air, kedalaman, dan SAV.
6. **Simpan ke spreadsheet.** Saat titik dibuka lagi, data terakhir dimuat ulang dari spreadsheet.

Penyimpanan mengganti seluruh baris sub-plot, transek, kedalaman, dan SAV milik plot itu dengan isi formulir.
Karena itu formulir selalu memuat data lama dulu, dan tombol simpan dikunci bila data lama gagal dimuat.

Status dan PJ tugas diubah di sheet **Tugas** di spreadsheet; halaman ini hanya menampilkannya.

## Catatan

- Akses web app terbuka: siapa pun yang membuka situs bisa membaca dan mengisi data plot.
  Bila nanti ingin dikunci, isi `INPUT_TOKEN` di Script Properties (lihat README Apps Script).
- Data dari spreadsheet di-cache 5 menit oleh Apps Script, dan dikosongkan setiap ada data baru tersimpan.
  Tombol **Muat ulang** mengambil data terbaru.
- Isi work page diubah di `content/workpage.md`. Blok `<div class="live" data-tahap="...">` menampilkan
  progres tahap; nilai `data-tahap` harus sama dengan kolom Tahap di sheet Tugas.
