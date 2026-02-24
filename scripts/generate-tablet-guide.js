const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType,
  PageOrientation, convertInchesToTwip,
} = require('docx');
const fs = require('fs');
const path = require('path');

// Colors
const PRIMARY = '1565C0';
const GREEN = '2E7D32';
const RED = 'C62828';
const ORANGE = 'E65100';
const GRAY = '424242';
const LIGHT_GRAY = 'F5F5F5';
const WHITE = 'FFFFFF';
const HEADER_BG = '1565C0';
const GREEN_BG = 'E8F5E9';
const RED_BG = 'FFEBEE';

function createHeaderCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: HEADER_BG, fill: HEADER_BG },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text, bold: true, color: WHITE, size: 22, font: 'Segoe UI' })],
      }),
    ],
  });
}

function createCell(text, width, options = {}) {
  const { bold, color, bgColor, align } = options;
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: bgColor ? { type: ShadingType.SOLID, color: bgColor, fill: bgColor } : undefined,
    children: [
      new Paragraph({
        alignment: align || AlignmentType.LEFT,
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, bold: !!bold, color: color || GRAY, size: 20, font: 'Segoe UI' })],
      }),
    ],
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({ text, bold: true, size: 28, color: PRIMARY, font: 'Segoe UI' }),
    ],
  });
}

function bulletPoint(text, options = {}) {
  const { bold, color } = options;
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.3) },
    children: [
      new TextRun({ text: '•  ', bold: true, color: PRIMARY, size: 20, font: 'Segoe UI' }),
      new TextRun({ text, bold: !!bold, color: color || GRAY, size: 20, font: 'Segoe UI' }),
    ],
  });
}

function numberedPoint(num, text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.3) },
    children: [
      new TextRun({ text: `${num}.  `, bold: true, color: PRIMARY, size: 20, font: 'Segoe UI' }),
      new TextRun({ text, color: GRAY, size: 20, font: 'Segoe UI' }),
    ],
  });
}

