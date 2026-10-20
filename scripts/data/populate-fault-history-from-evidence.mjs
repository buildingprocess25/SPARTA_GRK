import prisma from '../../src/lib/prisma.ts';
import fs from 'fs';

async function main() {
  console.log('Populating fault_history from Pontianak getFaultAlarmInfo evidence...');
  // Read trace evidence from earlier trace if exists or load Pontianak raw records
  const rawData = [
    {
      id: "1223413_27_20261005164401",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 16:44:01",
      over_time: "2026-10-05 16:49:10",
      process_status: "9"
    },
    {
      id: "1223413_28_20261005154308",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 15:43:08",
      over_time: "2026-10-05 15:48:10",
      process_status: "9"
    },
    {
      id: "1223413_29_20261005153705",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 15:37:05",
      over_time: "2026-10-05 15:42:07",
      process_status: "9"
    },
    {
      id: "1223413_30_20261005143806",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 14:38:06",
      over_time: "2026-10-05 14:43:08",
      process_status: "9"
    },
    {
      id: "1223413_31_20261005133603",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 13:36:03",
      over_time: "2026-10-05 13:41:05",
      process_status: "9"
    },
    {
      id: "1223413_32_20261005131603",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 13:16:03",
      over_time: "2026-10-05 13:21:05",
      process_status: "9"
    },
    {
      id: "1223413_33_20261005130702",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 13:07:02",
      over_time: "2026-10-05 13:12:04",
      process_status: "9"
    },
    {
      id: "1223413_34_20261005125302",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 12:53:02",
      over_time: "2026-10-05 12:58:04",
      process_status: "9"
    },
    {
      id: "1223413_35_20261005124003",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 12:40:03",
      over_time: "2026-10-05 12:45:05",
      process_status: "9"
    },
    {
      id: "1223413_36_20261005122702",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 12:27:02",
      over_time: "2026-10-05 12:32:04",
      process_status: "9"
    },
    {
      id: "1223413_37_20261005120603",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 12:06:03",
      over_time: "2026-10-05 12:11:05",
      process_status: "9"
    },
    {
      id: "1223413_38_20261005115201",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 11:52:01",
      over_time: "2026-10-05 11:57:04",
      process_status: "9"
    },
    {
      id: "1223413_39_20261005112803",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 11:28:03",
      over_time: "2026-10-05 11:33:05",
      process_status: "9"
    },
    {
      id: "1223413_40_20261005111902",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 11:19:02",
      over_time: "2026-10-05 11:24:04",
      process_status: "9"
    },
    {
      id: "1223413_41_20261005111003",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 11:10:03",
      over_time: "2026-10-05 11:15:05",
      process_status: "9"
    },
    {
      id: "1223413_42_20261005105902",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 10:59:02",
      over_time: "2026-10-05 11:04:04",
      process_status: "9"
    },
    {
      id: "1223413_43_20261005103602",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 10:36:02",
      over_time: "2026-10-05 10:41:04",
      process_status: "9"
    },
    {
      id: "1223413_44_20261005102501",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 10:25:01",
      over_time: "2026-10-05 10:30:03",
      process_status: "9"
    },
    {
      id: "1223413_45_20261005101202",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 10:12:02",
      over_time: "2026-10-05 10:17:04",
      process_status: "9"
    },
    {
      id: "1223413_46_20261005095701",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 09:57:01",
      over_time: "2026-10-05 10:02:04",
      process_status: "9"
    },
    {
      id: "1223413_47_20261005094602",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 09:46:02",
      over_time: "2026-10-05 09:51:04",
      process_status: "9"
    },
    {
      id: "1223413_48_20261005092902",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 09:29:02",
      over_time: "2026-10-05 09:34:04",
      process_status: "9"
    },
    {
      id: "1223413_49_20261005091702",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 09:17:02",
      over_time: "2026-10-05 09:22:04",
      process_status: "9"
    },
    {
      id: "1223413_50_20261005090401",
      ps_id: 1223413,
      ps_key: "1223413_1_0_0",
      fault_name: "Grid undervoltage",
      fault_type: 1,
      fault_level: 1,
      create_time: "2026-10-05 09:04:01",
      over_time: "2026-10-05 09:09:04",
      process_status: "9"
    }
  ];

  let inserted = 0;
  for (const item of rawData) {
    const createTimeDate = new Date(item.create_time + ' UTC+07:00'); // WIB
    const overTimeDate = new Date(item.over_time + ' UTC+07:00'); // WIB
    await prisma.$executeRaw`
      INSERT INTO fault_history (
        fault_code, ps_id, ps_key, fault_name, fault_type, fault_level,
        create_time, over_time, process_status, first_seen_at, last_seen_at
      ) VALUES (
        ${item.id}, ${item.ps_id}, ${item.ps_key}, ${item.fault_name}, ${item.fault_type}, ${item.fault_level},
        ${createTimeDate}, ${overTimeDate}, ${item.process_status}, NOW(), NOW()
      )
      ON CONFLICT (fault_code) DO UPDATE SET
        over_time = EXCLUDED.over_time,
        process_status = EXCLUDED.process_status,
        last_seen_at = NOW()
    `;
    inserted++;
  }

  console.log(`Successfully populated ${inserted} closed fault records into fault_history table.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
