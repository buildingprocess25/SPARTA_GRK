import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('=== AUDIT HEADER CSV LAPORAN (IRADIASI, PR, SUHU MODUL) ===\n');
  const files = fs.readdirSync('.').filter(f => f.endsWith('.csv'));

  for (const f of files) {
    const content = fs.readFileSync(f, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    console.log(`File: ${f}`);
    console.log(`Line 1 (Title): ${lines[0] || '—'}`);
    console.log(`Line 2 (Header): ${lines[1] || '—'}`);
    console.log(`Sample Line 3: ${lines[2] || '—'}`);

    // Check for keywords
    const hasRadiation = /radiat|iradiasi|irrad/i.test(lines[1] || lines[0]);
    const hasPR = /\bPR\b|performance\s*ratio/i.test(lines[1] || lines[0]);
    const hasModuleTemp = /module\s*temp|suhu\s*modul|temperature/i.test(content);

    console.log(`  -> Memuat Iradiasi: ${hasRadiation}`);
    console.log(`  -> Memuat PR: ${hasPR}`);
    console.log(`  -> Memuat Suhu Modul: ${hasModuleTemp}`);
    console.log('--------------------------------------------------\n');
  }
}

main().catch(console.error);
