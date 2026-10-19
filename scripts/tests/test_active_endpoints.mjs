const endpoints = [
  '/api/plts/dashboard/summary',
  '/api/plts/dashboard/matrix',
  '/api/plts/dashboard/performance',
  '/api/plts/dashboard/pr',
  '/api/plts/dashboard/load',
  '/api/plts/dashboard/support',
  '/api/isolar',
  '/api/emissions?period=2026-01_2026-09',
  '/api/overview',
  '/api/facilities'
];

async function test() {
  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://localhost:3000${ep}`);
      const text = await res.text();
      console.log(`\n================== ${ep} ==================`);
      console.log(`Status: ${res.status} ${res.statusText}`);
      console.log(`Body (first 300 chars):\n${text.slice(0, 300)}`);
    } catch (err) {
      console.log(`\n================== ${ep} ==================`);
      console.log(`Fetch Error:`, err.message);
    }
  }
}

test();
