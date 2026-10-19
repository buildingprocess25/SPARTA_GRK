import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma.js';
import { calculateScope1FuelEmission } from '../src/lib/carbon/carbonEngine.js';
import { isVehicleFuelRecord } from '../src/lib/scope1/fuelCategory.js';

// Usage: node scripts/import-vehicle-fuel-costs.mjs <rekap.csv> [--map <kuu-map.json>] [--year 2026] [--fuel PERTALITE] [--apply]
// Without --apply it only prints what would change.
// KUU codes missing from --map are stored with the raw code as dcId until a facility mapping exists.
const SOURCE = 'CSV_BIAYA_KENDARAAN';

function parseArgs(argv) {
  const args = { year: '2026', fuel: 'PERTALITE', apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--map') args.map = argv[++i];
    else if (arg === '--year') args.year = argv[++i];
    else if (arg === '--fuel') args.fuel = argv[++i].toUpperCase();
    else args.csv = arg;
  }
  if (!args.csv) throw new Error('Wajib: path CSV rekap biaya kendaraan');
  return args;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { cells.push(current); current = ''; }
    else current += ch;
  }
  cells.push(current);
  return cells.map(c => c.trim());
}

// The rekap uses comma thousand separators ("9,955"); an empty cell means no fill-up that month.
function toNumber(cell) {
  if (!cell) return 0;
  const value = Number(cell.replace(/,/g, ''));
  if (!Number.isFinite(value)) throw new Error(`Angka tidak valid: "${cell}"`);
  return value;
}

function parseRekap(text) {
  const lines = text.split(/\r?\n/).map(parseCsvLine);
  const monthRowIndex = lines.findIndex(cells => cells.some(c => /^\d{2}$/.test(c)));
  if (monthRowIndex < 0) throw new Error('Baris bulan (01, 02, ...) tidak ditemukan');

  // Month headers sit above the "Liter BBM" column; "Rp BBM" is the column right after it.
  const monthColumns = [];
  lines[monthRowIndex].forEach((cell, index) => {
    if (/^\d{2}$/.test(cell)) monthColumns.push({ month: cell, litersCol: index, costCol: index + 1 });
  });
  const totalLitersCol = lines[monthRowIndex].indexOf('Total Liter BBM');

  const rows = [];
  let totalRow = null;
  for (const cells of lines.slice(monthRowIndex + 2)) {
    const code = cells[0];
    if (!code) continue;
    const months = monthColumns.map(({ month, litersCol, costCol }) => ({
      month,
      liters: toNumber(cells[litersCol]),
      costRupiah: toNumber(cells[costCol]),
    }));
    const entry = {
      code,
      months,
      totalLiters: toNumber(cells[totalLitersCol]),
      totalCost: toNumber(cells[totalLitersCol + 1]),
    };
    if (code.toLowerCase() === 'total') totalRow = entry;
    else rows.push(entry);
  }
  return { rows, totalRow };
}

