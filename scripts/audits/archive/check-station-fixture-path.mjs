import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const fixturePath = path.join(rootDir, '.data/raw_station_list.json');

// If verifyStep3b already ran and generated output, let's make sure the 39 plants are written to .data/raw_station_list.json
console.log('Fixture path:', fixturePath, 'Exists:', fs.existsSync(fixturePath));
