import prisma from '../src/lib/prisma.js';

async function compareMonthlySources() {
  const observations = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { in: ['202601','202602','202603','202604','202605','202606','202607','202608','202609'] }
    }
  });

  const reportSums = {};
  const apiSums = {};

  for (const o of observations) {
    if (o.source === 'ISOLAR_REPORT_IMPORT') {
      reportSums[o.yearMonth] = (reportSums[o.yearMonth] || 0) + o.energyKwh;
    } else if (o.source === 'api_history') {
      apiSums[o.yearMonth] = (apiSums[o.yearMonth] || 0) + o.energyKwh;
    }
  }

  console.log('=== PERBANDINGAN ENERGI BULANAN: ISOLAR_REPORT_IMPORT VS API_HISTORY ===\n');
  console.log('| Bulan | ISOLAR_REPORT_IMPORT (kWh) | api_history (kWh) | Selisih (kWh) | Status Precedence |');
  console.log('|---|---|---|---|---|');

  const months = ['202601','202602','202603','202604','202605','202606','202607','202608','202609'];
  for (const ym of months) {
    const rep = reportSums[ym] || 0;
    const api = apiSums[ym] || 0;
    const diff = rep - api;
    console.log(`| ${ym} | ${rep.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${api.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${diff.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ISOLAR_REPORT_IMPORT (Kanonik Final) |`);
  }
}

compareMonthlySources().catch(console.error).finally(() => prisma.$disconnect());
