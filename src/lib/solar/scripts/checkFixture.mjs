import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const storePath = path.join(rootDir, '.data/solar_store.json');
const fixturePath = path.join(rootDir, '.data/raw_station_list.json');

// Let's check if fixture already exists or write it
if (!fs.existsSync(fixturePath)) {
  console.log('Fixture will be created from Step 3b cached plant data');
}
