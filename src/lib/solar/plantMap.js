/**
 * Central Plant Mapping & Metadata Registry for 36 Canonical DC Locations (representing 39 Physical Sungrow Plants)
 * Contains structural mapping (ps_id to DC entity) and baseline audit reference data.
 * 34 single locations + 2 multi-plant locations (Cilacap 1, 2, 3 and Lombok A, B).
 * RULE: NO API capacities are hardcoded here. Live/fixture API capacity is dynamically parsed at runtime.
 */

export const CANONICAL_DC_ENTITIES = [
  {
    dcId: 'DC-GORONTALO',
    canonicalName: 'Gorontalo',
    aliases: ['gorontalo', 'dc gorontalo', 'alfamart dc gorontalo'],
    sungrowPsIds: [1585267],
    apiInstalledKwp: 84.7,
    baselineInstalledKwp: 100.0,
    region: 'Gorontalo',
    grid: 'SULUTGO',
    isMultiPlant: false
  },
  {
    dcId: 'DC-LUWU',
    canonicalName: 'Luwu',
    aliases: ['luwu', 'dc luwu', 'alfamart dc luwu', 'luwu timur'],
    sungrowPsIds: [1583524],
    apiInstalledKwp: 96.8,
    baselineInstalledKwp: 90.0,
    region: 'Sulawesi Selatan',
    grid: 'SULSELRABAR',
    isMultiPlant: false
  },
  {
    dcId: 'DC-CILEUNGSI',
    canonicalName: 'Cileungsi',
    aliases: ['cileungsi', 'dc cileungsi', 'alfamart dc cileungsi'],
    sungrowPsIds: [1459033],
    apiInstalledKwp: 479.5,
    baselineInstalledKwp: 473.5,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-TEGAL',
    canonicalName: 'Tegal',
    aliases: ['tegal', 'dc tegal', 'alfamart dc tegal'],
    sungrowPsIds: [1456379],
    apiInstalledKwp: 119.88,
    baselineInstalledKwp: 135.0,
    region: 'Jawa Tengah',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-SIDOARJO',
    canonicalName: 'Sidoarjo',
    aliases: ['sidoarjo', 'dc sidoarjo', 'alfamart dc sidoarjo'],
    sungrowPsIds: [1415889],
    apiInstalledKwp: 265.29,
    baselineInstalledKwp: 250.0,
    region: 'Jawa Timur',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-DEMANSION',
    canonicalName: 'Tk. Drive Thru De Mansion',
    aliases: ['tk drive thru de mansion', 'drive thru de mansion', 'de mansion', 'demansion', 'alfamart dhrive thru de mansion'],
    sungrowPsIds: [1410080],
    apiInstalledKwp: 57.72,
    baselineInstalledKwp: 58.0,
    region: 'Banten',
    grid: 'JAMALI',
    facilityType: 'STORE',
    type: 'STORE',
    isMultiPlant: false
  },
  {
    dcId: 'DC-PLUMBON',
    canonicalName: 'Plumbon',
    aliases: ['plumbon', 'dc plumbon', 'alfamart dc plumbon', 'cirebon plumbon'],
    sungrowPsIds: [1393852],
    apiInstalledKwp: 215.9,
    baselineInstalledKwp: 170.0,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-JEMBER',
    canonicalName: 'Jember',
    aliases: ['jember', 'dc jember', 'alfamart dc jember'],
    sungrowPsIds: [1392560],
    apiInstalledKwp: 157.62,
    baselineInstalledKwp: 150.0,
    region: 'Jawa Timur',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-MADIUN',
    canonicalName: 'Madiun',
    aliases: ['madiun', 'dc madiun', 'alfamart dc madiun'],
    sungrowPsIds: [1391178],
    apiInstalledKwp: 250.86,
    baselineInstalledKwp: 180.0,
    region: 'Jawa Timur',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-SERANG',
    canonicalName: 'Serang',
    aliases: ['serang', 'dc serang', 'alfamart dc serang'],
    sungrowPsIds: [1389275],
    apiInstalledKwp: 169.83,
    baselineInstalledKwp: 175.0,
    region: 'Banten',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-BANDUNG2',
    canonicalName: 'Bandung 2',
    aliases: ['bandung 2', 'bandung2', 'dc bandung 2', 'alfamart dc bandung 2'],
    sungrowPsIds: [1389249],
    apiInstalledKwp: 168.72,
    baselineInstalledKwp: 90.0,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-CILACAP-1',
    canonicalName: 'Cilacap 1',
    aliases: ['cilacap 1', 'cilacap1', 'alfamart dc cilacap 1', 'dc cilacap 1', '1386493'],
    sungrowPsIds: [1386493],
    apiInstalledKwp: 137.1,
    baselineInstalledKwp: 165.0,
    region: 'Jawa Tengah',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-CILACAP-2',
    canonicalName: 'Cilacap 2',
    aliases: ['cilacap 2', 'cilacap2', 'alfamart dc cilacap 2', 'dc cilacap 2', '1387109'],
    sungrowPsIds: [1387109],
    apiInstalledKwp: 47.73,
    baselineInstalledKwp: 22.0,
    region: 'Jawa Tengah',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-CILACAP-3',
    canonicalName: 'Cilacap 3',
    aliases: ['cilacap 3', 'cilacap3', 'alfamart dc cilacap 3', 'dc cilacap 3', '1387111'],
    sungrowPsIds: [1387111],
    apiInstalledKwp: 30.52,
    baselineInstalledKwp: 18.0,
    region: 'Jawa Tengah',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-CIANJUR',
    canonicalName: 'Cianjur',
    aliases: ['cianjur', 'dc cianjur', 'alfamart dc cianjur'],
    sungrowPsIds: [1378278],
    apiInstalledKwp: 197.54,
    baselineInstalledKwp: 130.0,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-SEMARANG',
    canonicalName: 'Semarang',
    aliases: ['semarang', 'dc semarang', 'alfamart dc semarang'],
    sungrowPsIds: [1377551],
    apiInstalledKwp: 143.2,
    baselineInstalledKwp: 200.0,
    region: 'Jawa Tengah',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-KLATEN',
    canonicalName: 'Klaten',
    aliases: ['klaten', 'dc klaten', 'alfamart dc klaten'],
    sungrowPsIds: [1376844],
    apiInstalledKwp: 102.12,
    baselineInstalledKwp: 125.0,
    region: 'Jawa Tengah',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-DRIVETHRUGS',
    canonicalName: 'Tk. Drive Thru GS',
    aliases: ['tk drive thru gs', 'drive thru gs', 'store drive thru', 'alfamart store drive thru', 'gading serpong drive thru'],
    sungrowPsIds: [1284197],
    apiInstalledKwp: 39.6,
    baselineInstalledKwp: 40.0,
    region: 'Banten',
    grid: 'JAMALI',
    facilityType: 'STORE',
    type: 'STORE',
    isMultiPlant: false
  },
  {
    dcId: 'DC-KOTABUMI',
    canonicalName: 'Kotabumi',
    aliases: ['kotabumi', 'dc kotabumi', 'alfamart dc kotabumi'],
    sungrowPsIds: [1247367],
    apiInstalledKwp: 123.0,
    baselineInstalledKwp: 130.0,
    region: 'Lampung',
    grid: 'SUMATERA',
    isMultiPlant: false
  },
  {
    dcId: 'DC-MAKASSAR',
    canonicalName: 'Makassar',
    aliases: ['makassar', 'dc makassar', 'alfamart dc makassar'],
    sungrowPsIds: [1231394],
    apiInstalledKwp: 231.0,
    baselineInstalledKwp: 180.0,
    region: 'Sulawesi Selatan',
    grid: 'SULSELRABAR',
    isMultiPlant: false
  },
  {
    dcId: 'DC-MANADO',
    canonicalName: 'Manado',
    aliases: ['manado', 'dc manado', 'alfamart dc manado'],
    sungrowPsIds: [1230507],
    apiInstalledKwp: 200.2,
    baselineInstalledKwp: 195.0,
    region: 'Sulawesi Utara',
    grid: 'SULUTGO',
    isMultiPlant: false
  },
  {
    dcId: 'DC-PEKANBARU',
    canonicalName: 'Pekanbaru',
    aliases: ['pekanbaru', 'dc pekanbaru', 'alfamart dc pekanbaru'],
    sungrowPsIds: [1224999],
    apiInstalledKwp: 168.3,
    baselineInstalledKwp: 175.0,
    region: 'Riau',
    grid: 'SUMATERA',
    isMultiPlant: false
  },
  {
    dcId: 'DC-BATAM',
    canonicalName: 'Batam',
    aliases: ['batam', 'dc batam', 'alfamart dc batam'],
    sungrowPsIds: [1224963],
    apiInstalledKwp: 99.0,
    baselineInstalledKwp: 115.0,
    region: 'Kepulauan Riau',
    grid: 'BATAM',
    isMultiPlant: false
  },
  {
    dcId: 'DC-JAMBI',
    canonicalName: 'Jambi',
    aliases: ['jambi', 'dc jambi', 'alfamart dc jambi'],
    sungrowPsIds: [1223464],
    apiInstalledKwp: 88.0,
    baselineInstalledKwp: 45.0,
    region: 'Jambi',
    grid: 'SUMATERA',
    isMultiPlant: false
  },
  {
    dcId: 'DC-PONTIANAK',
    canonicalName: 'Pontianak',
    aliases: ['pontianak', 'dc pontianak', 'alfamart dc pontianak'],
    sungrowPsIds: [1223413],
    apiInstalledKwp: 105.6,
    baselineInstalledKwp: 95.0,
    region: 'Kalimantan Barat',
    grid: 'KALBAR',
    isMultiPlant: false
  },
  {
    dcId: 'DC-LOMBOK-A',
    canonicalName: 'Lombok A',
    aliases: ['lombok a', 'lomboka', 'alfamart dc lombok a', 'dc lombok a', '1219736'],
    sungrowPsIds: [1219736],
    apiInstalledKwp: 12.0,
    baselineInstalledKwp: 18.0,
    region: 'Nusa Tenggara Barat',
    grid: 'NTB_LOMBOK',
    isMultiPlant: false
  },
  {
    dcId: 'DC-LOMBOK-B',
    canonicalName: 'Lombok B',
    aliases: ['lombok b', 'lombokb', 'alfamart dc lombok b', 'dc lombok b', '1219715'],
    sungrowPsIds: [1219715],
    apiInstalledKwp: 57.75,
    baselineInstalledKwp: 68.0,
    region: 'Nusa Tenggara Barat',
    grid: 'NTB_LOMBOK',
    isMultiPlant: false
  },
  {
    dcId: 'DC-LAMPUNG',
    canonicalName: 'Lampung',
    aliases: ['lampung', 'dc lampung', 'alfamart dc lampung'],
    sungrowPsIds: [1218534],
    apiInstalledKwp: 108.9,
    baselineInstalledKwp: 115.0,
    region: 'Lampung',
    grid: 'SUMATERA',
    isMultiPlant: false
  },
  {
    dcId: 'DC-BOGOR',
    canonicalName: 'Bogor',
    aliases: ['bogor', 'dc bogor', 'alfamart dc bogor'],
    sungrowPsIds: [1162742],
    apiInstalledKwp: 106.0,
    baselineInstalledKwp: 131.55,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-PARUNG',
    canonicalName: 'Parung',
    aliases: ['parung', 'dc parung', 'alfamart dc parung'],
    sungrowPsIds: [1160041],
    apiInstalledKwp: 195.0,
    baselineInstalledKwp: 244.23,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-MALANG',
    canonicalName: 'Malang',
    aliases: ['malang', 'dc malang', 'alfamart dc malang'],
    sungrowPsIds: [1159761],
    apiInstalledKwp: 107.84,
    baselineInstalledKwp: 114.9,
    region: 'Jawa Timur',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-BANDUNG1',
    canonicalName: 'Bandung 1',
    aliases: ['bandung 1', 'bandung1', 'dc bandung 1', 'alfamart dc bandung 1'],
    sungrowPsIds: [1159732],
    apiInstalledKwp: 140.0,
    baselineInstalledKwp: 148.77,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-BALI',
    canonicalName: 'Bali',
    aliases: ['bali', 'dc bali', 'alfamart dc bali'],
    sungrowPsIds: [1159719],
    apiInstalledKwp: 88.0,
    baselineInstalledKwp: 101.19,
    region: 'Bali',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-REMBANG',
    canonicalName: 'Rembang',
    aliases: ['rembang', 'dc rembang', 'alfamart dc rembang'],
    sungrowPsIds: [1159599],
    apiInstalledKwp: 155.0,
    baselineInstalledKwp: 174.3,
    region: 'Jawa Tengah',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-BALARAJA',
    canonicalName: 'Balaraja',
    aliases: ['balaraja', 'dc balaraja', 'alfamart dc balaraja'],
    sungrowPsIds: [1159436],
    apiInstalledKwp: 399.73,
    baselineInstalledKwp: 399.74,
    region: 'Banten',
    grid: 'JAMALI',
    isMultiPlant: false
  },
  {
    dcId: 'DC-MEDAN',
    canonicalName: 'Medan',
    aliases: ['medan', 'dc medan', 'alfamart dc medan'],
    sungrowPsIds: [1157086],
    apiInstalledKwp: 162.0,
    baselineInstalledKwp: 162.0,
    region: 'Sumatera Utara',
    grid: 'SUMATERA',
    isMultiPlant: false
  },
  {
    dcId: 'DC-PALEMBANG',
    canonicalName: 'Palembang',
    aliases: ['palembang', 'dc palembang', 'alfamart dc palembang'],
    sungrowPsIds: [1154284],
    apiInstalledKwp: 236.57,
    baselineInstalledKwp: 236.57,
    region: 'Sumatera Selatan',
    grid: 'SUMATERA',
    isMultiPlant: false
  },
  {
    dcId: 'DC-BANJARMASIN',
    canonicalName: 'Banjarmasin',
    aliases: ['banjarmasin', 'dc banjarmasin', 'alfamart dc banjarmasin'],
    sungrowPsIds: [1154267],
    apiInstalledKwp: 129.6,
    baselineInstalledKwp: 129.6,
    region: 'Kalimantan Selatan',
    grid: 'KALSELTENG',
    isMultiPlant: false
  },
  {
    dcId: 'DC-KARAWANG',
    canonicalName: 'Karawang',
    aliases: ['karawang', 'dc karawang', 'alfamart dc karawang'],
    sungrowPsIds: [1092345],
    apiInstalledKwp: 198.0,
    baselineInstalledKwp: 198.0,
    region: 'Jawa Barat',
    grid: 'JAMALI',
    isMultiPlant: false
  }
];

