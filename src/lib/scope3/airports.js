// IATA codes seen in the BPDL ticket descriptions. Coordinates are the airport reference points (decimal degrees).
// A code missing here is reported as UNKNOWN_AIRPORT on import, never guessed.
export const AIRPORTS = Object.freeze({
  BDJ: { name: 'Banjarmasin', lat: -3.4424, lon: 114.7626, country: 'ID' },
  BKS: { name: 'Bengkulu', lat: -3.8637, lon: 102.3390, country: 'ID' },
  BPN: { name: 'Balikpapan', lat: -1.2683, lon: 116.8945, country: 'ID' },
  BTH: { name: 'Batam', lat: 1.1210, lon: 104.1190, country: 'ID' },
  BTJ: { name: 'Banda Aceh', lat: 5.5229, lon: 95.4206, country: 'ID' },
  CGK: { name: 'Jakarta Soekarno-Hatta', lat: -6.1256, lon: 106.6559, country: 'ID' },
  DJB: { name: 'Jambi', lat: -1.6380, lon: 103.6440, country: 'ID' },
  DPS: { name: 'Denpasar', lat: -8.7482, lon: 115.1672, country: 'ID' },
  GTO: { name: 'Gorontalo', lat: 0.6371, lon: 122.8500, country: 'ID' },
  HLP: { name: 'Jakarta Halim', lat: -6.2666, lon: 106.8911, country: 'ID' },
  KNO: { name: 'Medan Kualanamu', lat: 3.6422, lon: 98.8853, country: 'ID' },
  KOE: { name: 'Kupang', lat: -10.1716, lon: 123.6711, country: 'ID' },
  KTG: { name: 'Ketapang', lat: -1.8166, lon: 109.9633, country: 'ID' },
  LLO: { name: 'Luwu (Bua)', lat: -3.0828, lon: 120.2450, country: 'ID' },
  LOP: { name: 'Lombok', lat: -8.7573, lon: 116.2767, country: 'ID' },
  MDC: { name: 'Manado', lat: 1.5493, lon: 124.9259, country: 'ID' },
  MKW: { name: 'Manokwari', lat: -0.8918, lon: 134.0490, country: 'ID' },
  MLG: { name: 'Malang', lat: -7.9266, lon: 112.7145, country: 'ID' },
  PGK: { name: 'Pangkal Pinang', lat: -2.1622, lon: 106.1391, country: 'ID' },
  PKU: { name: 'Pekanbaru', lat: 0.4608, lon: 101.4445, country: 'ID' },
  PKY: { name: 'Palangkaraya', lat: -2.2251, lon: 113.9427, country: 'ID' },
  PLM: { name: 'Palembang', lat: -2.8983, lon: 104.6997, country: 'ID' },
  PNK: { name: 'Pontianak', lat: -0.1507, lon: 109.4039, country: 'ID' },
  SOC: { name: 'Solo', lat: -7.5161, lon: 110.7569, country: 'ID' },
  SOQ: { name: 'Sorong', lat: -0.8945, lon: 131.2870, country: 'ID' },
  SRG: { name: 'Semarang', lat: -6.9727, lon: 110.3750, country: 'ID' },
  SUB: { name: 'Surabaya', lat: -7.3798, lon: 112.7869, country: 'ID' },
  SWQ: { name: 'Sumbawa', lat: -8.4890, lon: 117.4121, country: 'ID' },
  TJQ: { name: 'Belitung', lat: -2.7457, lon: 107.7549, country: 'ID' },
  TKG: { name: 'Lampung', lat: -5.2406, lon: 105.1789, country: 'ID' },
  UPG: { name: 'Makassar', lat: -5.0616, lon: 119.5540, country: 'ID' },
  YIA: { name: 'Yogyakarta', lat: -7.9075, lon: 110.0544, country: 'ID' },
  DAC: { name: 'Dhaka', lat: 23.8433, lon: 90.3978, country: 'BD' },
  MNL: { name: 'Manila', lat: 14.5086, lon: 121.0198, country: 'PH' },
});

export function greatCircleKm(from, to) {
  const rad = deg => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLon = rad(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
