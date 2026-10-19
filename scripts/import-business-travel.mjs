import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma.js';
import { importTravelLedger, prepareTravelImport } from '../src/lib/scope3/travelImport.js';

// Usage: node --env-file=.env scripts/import-business-travel.mjs <BPDL journal.csv> [--apply]
// Without --apply it only prints what would be stored. Months in the file replace the stored ones.
const args = process.argv.slice(2);
const csvPath = args.find(arg => !arg.startsWith('--'));
const apply = args.includes('--apply');

async function main() {
  if (!csvPath) throw new Error('Wajib: path CSV jurnal BPDL');
  const text = fs.readFileSync(csvPath, 'utf8');
  const sourceFile = path.basename(csvPath);

  const { summary, months } = prepareTravelImport(text, { sourceFile });
  console.log(`Bulan: ${months.join(', ')} | ${summary.lineCount} baris dari ${summary.kuuCount} KUU`);
  console.log(`Total BPDL Rp ${summary.totalRupiah.toLocaleString('id-ID')} (tiket Rp ${summary.flightRupiah.toLocaleString('id-ID')})`);
  console.log(`${summary.flightCount} baris tiket, ${summary.distanceKm.toLocaleString('id-ID')} km, ${summary.emissionTon} tCO2e`);
  if (summary.uncalculatedFlights) console.log(`${summary.uncalculatedFlights} tiket tanpa rute terbaca (biaya tetap tercatat)`);
  if (summary.unknownAirports.length) console.log(`Kode bandara belum dikenal: ${summary.unknownAirports.join(', ')}`);

  if (!apply) {
    console.log('Dry run. Tambahkan --apply untuk menulis ke database.');
    return;
  }
  const result = await importTravelLedger(prisma, text, { sourceFile });
  console.log(`Selesai. ${result.lineCount} baris disimpan, ${result.replacedCount} baris lama untuk bulan yang sama diganti.`);
}

main()
  .catch(err => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
