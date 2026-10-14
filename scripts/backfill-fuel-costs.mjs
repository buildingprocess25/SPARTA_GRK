import prisma from '../src/lib/prisma.js';

async function main() {
  const records = await prisma.fuelActivity.findMany({
    where: {
      OR: [
        { costRupiah: null },
        { costRupiah: 0 },
      ]
    }
  });
  console.log(`Found ${records.length} records with missing costRupiah.`);

  let updated = 0;
  for (const r of records) {
    const liters = Number(r.liters) || 0;
    if (liters <= 0) continue;
    const fuel = String(r.fuelType || '').toUpperCase();
    const rate = Number(r.pricePerLiter) > 0
      ? Number(r.pricePerLiter)
      : (fuel === 'PERTALITE' ? 10000 : fuel === 'PERTAMAX' ? 12500 : 6800);
    const costRupiah = Math.round(liters * rate);

    await prisma.fuelActivity.update({
      where: { id: r.id },
      data: {
        costRupiah,
        pricePerLiter: rate,
      }
    });
    updated++;
  }
  console.log(`Successfully updated ${updated} fuel activity records.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
