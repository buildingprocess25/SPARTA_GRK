import fs from 'node:fs';

const psl = JSON.parse(fs.readFileSync('docs/evidence/vendor-20261005-1355/03_getPowerStationList.json'));
const list = psl.response.result_data.pageList;

console.log('| No | Nama Stasiun Vendor | `ps_id` | Daya (kW) | Energi (kWh) | `ps_status` | `ps_fault_status` | `alarm_count` | Kategori Portal | Klasifikasi Dashboard Saat Ini |');
console.log('| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |');

list.forEach((p, idx) => {
  const psId = p.ps_id;
  const power = p.curr_power?.value ?? 0;
  const energy = p.today_energy?.value ?? 0;
  let portalCat = 'Normal';
  if (psId === 1247367 || psId === 1162742) {
    portalCat = 'Offline (1 dev offline)';
  } else if (p.ps_fault_status === 2 || p.alarm_count > 0) {
    portalCat = 'Abnormal (1 alarm)';
  } else if (psId === 1585267 || (Number(power) === 0 && Number(energy) === 0)) {
    portalCat = 'Normal (0 kW / Pembangunan)';
  }

  let dashCat = 'Normal Producing';
  if (psId === 1585267 || (Number(power) === 0 && Number(energy) === 0)) {
    dashCat = 'Standby (Menunggu / Konstruksi)';
  } else if (p.ps_fault_status === 2 || p.alarm_count > 0) {
    dashCat = 'Alarm / Gangguan';
  }

  console.log(`| ${idx + 1} | ${p.ps_name} | \`${psId}\` | ${power} | ${energy} | \`${p.ps_status}\` | \`${p.ps_fault_status}\` | \`${p.alarm_count}\` | ${portalCat} | ${dashCat} |`);
});
