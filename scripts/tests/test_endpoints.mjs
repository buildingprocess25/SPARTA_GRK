const endpoints = [
  '/api/plts/dashboard/summary',
  '/api/isolar',
  '/api/emissions',
  '/api/solar/plants',
  '/api/solar/history',
  '/api/solar/energy-balance',
  '/api/solar/target-rkap'
];

async function test() {
  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://localhost:3000${ep}`);
      const text = await res.text();
      console.log(`\n================== ${ep} ==================`);
      console.log(`Status: ${res.status} ${res.statusText}`);
      console.log(`Body (first 500 chars):\n${text.slice(0, 500)}`);
    } catch (err) {
      console.log(`\n================== ${ep} ==================`);
      console.log(`Fetch Error:`, err.message);
    }
  }
}

test();
