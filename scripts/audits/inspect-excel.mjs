import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

function analyzeWorkbook(filePath) {
  console.log(`\n================================================================`);
  console.log(`ANALYZING WORKBOOK: ${filePath}`);
  console.log(`================================================================`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File NOT found: ${filePath}`);
    return;
  }

  const wb = XLSX.readFile(filePath, { cellFormula: true, cellHTML: false });
  console.log(`Sheet Names (${wb.SheetNames.length}):`, wb.SheetNames);

  for (const sheetName of wb.SheetNames) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`SHEET: "${sheetName}"`);
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.log(`(Empty sheet)`);
      continue;
    }
    
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    console.log(`Range: ${ws['!ref']} (Rows: ${range.e.r - range.s.r + 1}, Cols: ${range.e.c - range.s.c + 1})`);

    // Extract formulas and sample values
    const formulas = [];
    const headers = [];
    
    // Check first 10 rows for headers/structure
    for (let r = range.s.r; r <= Math.min(range.s.r + 15, range.e.r); r++) {
      const rowVals = [];
      for (let c = range.s.c; c <= Math.min(range.s.c + 20, range.e.c); c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
          rowVals.push(`[${addr}]=${cell.w || cell.v}${cell.f ? ` (fx: =${cell.f})` : ''}`);
          if (cell.f) {
            formulas.push({ addr, val: cell.v, formula: cell.f });
          }
        }
      }
      if (rowVals.length > 0) {
        console.log(`Row ${r + 1}: ${rowVals.slice(0, 10).join(' | ')}`);
      }
    }

    // Collect all unique formula patterns
    const formulaPatterns = new Map();
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.f) {
          const colLetter = addr.replace(/[0-9]/g, '');
          if (!formulaPatterns.has(colLetter)) {
            formulaPatterns.set(colLetter, { exampleAddr: addr, formula: cell.f, val: cell.v });
          }
        }
      }
    }

    if (formulaPatterns.size > 0) {
      console.log(`\nFormula Patterns in Sheet "${sheetName}":`);
      for (const [col, info] of formulaPatterns.entries()) {
        console.log(`  Col ${col} (e.g. ${info.exampleAddr}): =${info.formula} => Val: ${info.val}`);
      }
    }
  }
}

analyzeWorkbook('Monitor PLTS 2026 (1).xlsx');
analyzeWorkbook('perhitungan emisi karbon.xlsx');
