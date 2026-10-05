import fs from 'fs';
import path from 'path';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';
import prisma from '../src/lib/prisma.js';

async function capture() {
  console.log('Capturing Golden Snapshots for PLTS Dashboard...');
  const snapshotDir = path.resolve(process.cwd(), 'test-fixtures');
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const queriesToSnapshot = [
    {
      name: 'ytd_2026_sep_all',
      query: { period: '2026-01_2026-09', mode: 'YTD', month: '9', throughMonth: '9', compare: '2025,2026', grid: 'ALL', plant: 'ALL' }
    },
    {
      name: 'month_2026_sep_all',
      query: { period: '2026-09_2026-09', mode: 'MONTH', month: '9', throughMonth: '9', compare: '2025,2026', grid: 'ALL', plant: 'ALL' }
    },
    {
      name: 'ytd_2026_sep_jamali',
      query: { period: '2026-01_2026-09', mode: 'YTD', month: '9', throughMonth: '9', compare: '2025,2026', grid: 'JAMALI', plant: 'ALL' }
    },
    {
      name: 'ytd_2026_sep_single_plant',
      query: { period: '2026-01_2026-09', mode: 'YTD', month: '9', throughMonth: '9', compare: '2025,2026', grid: 'ALL', plant: 'DC_CIKOKOL' }
    },
  ];

  const now = new Date('2026-10-02T13:00:00Z');
  const snapshots = {};

  for (const item of queriesToSnapshot) {
    const data = await getPltsDashboard(item.query, { db: prisma, now });
    snapshots[item.name] = data;
    const filepath = path.join(snapshotDir, `golden_snapshot_${item.name}.json`);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Saved snapshot: ${filepath}`);
  }

  console.log('Golden snapshots captured successfully!');
  await prisma.$disconnect();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
