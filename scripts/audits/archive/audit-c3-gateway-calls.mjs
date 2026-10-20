import fs from 'fs';
import path from 'path';

// Recursively search for vendor host references or direct http calls to Sungrow
function searchFiles(dir, matchPattern, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === '.data') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath, matchPattern, results);
    } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (matchPattern.test(line)) {
          results.push({
            file: path.relative(process.cwd(), fullPath),
            line: idx + 1,
            content: line.trim()
          });
        }
      });
    }
  }
  return results;
}

console.log('=== C.3 AUDIT TEMPAT PEMANGGILAN GATEWAY VENDOR ===');
const vendorCalls = searchFiles(process.cwd(), /gateway\.isolarcloud|isolarcloud\.com|callOpenApi|fetch\s*\(.*(ISOLAR|gateway)/i);
console.log(`Ditemukan ${vendorCalls.length} baris kode yang mereferensikan endpoint vendor:`);
vendorCalls.forEach((v, i) => {
  console.log(`${i + 1}. ${v.file}:${v.line} -> ${v.content.slice(0, 100)}`);
});
