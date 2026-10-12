import { isIP } from 'net'
import { lookup } from 'dns/promises'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'

/**
 * SMTP settings for a workspace's own mail server, and the guard that decides
 * whether we are willing to connect to it.
 *
 * This is the one provider type where the destination is typed in by a user, so
 * the server opens a TCP connection to an address it was handed. Unchecked, that
 * is an SSRF primitive: `localhost:6379` or `169.254.169.254` would have the app
 * speak SMTP at its own Redis or at the cloud metadata service, and the reply
 * comes back to the user as a connection error message. Hence the port
 * allow-list and the private-address check below.
 *
 * The password is not stored here: it lives encrypted in EmailProvider.apiKey,
 * because EmailProvider.config is returned to the browser unmasked.
 */

export interface SmtpSettings {
  host: string
  port: number
  /** True for implicit TLS (465); false for STARTTLS on 587/25. */
  secure: boolean
  user: string
  password: string
}

/** The submission ports. 465 is implicit TLS, 587 and 2525 STARTTLS, 25 relay. */
export const SMTP_PORTS = [25, 465, 587, 2525] as const

/** Hostname suffixes that only ever name something inside a private network. */
const INTERNAL_SUFFIXES = ['.internal', '.local', '.localdomain', '.home.arpa']

const privateIPv4 = (address: string): boolean => {
  const [a, b] = address.split('.').map(Number)
  if (a === 0 || a === 127) return true          // this host, loopback
  if (a === 10) return true                       // private
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true         // link-local, incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true // carrier NAT
  if (a === 192 && b === 0) return true           // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true                       // multicast and reserved
  return false
}

const privateIPv6 = (address: string): boolean => {
  const value = address.toLowerCase().split('%')[0]
  if (value === '::' || value === '::1') return true
  // An IPv4-mapped address is an IPv4 address wearing a hat.
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return privateIPv4(mapped[1])
  if (/^f[cd]/.test(value)) return true           // unique local fc00::/7
  if (/^fe[89ab]/.test(value)) return true        // link-local fe80::/10
  if (value.startsWith('ff')) return true         // multicast
  return false
}

const isPrivateAddress = (address: string): boolean =>
  isIP(address) === 6 ? privateIPv6(address) : privateIPv4(address)

/**
 * Why this host and port may not be used, or null when they may.
 *
 * The message is shown to the person configuring the server, so it says what is
 * wrong rather than just refusing.
 */
export async function checkSmtpTarget(host: string, port: number): Promise<string | null> {
  const name = (host || '').trim().toLowerCase().replace(/\.$/, '')
  if (!name) return 'Enter the SMTP server address.'
  if (name.length > 253 || /[^a-z0-9.:\-\[\]]/.test(name)) return 'That is not a valid server address.'

  if (!(SMTP_PORTS as readonly number[]).includes(port)) {
    return `Use one of the SMTP ports: ${SMTP_PORTS.join(', ')}.`
  }

  if (name === 'localhost' || INTERNAL_SUFFIXES.some(suffix => name.endsWith(suffix))) {
    return 'That address is on a private network, which this server cannot send through.'
  }

  // A literal address needs no lookup; a name does, and the answer is what the
  // connection will actually use, so it is the answer that has to be checked.
  if (isIP(name)) {
    return isPrivateAddress(name)
      ? 'That address is on a private network, which this server cannot send through.'
      : null
  }

  if (!name.includes('.')) return 'Enter the full server address, such as smtp.example.com.'

  let addresses: { address: string }[]
  try {
    addresses = await lookup(name, { all: true })
  } catch {
    return 'That server address could not be found.'
  }
  if (!addresses.length) return 'That server address could not be found.'
  if (addresses.some(entry => isPrivateAddress(entry.address))) {
    return 'That address resolves to a private network, which this server cannot send through.'
  }
  return null
}

/**
 * Read the settings off a stored provider row. `config` is the JSON string
 * column; the password comes from the decrypted apiKey.
 */
export function readSmtpSettings(
  config: unknown,
  password: string
): SmtpSettings | null {
  const raw = typeof config === 'string'
    ? (() => { try { return JSON.parse(config) } catch { return null } })()
    : config
  if (!raw || typeof raw !== 'object') return null
  const { host, port, secure, user } = raw as Record<string, unknown>
  if (typeof host !== 'string' || !host.trim()) return null
  const parsedPort = Number(port)
  if (!Number.isFinite(parsedPort)) return null
  return {
    host: host.trim(),
    port: parsedPort,
    // 465 is implicit TLS whatever the row says; the two disagreeing is a hang.
    secure: parsedPort === 465 ? true : Boolean(secure),
    user: typeof user === 'string' ? user : '',
    password,
  }
}

/**
 * Check a submitted SMTP block and return the exact JSON to store.
 *
 * It rebuilds the object field by field rather than passing the submitted one
 * through, so a `password` or `pass` key pasted into the form never reaches the
 * `config` column — which the API hands back to the browser unmasked.
 */
export async function validateSmtpConfigInput(
  input: unknown
): Promise<{ error: string } | { config: string }> {
  const raw = typeof input === 'string'
    ? (() => { try { return JSON.parse(input) } catch { return null } })()
    : input
  if (!raw || typeof raw !== 'object') return { error: 'Enter the SMTP server address and port.' }

  const { host, port, secure, user } = raw as Record<string, unknown>
  const hostname = typeof host === 'string' ? host.trim() : ''
  const parsedPort = Number(port)
  if (!Number.isInteger(parsedPort)) return { error: 'Enter the SMTP port.' }

  const rejection = await checkSmtpTarget(hostname, parsedPort)
  if (rejection) return { error: rejection }

  return {
    config: JSON.stringify({
      host: hostname.toLowerCase(),
      port: parsedPort,
      secure: parsedPort === 465 ? true : Boolean(secure),
      user: typeof user === 'string' ? user.trim() : '',
    }),
  }
}

/** Timeouts so a server that accepts the socket and then says nothing cannot hold a worker. */
export const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
} as const

/**
 * A nodemailer transport for these settings. Unpooled, which is nodemailer's
 * default and the right one here: the queue worker is short-lived and a pooled
 * connection would outlive it. TLS verification is left on deliberately — a
 * self-signed mail server is a misconfiguration, not something to paper over.
 */
export async function createSmtpTransport(settings: SmtpSettings) {
  const nodemailer = await import('nodemailer')
  const options: SMTPTransport.Options = {
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...SMTP_TIMEOUTS,
  }
  // A server that wants no credentials must be sent none, or it answers 503.
  if (settings.user) options.auth = { user: settings.user, pass: settings.password }
  return nodemailer.createTransport(options)
}

/**
 * Prove the settings work before anything is sent through them. Returns the
 * server's own complaint, which is usually the useful part ("Invalid login",
 * "Must issue a STARTTLS command first").
 */
export async function verifySmtpConnection(
  settings: SmtpSettings
): Promise<{ success: true } | { success: false; error: string }> {
  const rejection = await checkSmtpTarget(settings.host, settings.port)
  if (rejection) return { success: false, error: rejection }

  let transport: Awaited<ReturnType<typeof createSmtpTransport>> | null = null
  try {
    transport = await createSmtpTransport(settings)
    await transport.verify()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not connect to the SMTP server.' }
  } finally {
    transport?.close()
  }
}
