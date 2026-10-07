import crypto from 'node:crypto';
import fs from 'node:fs';

const reportFiles = fs.readdirSync('.')
  .filter(name => /^monthly load consump_Annual report_.*\.csv$/i.test(name))
  .sort();

function sourceSummary(filename) {
  const buffer = fs.readFileSync(filename);
  const lines = buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  while (lines.at(-1) === '') lines.pop();
  return {
    filename,
    metadata: lines[0],
    header: lines[1],
    dataRows: Math.max(0, lines.length - 2),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

const filesToTrace = [
  'src/components/PenambahEmisiTab.jsx',
  'src/components/Scope2AnnualLoadDashboard.jsx',
  'src/app/api/scope2/annual-load/route.js',
  'src/lib/scope2/annualLoadReportServer.js',
  'src/lib/scope2/annualLoadReport.js',
  'src/lib/carbon/carbonEngine.js',
];

const needles = [
  'Scope2AnnualLoadDashboard',
  'Monthly load consumption(kWh)',
  'currentMonth',
  'emissionFactorForPlant',
  'tariffPerKwh',
  'ELECTRICITY_PLN_PER_KWH',
];

const trace = [];
for (const filename of filesToTrace) {
  const lines = fs.readFileSync(filename, 'utf8').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (needles.some(needle => lines[index].includes(needle))) {
      trace.push({ file: filename, line: index + 1, text: lines[index].trim() });
    }
  }
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  reports: reportFiles.map(sourceSummary),
  trace,
  octoberOrigin: 'Baris Time=2026-10 dalam monthly load consump_Annual report tahun 2026.',
  featureRemoval: {
    mechanism: 'Scope 2 lama masih ada di PenambahEmisiTab, tetapi dilewati oleh early return ke Scope2AnnualLoadDashboard.',
    restorationPolicy: 'Tidak dikembalikan seluruhnya; hanya filter periode/grid/DC yang diminta desain baru.',
  },
}, null, 2));

