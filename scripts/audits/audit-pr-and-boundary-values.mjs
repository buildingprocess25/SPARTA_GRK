import fs from 'node:fs';
import path from 'node:path';

function parseCsv(filename) {
  const content = fs.readFileSync(filename, 'utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Line 0: Title, Line 1: Header
  const header = lines[1].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 3) continue;
    rows.push({
      plantName: cols[0],
      time: cols[1], // e.g. "2026-01"
      kwp: cols[2] ? Number(cols[2]) : null,
      yieldKwh: cols[3] ? Number(cols[3]) : null,
      loadKwh: cols[4] ? Number(cols[4]) : null,
      purchasedKwh: cols[5] ? Number(cols[5]) : null,
      feedInKwh: cols[6] ? Number(cols[6]) : null,
      prPct: cols[7] ? Number(cols[7]) : null,
      irradWhM2: cols[8] ? Number(cols[8]) : null,
    });
  }
  return rows;
}

async function main() {
  console.log('=== AUDIT PR & NILAI BATAS (90.00 / 95.00) PER BULAN 2026 ===\n');

  const rows = parseCsv('Monthly Report_Annual report_20261001111530.csv');
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

  console.log('| Bulan | Total Plant | Valid (Dihitung) | Bernilai Batas (90.00 / 95.00) | Kosong / Null Iradiasi | Rata-rata Terbobot Valid (%) | Plant Bernilai Batas |');
  console.log('|---|---|---|---|---|---|---|');

  for (const m of months) {
    const monthRows = rows.filter(r => r.time === m);
    let validCount = 0;
    let boundaryCount = 0;
    let emptyCount = 0;
    const boundaryPlants = [];

    let totalValidEnergy = 0;
    let totalValidTheoretical = 0;

    for (const r of monthRows) {
      const pr = r.prPct;
      const irrad = r.irradWhM2;
      const kwp = r.kwp;
      const energy = r.yieldKwh;

      if (irrad === null || irrad === undefined || isNaN(irrad) || pr === null || isNaN(pr)) {
        emptyCount++;
      } else if (pr === 90 || pr === 95 || pr === 90.0 || pr === 95.0) {
        boundaryCount++;
        boundaryPlants.push(`${r.plantName} (${pr}%)`);
      } else if (pr > 0 && pr <= 100) {
        validCount++;
        if (energy !== null && kwp !== null && irrad !== null && kwp > 0 && irrad > 0) {
          totalValidEnergy += energy;
          // irrad is in Wh/m2, so kWh/m2 is irrad / 1000
          totalValidTheoretical += kwp * (irrad / 1000);
        }
      } else {
        emptyCount++;
      }
    }

    const weightedPr = totalValidTheoretical > 0 ? (totalValidEnergy / totalValidTheoretical) * 100 : null;

    console.log(`| ${m} | ${monthRows.length} | ${validCount} | ${boundaryCount} | ${emptyCount} | ${weightedPr !== null ? weightedPr.toFixed(2) + '%' : '—'} | ${boundaryPlants.length ? boundaryPlants.join('; ') : '—'} |`);
  }
}

main().catch(console.error);
