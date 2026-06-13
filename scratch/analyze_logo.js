const sharp = require('sharp');

async function analyze() {
  try {
    const image = sharp('public/logo.png');
    const metadata = await image.metadata();
    console.log('Metadata:', metadata);
    
    // Find the bounding box of non-transparent pixels
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * info.channels;
        // Check if alpha channel exists and is not transparent
        const alpha = info.channels === 4 ? data[idx + 3] : 255;
        if (alpha > 10) { // threshold for visibility
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    console.log('Bounding Box of content:');
    console.log(`Left: ${minX}, Right: ${maxX}, Width: ${maxX - minX}`);
    console.log(`Top: ${minY}, Bottom: ${maxY}, Height: ${maxY - minY}`);
    console.log(`Padding: Left/Right: ${minX} / ${info.width - maxX}, Top/Bottom: ${minY} / ${info.height - maxY}`);
  } catch (err) {
    console.error(err);
  }
}

analyze();
