const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_IMAGE = path.join(__dirname, '..', '..', '..', '..', 'Users', 'Warenski', 'Desktop', 'Tshirt', 'IgorotekLogo.png');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Use absolute path for source
const SOURCE_ABSOLUTE = 'C:\\Users\\Warenski\\Desktop\\Tshirt\\IgorotekLogo.png';

const iconSizes = [
  { name: 'icon.png', size: 1024, background: '#ffffff' },
  { name: 'adaptive-icon.png', size: 512, background: '#ffffff' },
  { name: 'splash-icon.png', size: 512, background: '#ffffff' },
  { name: 'favicon.png', size: 256, background: '#ffffff' },
  { name: 'login-logo.png', size: 200, background: null }, // transparent
  { name: 'playstore-icon.png', size: 512, background: '#ffffff' },
];

async function resizeIcons() {
  console.log('Starting icon resize process...');
  console.log('Source:', SOURCE_ABSOLUTE);
  console.log('Output:', ASSETS_DIR);

  // Check if source exists
  if (!fs.existsSync(SOURCE_ABSOLUTE)) {
    console.error('Source image not found:', SOURCE_ABSOLUTE);
    process.exit(1);
  }

  // Get original image metadata
  const metadata = await sharp(SOURCE_ABSOLUTE).metadata();
  console.log(`Original image: ${metadata.width}x${metadata.height}`);

  for (const icon of iconSizes) {
    const outputPath = path.join(ASSETS_DIR, icon.name);
    console.log(`Creating ${icon.name} (${icon.size}x${icon.size})...`);

    try {
      // Create the resized image with background
      let image = sharp(SOURCE_ABSOLUTE)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: icon.background ? icon.background : { r: 255, g: 255, b: 255, alpha: 0 }
        });

      // If background color specified, flatten to remove transparency
      if (icon.background) {
        image = image.flatten({ background: icon.background });
      }

      await image.png().toFile(outputPath);
      console.log(`  Created: ${outputPath}`);
    } catch (err) {
      console.error(`  Error creating ${icon.name}:`, err.message);
    }
  }

  console.log('\nDone! All icons have been resized.');
}

resizeIcons().catch(console.error);
