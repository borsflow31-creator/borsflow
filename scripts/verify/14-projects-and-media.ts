/**
 * Scenario 14 — project unit roll-up, and the media rules.
 *
 *  a. The six unit statuses collapse into exactly three dashboard buckets, and
 *     every status is accounted for. This is the number an agency reports to a
 *     developer, so an option counted as available stock, or a signed deed
 *     counted as merely reserved, is a wrong figure on a real statement.
 *  b. The denormalized counters on Program and the dashboard read the same
 *     mapping, so the header tiles cannot disagree with the units table.
 *  c. Video magic bytes: a renamed file cannot ride in as an MP4.
 *  d. Media kinds are not a partition -- a video may be a file or a link -- and
 *     every project kind maps onto storage rules that exist.
 *  e. Only recognised video hosts produce an embed URL; anything else falls back
 *     to a plain link rather than a broken iframe.
 *
 * No database: all of this is pure, and keeping it that way is why the rules live
 * in lib/crm/projects and lib/crm/media-storage rather than in the routes.
 */

import {
  LOT_STATUSES,
  PROGRAM_MEDIA_GROUPS,
  PROGRAM_FILE_MEDIA_KINDS,
  PROGRAM_LINK_MEDIA_KINDS,
  PROJECT_STATUSES,
  UNIT_BUCKETS,
  bucketForLotStatus,
  canBeCover,
  isProgramMediaKind,
  projectProgress,
  storageKindFor,
  summarizeUnits,
} from '../../src/lib/crm/projects'
import { FILE_MEDIA_KINDS, LINK_MEDIA_KINDS, MEDIA_KINDS } from '../../src/lib/crm/lifecycle'
import { contentMatchesType, VIDEO_FILE_TYPES, MAX_VIDEO_UPLOAD_SIZE, MAX_UPLOAD_SIZE } from '../../src/lib/uploads'
import { maxSizeForKind, typesForKind } from '../../src/lib/crm/media-storage'
import { embedUrl } from '../../src/components/realestate/media'
import { assert, assertEq, runScenario, section } from './_harness'

/** An ISO base media file: 4 size bytes, "ftyp", then the brand. */
function mp4Bytes(brand: string): Uint8Array {
  const bytes = new Uint8Array(16)
  bytes.set([0x00, 0x00, 0x00, 0x18], 0)
  bytes.set([0x66, 0x74, 0x79, 0x70], 4) // "ftyp"
  for (let i = 0; i < 4; i++) bytes[8 + i] = brand.charCodeAt(i)
  return bytes
}

