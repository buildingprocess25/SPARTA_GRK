import fs from 'fs';

const content = fs.readFileSync('WR Thn 2026 Laporan H.O (akun SAT) - WR_Thn_2026.csv', 'utf-8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
for (let i = 0; i < Math.min(30, lines.length); i++) {
  console.log(`Line ${i + 1}: ${lines[i]}`);
}
