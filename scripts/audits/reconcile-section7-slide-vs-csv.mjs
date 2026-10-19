async function main() {
  console.log('=== REKONSILIASI BAGIAN 7: SLIDE RESMI VS CSV PORTAL ===\n');

  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus'];
  const slideMwh = [479.0, 455.0, 584.0, 583.0, 529.0, 533.0, 549.0, 583.0];
  const csvMwh = [472.3318, 448.7813, 571.1603, 574.3144, 519.2931, 526.0447, 540.3874, 569.1974];

  console.log('| Bulan | Slide Resmi (MWh) | CSV Portal (MWh) | Selisih (MWh) | Rasio (Slide / CSV) | Selisih (%) |');
  console.log('|---|---|---|---|---|---|');

  let totalSlide = 0;
  let totalCsv = 0;

  for (let i = 0; i < months.length; i++) {
    const s = slideMwh[i];
    const c = csvMwh[i];
    const diff = s - c;
    const ratio = s / c;
    const diffPct = (diff / c) * 100;
    totalSlide += s;
    totalCsv += c;

    console.log(`| ${months[i]} | ${s.toFixed(1)} | ${c.toFixed(1)} | ${diff > 0 ? '+' : ''}${diff.toFixed(2)} | ${ratio.toFixed(4)} | ${diffPct > 0 ? '+' : ''}${diffPct.toFixed(2)}% |`);
  }

  const totalDiff = totalSlide - totalCsv;
  const totalRatio = totalSlide / totalCsv;
  const totalDiffPct = (totalDiff / totalCsv) * 100;

  console.log('|---|---|---|---|---|---|');
  console.log(`| **TOTAL (Jan–Agu)** | **${totalSlide.toFixed(1)}** | **${totalCsv.toFixed(1)}** | **+${totalDiff.toFixed(2)}** | **${totalRatio.toFixed(4)}** | **+${totalDiffPct.toFixed(2)}%** |`);

  console.log('\n--- PERTANYAAN TERBUKA UNTUK PENYUSUN LAPORAN ---');
  console.log('1. Apakah angka pada Slide Resmi (4.295 MWh) mencakup estimasi produksi dari plant yang belum terhubung telemetry (misalnya Gorontalo) atau menggunakan angka pembulatan/RKAP target?');
  console.log('2. Apakah terdapat koreksi/loss multiplier faktor transmisi/inverter internal korporat yang diaplikasikan pada angka yield portal sebelum dimasukkan ke slide presentasi manajemen?');
  console.log('3. Tanggal berapakah data pada slide resmi ditarik dari portal iSolarCloud (apakah ada perbedaan cut-off penarikan laporan)?');
}

main();
