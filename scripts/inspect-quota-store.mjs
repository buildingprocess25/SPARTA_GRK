import fs from 'node:fs';

const store = JSON.parse(fs.readFileSync('.data/solar_store.json', 'utf8'));
console.log('Store Quota State:', JSON.stringify(store.quota, null, 2));

if (store.telemetrySnapshots) {
  console.log('Telemetry Snapshots count:', store.telemetrySnapshots.length);
  store.telemetrySnapshots.forEach((s, idx) => {
    console.log(`Snapshot #${idx + 1}:`, s.timestamp, s.source, s.payload?.connectedGateway);
  });
}
