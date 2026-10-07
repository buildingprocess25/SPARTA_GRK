import crypto from 'node:crypto';

export const ANNUAL_LOAD_HEADER = Object.freeze([
  'Plant name',
  'Time',
  'Monthly load consumption(kWh)',
]);

export const MONTH_NAMES_ID = Object.freeze([
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]);

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('Malformed CSV row: unterminated quoted field');
  cells.push(value.trim());
  return cells;
}

function rounded(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

export function parseAnnualLoadReport(input, { filename = 'annual-load.csv' } = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  const text = new TextDecoder('utf-8', { fatal: true })
    .decode(buffer)
    .replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line, index, all) => line !== '' || index < all.length - 1);
  while (lines.at(-1) === '') lines.pop();

  const metadata = lines[0]?.trim() || '';
  const metadataMatch = /^monthly load consump_Year_(\d{4})$/i.exec(metadata);
  if (!metadataMatch) throw new Error(`Invalid report metadata row: ${metadata}`);
  const reportYear = Number(metadataMatch[1]);

  const headers = parseCsvLine(lines[1] || '');
  if (headers.length !== ANNUAL_LOAD_HEADER.length || headers.some((header, index) => header !== ANNUAL_LOAD_HEADER[index])) {
    throw new Error(`Unexpected report header: ${headers.join(' | ')}`);
  }

  const identities = new Set();
  const records = [];
  for (let offset = 2; offset < lines.length; offset += 1) {
    if (!lines[offset].trim()) continue;
    const cells = parseCsvLine(lines[offset]);
    if (cells.length !== 3) throw new Error(`Invalid column count at line ${offset + 1}`);
    const [plantName, yearMonth, rawLoad] = cells;
    const period = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
    if (!period || Number(period[1]) !== reportYear) {
      throw new Error(`Invalid period at line ${offset + 1}: ${yearMonth}`);
    }
    const identity = `${plantName}|${yearMonth}`;
    if (identities.has(identity)) throw new Error(`Duplicate plant and period: ${identity}`);
    identities.add(identity);

    let loadKwh = null;
    if (rawLoad !== '' && rawLoad !== '--') {
      loadKwh = Number(rawLoad);
      if (!Number.isFinite(loadKwh) || loadKwh < 0) {
        throw new Error(`Invalid monthly load at line ${offset + 1}: ${rawLoad}`);
      }
    }
    records.push({
      plantName,
      yearMonth,
      year: reportYear,
      month: Number(period[2]),
      loadKwh,
      status: loadKwh === null ? 'MISSING' : 'VALID',
    });
  }

  return {
    filename,
    reportYear,
    hash: crypto.createHash('sha256').update(buffer).digest('hex'),
    records,
    summary: {
      rowCount: records.length,
      plantCount: new Set(records.map(record => record.plantName)).size,
      validCount: records.filter(record => record.status === 'VALID').length,
      missingCount: records.filter(record => record.status === 'MISSING').length,
    },
  };
}

function summarizeRecords(records, emissionFactorForPlant, tariffPerKwh) {
  const valid = records.filter(record => record.loadKwh !== null);
  const totalLoadKwh = valid.reduce((sum, record) => sum + record.loadKwh, 0);
  const emissionKg = valid.reduce(
    (sum, record) => sum + record.loadKwh * emissionFactorForPlant(record.plantName),
    0,
  );
  return {
    totalLoadKwh: rounded(totalLoadKwh),
    averageLoadKwh: valid.length ? rounded(totalLoadKwh / valid.length) : null,
    dcCount: valid.length,
    coveredDcCount: new Set(valid.map(record => record.plantName)).size,
    expectedDcCount: new Set(records.map(record => record.plantName)).size,
    emissionTon: rounded(emissionKg / 1_000, 3),
    estimatedCostRupiah: rounded(totalLoadKwh * tariffPerKwh),
  };
}

export function buildScope2AnnualLoadDashboard({
  reports,
  currentYear,
  currentMonth,
  emissionFactorForPlant = () => 0.87,
  tariffPerKwh = 1_400,
}) {
  const allRecords = reports.flatMap(report => report.records);
  const years = [...new Set(reports.map(report => report.reportYear))].sort();
  const plantNames = [...new Set(allRecords.map(record => record.plantName))].sort((a, b) => a.localeCompare(b, 'id'));

  const monthlyForYear = (year, monthLimit = 12) => Array.from({ length: monthLimit }, (_, index) => {
    const month = index + 1;
    const records = allRecords.filter(record => record.year === year && record.month === month);
    return {
      yearMonth: `${year}-${String(month).padStart(2, '0')}`,
      month,
      monthName: MONTH_NAMES_ID[index],
      ...summarizeRecords(records, emissionFactorForPlant, tariffPerKwh),
    };
  });

  const currentRecords = allRecords.filter(
    record => record.year === currentYear && record.month <= currentMonth,
  );
  const currentMonthly = monthlyForYear(currentYear, currentMonth);
  const comparison = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
      month,
      monthName: MONTH_NAMES_ID[index],
      years: Object.fromEntries(years.map(year => {
        const records = allRecords.filter(record => record.year === year && record.month === month);
        return [String(year), summarizeRecords(records, emissionFactorForPlant, tariffPerKwh)];
      })),
    };
  });

  const dcRows = plantNames.map(plantName => ({
    plantName,
    months: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return {
        month,
        monthName: MONTH_NAMES_ID[index],
        years: Object.fromEntries(years.map(year => {
          const record = allRecords.find(item => item.plantName === plantName && item.year === year && item.month === month);
          return [String(year), record?.loadKwh ?? null];
        })),
      };
    }),
  }));

  return {
    source: 'ISOLAR_ANNUAL_REPORT_MONTHLY_LOAD',
    sourceLabel: 'iSolarCloud Annual Report — Monthly load consumption(kWh)',
    years,
    current: {
      year: currentYear,
      throughMonth: currentMonth,
      summary: summarizeRecords(currentRecords, emissionFactorForPlant, tariffPerKwh),
      monthly: currentMonthly,
    },
    comparison,
    dcRows,
    reports: reports.map(report => ({
      filename: report.filename,
      reportYear: report.reportYear,
      hash: report.hash,
      ...report.summary,
    })),
    assumptions: {
      tariffPerKwh,
      missingValues: 'Nilai kosong tidak dianggap nol dan tidak masuk pembagi rata-rata.',
    },
  };
}
