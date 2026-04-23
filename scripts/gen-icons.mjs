import sharp from 'sharp';

// Cream background, terracotta italic "L" in a serif style
const svgIcon = (size) => {
  const r = Math.round(size * 0.14);
  const fontSize = Math.round(size * 0.62);
  const y = Math.round(size * 0.74);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#F5F0E8" rx="${r}"/>
  <text
    x="${size / 2}"
    y="${y}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-style="italic"
    font-weight="400"
    font-size="${fontSize}"
    fill="#A84E3C"
    letter-spacing="-2"
  >L</text>
</svg>`;
};

const icons = [
  ['icon-192', 192],
  ['icon-512', 512],
  ['apple-touch-icon', 180],
];

for (const [name, size] of icons) {
  await sharp(Buffer.from(svgIcon(size)))
    .png()
    .toFile(`public/icons/${name}.png`);
  console.log(`✓  public/icons/${name}.png  (${size}×${size})`);
}
