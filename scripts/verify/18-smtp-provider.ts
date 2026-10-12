/**
 * Scenario 18 — the SMTP provider's guards.
 *
 * SMTP is the one provider type whose destination a user types in, so the server
 * opens a TCP connection to an address it was handed. These checks are what
 * stands between that and an SSRF: without them, `localhost:6379` would have the
 * app speak SMTP at its own Redis, and 169.254.169.254 at the cloud metadata
 * service, reporting whatever came back as a connection error.
 *
 * Also covers the storage split that keeps the password out of the API's
 * response: it lives in the encrypted `apiKey` column, never in `config`, which
 * is returned to the browser as it is.
 *
 * No database, and no network: every case here is decided before a lookup.
 */

import { checkSmtpTarget, readSmtpSettings, validateSmtpConfigInput, SMTP_PORTS } from '../../src/lib/email/smtp'
import { isSupportedProviderType, SUPPORTED_PROVIDER_TYPES } from '../../src/lib/email/provider-types'
import { assert, assertEq, runScenario, section } from './_harness'

const rejects = async (host: string, port: number, why: string) => {
  const result = await checkSmtpTarget(host, port)
  assert(typeof result === 'string' && result.length > 0, `rejects ${host}:${port} — ${why}`)
}

const allows = async (host: string, port: number) => {
  const result = await checkSmtpTarget(host, port)
  assertEq(result, null, `allows ${host}:${port}`)
}

export default function scenario() {
  return runScenario('18 SMTP provider guards (no DB)', async () => {
    section('only the submission ports')
    // Checked before anything else, so no lookup happens for a bad port.
    await rejects('mail.example.com', 8025, 'a dev mail catcher, not a relay')
    await rejects('mail.example.com', 6379, 'Redis')
    await rejects('mail.example.com', 80, 'HTTP')
    for (const port of SMTP_PORTS) {
      await allows('8.8.8.8', port)
    }

    section('nothing on a private network')
    await rejects('localhost', 587, 'this host')
    await rejects('127.0.0.1', 587, 'loopback')
    await rejects('0.0.0.0', 587, 'this host, the other spelling')
    await rejects('10.0.0.1', 587, 'private')
    await rejects('172.16.0.1', 587, 'private')
    await rejects('172.31.255.255', 587, 'private, top of the range')
    await rejects('192.168.1.1', 587, 'private')
    await rejects('169.254.169.254', 587, 'link-local: the cloud metadata service')
    await rejects('100.64.0.1', 587, 'carrier NAT')
    await rejects('::1', 587, 'loopback, IPv6')
    await rejects('fd00::1', 587, 'unique local, IPv6')
    await rejects('fe80::1', 587, 'link-local, IPv6')
    await rejects('::ffff:127.0.0.1', 587, 'loopback wearing an IPv6 hat')
    await rejects('mail.internal', 587, 'internal name')
    await rejects('mail.localdomain', 587, 'internal name')
    await rejects('postgres', 587, 'a bare container name')

    section('a public address is fine')
    await allows('8.8.8.8', 587)
    await allows('172.32.0.1', 587) // just outside 172.16/12
    await allows('192.167.1.1', 587) // just outside 192.168/16

    section('nonsense is refused before it reaches the network')
    await rejects('', 587, 'empty')
    await rejects('smtp example com', 587, 'spaces')
    await rejects('smtp.example.com/../x', 587, 'a path')

    section('the stored config is rebuilt, never passed through')
    const submitted = {
      host: ' 8.8.8.8 ',
      port: 587,
      secure: false,
      user: 'agency@example.com',
      // Someone pasting the whole thing into one field, or a client bug. This
      // column is handed back to the browser unmasked, so it must not survive.
      password: 'hunter2',
      pass: 'hunter2',
      apiKey: 'hunter2',
    }
    const checked = await validateSmtpConfigInput(submitted)
    assert(!('error' in checked), 'a valid SMTP block is accepted')
    if ('config' in checked) {
      const stored = JSON.parse(checked.config)
      assertEq(Object.keys(stored).sort().join(','), 'host,port,secure,user', 'only these four keys are stored')
      assertEq(stored.host, '8.8.8.8', 'the host is trimmed and lowercased')
      assert(!checked.config.includes('hunter2'), 'no credential survives into config')
    }

    const refused = await validateSmtpConfigInput({ host: 'localhost', port: 587 })
    assert('error' in refused, 'a private host is refused at save time, not at send time')
    assert('error' in (await validateSmtpConfigInput('not json')), 'unparseable config is refused')
    assert('error' in (await validateSmtpConfigInput({ host: '8.8.8.8' })), 'a missing port is refused')

    section('reading the settings back')
    const settings = readSmtpSettings('{"host":"mail.example.com","port":465,"secure":false,"user":"u"}', 'secret')
    assert(settings !== null, 'settings parse from the stored JSON string')
    assertEq(settings!.secure, true, 'port 465 is implicit TLS whatever the row says')
    assertEq(settings!.password, 'secret', 'the password comes from the decrypted apiKey, not from config')
    assertEq(readSmtpSettings('{ broken', 'secret'), null, 'a corrupt config row yields null, does not throw')
    assertEq(readSmtpSettings('{"port":587}', 'secret'), null, 'no host yields null')
    assertEq(readSmtpSettings(null, 'secret'), null, 'no config yields null')

    section('smtp is a type the sender admits to supporting')
    // It was listed as "nodemailer" for years with nothing behind it, and every
    // email routed there was marked sent while nothing was delivered.
    assert(isSupportedProviderType('smtp'), 'smtp is supported')
    assert(!isSupportedProviderType('nodemailer'), 'the phantom type is gone')
    assert(!isSupportedProviderType('carrier-pigeon'), 'an unknown type is not supported')
    assertEq(SUPPORTED_PROVIDER_TYPES.includes('smtp'), true, 'and it is in the shared list the UI reads')
  })
}

if (require.main === module) {
  scenario()
}
