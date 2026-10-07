import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import fs from 'fs';

async function main() {
  console.log('=== TEST B3: getDevicePointsDayMonthYearDataList with ps_key_list ===');
  
  // Test with ps_key_list
  const samplePsKeys = ['1092345_5_4_1', '1223413_5_5_1', '1154267_5_3_1'];
  try {
    const res = await executeIsolarRequest('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: samplePsKeys,
      query_type: '2', // month
      data_type: '4',
      start_time_stamp: '202601',
      end_time_stamp: '202609'
    }, { isLive: true, category: 'Historical Aggregation' });

    console.log('Response code:', res?.data?.result_code, 'msg:', res?.data?.result_msg);
    console.log('Response data:', JSON.stringify(res?.data?.result_data, null, 2)?.slice(0, 800));
  } catch (err) {
    console.error('Error querying device points:', err.message);
  }

  console.log('\n=== INSPECT Monthly Report CSV 2026 for Feed-in / Purchased / Load ===');
  const csvPath = 'Monthly Report_Annual report_20261001111530.csv';
  if (fs.existsSync(csvPath)) {
    const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim().length > 0);
    console.log('Header line 1:', lines[0]);
    console.log('Header line 2:', lines[1]);
    console.log(`Total data rows: ${lines.length - 2}`);
    
    // Parse sample rows
    const headerCols = lines[1].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    console.log('Columns:', headerCols);
    
    // Check Feed-in values across rows
    let nonZeroFeedIn = 0;
    let nonZeroPurchased = 0;
    let nonZeroLoad = 0;
    let totalRows = 0;
    const sampleRows = [];

    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < headerCols.length) continue;
      totalRows++;
      const plant = cols[0];
      const time = cols[1];
      const yieldKwh = Number(cols[3]) || 0;
      const loadKwh = Number(cols[4]) || 0;
      const purchasedKwh = Number(cols[5]) || 0;
      const feedInKwh = Number(cols[6]) || 0;

      if (feedInKwh > 0) nonZeroFeedIn++;
      if (purchasedKwh > 0) nonZeroPurchased++;
      if (loadKwh > 0) nonZeroLoad++;

      if (i < 12 || feedInKwh > 0) {
        sampleRows.push({ plant, time, yieldKwh, loadKwh, purchasedKwh, feedInKwh });
      }
    }

    console.log(`Summary of 2026 CSV (${totalRows} rows):`);
    console.log(`- Rows with Feed-in > 0: ${nonZeroFeedIn}`);
    console.log(`- Rows with Purchased > 0: ${nonZeroPurchased}`);
    console.log(`- Rows with Load > 0: ${nonZeroLoad}`);
    console.log('Sample rows:', sampleRows.slice(0, 10));
  }
}

main().catch(console.error);
