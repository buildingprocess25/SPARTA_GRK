/**
 * Rule-based (non-AI) savings suggestions for the GRK calculator's
 * Rekapitulasi tab. Deliberately NOT an LLM call: every number quoted here
 * comes straight from summarizeEntries()'s own output, so a suggestion can
 * never misstate the calculator's own figures - only the sentence wrapping
 * around them is templated. This matters because the calculator is an
 * emissions-reporting tool; a hallucinated number here would undermine the
 * one thing the tool has to be trustworthy about.
 */

const ADDITION_TEMPLATES = {
  scope1a: (shareLabel) => `Genset & mesin bakar statis menyumbang ${shareLabel} dari total penambah emisi. Cek jadwal maintenance, efisiensi bahan bakar, dan jam operasional genset: area ini biasanya penghematan termudah untuk ditindaklanjuti.`,
  scope1b: (shareLabel) => `Kendaraan operasional menyumbang ${shareLabel} dari total penambah. Pertimbangkan optimasi rute pengiriman, pelatihan eco-driving untuk pengemudi, atau migrasi bertahap ke kendaraan listrik.`,
  scope2: (shareLabel) => `Listrik dari PLN menyumbang ${shareLabel} dari total penambah. Evaluasi efisiensi pemakaian (setpoint AC, pencahayaan LED), dan tingkatkan porsi pemakaian sendiri dari PLTS atap untuk mengurangi ketergantungan ke grid.`,
  travel: (shareLabel) => `Perjalanan dinas menyumbang ${shareLabel} dari total penambah. Pertimbangkan video call untuk rapat yang tidak wajib hadir fisik, atau konsolidasi beberapa perjalanan jadi satu trip.`,
  financed: (shareLabel) => `Emisi yang dibiayai menyumbang ${shareLabel} dari total penambah. Tinjau arah portofolio pembiayaan/investasi ke proyek dengan profil emisi lebih rendah.`,
};

const REDUCTION_TEMPLATES = {
  offset: (shareLabel) => `Carbon offset menyumbang ${shareLabel} dari total pengurangan. Pastikan sertifikat yang dipakai kredibel dan terverifikasi oleh standar yang diakui.`,
  ev: (shareLabel) => `Kendaraan listrik menyumbang ${shareLabel} dari total pengurangan. Ada peluang memperluas elektrifikasi ke bagian armada yang lain untuk pengurangan lebih besar.`,
  renewable: (shareLabel) => `PLTS/energi terbarukan menyumbang ${shareLabel} dari total pengurangan. Cek halaman PLTS Atap untuk plant yang offline/underperform: menaikkan utilisasi plant yang sudah ada seringkali lebih murah daripada menambah kapasitas baru.`,
  kkb: (shareLabel) => `Kredit kendaraan listrik menyumbang ${shareLabel} dari total pengurangan. Pertimbangkan memperluas skema pembiayaan ini ke segmen lain.`,
  green_security: (shareLabel) => `Surat berharga hijau menyumbang ${shareLabel} dari total pengurangan. Tinjau apakah porsi ini masih bisa ditingkatkan dalam portofolio pembiayaan.`,
};

function formatSharePct(sharePct) {
  if (sharePct === null || sharePct === undefined || !Number.isFinite(sharePct)) return null;
  return `${sharePct.toFixed(1)}%`;
}

/**
 * @param {ReturnType<typeof import('./engine.js').summarizeEntries>} summary
 * @param {Array<{id: string, kind: 'addition'|'reduction', title: string}>} categories
 * @returns {{ headline: string, headlineTone: 'positive'|'neutral'|'warning', items: Array<{id: string, kind: 'addition'|'reduction', text: string}> }}
 */
export function generateGrkSuggestions(summary, categories) {
  const byCategory = summary?.byCategory || {};
  const categoryKind = Object.fromEntries(categories.map((category) => [category.id, category.kind]));

  const rankedAdditions = Object.entries(byCategory)
    .filter(([id]) => categoryKind[id] === 'addition')
    .sort((a, b) => b[1].kgCo2e - a[1].kgCo2e);
  const rankedReductions = Object.entries(byCategory)
    .filter(([id]) => categoryKind[id] === 'reduction')
    .sort((a, b) => b[1].kgCo2e - a[1].kgCo2e);

  const items = [];

  for (const [categoryId, stats] of rankedAdditions.slice(0, 2)) {
    const template = ADDITION_TEMPLATES[categoryId];
    const shareLabel = formatSharePct(stats.sharePct);
    if (!template || !shareLabel) continue;
    items.push({ id: categoryId, kind: 'addition', text: template(shareLabel) });
  }

  for (const [categoryId, stats] of rankedReductions.slice(0, 2)) {
    const template = REDUCTION_TEMPLATES[categoryId];
    const shareLabel = formatSharePct(stats.sharePct);
    if (!template || !shareLabel) continue;
    items.push({ id: categoryId, kind: 'reduction', text: template(shareLabel) });
  }

  let headline;
  let headlineTone;
  if (summary?.totalAdditionKg <= 0) {
    headline = 'Belum ada entri penambah emisi untuk dianalisis. Isi minimal satu entri Scope 1/2/3 agar saran bisa dihitung.';
    headlineTone = 'neutral';
  } else if (summary.reductionPct === null || summary.reductionPct < 20) {
    const pctLabel = summary.reductionPct === null ? '0%' : `${summary.reductionPct.toFixed(1)}%`;
    headline = `Pengurangan emisi baru menutup ${pctLabel} dari total penambah. Fokuskan upaya ke kategori penambah terbesar di bawah dulu sebelum menambah skema pengurangan baru.`;
    headlineTone = 'warning';
  } else if (summary.reductionPct < 50) {
    headline = `Pengurangan emisi sudah menutup ${summary.reductionPct.toFixed(1)}% dari total penambah: ada kemajuan, masih ada ruang untuk ditingkatkan.`;
    headlineTone = 'neutral';
  } else {
    headline = `Pengurangan emisi sudah menutup ${summary.reductionPct.toFixed(1)}% dari total penambah: performa yang baik, pertahankan dan cari peluang tambahan di kategori terbesar berikut.`;
    headlineTone = 'positive';
  }

  return { headline, headlineTone, items };
}