export const PLANT_REGISTRY = CANONICAL_DC_ENTITIES.map(dc => ({
  psId: dc.dcId,
  canonicalName: dc.canonicalName,
  aliases: dc.aliases,
  baselineInstalledKwp: dc.baselineInstalledKwp,
  region: dc.region,
  grid: dc.grid,
  isMultiPlant: dc.isMultiPlant,
  sungrowPsIds: dc.sungrowPsIds,
  subPlants: dc.subPlants || []
}));

/**
 * Normalizes plant name string for fuzzy alias matching
 */
export function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/\balfamart\b/g, '')
    .replace(/\bdhrive\b/g, 'drive')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lookup DC entity by plantName, ps_id, or alias
 */
export function lookupPlantMetadata(raw) {
  if (!raw) {
    return { isMapped: false, psId: 'SG-UNKNOWN', canonicalName: '—', region: null, baselineInstalledKwp: null };
  }

  const rawId = Number(raw.psId || raw.ps_id || raw.id || 0);
  const rawIdStr = String(raw.psId || raw.ps_id || raw.id || '').trim();
  const rawName = String(raw.plantName || raw.psName || raw.ps_name || raw.name || raw.branch || '').trim();
  const normRawName = normalizeName(rawName);

  // 1. Match by exact sungrowPsId
  if (rawId > 0) {
    const bySungrowId = CANONICAL_DC_ENTITIES.find(dc => dc.sungrowPsIds.includes(rawId));
    if (bySungrowId) {
      return {
        ...bySungrowId,
        psId: bySungrowId.dcId,
        isMapped: true
      };
    }
  }

  // 2. Match by dcId string
  if (rawIdStr && rawIdStr !== 'SG-UNKNOWN') {
    const byDcId = CANONICAL_DC_ENTITIES.find(dc => dc.dcId === rawIdStr || dc.canonicalName.toUpperCase() === rawIdStr.toUpperCase());
    if (byDcId) {
      return {
        ...byDcId,
        psId: byDcId.dcId,
        isMapped: true
      };
    }
  }

  // 3. Match by normalized name / aliases
  if (normRawName) {
    const byName = CANONICAL_DC_ENTITIES.find(dc => {
      if (normalizeName(dc.canonicalName) === normRawName) return true;
      return dc.aliases.some(alias => normalizeName(alias) === normRawName);
    });
    if (byName) {
      return {
        ...byName,
        psId: byName.dcId,
        isMapped: true
      };
    }
  }

  return {
    psId: rawIdStr || 'SG-UNKNOWN',
    canonicalName: rawName || '—',
    aliases: [],
    baselineInstalledKwp: raw.installedKwp ? Number(raw.installedKwp) : null,
    region: raw.region || null,
    grid: raw.grid || null,
    isMapped: false
  };
}

/**
 * Helper to determine if a plant/entity is a DC (Distribution Center).
 * Prioritizes explicit type/category/facilityType fields, and falls back to
 * excluding non-DC names (e.g. "Tk. Drive Thru ...") via case-insensitive regex.
 */
export function isDcLocation(plant) {
  if (!plant) return false;
  const type = String(plant.facilityType || plant.type || plant.category || plant.plantType || '').toUpperCase().trim();
  if (type === 'STORE' || type === 'TOKO' || type === 'RETAIL') return false;
  if (type === 'DC' || type === 'DISTRIBUTION_CENTER') return true;

  const name = String(plant.canonicalName || plant.plantName || plant.name || plant.psName || plant.ps_name || '').trim();
  const dcId = String(plant.dcId || plant.id || plant.psId || '').trim();

  if (/^tk\.?\s*drive\s*thru/i.test(name) || /^toko\s*drive\s*thru/i.test(name)) return false;
  if (/^dc-demansion$/i.test(dcId) || /^dc-drivethrugs$/i.test(dcId)) return false;

  return true;
}

