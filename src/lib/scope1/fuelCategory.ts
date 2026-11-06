// Vehicle vs genset comes from facilityType, never fuelType: either can run on any fuel.
// 'vehicle' is what Excel uploads stored before they were aligned to 'transport'.
export const isVehicleFuelRecord = (record) => record.facilityType === 'transport' || record.facilityType === 'vehicle';

export function getRecordCost(record) {
  if (record.costRupiah !== null && record.costRupiah !== undefined && Number(record.costRupiah) > 0) {
    return Number(record.costRupiah);
  }
  const liters = Number(record.liters) || 0;
  if (liters <= 0) return 0;
  const price = Number(record.pricePerLiter);
  if (price > 0) return Math.round(liters * price);

  const fuel = String(record.fuelType || '').toUpperCase();
  const rate = (fuel === 'PERTALITE') ? 10000 : (fuel === 'PERTAMAX') ? 12500 : 6800;
  return Math.round(liters * rate);
}
