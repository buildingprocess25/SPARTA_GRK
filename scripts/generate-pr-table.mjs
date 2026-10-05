import fs from 'fs';
import path from 'path';

function parseCsv(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  // line 0 is Monthly Report_Year_2026
  // line 1 is header
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 8) continue;
    rows.push({
      plantName: parts[0]?.trim(),
      time: parts[1]?.trim(), // e.g. 2026-01
      installedKwp: parts[2] ? parseFloat(parts[2]) : null,
      monthlyYieldKwh: parts[3] ? parseFloat(parts[3]) : null,
      officialPrPct: parts[7] ? parseFloat(parts[7]) : null,
      monthlyIrradWhM2: parts[8] ? parseFloat(parts[8]) : null,
    });
  }
  return rows;
}

async function main() {
  console.log('=== GENERATING PR RECONCILIATION TABLE (JAN - SEP 2026) ===');
  const csvPath = path.resolve(process.cwd(), 'Monthly Report_Annual report_20261001111530.csv');
  const rawRows = parseCsv(csvPath);

  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const plantMap = {};

  rawRows.forEach(r => {
    if (!months.includes(r.time)) return;
    if (!plantMap[r.plantName]) {
      plantMap[r.plantName] = {
        plantName: r.plantName,
        installedKwp: r.installedKwp,
        records: {}
      };
    }
    const irradKwhM2 = r.monthlyIrradWhM2 !== null && r.monthlyIrradWhM2 !== undefined ? Number((r.monthlyIrradWhM2 / 1000).toFixed(2)) : null;
    let calculatedPr = null;
    if (r.monthlyYieldKwh !== null && r.installedKwp !== null && r.installedKwp > 0 && irradKwhM2 !== null && irradKwhM2 > 0) {
      calculatedPr = Number(((r.monthlyYieldKwh / (r.installedKwp * irradKwhM2)) * 100).toFixed(2));
    }
    const officialPr = r.officialPrPct;
    const diff = (calculatedPr !== null && officialPr !== null) ? Number((calculatedPr - officialPr).toFixed(2)) : null;

    let irradSource = 'Meteo Sensor / Pyranometer';
    if (r.plantName.includes('Cilacap 2') || r.plantName.includes('Cilacap 3')) {
      irradSource = 'Dipinjam dari Cilacap 1 (Co-located)';
    } else if (r.plantName.includes('Lombok A')) {
      irradSource = 'Dipinjam dari Lombok B (Co-located)';
    } else if (irradKwhM2 === null || irradKwhM2 === 0) {
      irradSource = 'Sensor Offline / Tidak Ada Sensor';
    }

    plantMap[r.plantName].records[r.time] = {
      month: r.time,
      yieldKwh: r.monthlyYieldKwh,
      irradKwhM2,
      irradSource,
      calculatedPr,
      officialPr,
      diff
    };
  });

  const evidenceDir = path.resolve(process.cwd(), 'docs/evidence');
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  const jsonPath = path.join(evidenceDir, 'pr_reconciliation_jan_sep.json');
  fs.writeFileSync(jsonPath, JSON.stringify(plantMap, null, 2), 'utf8');
  console.log(`Saved JSON to ${jsonPath}`);

  // Generate Markdown report
  let md = `# Tabel Rekonsiliasi PR per Plant (Jan - Sep 2026)\n\n`;
  md += `**Sumber Data Resmi:** \`Monthly Report_Annual report_20261001111530.csv\` (iSolarCloud Portal Export)\n\n`;
  md += `### Formula Perhitungan PR:\n`;
  md += `$$\\text{PR Hitung (\\%)} = \\frac{\\text{Yield (kWh)}}{\\text{Kapasitas Terpasang (kWp)} \\times \\text{Iradiasi (kWh/m}^2\\text{)}} \\times 100$$\n\n`;
  md += `| Nama Plant | Kapasitas (kWp) | Bulan | Yield (kWh) | Iradiasi (kWh/m²) | Sumber Iradiasi | PR Hitung (%) | PR Resmi CSV (%) | Selisih (pt) |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  Object.values(plantMap).sort((a,b) => a.plantName.localeCompare(b.plantName)).forEach(p => {
    months.forEach(m => {
      const rec = p.records[m];
      if (!rec) return;
      const yieldStr = rec.yieldKwh !== null ? rec.yieldKwh.toLocaleString('id-ID', { minimumFractionDigits: 1 }) : '—';
      const irradStr = rec.irradKwhM2 !== null ? rec.irradKwhM2.toFixed(2) : '—';
      const calcPrStr = rec.calculatedPr !== null ? `${rec.calculatedPr.toFixed(2)}%` : '—';
      const offPrStr = rec.officialPr !== null ? `${rec.officialPr.toFixed(2)}%` : '—';
      const diffStr = rec.diff !== null ? `${rec.diff > 0 ? '+' : ''}${rec.diff.toFixed(2)}%` : '—';
      md += `| ${p.plantName} | ${p.installedKwp} | ${m} | ${yieldStr} | ${irradStr} | ${rec.irradSource} | ${calcPrStr} | ${offPrStr} | ${diffStr} |\n`;
    });
  });

  const mdPath = path.join(evidenceDir, 'pr_reconciliation_jan_sep.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`Saved Markdown to ${mdPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
