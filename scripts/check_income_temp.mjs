import prisma from '../src/lib/prisma.js';
const plants = await prisma.plantLatest.findMany({
  select: { psId: true, name: true, todayIncome: true, raw: true },
  orderBy: { name: 'asc' }
});
console.log('=== Income dari raw field API iSolarCloud ===');
const rows = plants.map(p => ({
  psId: p.psId,
  name: p.name.replace('Alfamart DC ', '').replace('Alfamart ', ''),
  todayIncome: p.raw?.today_income ?? 'N/A',
  yearIncome: p.raw?.year_income ?? 'N/A',
  totalIncome: p.raw?.total_income ?? 'N/A',
}));
console.table(rows);
// check currency: if income is very small, likely CNY not IDR
const sample = plants.find(p => p.raw?.year_income && Number(p.raw.year_income) > 0);
if (sample) {
  console.log('\nSample plant:', sample.name);
  console.log('year_income raw value:', sample.raw.year_income);
  console.log('total_energy raw value:', sample.raw.total_energy, 'kWh');
  const yearIncome = Number(sample.raw.year_income);
  const yearEnergy = Number(sample.raw.total_energy);
  if (yearIncome > 0 && yearEnergy > 0) {
    const tariffCalc = yearIncome / yearEnergy;
    console.log(`Implied tariff: ${tariffCalc.toFixed(4)} per kWh`);
    console.log(`If IDR: ~${tariffCalc.toFixed(0)} Rp/kWh (expected ~1,444 for LWBP)`);
    console.log(`If CNY: ~${tariffCalc.toFixed(4)} CNY/kWh`);
  }
} else {
  console.log('\nNo plants with year_income > 0 found');
}
await prisma.$disconnect();
