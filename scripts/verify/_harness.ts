/**
 * Verification harness.
 *
 * This project has no test framework, so the end-to-end checks are runnable
 * scripts. They talk to a real Postgres because what they verify lives in the
 * database: unique constraints, CHECK constraints, delete triggers, RLS, and the
 * query count of a refactored write path.
 *
 * Safety: every script connects to VERIFY_DATABASE_URL and refuses to run if it
 * matches DATABASE_URL. These scripts create and delete workspaces; pointing
 * them at the real database would write test rows into live data.
 */

import { PrismaClient } from '@prisma/client'
import { DEFAULT_PIPELINES } from '../../src/lib/crm/lifecycle'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Read a key out of the project's env files.
 *
 * tsx does not load .env the way `next` does, so process.env.DATABASE_URL is
 * normally empty here. The guard below still has to know what the live database
 * is in order to refuse it, so it is read from disk rather than trusted to be
 * absent.
 */
function envFileValue(key: string): string | null {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!match || match[1] !== key) continue
      return match[2].replace(/^["']|["']$/g, '')
    }
  }
  return null
}

/** Strip credentials so a refusal can name the database without printing a password. */
function redact(url: string): string {
  return url.replace(/\/\/[^@]*@/, '//***@')
}

/**
 * The project's own database URLs, captured once at import time -- before
 * useVerifyDatabase() overwrites process.env.DATABASE_URL -- so that the guard
 * keeps comparing against the real thing rather than against our own override.
 */
const LIVE_URLS = [process.env.DATABASE_URL, envFileValue('DATABASE_URL'), envFileValue('DIRECT_URL')]

export function verifyDatabaseUrl(): string {
  const url = process.env.VERIFY_DATABASE_URL
  if (!url) {
    throw new Error(
      'VERIFY_DATABASE_URL is not set. Point it at a throwaway database (a Supabase branch or a local Postgres) that has had the migrations applied.'
    )
  }

  // These scripts create and delete workspaces. Running them against the live
  // database would write test rows into real data, so the live URL is refused
  // whether it arrives from the environment or from the project's env files.
  if (LIVE_URLS.some(candidate => candidate && candidate === url)) {
    throw new Error(
      `VERIFY_DATABASE_URL is the project's own database (${redact(url)}). Point it at a throwaway database instead.`
    )
  }

  return url
}

/**
 * Bind the application's prisma singleton to the verification database.
 *
 * src/lib/prisma constructs `new PrismaClient()` with no explicit datasource, so
 * it reads DATABASE_URL once, at import time. Any scenario that exercises real
 * application code — the segmentation service, the automation engine — must call
 * this *before* importing that code, and must import it dynamically so the call
 * happens first. A static import would be hoisted above this and bind to the
 * wrong database.
 */
export function useVerifyDatabase(): string {
  const url = verifyDatabaseUrl()
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  return url
}

/**
 * A client bound to the verification database, never the app's singleton in
 * src/lib/prisma, which reads DATABASE_URL.
 */
export function verifyClient(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: verifyDatabaseUrl() } } })
}

export class AssertionFailed extends Error {}

export function assert(condition: unknown, message: string): void {
  if (!condition) throw new AssertionFailed(message)
}

export function assertEq<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new AssertionFailed(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

export async function assertThrows(fn: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await fn()
  } catch {
    return
  }
  throw new AssertionFailed(message)
}

let indent = 0

export function section(name: string): void {
  console.log(`${'  '.repeat(indent)}· ${name}`)
}

export interface ScenarioResult {
  name: string
  passed: boolean
  error?: string
  ms: number
}

export async function runScenario(name: string, body: () => Promise<void>): Promise<ScenarioResult> {
  const started = Date.now()
  console.log(`\n=== ${name} ===`)
  indent = 1
  try {
    await body()
    const ms = Date.now() - started
    console.log(`PASS ${name} (${ms}ms)`)
    return { name, passed: true, ms }
  } catch (error: any) {
    const ms = Date.now() - started
    const message = error instanceof AssertionFailed ? error.message : `${error?.message || error}`
    console.error(`FAIL ${name}: ${message}`)
    if (!(error instanceof AssertionFailed) && error?.stack) console.error(error.stack)
    process.exitCode = 1
    return { name, passed: false, error: message, ms }
  } finally {
    indent = 0
  }
}

/** Unique-enough suffix so parallel or repeated runs never collide. */
export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export interface Fixture {
  userId: string
  workspaceId: string
  /** One pipeline per board kind, seeded from DEFAULT_PIPELINES like a real workspace. */
  pipelines: { Lead: string; Interest: string; Property: string }
}

/**
 * A workspace with an owner and the three boards, isolated from every other
 * fixture. Boards come from DEFAULT_PIPELINES so scenarios run against exactly
 * what a new agency gets, stage names included.
 */
export async function makeWorkspace(prisma: PrismaClient, prefix = 'verify'): Promise<Fixture> {
  const tag = uid(`${prefix}-`)

  const user = await prisma.user.create({
    data: { email: `${tag}@verify.invalid`, name: `${prefix} owner` },
    select: { id: true },
  })

  const workspace = await prisma.workspace.create({
    data: { name: `${prefix} workspace ${tag}`, ownerId: user.id },
    select: { id: true },
  })

  const pipelines: Record<string, string> = {}
  for (const [index, spec] of DEFAULT_PIPELINES.entries()) {
    const pipeline = await prisma.pipeline.create({
      data: {
        name: spec.name,
        workspaceId: workspace.id,
        order: index,
        stages: JSON.stringify(spec.stages),
        subjectType: spec.subjectType,
      },
      select: { id: true },
    })
    pipelines[spec.subjectType] = pipeline.id
  }

  return {
    userId: user.id,
    workspaceId: workspace.id,
    pipelines: pipelines as Fixture['pipelines'],
  }
}

/**
 * Remove a fixture. Deleting the workspace cascades to pipelines, leads,
 * properties, segments and automations; the user is deleted separately because
 * it is the workspace's parent, not its child.
 */
export async function cleanup(prisma: PrismaClient, fixture: Fixture): Promise<void> {
  await prisma.workspace.delete({ where: { id: fixture.workspaceId } }).catch(() => {})
  await prisma.user.delete({ where: { id: fixture.userId } }).catch(() => {})
}
