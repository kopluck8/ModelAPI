# Pemodelan Arah Rambatan Api FlamMap di Savana TN Tambora

## Ringkasan

Tujuan kerja ini adalah peta **arah dan laju rambatan api** di savana TN Tambora dari FlamMap 6.2, memakai **custom fuel model** hasil ukur lapangan, bukan 40 model standar Scott & Burgan (2005) yang dikalibrasi untuk vegetasi Amerika Serikat.

Model standar tidak cocok karena rumput savana Tambora (dominan *Themeda*, *Heteropogon* dan sejenisnya) punya muatan, tinggi, dan pola pengeringan musiman yang berbeda dari padang rumput AS. Selisih muatan atau kedalaman bahan bakar langsung mengubah laju rambat dan arah rambat maksimum yang dihitung FlamMap.

Alurnya lima tahap: (1) kumpulkan data primer dan sekunder, (2) olah data plot menjadi file **.FMD** (fuel model) dan **.FMS** (kadar air), (3) susun raster lanskap yang selaras, (4) jalankan FlamMap (Basic Fire Behavior dan MTT), (5) validasi dengan area terbakar nyata, lalu kalibrasi ulang bila meleset.

![Alur kerja: data primer dan sekunder, custom fuel model dan raster lanskap, running FlamMap, validasi, lalu peta arah rambatan; hasil yang meleset kembali ke kalibrasi fuel model](assets/alur.svg)

Plot lapangan dipakai dua kali: untuk menyusun fuel model, dan sebagai titik latih klasifikasi peta fuel model.

## 0. Persiapan

<div class="live" data-tahap="1. Persiapan"></div>

Buat stratifikasi awal savana dari Sentinel-2, lalu tentukan lokasi plot secara acak bertingkat. Titik plot rencana disimpan di `data/plot_rencana.geojson` dan muncul di tab **Peta & Input**.

## 1. Data primer (pengukuran lapangan)

<div class="live" data-tahap="2. Data primer"></div>
<div class="live-plot"></div>

Data primer mengisi 13 parameter custom fuel model dan file kadar air. Waktu ukur terbaik adalah puncak kemarau (Juli sampai Oktober), saat rumput sudah *curing* (mengering) dan kebakaran paling sering terjadi; ulangi sekali di awal kemarau (Mei sampai Juni) untuk melihat perubahan fraksi mati.

**Penyesuaian untuk sel 10 m:** letakkan plot di tengah hamparan vegetasi yang seragam minimal 25 x 25 m (sekitar 3 x 3 sel), agar plot tetap di kelas yang benar walau posisi GPS meleset satu sel. Rata-ratakan posisi GPS 1 sampai 2 menit di titik tengah plot, atau pakai GNSS genggam, karena GPS HP bisa meleset 3 sampai 10 m.

### 1.1 Desain sampling

- **Stratifikasi** savana dulu dari citra Sentinel-2, misalnya: rumput pendek terbuka, rumput tinggi, savana bersemak, bekas terbakar kurang dari 1 tahun. Satu strata nantinya menjadi satu custom fuel model.
- **Jumlah plot**: minimal 15 sampai 30 plot per strata, tersebar acak bertingkat, dengan jarak antarplot lebih dari 100 m agar tidak saling berkorelasi.
- **Bentuk plot**: plot utama lingkaran radius 5 m atau bujur sangkar 10 x 10 m. Di dalamnya 4 sampai 5 sub-plot panen 1 x 1 m (rumput dan herba) dan 2 transek 10 m (ranting dan kayu mati).
- Catat **koordinat GPS**, elevasi, kemiringan, arah lereng, dan foto 4 arah di setiap plot.

### 1.2 Parameter yang diukur

