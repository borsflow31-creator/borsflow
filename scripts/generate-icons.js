const sharp = require('sharp')
const fs = require('fs')

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512]

const svgSource = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#6366F1"/>
  <text
    x="50%" y="54%"
    font-family="system-ui,sans-serif"
    font-size="${size * 0.52}"
    font-weight="700"
    fill="#00FFB3"
    text-anchor="middle"
    dominant-baseline="middle"
  >B</text>
</svg>`

fs.mkdirSync('./public/icons', { recursive: true })

Promise.all(
  sizes.map((size) => {
    const name = size === 180 ? 'apple-touch-icon' : `icon-${size}x${size}`
    return sharp(Buffer.from(svgSource(size)))
      .png()
      .toFile(`./public/icons/${name}.png`)
      .then(() => console.log(`Generated ${name}.png`))
  })
).then(() => console.log('All icons generated successfully'))
