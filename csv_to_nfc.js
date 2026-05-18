const fs = require('fs');
const csv = require('fast-csv');
const path = require('path');

// 입력/출력 파일 경로
const INPUT = path.join(__dirname, 'final_merged.csv');
const OUTPUT = path.join(__dirname, 'final_merged_nfc.csv');

// 파일을 NFC(완성형)로 변환하여 저장
function toNFC(str) {
  return (str || '').toString().normalize('NFC');
}

function convertCSVtoNFC(inputPath, outputPath) {
  const rows = [];

  fs.createReadStream(inputPath)
    .pipe(csv.parse({ headers: false, skipEmptyLines: false }))
    .on('error', (err) => {
      console.error('❌ CSV 읽기 에러:', err);
    })
    .on('data', row => {
      // row가 배열인 경우: fast-csv v5 이상
      if (Array.isArray(row)) {
        rows.push(row.map(toNFC));
      } else {
        // 혹시 key-value 객체면 value만 NFC
        rows.push(Object.values(row).map(toNFC));
      }
    })
    .on('end', () => {
      // NFC로 변환된 데이터 쓰기
      const ws = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
      csv.write(rows, { headers: false }).pipe(ws);
      ws.on('finish', () => {
        console.log(`✅ CSV 파일이 NFC(완성형)로 저장됨: ${outputPath}`);
      });
    });
}

convertCSVtoNFC(INPUT, OUTPUT);
