const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'SCH_Murderhouse_2026-02-07 (2).json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const shapes = data.schematics[0].dataStr.shape;

// =====================================================================
// 1. EXTRACT ALL COMPONENTS WITH DETAILS
// =====================================================================
console.log('=== COMPONENT INVENTORY ===\n');

const components = [];
for (let i = 0; i < shapes.length; i++) {
  const s = shapes[i];
  if (!s.startsWith('LIB~')) continue;

  // Extract package info from the backtick-delimited metadata
  const packageMatch = s.match(/package`([^`]*)`/);
  const supplierPartMatch = s.match(/Supplier Part`([^`]*)`/);
  const manufacturerPartMatch = s.match(/Manufacturer Part`([^`]*)`/);
  const manufacturerMatch = s.match(/Manufacturer`([^`]*)`/);

  // Extract ref designator from the T~P (prefix) comment field
  // Format: #@$T~P~x~y~rot~color~font~~~~~comment~REFDES~
  const refDesMatch = s.match(/#@\$T~P~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~~~~~comment~([^~]*?)~/);

  // Extract value from T~N (name) comment field
  const valueMatch = s.match(/#@\$T~N~[^~]*~[^~]*~[^~]*~[^~]*~[^~]*~~~~~comment~([^~]*?)~/);

  const comp = {
    shapeIndex: i,
    refDes: refDesMatch ? refDesMatch[1] : 'UNKNOWN',
    value: valueMatch ? valueMatch[1] : '',
    package: packageMatch ? packageMatch[1] : '',
    supplierPart: supplierPartMatch ? supplierPartMatch[1] : '',
    manufacturerPart: manufacturerPartMatch ? manufacturerPartMatch[1] : '',
    manufacturer: manufacturerMatch ? manufacturerMatch[1] : ''
  };
  components.push(comp);
}

// Sort and display
components.sort((a, b) => {
  // Extract letter prefix and number for sorting
  const aMatch = a.refDes.match(/^([A-Z]+)(\d+)/);
  const bMatch = b.refDes.match(/^([A-Z]+)(\d+)/);
  if (aMatch && bMatch) {
    if (aMatch[1] !== bMatch[1]) return aMatch[1].localeCompare(bMatch[1]);
    return parseInt(aMatch[2]) - parseInt(bMatch[2]);
  }
  return a.refDes.localeCompare(b.refDes);
});

for (const c of components) {
  console.log(`${c.refDes.padEnd(20)} | Value: ${c.value.padEnd(30)} | Package: ${c.package.padEnd(35)} | LCSC: ${c.supplierPart.padEnd(12)} | Mfr Part: ${c.manufacturerPart}`);
}

// =====================================================================
// 2. CHECK FOR EXPECTED COMPONENTS
// =====================================================================
console.log('\n=== EXPECTED vs FOUND ===\n');

const expectedRefs = [
  'J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9', 'J10', 'J11', 'J12',
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8',
  'C1',
  'D1', 'D2', 'D3',
  'SW1'
];

const foundRefs = components.map(c => {
  // Normalize: "J1_ESP_LEFT" -> "J1"
  const m = c.refDes.match(/^([A-Z]+\d+)/);
  return m ? m[1] : c.refDes;
});

for (const expected of expectedRefs) {
  const found = components.find(c => {
    const m = c.refDes.match(/^([A-Z]+\d+)/);
    return m && m[1] === expected;
  });
  if (found) {
    console.log(`  [FOUND]   ${expected.padEnd(5)} -> ${found.refDes} (${found.value}, LCSC: ${found.supplierPart})`);
  } else {
    console.log(`  [MISSING] ${expected}`);
  }
}

// Check for extras
const normalizedExpected = new Set(expectedRefs);
const extras = components.filter(c => {
  const m = c.refDes.match(/^([A-Z]+\d+)/);
  const base = m ? m[1] : c.refDes;
  return !normalizedExpected.has(base);
});
if (extras.length > 0) {
  console.log('\nExtra components not in design doc:');
  for (const e of extras) {
    console.log(`  ${e.refDes} (${e.value}, LCSC: ${e.supplierPart})`);
  }
}

// =====================================================================
// 3. RESISTOR VALUE COMPARISON
// =====================================================================
console.log('\n=== RESISTOR VALUE COMPARISON ===\n');

const expectedResistors = {
  'R1': { value: '100\u03A9', lcsc: 'C17408', purpose: 'YES button LED (yellow)' },
  'R2': { value: '150\u03A9', lcsc: 'C17471', purpose: 'NO button LED (red)' },
  'R3': { value: '330\u03A9', lcsc: 'C17630', purpose: 'Neopixel data line' },
  'R4': { value: '220\u03A9', lcsc: 'C17557', purpose: 'Power LED D1 (yellow)' },
  'R5': { value: '4.7k\u03A9', lcsc: 'C17673', purpose: 'I2C SDA pullup' },
  'R6': { value: '4.7k\u03A9', lcsc: 'C17673', purpose: 'I2C SCL pullup' },
  'R7': { value: '150\u03A9', lcsc: 'C17471', purpose: 'I2C status LED D2 (red)' },
  'R8': { value: '100\u03A9', lcsc: 'C17408', purpose: 'Heartbeat LED D3 (green)' }
};

for (const [ref, expected] of Object.entries(expectedResistors)) {
  const found = components.find(c => c.refDes.startsWith(ref + '_') || c.refDes === ref || c.refDes.match(new RegExp('^' + ref + '\\b')));
  if (found) {
    const valueMatch = found.value === expected.value ? 'OK' : 'MISMATCH';
    const lcscMatch = found.supplierPart === expected.lcsc ? 'OK' : 'MISMATCH';
    console.log(`${ref}: Expected ${expected.value} (${expected.lcsc}) | Found ${found.value} (${found.supplierPart}) | Value: ${valueMatch} | LCSC: ${lcscMatch}`);
    if (valueMatch === 'MISMATCH' || lcscMatch === 'MISMATCH') {
      console.log(`   *** PURPOSE: ${expected.purpose} ***`);
    }
  } else {
    console.log(`${ref}: MISSING from schematic (expected ${expected.value}, ${expected.lcsc} for ${expected.purpose})`);
  }
}

// =====================================================================
// 4. CONNECTOR TYPE CHECK
// =====================================================================
console.log('\n=== CONNECTOR TYPE CHECK ===\n');

const connectorChecks = {
  'J3': { type: 'JST-XH 7-pin', lcsc: 'C144398', part: 'B7B-XH' },
  'J4': { type: 'JST-XH 4-pin', lcsc: 'C144395', part: 'B4B-XH' },
  'J5': { type: 'JST-XH 4-pin', lcsc: 'C144395', part: 'B4B-XH' },
  'J6': { type: 'JST-XH 5-pin', lcsc: 'C157991', part: 'B5B-XH' },
  'J7': { type: 'JST-XH 3-pin', lcsc: 'C144394', part: 'B3B-XH' },
  'J8': { type: 'JST-XH 6-pin', lcsc: 'C144397', part: 'B6B-XH' },
  'J9': { type: 'JST-XH 4-pin', lcsc: 'C144395', part: 'B4B-XH' },
  'J10': { type: 'JST-XH 2-pin', lcsc: 'C158012', part: 'B2B-XH' },
  'J11': { type: 'JST-XH 2-pin', lcsc: 'C158012', part: 'B2B-XH' },
  'J12': { type: 'JST-XH 2-pin', lcsc: 'C158012', part: 'B2B-XH' },
};

for (const [ref, expected] of Object.entries(connectorChecks)) {
  const found = components.find(c => {
    const m = c.refDes.match(/^([A-Z]+\d+)/);
    return m && m[1] === ref;
  });
  if (found) {
    const isXH = found.manufacturerPart.includes('XH') || found.package.includes('XH');
    const lcscOk = found.supplierPart === expected.lcsc;
    const partOk = found.manufacturerPart.includes(expected.part.replace('XH', 'XH-A'));
    console.log(`${ref}: ${expected.type} | Found: ${found.manufacturerPart} (LCSC: ${found.supplierPart}) | JST-XH: ${isXH ? 'YES' : 'NO'} | LCSC Match: ${lcscOk ? 'OK' : 'MISMATCH'}`);
  } else {
    console.log(`${ref}: MISSING`);
  }
}

// =====================================================================
// 5. NET/WIRE CONNECTION ANALYSIS
// =====================================================================
console.log('\n=== NET LABELS (from junction and wire shapes) ===\n');

// Look at all shapes for net labels
for (let i = 0; i < shapes.length; i++) {
  const s = shapes[i];
  // NetLabel shapes in EasyEDA typically contain GPIO references
  if (s.includes('GPIO') || s.includes('SDA') || s.includes('SCL') || s.includes('NEOPIXEL') ||
      s.includes('OLED') || s.includes('BTN') || s.includes('LED') || s.includes('ENCODER') ||
      s.includes('HEARTBEAT') || s.includes('HB_') || s.includes('I2C')) {
    if (!s.startsWith('LIB~') && !s.startsWith('W~')) {
      console.log(`Shape ${i} (${s.substring(0,3)}): ${s.substring(0, 400)}`);
    }
  }
}

// Check wire shapes for net names
console.log('\n=== WIRE NET NAMES ===\n');
for (let i = 0; i < shapes.length; i++) {
  const s = shapes[i];
  if (s.startsWith('W~')) {
    // Wire shapes may contain net names
    const parts = s.split('~');
    // Typically net name is one of the fields
    const hasNetName = parts.find(p => p.includes('GPIO') || p.includes('GND') || p.includes('VCC') ||
      p.includes('3V3') || p.includes('5V') || p.includes('SDA') || p.includes('SCL'));
    if (hasNetName) {
      console.log(`Wire ${i}: ${hasNetName}`);
    }
  }
}

// Look for net flags (power, GND, etc)
console.log('\n=== POWER/NET FLAGS ===\n');
for (let i = 0; i < shapes.length; i++) {
  const s = shapes[i];
  if (s.startsWith('F~') || s.startsWith('O~')) {
    console.log(`Shape ${i} (${s.substring(0,1)}): ${s.substring(0, 300)}`);
  }
}
