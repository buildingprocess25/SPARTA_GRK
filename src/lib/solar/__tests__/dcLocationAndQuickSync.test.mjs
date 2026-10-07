import test from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_DC_ENTITIES, isDcLocation } from '../plantMap.js';

test('isDcLocation filters out non-DC locations (Tk. Drive Thru)', () => {
  // 1. Total canonical entities is 39
  assert.equal(CANONICAL_DC_ENTITIES.length, 39);

  // 2. DC-only filtered entities is exactly 37
  const dcOnly = CANONICAL_DC_ENTITIES.filter(isDcLocation);
  assert.equal(dcOnly.length, 37);

  // 3. Specifically excludes De Mansion and Drive Thru GS
  const excludedNames = CANONICAL_DC_ENTITIES.filter(e => !isDcLocation(e)).map(e => e.canonicalName);
  assert.deepEqual(excludedNames.sort(), ['Tk. Drive Thru De Mansion', 'Tk. Drive Thru GS'].sort());

  // 4. Test case-insensitivity and prefix patterns
  assert.equal(isDcLocation({ name: 'Tk. Drive Thru De Mansion' }), false);
  assert.equal(isDcLocation({ name: 'tk. drive thru gs' }), false);
  assert.equal(isDcLocation({ plantName: 'Toko Drive Thru XYZ' }), false);
  assert.equal(isDcLocation({ canonicalName: 'TK DRIVE THRU TEST' }), false);
  assert.equal(isDcLocation({ dcId: 'DC-DEMANSION' }), false);
  assert.equal(isDcLocation({ dcId: 'DC-DRIVETHRUGS' }), false);
  assert.equal(isDcLocation({ facilityType: 'STORE' }), false);
  assert.equal(isDcLocation({ type: 'STORE' }), false);

  // 5. Test valid DC locations
  assert.equal(isDcLocation({ canonicalName: 'Parung', dcId: 'DC-PARUNG' }), true);
  assert.equal(isDcLocation({ canonicalName: 'Luwu', dcId: 'DC-LUWU' }), true);
  assert.equal(isDcLocation({ canonicalName: 'Cilacap 1', dcId: 'DC-CILACAP-1' }), true);
  assert.equal(isDcLocation({ canonicalName: 'Cileungsi', dcId: 'DC-CILEUNGSI' }), true);

  // 6. Capacity of 37 DC locations
  const totalDcCapacity = dcOnly.reduce((sum, dc) => sum + (dc.apiInstalledKwp || 0), 0);
  // 5876.12 - 57.72 - 39.60 = 5778.80 kWp
  assert.equal(Number(totalDcCapacity.toFixed(2)), 5778.80);
});
