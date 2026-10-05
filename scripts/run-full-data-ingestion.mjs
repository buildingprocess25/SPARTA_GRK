import { runFullDataIngestionPipeline } from '../src/lib/importers/excelImporter.js';

async function main() {
  try {
    const result = await runFullDataIngestionPipeline();
    console.log('Ingestion completed successfully:', result);
    process.exit(0);
  } catch (err) {
    console.error('Ingestion failed:', err);
    process.exit(1);
  }
}

main();
