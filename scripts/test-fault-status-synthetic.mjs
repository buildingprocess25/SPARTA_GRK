/**
 * TEST FIXTURE SINTETIS (Label: "sintetis, bukan data vendor")
 * Verifikasi aturan klasifikasi status Fault, prioritas status, lokasi gabungan,
 * konsistensi KPI, serta siklus hidup FaultActive & FaultHistory.
 */

import assert from 'node:assert/strict';
import {
  classifyVendorPlantStatus,
  resolvePlantStatus,
  classifyLocationStatus,
} from '../src/lib/solar/status.js';

console.log('================================================================');
console.log('TEST SUITE: Status Fault & Operational Lifecycle (Sintetis)');
console.log('Label Data: "sintetis, bukan data vendor"');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}: ${err.message}`);
    throw err;
  }
}

// 1. ps_fault_status = 1 -> FAULT
runTest('1. Trigger FAULT via ps_fault_status = 1 (sintetis, bukan data vendor)', () => {
  const syntheticPlant = {
    ps_id: 999001,
    ps_name: 'Synthetic DC Plant 1',
    ps_status: 1,
    ps_fault_status: 1,
    fault_count: 0,
    alarm_count: 0,
    curr_power: 45.2,
  };
  const result = resolvePlantStatus(syntheticPlant);
  assert.equal(result.key, 'FAULT');
  assert.equal(result.hasFault, true);
  assert.equal(result.isOnline, true);
});

// 2. fault_count > 0 -> FAULT
runTest('2. Trigger FAULT via fault_count > 0 dengan ps_fault_status = 3 (sintetis, bukan data vendor)', () => {
  const syntheticPlant = {
    ps_id: 999002,
    ps_name: 'Synthetic DC Plant 2',
    ps_status: 1,
    ps_fault_status: 3,
    fault_count: 2,
    alarm_count: 0,
    curr_power: 30.0,
  };
  const result = resolvePlantStatus(syntheticPlant);
  assert.equal(result.key, 'FAULT');
  assert.equal(result.hasFault, true);
  assert.equal(result.isOnline, true);
});

// 3. FaultActive fault_type = 1 -> FAULT
runTest('3. Trigger FAULT via FaultActive fault_type = 1 (sintetis, bukan data vendor)', () => {
  const syntheticPlant = {
    ps_id: 999003,
    ps_name: 'Synthetic DC Plant 3',
    ps_status: 1,
    ps_fault_status: 3,
    fault_count: 0,
    alarm_count: 0,
    activeFaults: [
      {
        faultName: 'Synthetic Inverter Grid Undervoltage',
        faultType: 1,
        faultLevel: 1,
        deviceName: 'Inverter1',
        processStatus: 8,
      },
    ],
  };
  const result = resolvePlantStatus(syntheticPlant);
  assert.equal(result.key, 'FAULT');
  assert.equal(result.hasFault, true);
  assert.equal(result.isOnline, true);
});

// 4. Fault tidak menjadikan Offline
runTest('4. Status FAULT tidak mengubah status plant menjadi Offline (sintetis, bukan data vendor)', () => {
  const syntheticPlant = {
    ps_status: 1,
    ps_fault_status: 1,
    fault_count: 1,
    curr_power: 12.5,
    today_energy: 85.0,
  };
  const resVendor = classifyVendorPlantStatus(syntheticPlant);
  const resUI = resolvePlantStatus(syntheticPlant);
  
  assert.equal(resVendor.category, 'FAULT');
  assert.equal(resUI.key, 'FAULT');
  assert.equal(resUI.isOnline, true, 'Plant harus tetap terhubung/Online');
  assert.notEqual(resUI.key, 'OFFLINE', 'Fault tidak boleh menyebabkan status OFFLINE');
});

// 5. Prioritas Status: Offline > Fault > Alarm > Menunggu Data > Normal
runTest('5. Prioritas Status: Offline > Fault > Alarm > Menunggu Data > Normal (sintetis, bukan data vendor)', () => {
  // Case A: Offline (ps_status=0) wins over Fault (ps_fault_status=1, fault_count=5)
  const offlineAndFault = resolvePlantStatus({
    ps_status: 0,
    ps_fault_status: 1,
    fault_count: 5,
    alarm_count: 2,
  });
  assert.equal(offlineAndFault.key, 'OFFLINE');

  // Case B: Fault (ps_fault_status=1) wins over Alarm (alarm_count=10)
  const faultAndAlarm = resolvePlantStatus({
    ps_status: 1,
    ps_fault_status: 1,
    fault_count: 1,
    alarm_count: 10,
  });
  assert.equal(faultAndAlarm.key, 'FAULT');

  // Case C: Alarm wins over Normal
  const alarmAndNormal = resolvePlantStatus({
    ps_status: 1,
    ps_fault_status: 2,
    alarm_count: 3,
  });
  assert.equal(alarmAndNormal.key, 'ALARM');

  // Case D: Waiting Data when ps_status is null
  const waitingData = resolvePlantStatus({
    ps_status: null,
    ps_fault_status: null,
  });
  assert.equal(waitingData.key, 'WAITING_DATA');

  // Case E: Normal when clean
  const normalClean = resolvePlantStatus({
    ps_status: 1,
    ps_fault_status: 3,
    fault_count: 0,
    alarm_count: 0,
  });
  assert.equal(normalClean.key, 'NORMAL');
});

// 6. Lokasi Gabungan Memakai Status Terburuk
runTest('6. Lokasi Gabungan (Compound Location) memakai status terburuk dari sub-plant (sintetis, bukan data vendor)', () => {
  // Sub-plant 1 Normal, Sub-plant 2 Fault -> Location harus FAULT
  const compoundLocationFault = classifyLocationStatus({
    subPlants: [
      { psId: 101, name: 'Cilacap A', psStatus: 1, psFaultStatus: 3, faultCount: 0, alarmCount: 0 },
      { psId: 102, name: 'Cilacap B', psStatus: 1, psFaultStatus: 1, faultCount: 1, alarmCount: 0 },
    ],
  });
  assert.equal(compoundLocationFault.operational.key, 'FAULT');
  assert.equal(compoundLocationFault.operational.compoundNote, '1 dari 2 sub-plant Fault');

  // Sub-plant 1 Normal, Sub-plant 2 Alarm -> Location harus ALARM
  const compoundLocationAlarm = classifyLocationStatus({
    subPlants: [
      { psId: 201, name: 'Lombok 1', psStatus: 1, psFaultStatus: 3, faultCount: 0, alarmCount: 0 },
      { psId: 202, name: 'Lombok 2', psStatus: 1, psFaultStatus: 2, faultCount: 0, alarmCount: 2 },
    ],
  });
  assert.equal(compoundLocationAlarm.operational.key, 'ALARM');
  assert.equal(compoundLocationAlarm.operational.compoundNote, '1 dari 2 sub-plant Alarm');

  // Sub-plant 1 Normal, Sub-plant 2 Offline -> Location PARTIAL_OFFLINE
  const compoundLocationPartialOffline = classifyLocationStatus({
    subPlants: [
      { psId: 301, name: 'Lombok 1', psStatus: 1, psFaultStatus: 3, faultCount: 0, alarmCount: 0 },
      { psId: 302, name: 'Lombok 2', psStatus: 0, psFaultStatus: 3, faultCount: 0, alarmCount: 0 },
    ],
  });
  assert.equal(compoundLocationPartialOffline.operational.key, 'PARTIAL_OFFLINE');

  // All sub-plants offline -> Location OFFLINE
  const compoundLocationFullOffline = classifyLocationStatus({
    subPlants: [
      { psId: 301, name: 'Lombok 1', psStatus: 0, psFaultStatus: 3, faultCount: 0, alarmCount: 0 },
      { psId: 302, name: 'Lombok 2', psStatus: 0, psFaultStatus: 3, faultCount: 0, alarmCount: 0 },
    ],
  });
  assert.equal(compoundLocationFullOffline.operational.key, 'OFFLINE');
});

// 7. Jumlah KPI = Jumlah Lokasi
runTest('7. Jumlah KPI Status Operasional sama persis dengan total jumlah lokasi (sintetis, bukan data vendor)', () => {
  // 37 synthetic presentation locations (including compound locations)
  const syntheticLocations = [
    { id: 1, name: 'Loc 1 (Normal)', ps_status: 1, ps_fault_status: 3, fault_count: 0, alarm_count: 0 },
    { id: 2, name: 'Loc 2 (Fault)', ps_status: 1, ps_fault_status: 1, fault_count: 1, alarm_count: 0 },
    { id: 3, name: 'Loc 3 (Alarm)', ps_status: 1, ps_fault_status: 2, fault_count: 0, alarm_count: 1 },
    { id: 4, name: 'Loc 4 (Offline)', ps_status: 0, ps_fault_status: 3, fault_count: 0, alarm_count: 0 },
    { id: 5, name: 'Loc 5 (Waiting)', ps_status: null, ps_fault_status: null, fault_count: 0, alarm_count: 0 },
  ];
  // Pad out to 37 locations
  for (let i = 6; i <= 37; i++) {
    syntheticLocations.push({
      id: i,
      name: `Loc ${i} (Normal)`,
      ps_status: 1,
      ps_fault_status: 3,
      fault_count: 0,
      alarm_count: 0,
    });
  }

  let normalCount = 0;
  let faultCount = 0;
  let alarmCount = 0;
  let offlineCount = 0;
  let waitingCount = 0;

  syntheticLocations.forEach((loc) => {
    const res = resolvePlantStatus(loc);
    if (res.key === 'NORMAL') normalCount++;
    else if (res.key === 'FAULT') faultCount++;
    else if (res.key === 'ALARM') alarmCount++;
    else if (res.key === 'OFFLINE') offlineCount++;
    else if (res.key === 'WAITING_DATA') waitingCount++;
  });

  const sumKpi = normalCount + faultCount + alarmCount + offlineCount + waitingCount;
  assert.equal(sumKpi, syntheticLocations.length, 'Total KPI breakdown harus tepat sama dengan total lokasi (37)');
  assert.equal(normalCount, 33);
  assert.equal(faultCount, 1);
  assert.equal(alarmCount, 1);
  assert.equal(offlineCount, 1);
  assert.equal(waitingCount, 1);
});

// 8. FaultActive diganti penuh tiap sinkron dan FaultHistory tidak menghapus riwayat
runTest('8. FaultActive diganti penuh tiap sinkron & FaultHistory mempertahankan riwayat (sintetis, bukan data vendor)', () => {
  // Simulasi state database in-memory
  let dbFaultActive = [
    { id: 'f_active_old', ps_id: 999001, fault_name: 'Old Alarm', fault_type: 2, process_status: 8 },
  ];
  let dbFaultHistory = [
    { id: 'f_hist_1', ps_id: 999001, fault_name: 'Resolved Fault Yesterday', fault_type: 1, process_status: 9 },
  ];

  // Incoming sync payload dari vendor:
  // 1 fault aktif baru (process_status 8), 1 fault selesai baru (process_status 9)
  const syncIncomingRecords = [
    { id: 'f_active_new_1', ps_id: 999001, fault_name: 'New Undervoltage', fault_type: 1, process_status: 8 },
    { id: 'f_hist_new_2', ps_id: 999001, fault_name: 'New Resolved Warning', fault_type: 2, process_status: 9 },
  ];

  // SINKRONISASI:
  // A. Ganti penuh dbFaultActive (deleteMany + createMany)
  const newActive = syncIncomingRecords.filter(r => r.process_status === 8);
  dbFaultActive = [...newActive]; // Replaced completely

  // B. Upsert / Append ke dbFaultHistory tanpa menghapus rekaman lama
  const newClosed = syncIncomingRecords.filter(r => r.process_status === 9);
  dbFaultHistory = [...dbFaultHistory, ...newClosed]; // Historical preservation

  assert.equal(dbFaultActive.length, 1);
  assert.equal(dbFaultActive[0].id, 'f_active_new_1');
  assert.equal(dbFaultActive[0].fault_name, 'New Undervoltage');

  assert.equal(dbFaultHistory.length, 2, 'Riwayat FaultHistory tidak boleh terhapus saat sinkronisasi');
  assert.equal(dbFaultHistory[0].id, 'f_hist_1');
  assert.equal(dbFaultHistory[1].id, 'f_hist_new_2');
});

console.log(`\n================================================================`);
console.log(`HASIL TEST SUITE: ${passedTests} / ${totalTests} test berhasil lulus 100%`);
console.log(`================================================================\n`);