// Cross-check every row against the rekap's own totals so a misparsed column fails loudly.
// Liters are exported rounded to whole numbers, so each summed cell may drift by up to 0.5 L.
function verifyTotals({ rows, totalRow }) {
  const problems = [];
  const literTolerance = cellCount => 0.5 * (cellCount + 1);
  for (const row of rows) {
    const liters = row.months.reduce((s, m) => s + m.liters, 0);
    const cost = row.months.reduce((s, m) => s + m.costRupiah, 0);
    if (Math.abs(liters - row.totalLiters) > literTolerance(row.months.length)) problems.push(`${row.code}: liter ${liters} vs total ${row.totalLiters}`);
    if (Math.abs(cost - row.totalCost) > 1) problems.push(`${row.code}: Rp ${cost} vs total ${row.totalCost}`);
  }
  if (totalRow) {
    totalRow.months.forEach((total, i) => {
      const liters = rows.reduce((s, r) => s + r.months[i].liters, 0);
      const cost = rows.reduce((s, r) => s + r.months[i].costRupiah, 0);
      if (Math.abs(liters - total.liters) > literTolerance(rows.length)) problems.push(`Bulan ${total.month}: liter ${liters} vs total ${total.liters}`);
      if (Math.abs(cost - total.costRupiah) > 1) problems.push(`Bulan ${total.month}: Rp ${cost} vs total ${total.costRupiah}`);
    });
  }
  return problems;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const parsed = parseRekap(fs.readFileSync(args.csv, 'utf8'));
  const problems = verifyTotals(parsed);
  if (problems.length) throw new Error(`Total rekap tidak cocok:\n  ${problems.join('\n  ')}`);

  const kuuMap = args.map ? JSON.parse(fs.readFileSync(args.map, 'utf8')) : {};
  const unmapped = parsed.rows.map(r => r.code).filter(code => !kuuMap[code]);
  if (unmapped.length) console.log(`KUU tanpa pemetaan (disimpan dengan kode KUU): ${unmapped.join(', ')}`);

  const facilityIds = new Set((await prisma.facilityMaster.findMany({ select: { id: true } })).map(f => f.id));
  const unknown = [...new Set(Object.values(kuuMap))].filter(id => !facilityIds.has(id));
  if (unknown.length) throw new Error(`Facility ID tidak ada di facility_master: ${unknown.join(', ')}`);

  const proofRef = path.basename(args.csv);
  const batchId = `${SOURCE}-${args.year}`;
  const data = [];
  for (const row of parsed.rows) {
    for (const m of row.months) {
      if (m.liters <= 0) continue;
      const yearMonth = `${args.year}-${m.month}`;
      const pricePerLiter = m.costRupiah > 0 ? m.costRupiah / m.liters : null;
      const emission = calculateScope1FuelEmission({ fuelType: args.fuel, liters: m.liters, costRupiah: m.costRupiah, pricePerLiter });
      data.push({
        date: `${yearMonth}-01`,
        yearMonth,
        dcId: kuuMap[row.code] || row.code,
        facilityType: 'transport',
        fuelType: emission.fuelType,
        liters: m.liters,
        costRupiah: m.costRupiah,
        pricePerLiter: pricePerLiter ? Number(pricePerLiter.toFixed(2)) : null,
        emissionFactor: emission.factorKgPerLiter,
        emissionKg: emission.emissionKg,
        emissionTon: emission.emissionTon,
        status: 'ACTIVE',
        validationNote: `Rekap biaya kendaraan per KUU ${row.code}`,
        source: SOURCE,
        batchId,
        proofRef,
        metadata: { kuu: row.code },
      });
    }
  }

  const existing = (await prisma.fuelActivity.findMany()).filter(isVehicleFuelRecord);
  const totalLiters = data.reduce((s, r) => s + r.liters, 0);
  const totalCost = data.reduce((s, r) => s + r.costRupiah, 0);
  const totalTon = data.reduce((s, r) => s + r.emissionTon, 0);

  console.log(`Data kendaraan lama yang akan dihapus: ${existing.length}`);
  for (const r of existing) console.log(`  - ${r.id} ${r.yearMonth} ${r.dcId} ${r.liters} L ${r.source}`);
  console.log(`Data baru: ${data.length} baris dari ${parsed.rows.length} KUU, ${totalLiters.toLocaleString('id-ID')} L, Rp ${totalCost.toLocaleString('id-ID')}, ${totalTon.toFixed(3)} tCO2e (${args.fuel})`);

  if (!args.apply) {
    console.log('Dry run. Tambahkan --apply untuk menulis ke database.');
    return;
  }

  await prisma.$transaction([
    prisma.fuelActivity.deleteMany({ where: { id: { in: existing.map(r => r.id) } } }),
    prisma.fuelActivity.createMany({ data }),
  ]);
  console.log('Selesai.');
}

main()
  .catch(err => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
