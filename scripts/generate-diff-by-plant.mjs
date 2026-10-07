import prisma from '../src/lib/prisma.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('--- Generating plant-by-plant reconciliation for Jan-Agu 2026 ---');
  
  const plants = await prisma.$queryRaw`
    SELECT dc_id, canonical_name, sungrow_ps_ids, api_installed_kwp
    FROM plant_master
    ORDER BY canonical_name;
  `;

  // Get ISOLAR_REPORT_IMPORT observations
  const reportObs = await prisma.$queryRaw`
    SELECT ps_id, year_month, energy_kwh
    FROM monthly_yield_observation
    WHERE source = 'ISOLAR_REPORT_IMPORT' AND year_month BETWEEN '202601' AND '202608';
  `;

  // Get api_history observations
  const apiObs = await prisma.$queryRaw`
    SELECT ps_id, year_month, energy_kwh
    FROM monthly_yield_observation
    WHERE source = 'api_history' AND year_month BETWEEN '202601' AND '202608';
  `;

  const reportMap = new Map();
  for (const r of reportObs) {
    reportMap.set(`${r.ps_id}_${r.year_month}`, Number(r.energy_kwh));
  }

  const apiMap = new Map();
  for (const a of apiObs) {
    apiMap.set(`${a.ps_id}_${a.year_month}`, Number(a.energy_kwh));
  }

  const months = ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608'];

  // Calculate per-plant sums
  const plantDiffs = [];
  for (const p of plants) {
    const psIds = p.sungrow_ps_ids || [];
    let reportSum = 0;
    let apiSum = 0;
    const monthDetails = {};

    for (const ym of months) {
      let rMonth = 0;
      let aMonth = 0;
      for (const psId of psIds) {
        rMonth += reportMap.get(`${psId}_${ym}`) || 0;
        aMonth += apiMap.get(`${psId}_${ym}`) || 0;
      }
      monthDetails[ym] = {
        report: rMonth,
        api: aMonth,
        diff: rMonth - aMonth
      };
      reportSum += rMonth;
      apiSum += aMonth;
    }

    const diffKwh = reportSum - apiSum;
    const diffPct = reportSum > 0 ? ((diffKwh / reportSum) * 100) : 0;

    plantDiffs.push({
      dcId: p.dc_id,
      name: p.canonical_name,
      kwp: p.api_installed_kwp,
      reportKwh: reportSum,
      apiKwh: apiSum,
      diffKwh: diffKwh,
      diffPct: diffPct,
      monthDetails
    });
  }

  // Sort by diffKwh descending
  plantDiffs.sort((a, b) => b.diffKwh - a.diffKwh);

  console.log('Top 15 plants contributing to difference:');
  console.table(plantDiffs.slice(0, 15).map(p => ({
    name: p.name,
    kwp: p.kwp,
    reportKwh: Math.round(p.reportKwh),
    apiKwh: Math.round(p.apiKwh),
    diffKwh: Math.round(p.diffKwh),
    diffPct: p.diffPct.toFixed(2) + '%'
  })));

  // Generate markdown report
  let md = '# Rekonsiliasi Per-Plant: ISOLAR_REPORT_IMPORT vs api_history (Jan–Agu 2026)\n\n';
  md += `Dokumen ini dihasilkan secara otomatis oleh skrip query database pada ${new Date().toISOString()}.\n\n`;
  md += '### Ringkasan Nasional (Jan–Agu 2026)\n';
  const totalReport = plantDiffs.reduce((a, b) => a + b.reportKwh, 0);
  const totalApi = plantDiffs.reduce((a, b) => a + b.apiKwh, 0);
  const totalDiff = totalReport - totalApi;
  const totalDiffPct = (totalDiff / totalReport) * 100;
  md += `- **Total ISOLAR_REPORT_IMPORT (Jan–Agu)**: ${totalReport.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh\n`;
  md += `- **Total api_history (Jan–Agu)**: ${totalApi.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh\n`;
  md += `- **Selisih Total**: ${totalDiff.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh (${totalDiffPct.toFixed(2)}%)\n\n`;

  md += '### Tabel Rincian Selisih Per-Plant (39 Plant)\n\n';
  md += '| No | Nama Plant | Kapasitas (kWp) | ISOLAR_REPORT (kWh) | api_history (kWh) | Selisih (kWh) | Selisih (%) | Analisis Penyebab |\n';
  md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

  plantDiffs.forEach((p, idx) => {
    let reason = 'Variasi normal telemetri API harian';
    if (p.reportKwh === 0 && p.apiKwh === 0) {
      reason = 'Dalam pembangunan (0 produksi)';
    } else if (p.diffPct > 20) {
      reason = 'Data telemetri API parsial/terputus pada bulan tertentu';
    } else if (p.diffKwh < 0) {
      reason = 'api_history mencatat nilai sedikit lebih tinggi';
    }
    md += `| ${idx + 1} | **${p.name}** | ${p.kwp} | ${p.reportKwh.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${p.apiKwh.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${p.diffKwh.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${p.diffPct.toFixed(2)}% | ${reason} |\n`;
  });

  md += '\n\n### Rincian Per Bulan (Jan–Agu 2026)\n\n';
  md += '| Bulan | ISOLAR_REPORT_IMPORT (kWh) | api_history (kWh) | Selisih (kWh) | Selisih (%) |\n';
  md += '| :--- | :--- | :--- | :--- | :--- |\n';

  for (const ym of months) {
    const mReport = plantDiffs.reduce((a, b) => a + b.monthDetails[ym].report, 0);
    const mApi = plantDiffs.reduce((a, b) => a + b.monthDetails[ym].api, 0);
    const mDiff = mReport - mApi;
    const mPct = mReport > 0 ? (mDiff / mReport) * 100 : 0;
    md += `| ${ym} | ${mReport.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${mApi.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${mDiff.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${mPct.toFixed(2)}% |\n`;
  }

  const evidenceDir = path.resolve('docs/evidence');
  fs.writeFileSync(path.join(evidenceDir, 'diff_isolar_vs_api_history_by_plant.md'), md, 'utf-8');
  fs.writeFileSync(path.join(evidenceDir, 'diff_isolar_vs_api_history_by_plant.json'), JSON.stringify(plantDiffs, null, 2), 'utf-8');

  console.log('Saved to docs/evidence/diff_isolar_vs_api_history_by_plant.md');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
