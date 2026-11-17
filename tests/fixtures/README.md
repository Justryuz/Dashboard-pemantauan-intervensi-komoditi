# Fixture ujian banjir dan kualiti udara

Dipotong daripada respons sebenar yang diambil pada 2026-11-17 (GET sahaja, tanpa kunci atau token). Tiada rahsia.

| Fail                          | Asal                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `jps-nasional.json`           | 26 rekod sebenar daripada `latestreadingstrendabc.json` (JPS Public Info Banjir), bacaan sekitar 11:45 MYT. |
| `jps-selangor-telemetry.json` | 6 rekod sebenar daripada JPSAPI `LatestAlert/Telemetry`, bacaan 14:45-15:00 MYT.                            |
| `getdisse-sintetik.json`      | Sintetik. `getdisse.php` sentiasa `[]` semasa diuji; medan `MessageDT/EstimatedDT/EstimatedEndDT` tersirat. |
| `arcgis-banjir2024.json`      | 10 ciri sebenar `BANJIR_2024` (ArcGIS Selangor); 3 ciri disunting supaya lat/lon rentetan dengan ruang/tab. |
| `ipu-peta.json`               | 15 stesen sebenar lapisan peta JAS MyEQMS; `CA33J` dan `CA44T` disunting kepada `API: null`.                |
| `ipu-jam.json`                | Baris `apitablehourly` (24 jam) bagi stesen yang sama, tanpa medan `PAGE_*`.                                |

Rekod `jps-nasional.json` yang disunting (bukan sebenar sepenuhnya):

- `BTU10_LAPUK`: bacaan paras air dilapukkan (06:00) dengan hujan segar.
- `3016002_LEBAT`: kategori hujan `Heavy` (65 mm hari ini).

Masa rujukan (`sekarang`) untuk ujian unit: nasional `2026-11-17T04:30:00Z`, Selangor `2026-11-17T07:10:00Z`, IPU `2026-11-17T06:30:00Z`.
