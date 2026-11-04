# Portfolio — Renaissance Ricarda Sugiarto Putra

Portofolio pribadi dengan tema gelap. Halaman dibuka dengan kotak RR. Saat kotak disorot, kursor agen keluar, dan saat diklik pengunjung masuk. Di dalam, dua kru kursor menunggu rapi di sekitar kursor utama: kru scale menarik bingkai ukuran setiap layer, lalu kru pengetik mengisi kata di dalamnya.

## Isi halaman
- **Hero**: pernyataan singkat, unduh CV, dan empat fakta yang tertaut ke buktinya.
- **Proyek**: A.R.O.N.A dan Juara 1 Web Technologies Competition.
- **Keahlian**: Cyber Security & OSINT, Software & AI Engineering, Full-Stack Web, QA & Toolchain.
- **Pengalaman**, **Sertifikat**, **Tentang**, dan **Kontak** dengan formulir.

## Teknologi
HTML, CSS, dan JavaScript murni tanpa library dan tanpa build step.

| File | Fungsi |
| --- | --- |
| `js/build.js` | Mesin agen: layar RR, kursor, bangun dan hapus layer, keluar |
| `js/device.js` | Monitor 3D dengan WebGL murni, layarnya boot sampai terminal |
| `js/i18n.js` | Teks bahasa Inggris dan teks dinamis |
| `js/main.js` | Bahasa, menu, dan formulir kontak |

## Mengubah konten
Teks bahasa Indonesia ada di `index.html`, terjemahan Inggrisnya ada di `js/i18n.js` dengan kunci `data-i18n` yang sama.

Elemen yang ingin ikut dibangun agen diberi atribut `data-b` dengan nilai `text`, `box`, `line`, atau `pop`, di dalam elemen ber-`data-unit`. Satu `data-unit` adalah satu tema, dan kursor yang mengerjakannya memakai satu warna.

## Formulir kontak
Isi nilai `web3FormsKey` di `index.html` dengan access key dari Web3Forms. Selama masih `YOUR_ACCESS_KEY_HERE`, formulir membuka aplikasi email pengunjung.

## Easter egg
Di perangkat dengan mouse, terminal di monitor bisa diklik lalu diketik. Perintahnya ada di objek `COMMANDS` dalam `js/device.js`. Coba `help`.

Portofolio lama bertema dossier ada di folder `dossier/`. Tidak ada tautan ke sana dari situs, jadi pengunjung membukanya lewat perintah `dossier` di terminal. Halamannya ditandai `noindex` supaya tidak muncul di mesin pencari.

## Saat mengubah CSS atau JS
Ganti nilai `?v=` pada tautan `css/style.css` dan semua `js/*.js` di `index.html`, misalnya `?v=20261105a`. GitHub Pages mengizinkan browser menyimpan file selama 10 menit. Tanpa nomor baru, pengunjung bisa mendapat HTML baru dengan CSS lama, dan halaman tampil berantakan.

## Menjalankan di komputer
```bash
python -m http.server 4173
```

---
© 2026 Renaissance Ricarda Sugiarto Putra. All rights reserved.
