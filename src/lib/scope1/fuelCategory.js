// Vehicle vs genset comes from facilityType, never fuelType: either can run on any fuel.
// 'vehicle' is what Excel uploads stored before they were aligned to 'transport'.
export const isVehicleFuelRecord = (record) => record.facilityType === 'transport' || record.facilityType === 'vehicle';
