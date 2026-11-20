# Simulasi CAT SKD CPNS

Aplikasi latihan **Computer Assisted Test (CAT) Seleksi Kompetensi Dasar (SKD) CPNS** — TWK, TIU, dan TKP — dengan tampilan
peserta meniru CAT BKN. Dibangun di atas mesin CBT sebelumnya (GitHub Pages + Google Apps Script + Google Sheets; Mode Lokal bila `config.js` kosong).

> Aplikasi ini **simulasi latihan**, bukan aplikasi resmi BKN. Logo CAT BKN dipakai sebagai identitas visual simulasi. Sertifikat yang dihasilkan
> bertuliskan "hasil simulasi latihan" dan bukan dokumen resmi.

## Memasang / memperbarui
1. **Apps Script:** ganti isi `Code.gs`, lalu *Deploy › Manage deployments › New version*. Kolom baru dibuat otomatis:
   `Ujian.ambang_json` dan `Sesi.skor_json` (sheet lama tetap utuh).
2. **GitHub:** unggah semua isi folder ini **kecuali `config.js`** (berkas itu berisi alamat Apps Script Anda; jangan ditimpa dengan yang kosong).
   Berkas yang dibutuhkan: `index.html`, `app.js`, `skd.js`, `skd.css`, `style.css`, `manifest.json`, `icons/`, `vendor/`.
   Berkas lama `anbk.js`, `anbk.css`, `survei.js`, `survei.css`, dan template survei `.docx` **tidak dipakai lagi**; hapus dari repo.
3. Tekan Ctrl+F5. Di HP, hapus lalu instal ulang aplikasi agar nama dan ikon baru terbaca.

## Penilaian & ambang batas (aturan SKD CPNS)
| Subtes | Soal (resmi) | Skor | Maks | Ambang batas (formasi umum) |
|---|---|---|---|---|
| TWK | 30 | benar 5, salah/kosong 0 | 150 | 65 |
| TIU | 35 | benar 5, salah/kosong 0 | 175 | 80 |
| TKP | 45 | tiap opsi 1–5, kosong 0 | 225 | 166 |
| **Total** | **110** | | **550** | **311** |

* Lulus = **semua** ambang batas terpenuhi (TWK, TIU, TKP, dan total). Durasi resmi 100 menit.
* **Formasi khusus** tersedia sebagai preset di form ujian (hanya TIU minimum + total): Disabilitas/Papua (TIU 60, total 286),
  Cumlaude/Diaspora (TIU 85, total 311), Dokter (TIU 80, total 311), ABK/Rescuer/Pengamat Gunung Api (TIU 70, total 286).
  Semua angka bisa diubah per ujian bila ada keputusan MenPAN-RB yang baru.
* Jumlah soal per subtes tidak dikunci (default 30/35/45, bisa diubah). Urutan di layar peserta selalu **TWK → TIU → TKP**; acak soal hanya di dalam tiap subtes.
* Ujian lama tanpa `ambang_json` tetap memakai nilai persen (kompatibel).

## Alur peserta (mirip CAT BKN)
Login (username, password) → **Daftar Simulasi** → **Info Simulasi** (materi, durasi, passing grade, perhatian penting, input token) →
konfirmasi → **Ujian** (navigasi nomor merah/hijau/kuning, "Simpan dan Lanjutkan", "Lewatkan", "Ragu-ragu", ukuran font) →
**Hasil**: skor TWK/TIU/TKP + ambang batas, skor total, status memenuhi/belum, **analisis materi**, grafik perkembangan,
detail jawaban + pembahasan, dan **Unduh Sertifikat**. **Dashboard** peserta: riwayat simulasi, grafik garis naik/turun, analisis materi gabungan.
Token ujian dan **token per kelas** (aktif/nonaktif per kelas) tetap berlaku.

## Portal guru
Dashboard (grafik garis rata-rata TWK/TIU/TKP/Total per simulasi), Bank Soal, Kelola Ujian, **Pemantauan Peserta**, Rekap Nilai
(TWK/TIU/TKP/Total berwarna terhadap ambang batas + tombol **🎓 Sertifikat**), Analisis Soal, Log Pelanggaran, Data Siswa
(**Cetak Kartu Peserta** gaya kartu peserta CASN: logo, barcode, foto 3×4, QR, PIN), **Analisis Materi** (materi yang kurang per peserta + ringkasan kelas), Pengaturan.

