import { PrismaClient } from '../src/generated/prisma/index.js';
import {
  CARBON_FACTORS,
  getGridEmissionFactor,
  getGridEmissionFactorDetails,
  calculateScope1FuelEmission,
  calculateScope2ElectricityEmission,
  calculatePLTSAvoidedEmissions
} from '../src/lib/carbon/carbonEngine.js';
import {
  MASTER_FACILITIES,
  BRANCH_LIST,
  FACILITY_TYPES,
  getFilteredFacilities,
  findFacilityById
} from '../src/lib/master/facilityMaster.js';

const prisma = new PrismaClient();

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✔ PASS: ${message}`);
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runMasterFacilitiesTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: MASTER FASILITAS, PEMETAAN PLANT, & FAKTOR AUDIT');
  console.log('================================================================\n');

  // --- SUITE 1: VERIFIKASI SUMBER & MASTER DATABASE ---
  console.log('--- SUITE 1: Verifikasi Sumber & Database Master Fasilitas ---');
  const dbFacilityCount = await prisma.facilityMaster.count();
  assert(dbFacilityCount >= 40, `FacilityMaster di PostgreSQL memiliki ${dbFacilityCount} fasilitas terverifikasi (min 40)`);

  const hoFacility = await prisma.facilityMaster.findUnique({
    where: { id: 'FAC-HO-ALFATOWER' }
  });
  assert(hoFacility !== null, 'Alfa Tower Head Office terdaftar di database (FAC-HO-ALFATOWER)');
  assert(hoFacility.facilityType === 'HO', 'Alfa Tower bertipe HO');
  assert(hoFacility.verificationStatus === 'VERIFIED', 'Alfa Tower berstatus VERIFIED');
  assert(hoFacility.sourceMaster === 'HO_MASTER_CORPORATE', 'Alfa Tower memiliki sumber master korporat yang sahih');

  // --- SUITE 2: FASILITAS NON-PLTS MENCATAT SCOPE 1 & 2 ---
  console.log('\n--- SUITE 2: Fasilitas Non-PLTS Mencatat Scope 1 & Scope 2 ---');
  // Scope 1 Genset di HO
  const scope1GensetHO = calculateScope1FuelEmission({
    fuelType: 'SOLAR',
    liters: 2500
  });
  assert(scope1GensetHO.emissionTon > 0, `HO dapat menghitung Scope 1 Genset (2500 L Solar = ${scope1GensetHO.emissionTon.toFixed(4)} Ton CO2e)`);

  // Scope 2 Listrik PLN di HO
  const scope2ElectricityHO = calculateScope2ElectricityEmission({
    kwh: 450000,
    customGridFactor: hoFacility.gridEmissionFactor
  });
  assert(scope2ElectricityHO.emissionTon > 0, `HO dapat menghitung Scope 2 PLN Jamali (450.000 kWh = ${scope2ElectricityHO.emissionTon.toFixed(4)} Ton CO2e)`);

  // Scope 1 Kendaraan di Kantor Cabang Cikokol
  const branchOfficeCikokol = findFacilityById('FAC-BR-TGR1');
  assert(branchOfficeCikokol !== null, 'Kantor Cabang Cikokol terdaftar');
  const scope1VehicleBranch = calculateScope1FuelEmission({
    fuelType: 'PERTALITE',
    liters: 800
  });
  assert(scope1VehicleBranch.emissionTon > 0, `Kantor Cabang dapat mencatat Scope 1 Kendaraan (${scope1VehicleBranch.emissionTon.toFixed(4)} Ton CO2e)`);

  // --- SUITE 3: PEMISAHAN PLANT DARI FASILITAS & TOKO BUKAN DC ---
  console.log('\n--- SUITE 3: Pemisahan Plant PLTS dari Fasilitas Fisik & Toko Ritel ---');
  const plantDeMansion = await prisma.facilityMaster.findUnique({
    where: { id: 'FAC-STR-DEMANSION' }
  });
  assert(plantDeMansion !== null, 'Fasilitas Toko De Mansion terdaftar di database');
  assert(plantDeMansion.facilityType === 'STORE', 'Plant Tk. Drive Thru De Mansion berklasifikasi STORE (Bukan DC)');

  const plantGS = await prisma.facilityMaster.findUnique({
    where: { id: 'FAC-STR-GS' }
  });
  assert(plantGS !== null, 'Fasilitas Toko GS terdaftar di database');
  assert(plantGS.facilityType === 'STORE', 'Plant Tk. Drive Thru GS berklasifikasi STORE (Bukan DC)');

  // Verifikasi Plant Cilacap 1, 2, 3 ke Kompleks DC Cilacap
  const dcCilacap = await prisma.facilityMaster.findUnique({
    where: { id: 'FAC-DC-CILACAP' }
  });
  assert(dcCilacap !== null, 'Kompleks DC Cilacap terdaftar sebagai satu fasilitas fisik');
  assert(dcCilacap.meterType === 'SHARED', 'DC Cilacap bertipe SHARED meter untuk 3 plant (Cilacap 1, 2, 3)');

  // Verifikasi Plant Lombok A, B ke Kompleks DC Lombok
  const dcLombok = await prisma.facilityMaster.findUnique({
    where: { id: 'FAC-DC-LOMBOK' }
  });
  assert(dcLombok !== null, 'Kompleks DC Lombok terdaftar sebagai satu fasilitas fisik');
  assert(dcLombok.meterType === 'SHARED', 'DC Lombok bertipe SHARED meter untuk 2 plant (Lombok A & B)');

  // --- SUITE 4: REKONSILIASI FAKTOR GRID SUMATERA ---
  console.log('\n--- SUITE 4: Rekonsiliasi Faktor Emisi Grid Sumatera (ESDM 0.761 vs KLHK 0.77) ---');
  const sumateraFactorNum = getGridEmissionFactor('SUMATERA');
  assert(sumateraFactorNum === 0.761, `Faktor Grid Sumatera adalah 0.761 kgCO2e/kWh (ESDM No. 379.K/2021)`);

  const sumateraDetails = getGridEmissionFactorDetails('SUMATERA');
  assert(sumateraDetails.gridName === 'SUMATERA', 'Sistem interkoneksi Sumatera teridentifikasi');
  assert(sumateraDetails.auditNotes && sumateraDetails.auditNotes.includes('0.77'), 'Audit notes mencatat riwayat pembulatan 0.77');

  const dcMedan = findFacilityById('FAC-DC-MEDAN');
  assert(dcMedan !== null, 'DC Medan terdaftar');
  assert(dcMedan.gridFactor === 0.761, 'DC Medan menggunakan faktor grid Sumatera 0.761');

  // --- SUITE 5: FILTER, PENCARIAN, & PENGECUALIAN UNVERIFIED ---
  console.log('\n--- SUITE 5: Filter, Pencarian, & Pengecualian Fasilitas Unverified ---');
  const verifiedOnlyList = getFilteredFacilities({ includeUnverified: false });
  const hasAnyUnverified = verifiedOnlyList.some(f => f.verificationStatus === 'UNVERIFIED');
  assert(!hasAnyUnverified, 'Pilihan fasilitas produksi hanya menyertakan fasilitas VERIFIED');

  const dcOnlyList = getFilteredFacilities({ facilityType: 'DC' });
  assert(dcOnlyList.length >= 32, `Filter DC mengembalikan ${dcOnlyList.length} Distribution Centers`);

  const searchResults = getFilteredFacilities({ searchQuery: 'Balaraja' });
  assert(searchResults.length >= 1, `Pencarian 'Balaraja' menemukan ${searchResults.length} fasilitas`);

  // --- SUITE 6: SCOPE 3 DITUNDA & PERIODE DINAMIS ---
  console.log('\n--- SUITE 6: Scope 3 Ditunda & Periode Pelaporan Dinamis ---');
  assert(CARBON_FACTORS.SCOPE3 === undefined || CARBON_FACTORS.SCOPE3.IS_ACTIVE === false, 'Scope 3 ditunda dan tidak aktif dalam engine kalkulasi');

  console.log('\n================================================================');
  console.log(`HASIL AKTUIL PENGUJIAN: ${passedAssertions} dari ${totalAssertions} assertions BERHASIL.`);
  console.log('================================================================\n');
}

runMasterFacilitiesTestSuite()
  .catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