| Parameter | Cara ukur | Alat | Satuan catat |
| --- | --- | --- | --- |
| Muatan rumput/herba mati (masuk 1-hr) | Panen semua rumput di sub-plot 1 x 1 m, pisahkan mati dan hidup, timbang basah, oven 70 °C selama 48 jam, timbang kering | Gunting rumput, kantong kertas, timbangan 0,1 g, oven | g/m² berat kering |
| Muatan herba hidup | Sama, dari fraksi hijau | Sama | g/m² |
| Muatan semak hidup (live woody) | Panen daun dan ranting hidup diameter < 6 mm di sub-plot; atau ukur tinggi dan diameter tajuk semak lalu pakai persamaan alometrik | Gunting dahan, meteran | g/m² |
| Ranting mati 1-hr, 10-hr, 100-hr | Metode *planar intersect* (Brown 1974): hitung ranting yang memotong transek per kelas diameter < 0,64 cm, 0,64 sampai 2,54 cm, 2,54 sampai 7,62 cm | Meteran 10 m, *go/no-go gauge* atau jangka sorong | jumlah potongan per kelas |
| Serasah | Panen serasah di sub-plot terpisah dari rumput | Kantong, timbangan | g/m² |
| Kedalaman bed bahan bakar | Ukur tinggi rata-rata bahan bakar di 10 titik per plot (bukan tinggi pucuk tertinggi); atau dari aplikasi LiDAR iPhone | Penggaris 1 m, LiDAR | cm |
| Kadar air bahan bakar | Berat basah dan kering tiap fraksi, sampel diambil pukul 12.00 sampai 15.00 | Kantong kedap udara, timbangan, oven 105 °C 24 jam | % berat kering |
| Tutupan dan tinggi tajuk pohon | Densiometer atau foto hemisferis; tinggi pohon dan tinggi dasar tajuk | Densiometer, clinometer/rangefinder | %, m |
| Lebar dan tebal daun rumput (untuk SAV) | Ukur 20 helai per spesies dominan | Jangka sorong digital | mm |
| Komposisi spesies | Spesies dominan dan persen tutupan | Kuadrat, buku identifikasi | % |

Kadar air dihitung dengan rumus (BB = berat basah, BK = berat kering):

<p class="formula">KA (%) = (BB − BK) / BK × 100</p>

### 1.3 Data cuaca dan perilaku api di lapangan

- **Cuaca mikro**: suhu, kelembapan relatif, kecepatan dan arah angin per 10 menit dengan stasiun cuaca portabel atau Kestrel, sensor angin dipasang setinggi 6 m (atau 2 m lalu dikonversi).
- **Observasi kebakaran** (sangat berharga untuk kalibrasi): bila ada kebakaran atau pembakaran terkendali sesuai prosedur Balai TN Tambora, catat laju rambat (jarak tempuh muka api per menit dengan patok berjarak), panjang nyala, arah rambat, dan cuaca saat itu.
- **Wawancara petugas** Manggala Agni dan Balai TN: lokasi, tanggal, arah angin dominan, dan arah api pada kebakaran sebelumnya.

### 1.4 Parameter yang biasanya tidak diukur sendiri

Panas pembakaran (*heat content*) dan *moisture of extinction* butuh laboratorium (bom kalorimeter) atau uji bakar. Bila tidak tersedia, pakai nilai baku: panas 18.622 kJ/kg (8.000 BTU/lb), dan *moisture of extinction* 15 sampai 25% untuk rumput kering, mengacu ke model GR terdekat.

### 1.5 Pohon hidup bila yang terbakar hanya rumput

Biomassa pohon hidup (batang, cabang, tajuk) **tidak masuk** muatan custom fuel model, karena fuel model hanya berisi bahan bakar permukaan setinggi kurang lebih 1,8 m dari tanah. Yang tetap dihitung: serasah daun dan ranting mati di bawah pohon, anakan pohon, dan semak rendah. Pohon tetap dicatat sebagai **canopy cover** (wajib di lanskap), karena tajuk memperlambat angin di permukaan dan menaungi bahan bakar. Agar FlamMap tidak memunculkan api tajuk, isi tinggi dasar tajuk (CBH) sesuai ukuran lapangan, atau nilai tinggi bila api tajuk memang tidak pernah terjadi.

## 2. Data sekunder

<div class="live" data-tahap="3. Data sekunder"></div>

Data sekunder membentuk lapisan lanskap, input cuaca, dan data validasi. Semua raster nanti diproyeksikan ke **WGS 84 / UTM zona 50S (EPSG:32750)** dengan ukuran sel yang sama (disarankan 10 m, diselaraskan ke grid Sentinel-2; DEMNAS 8 m diresample ke 10 m).

