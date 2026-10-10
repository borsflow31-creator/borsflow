/**
 * Asks the workspace assistant real questions as the demo owner and prints what
 * it answered and which tools it used, so its answers can be checked against
 * the demo data.
 *
 *   npm run dev   (in another terminal)
 *   npx tsx scripts/demo/check-ai.ts [--base http://localhost:3000] ["a question" ...]
 */
import { loadEnv, DEMO_USERS, demoPassword } from './env'

loadEnv()

const args = process.argv.slice(2)
const baseAt = args.indexOf('--base')
const BASE = baseAt > -1 ? args[baseAt + 1] : 'http://localhost:3000'
const custom = args.filter((a, i) => a !== '--base' && i !== baseAt + 1)

const QUESTIONS = custom.length ? custom : [
  'Combien de lots sont encore disponibles dans le programme Les Terrasses de Bir El Djir ?',
  'Quels sont mes suivis en retard ou à faire aujourd’hui ?',
  'Liste les acquéreurs à l’étape Qualified.',
  'Quels appels de fonds sont en retard de paiement ?',
]

const cookies = new Map<string, string>()
const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
function keep(res: Response) {
  for (const line of ((res.headers as any).getSetCookie?.() ?? []) as string[]) {
    const [pair] = line.split(';')
    const i = pair.indexOf('=')
    cookies.set(pair.slice(0, i), pair.slice(i + 1))
  }
}

async function main() {
  const csrf = await fetch(`${BASE}/api/auth/csrf`)
  keep(csrf)
  const { csrfToken } = await csrf.json()
  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, email: DEMO_USERS[0].email, password: demoPassword(), json: 'true' }),
  })
  keep(login)
  const ws = await (await fetch(`${BASE}/api/workspaces`, { headers: { Cookie: cookieHeader() } })).json()
  const workspaceId = ws.workspaces?.[0]?.id
  if (!workspaceId) throw new Error('Login failed or no workspace')

  for (const question of QUESTIONS) {
    const res = await fetch(`${BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
      body: JSON.stringify({ workspaceId, messages: [{ role: 'user', content: question }], timeZone: 'Africa/Algiers' }),
    })
    console.log(`\n=== ${question}`)
    if (!res.ok) {
      console.log(`HTTP ${res.status}: ${await res.text()}`)
      continue
    }
    let text = ''
    const tools: string[] = []
    for (const line of (await res.text()).split('\n').filter(Boolean)) {
      const event = JSON.parse(line)
      if (event.t === 'text') text += event.v
      if (event.t === 'tool_done') tools.push(`${event.name}${event.ok ? '' : ' (failed)'}`)
      if (event.t === 'error') text += `\n[error] ${event.message}`
      if (event.t === 'done') tools.push(`credits: ${event.credits}`)
    }
    console.log(`tools: ${tools.join(', ') || 'none'}`)
    console.log(text.trim())
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