const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(0.7),
          bottom: convertInchesToTwip(0.7),
          left: convertInchesToTwip(0.8),
          right: convertInchesToTwip(0.8),
        },
      },
    },
    children: [
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: 'IgoroTech POS', bold: true, size: 40, color: PRIMARY, font: 'Segoe UI' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [
          new TextRun({ text: 'Tablet Buying Guide for POS Systems', bold: true, size: 30, color: GRAY, font: 'Segoe UI' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new TextRun({ text: 'Choosing the right tablet ensures reliability, speed, and data safety for your business.', italics: true, size: 20, color: GRAY, font: 'Segoe UI' }),
        ],
      }),

      // === RECOMMENDED TABLETS ===
      sectionTitle('Recommended Tablets for POS Use'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createHeaderCell('Tablet', 30),
              createHeaderCell('Why It\'s Good', 45),
              createHeaderCell('Est. Price (PH)', 25),
            ],
          }),
          new TableRow({
            children: [
              createCell('Samsung Galaxy Tab A9 / A9+', 30, { bold: true }),
              createCell('Reliable storage, good build quality, long software support', 45),
              createCell('P10,000 - P15,000', 25, { align: AlignmentType.CENTER }),
            ],
          }),
          new TableRow({
            children: [
              createCell('Samsung Galaxy Tab S6 Lite', 30, { bold: true, bgColor: LIGHT_GRAY }),
              createCell('S-Pen bonus, solid performance, AMOLED display', 45, { bgColor: LIGHT_GRAY }),
              createCell('P15,000 - P18,000', 25, { align: AlignmentType.CENTER, bgColor: LIGHT_GRAY }),
            ],
          }),
          new TableRow({
            children: [
              createCell('Lenovo Tab M11 / P11', 30, { bold: true }),
              createCell('Good value, decent build, clean Android experience', 45),
              createCell('P12,000 - P16,000', 25, { align: AlignmentType.CENTER }),
            ],
          }),
          new TableRow({
            children: [
              createCell('Xiaomi Pad 6', 30, { bold: true, bgColor: LIGHT_GRAY }),
              createCell('Fast processor, great screen, excellent price-to-performance', 45, { bgColor: LIGHT_GRAY }),
              createCell('P14,000 - P18,000', 25, { align: AlignmentType.CENTER, bgColor: LIGHT_GRAY }),
            ],
          }),
          new TableRow({
            children: [
              createCell('Samsung Galaxy Tab A8', 30, { bold: true }),
              createCell('Budget-friendly but still Samsung quality and reliability', 45),
              createCell('P9,000 - P12,000', 25, { align: AlignmentType.CENTER }),
            ],
          }),
        ],
      }),

      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: 'BEST VALUE: ', bold: true, size: 20, color: GREEN, font: 'Segoe UI' }),
          new TextRun({ text: 'Samsung Galaxy Tab A9 (~P10,000) — reliable storage, gets updates, good specs for POS, affordable enough to buy a spare.', size: 20, color: GRAY, font: 'Segoe UI' }),
        ],
      }),

      // === MINIMUM SPECIFICATIONS ===
      sectionTitle('Minimum Specifications to Look For'),

      bulletPoint('At least 4GB RAM — anything less will lag with the POS app'),
      bulletPoint('64GB+ internal storage — the database grows over time, avoid 32GB models'),
      bulletPoint('eMMC 5.1 or UFS storage type — faster read/write reduces data corruption risk'),
      bulletPoint('Reputable brand with regular updates — Samsung, Lenovo, Xiaomi'),
      bulletPoint('USB-C port — for reliable charging and accessory support'),
      bulletPoint('Battery 7,000mAh or higher — survives a full business day'),
      bulletPoint('Android 12 or higher — for continued security patches and support'),

      // === TABLETS TO AVOID ===
      sectionTitle('Tablets to AVOID'),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              createHeaderCell('Avoid', 35),
              createHeaderCell('Why', 65),
            ],
          }),
          new TableRow({
            children: [
              createCell('Cherry Mobile / MyPhone tablets', 35, { bold: true, color: RED }),
              createCell('Cheap flash memory, no firmware updates, high risk of data corruption', 65),
            ],
          }),
          new TableRow({
            children: [
              createCell('Unbranded "China tablets" (Teclast, Alldocube, etc.)', 35, { bold: true, color: RED, bgColor: RED_BG }),
              createCell('Unreliable storage controllers, fake storage specs, no after-sales support', 65, { bgColor: RED_BG }),
            ],
          }),
          new TableRow({
            children: [
              createCell('Any tablet under P5,000', 35, { bold: true, color: RED }),
              createCell('Almost guaranteed to have bad flash memory and very slow storage I/O', 65),
            ],
          }),
          new TableRow({
            children: [
              createCell('Tablets with only 2GB RAM', 35, { bold: true, color: RED, bgColor: RED_BG }),
              createCell('Will struggle and freeze with the POS app and background services', 65, { bgColor: RED_BG }),
            ],
          }),
          new TableRow({
            children: [
              createCell('Tablets with only 32GB storage', 35, { bold: true, color: RED }),
              createCell('Will fill up fast with backups, database growth, and OS updates', 65),
            ],
          }),
          new TableRow({
            children: [
              createCell('Amazon Fire tablets', 35, { bold: true, color: RED, bgColor: RED_BG }),
              createCell('Locked ecosystem, no Google Play Store, Bluetooth printing issues', 65, { bgColor: RED_BG }),
            ],
          }),
          new TableRow({
            children: [
              createCell('Used/refurbished with old Android', 35, { bold: true, color: RED }),
              createCell('No security patches, potential battery and storage degradation', 65),
            ],
          }),
        ],
      }),

      // === CARE TIPS ===
      sectionTitle('Important Care Tips for Your POS Tablet'),

      numberedPoint(1, 'Always use internal storage, NEVER SD card — SD cards are the #1 cause of database corruption on Android.'),
      numberedPoint(2, 'Keep the tablet plugged in during business hours — avoids sudden power loss during transactions.'),
      numberedPoint(3, 'Run daily backups — use the Backup button on the Dashboard to protect your data.'),
      numberedPoint(4, 'Do NOT install unnecessary apps — "cleaners", "boosters", and "optimizer" apps can damage database files.'),
      numberedPoint(5, 'Keep the tablet dedicated to POS only — do not use it as a personal device.'),
      numberedPoint(6, 'Buy from authorized resellers — avoid secondhand units with worn-out storage.'),
      numberedPoint(7, 'Keep Android updated — install system updates when available for security and stability.'),

      // === WHY IT MATTERS ===
      sectionTitle('Why the Right Tablet Matters'),

      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text: 'Your POS tablet stores ALL your business data — sales records, inventory, customer information, and financial reports. A cheap tablet with unreliable storage can lead to:',
            size: 20, color: GRAY, font: 'Segoe UI',
          }),
        ],
      }),

      bulletPoint('Data loss or corruption — losing months of sales records', { color: RED }),
      bulletPoint('Slow performance — long wait times during checkout frustrate customers', { color: RED }),
      bulletPoint('Frequent crashes — interrupting transactions and losing sales', { color: RED }),
      bulletPoint('No software updates — leaving your system vulnerable to bugs', { color: RED }),

      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: 'Investing in a quality tablet (P10,000-P18,000) protects your business data and ensures smooth daily operations. Think of it as essential business equipment, not a personal gadget.',
            bold: true, size: 20, color: GREEN, font: 'Segoe UI',
          }),
        ],
      }),

      // Footer
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [
          new TextRun({ text: '— IgoroTech POS —', bold: true, size: 18, color: PRIMARY, font: 'Segoe UI' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        children: [
          new TextRun({ text: 'For questions and support, contact your IgoroTech representative.', italics: true, size: 16, color: GRAY, font: 'Segoe UI' }),
        ],
      }),
    ],
  }],
});

const outputPath = path.join(__dirname, '..', 'docs', 'IgoroTech-POS-Tablet-Buying-Guide.docx');

// Ensure docs directory exists
const docsDir = path.dirname(outputPath);
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document created: ${outputPath}`);
}).catch((err) => {
  console.error('Error creating document:', err);
});