| Data | Kegunaan di FlamMap | Sumber | Resolusi |
| --- | --- | --- | --- |
| DEM (elevasi) | Layer elevasi, turunan slope dan aspect | [DEMNAS BIG](https://tanahair.indonesia.go.id/demnas) atau [Copernicus DEM GLO-30](https://dataspace.copernicus.eu) | 8 m / 30 m |
| Citra Sentinel-2 L2A musim kemarau | Klasifikasi strata bahan bakar, indeks NDVI/NBR | [Copernicus Data Space](https://dataspace.copernicus.eu) atau Google Earth Engine | 10 m |
| Tutupan lahan | Peta awal kelas vegetasi dan area tidak terbakar (air, permukiman, batuan) | Peta tutupan lahan KLHK, [ESA WorldCover](https://esa-worldcover.org) | 30 m / 10 m |
| Tinggi kanopi | Layer tinggi tegakan (CH) untuk hutan di tepi savana | [ETH Global Canopy Height 2020](https://langnico.github.io/globalcanopyheight/) atau Meta/WRI 1 m | 10 m / 1 m |
| Batas kawasan TN Tambora dan zonasi | Batas area model | Balai TN Tambora, KLHK | vektor |
| Cuaca jam-jaman historis | Angin dominan, suhu, RH untuk skenario dan file .WXS | Stasiun BMKG terdekat (Bima, Sumbawa Besar) via [dataonline.bmkg.go.id](https://dataonline.bmkg.go.id); [ERA5-Land](https://cds.climate.copernicus.eu) | titik / 9 km |
| Titik panas (hotspot) | Lokasi penyulutan untuk MTT, urutan waktu untuk arah rambat nyata | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov) VIIRS dan MODIS, [SiPongi KLHK](https://sipongi.menlhk.go.id) | 375 m / 1 km |
| Area terbakar historis | Validasi perimeter dan arah | Sentinel-2 dNBR (buat sendiri), MODIS MCD64A1 | 10 m / 500 m |
| Laporan kejadian kebakaran | Tanggal, luas, arah api, misalnya kebakaran Resort Piong 5 Juli 2026 (sekitar 1.956 ha) | Balai TN Tambora, Manggala Agni, berita | - |
| Literatur fuel model savana tropis | Pembanding SAV, panas, *moisture of extinction* | Scott & Burgan 2005 (RMRS-GTR-153); studi savana Australia utara dan Afrika | - |

Catatan angin: FlamMap memakai angin pada ketinggian 20 ft (sekitar 6 m), sedangkan BMKG dan ERA5 mencatat angin 10 m. Konversi kasar yang umum: angin 20 ft = angin 10 m dibagi 1,15.

## 3. Pengolahan data primer menjadi custom fuel model

<div class="live" data-tahap="4. Olah fuel model"></div>

Hasil tahap ini adalah satu file **.FMD** berisi satu baris per strata savana, dan satu file **.FMS** berisi kadar air per fuel model. Semua hitungan di bawah dikerjakan otomatis oleh spreadsheet.

### 3.1 Hitung muatan per plot

1. Rumput, herba, semak, serasah: berat kering g/m² dibagi 100 = **t/ha**. Rata-ratakan semua sub-plot per plot.
2. Rumput mati dan serasah halus masuk kelas **1-hr mati**. Rumput hijau masuk **herba hidup**. Daun dan ranting hidup semak masuk **kayu hidup (live woody)**.
3. Ranting mati dari transek dihitung dengan rumus *planar intersect* (Van Wagner 1968, Brown 1974). W = muatan (t/ha), G = berat jenis kayu (g/cm³), a = koreksi orientasi, Σd² = jumlah kuadrat diameter ranting yang memotong transek (cm²), c = koreksi lereng, L = panjang transek (m).

<p class="formula">W = 1,234 × G × a × c × Σd² / L, dengan c = √(1 + (lereng % / 100)²)</p>

4. Kedalaman bed: rata-rata 10 titik per plot, dalam cm.

### 3.2 Ringkas per strata

Hitung rata-rata, simpangan baku, dan selang kepercayaan 95% tiap parameter per strata. Bila simpangan baku lebih dari 50% rata-rata, pertimbangkan memecah strata itu menjadi dua. Lihat tab **Rekap & Fuel Model** untuk angka terbaru.

### 3.3 Tentukan parameter yang tidak diukur langsung

- **SAV rumput**: helai berbentuk pipih, SAV kira-kira 2 dibagi tebal helai (cm); rumput savana umumnya 50 sampai 80 1/cm. Bandingkan dengan model GR (1-hr SAV sekitar 66 1/cm).
- **SAV kayu hidup**: pakai nilai model GS/SH terdekat (sekitar 50 sampai 60 1/cm).
- **Moisture of extinction**: 15% untuk rumput halus kering, sampai 30 sampai 40% untuk rumput tinggi dan lebat (ikuti model GR dengan struktur paling mirip).
- **Panas**: 18.622 kJ/kg untuk mati dan hidup, kecuali punya hasil bom kalorimeter.
- **Tipe model**: savana rumput pakai **dynamic**, artinya FlamMap memindahkan sebagian herba hidup ke kelas mati sesuai kadar air herba (kadar air 30% berarti seluruhnya dianggap mati, 120% berarti seluruhnya hidup).

### 3.4 File .FMD dan .FMS dari spreadsheet

Urutan kolom resmi FlamMap 6.2: nomor, kode, 1-hr, 10-hr, 100-hr, herba hidup, kayu hidup, tipe, SAV 1-hr, SAV herba, SAV kayu, kedalaman, *moisture of extinction*, panas mati, panas hidup, nama. Baris pertama `METRIC` membuat satuan menjadi t/ha, 1/cm, cm, % dan kJ/kg. Pakai nomor model **14 sampai 89** agar tidak bentrok dengan model standar.

File .FMS berisi satu baris per fuel model: nomor, kadar air 1-hr, 10-hr, 100-hr, herba hidup, kayu hidup, 1000-hr (%, bilangan bulat). Baris nomor 0 menjadi nilai baku untuk model yang tidak tercantum.

Isi kedua file di bawah ini dibangun langsung dari data spreadsheet saat ini:

<div class="live-fuel"></div>

### 3.5 Kalibrasi sebelum masuk peta

Uji setiap model di **BehavePlus 6** (gratis, USDA) atau FlamMap dengan lanskap datar kecil. Masukkan cuaca saat observasi kebakaran (1.3), lalu bandingkan laju rambat dan panjang nyala hasil model dengan pengamatan. Bila meleset jauh, sesuaikan kedalaman, SAV, atau *moisture of extinction* dalam rentang wajar, bukan muatan yang sudah diukur. Catat setiap perubahan di sheet **Kalibrasi**.

## 4. Pengolahan data spasial (lanskap)

<div class="live" data-tahap="5. Lanskap"></div>

FlamMap butuh 5 raster wajib dan 3 raster opsional yang **identik** dalam proyeksi, ukuran sel, jumlah baris-kolom, dan batas. Kerjakan di QGIS (gratis) dengan GDAL bawaannya.

### 4.1 Lapisan lanskap

| Layer | Wajib | Cara membuat | Satuan / tipe |
| --- | --- | --- | --- |
| Elevasi | Ya | DEMNAS, *mosaic* lalu potong ke batas TN plus *buffer* 2 km | meter, integer |
| Slope | Ya | QGIS *Raster → Analysis → Slope* dari DEM yang sudah UTM | derajat, integer |
| Aspect | Ya | QGIS *Raster → Analysis → Aspect* (0 = utara, searah jarum jam) | derajat, integer |
| Fuel model | Ya | Klasifikasi Sentinel-2 menjadi strata (4.2), lalu *reclassify* ke nomor .FMD (30, 31, 32, 33) dan non-burnable | kode integer |
| Canopy cover | Ya | Dari Sentinel-2 atau peta tutupan pohon; savana umumnya 0 sampai 10% | persen, integer |
| Canopy height (CH) | Tidak | Peta tinggi kanopi global; savana isi 0 | meter |
| Canopy base height (CBH) | Tidak | Data plot pohon; atau konstan | meter |
| Canopy bulk density (CBD) | Tidak | Literatur hutan kering tropis; atau konstan | kg/m³ |

### 4.2 Peta fuel model dari klasifikasi

1. Buat komposit Sentinel-2 median musim kemarau (Juli sampai September) dengan awan kurang dari 20%.
2. Hitung indeks NDVI, NBR, dan NDMI; gabungkan dengan elevasi dan slope sebagai variabel.
3. Pakai **plot lapangan sebagai titik latih**, ditambah titik interpretasi visual untuk hutan, air, permukiman, batuan, dan pasir/lahar.
4. Klasifikasi *Random Forest* (Google Earth Engine, atau QGIS plugin dzetsaka/SCP).
5. Uji akurasi dengan 30% titik yang disisihkan; targetkan *overall accuracy* di atas 80%.
6. *Reclassify* kelas ke kode: strata savana ke 30 sampai 33, hutan ke model standar TL/TU (misalnya 182 TL2 atau 161 TU1), air 98, permukiman 91, batuan dan lahar 99.

### 4.3 Menyelaraskan semua raster

Pakai DEM UTM sebagai acuan grid. Contoh perintah GDAL (jalan di OSGeo4W Shell atau terminal QGIS):

```
gdalwarp -t_srs EPSG:32750 -tr 10 10 -tap -r bilinear -te XMIN YMIN XMAX YMAX demnas.tif elev_10m.tif
gdalwarp -t_srs EPSG:32750 -tr 10 10 -tap -r near -te XMIN YMIN XMAX YMAX fuel_klas.tif fuel_10m.tif
gdal_translate -ot Int16 -a_nodata -9999 fuel_10m.tif fuel_final.tif
```

Pakai resampling **bilinear** untuk data kontinu (DEM, tutupan) dan **near** untuk data kategori (fuel model). Isi semua sel kosong; sel NoData di dalam area model membuat api berhenti di sana.

### 4.4 Cek sebelum masuk FlamMap

- Semua raster EPSG:32750, ukuran sel dan *extent* sama persis (cek di *Layer Properties → Information*).
- Fuel model hanya berisi kode yang ada di .FMD atau model standar.
- Slope dan aspect dalam derajat, bukan persen atau radian.
- Ekspor sebagai GeoTIFF (atau ASCII Grid .asc) satu file per layer.

## 5. Running di FlamMap 6.2

<div class="live" data-tahap="6. Running FlamMap"></div>

Urutan di bawah mengikuti tutorial resmi FlamMap 6.2; nama tombol bisa sedikit berbeda antarversi. Pastikan pilihan satuan (English atau Metric) di setiap dialog sesuai data, terutama kecepatan angin (mph atau km/jam).

### 5.1 Membuat lanskap

1. Buka FlamMap, pilih **Tools → Generate Landscape**.
2. Isi tiap layer dengan GeoTIFF dari tahap 4: Elevation (meter), Slope (degrees), Aspect (degrees), Fuel Model (custom), Canopy Cover (percent). Layer kanopi opsional boleh diisi konstan (misalnya CH 0, CBH 0, CBD 0 untuk savana).
3. Pilih *Fuel Model* dengan opsi kode kustom atau Scott & Burgan 40, sesuai kode yang dipakai.
4. Simpan sebagai `tambora.lcp` (atau GeoTIFF landscape).

### 5.2 Proyek dan run

1. **File → New Project**, lalu buka `tambora.lcp` sebagai landscape. Periksa tampilan setiap tema di panel kiri (*Tree*): fuel model harus menampilkan kode 30 sampai 33 dan non-burnable di tempat yang benar.
2. Buat run baru dari panel *Tree* (klik kanan pada landscape → *New Run*, atau salin run yang ada dengan *Copy...*).
3. Di dialog **Run**, tab **Inputs**:
    - **Fuel Moisture File**: muat `tambora.fms`.
    - **Custom Fuels File**: muat `tambora.fmd`.
    - **Winds**: pilih *Wind Direction*, isi kecepatan angin (ketinggian 20 ft) dan arah angin datang (derajat dari utara). Untuk musim kemarau Tambora mulai dari angin timur sampai tenggara (90 sampai 135°), lalu sesuaikan dengan data BMKG/ERA5.
    - Opsional: centang **WindNinja** (*gridded winds*) agar angin mengikuti bentuk lereng gunung. Sangat disarankan di Tambora.
    - Opsional: **Fuel Moisture Conditioning** dengan file .WXS 3 sampai 7 hari sebelum tanggal simulasi, supaya kadar air mati berbeda antara lereng utara dan selatan.
4. Tab **Fire Behavior Options**: pilih metode api tajuk (Finney 1998 atau Scott/Reinhardt 2001), kadar air daun (*foliar moisture*, misalnya 100%), lalu **Apply**.

### 5.3 Basic Fire Behavior (arah rambat per sel)

1. Di bagian output pilih: **Rate of Spread**, **Flame Length**, **Fireline Intensity**, **Max Spread Direction**, dan *Spread Vectors* bila tersedia.
2. Klik **Launch** untuk menjalankan.
3. Hasil Max Spread Direction adalah arah rambat tercepat di setiap sel. Periksa satuannya di legenda atau header: bila nilai maksimum sekitar 6,28, satuannya radian; bila sampai 360, derajat dari utara.
4. Ekspor setiap output ke GeoTIFF/ASCII (klik kanan output → *Export*) untuk dianalisis di QGIS.

### 5.4 Minimum Travel Time (jalur rambat dari titik api)

1. Siapkan shapefile titik penyulutan (misalnya hotspot FIRMS pertama dari kejadian Resort Piong, atau titik dari laporan petugas), proyeksi EPSG:32750.
2. Tab **Minimum Travel Time**: di *Ignitions* pilih **From File → Ignitions File**, muat shapefile tadi.
3. Isi *Resolution of Calculations* (sama dengan ukuran sel, 10 m), *Maximum Simulation Time* (misalnya 480 menit), dan *Spot Probability* (misalnya 0,1 untuk savana berangin).
4. **Apply → Launch**. Output: *Arrival Time*, *Major Paths* (jalur rambat utama, ini yang paling langsung menunjukkan arah rambatan), *Rate of Spread*, dan perimeter per waktu.

### 5.5 Skenario

Jalankan minimal tiga skenario cuaca: angin rata-rata kemarau, angin kuat (persentil 90), dan kadar air 1-hr sangat rendah (3 sampai 4%). Untuk peta lokasi rawan, ulangi MTT dengan **Random Ignitions** (1.000 sampai 10.000 titik) sebagai analisis *Burn Probability*.

## 6. Validasi dan kalibrasi

<div class="live" data-tahap="7. Validasi"></div>

Model dianggap layak bila perimeter dan arah rambat simulasi cocok dengan kebakaran nyata yang tidak dipakai untuk kalibrasi.

1. **Perimeter**: buat peta area terbakar Sentinel-2 dNBR (citra sebelum dan sesudah kejadian, ambang dNBR sekitar 0,27 atau dicek lapangan). Bandingkan dengan perimeter MTT pada waktu yang sama memakai indeks Jaccard atau Sørensen. Nilai di atas 0,5 untuk savana sudah tergolong baik.
2. **Arah**: hitung arah sumbu panjang area terbakar (atau arah urutan hotspot VIIRS dari waktu ke waktu), lalu bandingkan dengan arah *Major Paths* dan Max Spread Direction. Selisih kurang dari 30° menunjukkan arah sudah tertangkap.
3. **Laju**: bandingkan jarak hotspot pertama dan terakhir dibagi selang waktunya dengan laju rambat simulasi.
4. Bila meleset, kembali ke 3.5 (kalibrasi fuel model) atau perbaiki input angin (WindNinja, arah dominan). Ulangi sampai stabil, lalu uji pada kejadian kedua.

## 7. Checklist keluaran

- Tabel plot lapangan (CSV dengan koordinat) dan ringkasan per strata
- `tambora.fmd` (custom fuel model) dan `tambora.fms` (kadar air)
- Raster selaras: elevasi, slope, aspect, fuel model, canopy cover (EPSG:32750, 10 m)
- `tambora.lcp` dari Generate Landscape
- Shapefile titik penyulutan dan file angin atau .WXS per skenario
- Output Basic Fire Behavior dan MTT (GeoTIFF) per skenario
- Peta dNBR dan tabel uji akurasi (Jaccard, selisih arah, laju)
- Catatan kalibrasi: parameter yang diubah dan alasannya

## Sumber

- [Custom Fuel Model File (.FMD), FlamMap 6.2 Help](https://owfflammaphelp62.firenet.gov/FileTypes/PU_Custom_Fuel_Model_File.htm)
- [Initial Fuel Moistures (.FMS), FlamMap 6.2 Help](https://owfflammaphelp62.firenet.gov/FileTypes/PU_Initial_Fuel_Moistures.htm)
- [Data Requirements, FlamMap 6.2 Help](https://owfflammaphelp62.firenet.gov/FileTypes/ug3_Data_Requirements.htm)
- [Lesson 4: Minimum Travel Time, FlamMap 6.2 Tutorial](https://owfflammaphelp62.firenet.gov/Tutorial/TU_MTT.htm)
- Scott, J.H. & Burgan, R.E. (2005). *Standard Fire Behavior Fuel Models*. USDA RMRS-GTR-153.
- Brown, J.K. (1974). *Handbook for Inventorying Downed Woody Material*. USDA INT-GTR-16.
- Van Wagner, C.E. (1968). The line intersect method in forest fuel sampling. *Forest Science* 14: 20–26.