export default function scenario() {
  return runScenario('14 projects and media (no DB)', async () => {
    section('every unit status falls in exactly one dashboard bucket')
    for (const status of LOT_STATUSES) {
      const bucket = bucketForLotStatus(status)
      assert(bucket !== null, `${status} has a bucket`)
      const hits = Object.values(UNIT_BUCKETS).filter(list => (list as readonly string[]).includes(status))
      assertEq(hits.length, 1, `${status} is in exactly one bucket`)
    }
    assertEq(bucketForLotStatus('invented_by_an_agency'), null, 'an unknown status is counted in no bucket')

    section('the roll-up answers what can still be sold, what is held, what is in')
    const lots = [
      { status: 'available', totalPrice: 200_000 },
      { status: 'available', totalPrice: 300_000 },
      { status: 'optioned', totalPrice: 250_000 },
      { status: 'reserved', totalPrice: 400_000 },
      { status: 'contract_signed', totalPrice: 500_000 },
      { status: 'deed_signed', totalPrice: 600_000 },
      { status: 'delivered', totalPrice: 700_000 },
    ]
    const totals = summarizeUnits(lots)
    assertEq(totals.total, 7, 'every unit counts toward the total')
    assertEq(totals.available, 2, 'only available stock is available')
    assertEq(totals.reserved, 2, 'an option is held, not available')
    assertEq(totals.sold, 3, 'contract, deed and delivery are all sold')
    assertEq(totals.available + totals.reserved + totals.sold, totals.total, 'the three buckets cover the total')
    assertEq(totals.totalValue, 2_950_000, 'total value is every unit, whatever its status')
    assertEq(totals.availableValue, 500_000, 'available inventory is what a sales team can still offer')
    assertEq(totals.soldValue, 1_800_000, 'sold value is the three sold statuses')

    section('price falls back to basePrice, and an empty project does not divide by zero')
    assertEq(summarizeUnits([{ status: 'available', basePrice: 120_000 }]).totalValue, 120_000, 'basePrice is used when totalPrice is absent')
    assertEq(summarizeUnits([{ status: 'available', totalPrice: null, basePrice: null }]).totalValue, 0, 'a priceless unit contributes nothing')
    const empty = summarizeUnits([])
    assertEq(empty.total, 0, 'no units')
    assertEq(empty.totalValue, 0, 'and no value')

    section('an unknown status still counts in the total but in no bucket')
    const odd = summarizeUnits([{ status: 'available', totalPrice: 100 }, { status: 'mystery', totalPrice: 900 }])
    assertEq(odd.total, 2, 'it is a unit')
    assertEq(odd.totalValue, 1000, 'and its price is part of what the project is worth')
    assertEq(odd.available + odd.reserved + odd.sold, 1, 'but it is not reported as any of the three')

    section('lifecycle progress runs 0 to 100 across the statuses, and tolerates nonsense')
    assertEq(projectProgress(PROJECT_STATUSES[0]), 0, 'the first status is 0%')
    assertEq(projectProgress(PROJECT_STATUSES[PROJECT_STATUSES.length - 1]), 100, 'the last is 100%')
    assertEq(projectProgress('not_a_status'), 0, 'an unknown status does not produce NaN')

    section('video magic bytes: the declared type is not trusted')
    assert(contentMatchesType(mp4Bytes('isom'), 'mp4'), 'a real MP4 is accepted')
    assert(contentMatchesType(mp4Bytes('qt  '), 'mov'), 'QuickTime differs only by brand')
    assert(contentMatchesType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]), 'webm'), 'WebM is EBML')
    assert(!contentMatchesType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0]), 'mp4'), 'a Windows executable is not an MP4')
    assert(!contentMatchesType(mp4Bytes('heic'), 'mp4'), 'a HEIC image shares the container but not the brand')
    assert(!contentMatchesType(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'webm'), 'a PDF is not WebM')
    assert(!contentMatchesType(new Uint8Array(4), 'mp4'), 'four zero bytes are not an MP4')

    section('media kinds overlap on purpose: a video is a file or a link')
    assert(FILE_MEDIA_KINDS.includes('video'), 'a video can be uploaded')
    assert(LINK_MEDIA_KINDS.includes('video'), 'and a video can be a link')
    assert(FILE_MEDIA_KINDS.includes('photo') && !LINK_MEDIA_KINDS.includes('photo'), 'a photo is only ever a file')
    assert(LINK_MEDIA_KINDS.includes('virtual_tour') && !FILE_MEDIA_KINDS.includes('virtual_tour'), 'a virtual tour is only ever a link')
    for (const kind of [...FILE_MEDIA_KINDS, ...LINK_MEDIA_KINDS]) {
      assert((MEDIA_KINDS as readonly string[]).includes(kind), `${kind} is a known media kind`)
    }

    section('a file kind has an allow-list and a ceiling; a link kind needs neither')
    for (const kind of FILE_MEDIA_KINDS) {
      const types = typesForKind(kind)
      assert(types !== null && Object.keys(types).length > 0, `${kind} has permitted MIME types`)
      assert(maxSizeForKind(kind) > 0, `${kind} has a size ceiling`)
    }
    assertEq(typesForKind('virtual_tour'), null, 'a link kind accepts no file at all')
    assertEq(maxSizeForKind('video'), MAX_VIDEO_UPLOAD_SIZE, 'video gets the large ceiling')
    assertEq(maxSizeForKind('photo'), MAX_UPLOAD_SIZE, 'a photo gets the ordinary one')
    assert(MAX_VIDEO_UPLOAD_SIZE > MAX_UPLOAD_SIZE, 'a walkthrough is allowed to be much bigger than a photo')
    assertEq(Object.keys(typesForKind('video')!).sort().join(','), Object.keys(VIDEO_FILE_TYPES).sort().join(','), 'the video allow-list is the shared one')

    section('every project media kind maps onto storage rules that exist')
    for (const kind of PROGRAM_MEDIA_GROUPS) {
      assert(isProgramMediaKind(kind), `${kind} is a known project media kind`)
      const storage = storageKindFor(kind)
      assert(typesForKind(storage) !== null, `${kind} borrows rules from ${storage}`)
    }
    assertEq(storageKindFor('drone'), 'photo', 'a drone shot is a photo as far as bytes go')
    assertEq(storageKindFor('3d_render'), 'photo', 'and so is a render')
    assertEq(storageKindFor('video'), 'video', 'a video is a video')
    assertEq(storageKindFor('quarterly_report'), 'floorplan', 'a report is an image or the PDF it arrived as')
    assertEq(storageKindFor('document'), 'floorplan', 'as is a brochure')
    assert(PROGRAM_LINK_MEDIA_KINDS.every(k => PROGRAM_FILE_MEDIA_KINDS.includes(k)), 'a project link kind can also be uploaded')

    section('only an image can be a project cover')
    assert(canBeCover('photo') && canBeCover('drone') && canBeCover('3d_render'), 'images can')
    assert(!canBeCover('video') && !canBeCover('document') && !canBeCover('quarterly_report'), 'a video or a PDF has no thumbnail to show')

    section('embeds: recognised hosts only, so an unknown link stays a link')
    assertEq(embedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'a YouTube watch URL')
    assertEq(embedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'a short link')
    assertEq(embedUrl('https://youtube.com/shorts/abc123'), 'https://www.youtube.com/embed/abc123', 'a short-form link')
    assertEq(embedUrl('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789', 'a Vimeo link')
    assertEq(embedUrl('https://example.com/video.mp4'), null, 'an unknown host gets no iframe')
    assertEq(embedUrl('https://www.youtube.com/'), null, 'a YouTube URL naming no video gets no iframe')
    assertEq(embedUrl('not a url'), null, 'unparseable input does not throw')
    assertEq(embedUrl(null), null, 'nor does a missing link')

    section('a script URL never becomes an embed')
    for (const hostile of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox']) {
      assertEq(embedUrl(hostile), null, `${hostile.slice(0, 24)} is not embeddable`)
    }
  })
}

if (require.main === module) {
  scenario()
}