## Format soal & template
* **Kategori** di Bank Soal diberi nama **TWK**, **TIU**, **TKP** (boleh memuat kata itu, mis. "Soal TIU"). **Sub-kategori** = paket/try out. **Topik** = materi (dipakai analisis materi).
* Template Word/Excel (menu Kelola Soal › Unduh Template) memakai kolom: Kategori, Topik, Tipe, Pertanyaan, Gambar, Opsi A–E, Kunci, Bobot, Kesulitan, Pembahasan.
  * **Tipe PG** (TWK/TIU): Kunci satu huruf.
  * **Tipe TKP**: kolom Kunci = skor tiap opsi berurutan A..E, mis. `5,4,3,2,1`.
  * **Tipe Kecukupan** (soal Kecukupan Data TIU): lima pilihan baku terisi otomatis; isi Pertanyaan (+ PERNYATAAN 1 & 2) dan Kunci A–E.
  * **Soal bertabel** (Pola Bilangan, tabel X–Y, dll.): pada Word, buat/tempel **tabel di dalam sel Pertanyaan**; tabel ikut terbaca dan tampil di layar peserta. Gambar boleh di kolom Gambar.
* `Contoh_Soal_SKD_Format_CBT.docx` berisi 11 soal contoh (3 TWK, 5 TIU termasuk 2 Kecukupan Data bertabel, 3 TKP) yang siap diimpor untuk uji coba.
* Soal tipe lain (checkbox, jodohkan, dll.) tidak lagi ditawarkan di tab Kelola Soal; data lama tidak dihapus.

## Rumus matematika
Rumus tampil rapi (KaTeX, dibundel lokal di `vendor/katex/` sehingga tetap jalan walau CDN lambat) di layar ujian, pratinjau, detail jawaban, dan pembahasan.
* **Word (.docx):** cukup *Insert › Equation*; otomatis dikonversi saat impor.
* **Excel (.xlsx) / ketik manual:** apit rumus dengan `$ ... $` (LaTeX), mis. `$\frac{1}{2}$`, `$x^{2}$`, `$\sqrt{49}$`. Rumus besar di baris sendiri: `$$ ... $$`.
  Template Excel punya sheet kedua **"Petunjuk Rumus"** berisi contoh siap salin. Tanda `<` dan `>` di dalam rumus aman dipakai.
* **Form Tambah Soal:** tombol **RUMUS Σ** membuka kotak rumus dengan pratinjau langsung dan tombol simbol (pecahan, pangkat, akar, ≤ ≥ ≠, π, ∑, ∫, log, dst). Klik 2× pada rumus di kotak editor untuk mengubahnya.
* Pemasangan: unggah juga folder `vendor/` ke GitHub.

## Keterangan jumlah soal (TWK/TIU/TKP) pada ujian
* Di form ujian muncul panel **Diminta / Tersedia / Terpilih** per subtes, merah bila soal di Bank Soal kurang dari jumlah yang diminta.
* Saat **Simpan Ujian** dengan jumlah soal kurang, muncul konfirmasi (*Tetap Simpan* / *Kembali & Perbaiki*).
* Jumlah yang diminta ikut tersimpan di `ambang_json` (tanpa perubahan kolom/`Code.gs`), sehingga **Kelola Ujian** punya kolom **Komposisi Soal** (mis. `TIU 30 / 35 — kurang 5`), termasuk menandai soal yang sudah dihapus dari Bank Soal.
* Ujian lama (belum menyimpan jumlah yang diminta) cukup dibuka lewat **Ubah** lalu **Simpan** sekali.

## Dihapus dari versi sebelumnya
Seluruh fitur survei (Survei Karakter/Sulingjar) dan identitas ANBK/TKA/sekolah. Sheet `Survei`/`PaketSurvei` lama tidak dipakai lagi (boleh dihapus manual).

## Catatan pengujian
Logika penilaian, alur peserta, impor Word (termasuk tabel bersarang, TKP, Kecukupan Data), hasil, dashboard, sertifikat, kartu, dan analisis materi
diuji otomatis pada Mode Lokal (jsdom) dan aksi server diuji dengan sheet tiruan. Tampilan visual belum dibandingkan piksel-demi-piksel dengan CAT BKN di browser nyata.
