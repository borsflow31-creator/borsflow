/**
 * Crops the raw captures from capture-landing.mjs to where the interface content
 * ends, scales them to 2160px wide and encodes WebP into public/shots, with a
 * provenance file beside each like the earlier captures.
 *
 *   node scripts/demo/encode-shots.mjs [--in landing-shots]
 */
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join } from 'path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : fallback
}
const IN = arg('--in', 'landing-shots')
const OUT = join(process.cwd(), 'public', 'shots')

// source capture -> published name, and the device-pixel height to keep (captures are 2880 wide).
const SHOTS = [
  { from: 'crm.png', to: 'buyer-board.webp', height: 1240, what: 'the Buyer journey board' },
  { from: 'property.png', to: 'listing.webp', height: 1610, what: 'a listing’s Offers tab with three competing offers' },
  { from: 'commissions-accrued.png', to: 'commissions.webp', height: 1660, what: 'the Commissions view, Accrued tab, with agent splits' },
]

for (const shot of SHOTS) {
  const out = join(OUT, shot.to)
  const info = await sharp(join(IN, shot.from))
    .extract({ left: 0, top: 0, width: 2880, height: shot.height })
    .resize({ width: 2160 })
    .webp({ quality: 82 })
    .toFile(out)
  writeFileSync(`${out}.json`, JSON.stringify({
    prompt: `Screenshot of the BorsFlow application itself, showing ${shot.what}. Captured ${new Date().toISOString().slice(0, 10)} with scripts/demo/capture-landing.mjs at 1440x900 CSS px, deviceScaleFactor 2, dark theme, signed in as the temporary agency demo account (scripts/demo/seed-agency.ts). Cropped to 2880x${shot.height} where the interface content ends, scaled to 2160px wide and encoded to WebP. The interface is the real shipped UI, not a mock. The records shown (the Kestrel Lane Estates workspace, its Dublin listings, buyers, offers and commissions) were authored solely for this capture and deleted from the database afterwards. No retouching beyond the crop.`,
    createdAt: new Date().toISOString(),
  }, null, 2))
  console.log(`${shot.to}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`)
}
