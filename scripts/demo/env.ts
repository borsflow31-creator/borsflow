/**
 * Load the project's .env into process.env for a tsx script.
 *
 * tsx does not read .env the way `next` does, and the app's prisma singleton
 * reads DATABASE_URL at import time, so this has to run before any service is
 * imported (import those dynamically). Tolerates `KEY = value` with spaces,
 * quoted values and comments; never overrides a variable already set.
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

export function loadEnv(): void {
  for (const file of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!match || line.trimStart().startsWith('#')) continue
      const [, key, raw] = match
      if (process.env[key] !== undefined) continue
      process.env[key] = raw.replace(/^(["'])(.*)\1$/, '$2')
    }
  }
}

/**
 * The demo accounts' password, from DEMO_PASSWORD in .env. Kept out of the code:
 * the repository is public and the accounts live on the real database.
 */
export function demoPassword(): string {
  const value = process.env.DEMO_PASSWORD
  if (!value) throw new Error('Set DEMO_PASSWORD in .env (the password of the demo accounts).')
  return value
}

/** The demo accounts. Nothing outside this list is ever modified or deleted. */
export const DEMO_USERS = [
  { key: 'owner', email: 'demo.promoteur@example.com', name: 'Karim Haddad', role: 'owner' },
  { key: 'samira', email: 'demo.samira@example.com', name: 'Samira Bouzid', role: 'admin' },
  { key: 'yacine', email: 'demo.yacine@example.com', name: 'Yacine Meziane', role: 'member' },
] as const
export const DEMO_WORKSPACE_NAME = 'Promotion El Bina (démo)'

/**
 * The agency demo, used to capture the landing page screenshots
 * (scripts/demo/seed-agency.ts, scripts/demo/capture-landing.mjs). Same rule:
 * nothing outside this list is ever modified or deleted.
 */
export const AGENCY_DEMO_USERS = [
  { key: 'owner', email: 'demo.agence@example.com', name: 'Claire Donnelly', role: 'owner' },
  { key: 'ronan', email: 'demo.ronan@example.com', name: 'Ronan Walsh', role: 'admin' },
  { key: 'aoife', email: 'demo.aoife@example.com', name: 'Aoife Brennan', role: 'member' },
] as const
export const AGENCY_DEMO_WORKSPACE_NAME = 'Kestrel Lane Estates'
