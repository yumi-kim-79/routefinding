// bouldering_csv_to_nfc.js
const fs = require('fs');
const csv = require('fast-csv');
const path = require('path');

const SRC = path.resolve(__dirname, 'bouldering_data.csv');
const DST = path.resolve(__dirname, 'bouldering_data_nfc.csv');

function toNFC(str) {
  return (str || '').toString().normalize('NFC');
}

(async () => {
  const rows = [];
  fs.createReadStream(SRC)
    .pipe(csv.parse({ headers: true }))
    .on('data', row => {
      Object.keys(row).forEach(k => row[k] = toNFC(row[k]));
      rows.push(row);
    })
    .on('end', () => {
      // 저장
      csv.writeToPath(DST, rows, { headers: true })
        .on('finish', () => {
          console.log('✅ NFC 변환 완료:', DST);
        });
    });
})();
