/**
 * Runs every verification scenario and prints a summary.
 *
 * Scenarios that need a database read VERIFY_DATABASE_URL and refuse to run
 * against the project's own. Scenario 1 needs no database, so it runs either
 * way — which is also a quick smoke test that the criteria engine still works
 * without standing anything up.
 */

import type { ScenarioResult } from './_harness'

import criteriaEngine from './01-criteria-engine'
import segmentRefresh from './02-segment-refresh'
import enrollmentCollision from './03-enrollment-collision'
import orphanPurge from './04-orphan-purge'
import recipientDedup from './05-recipient-dedup'
import newListingMatch from './06-new-listing-match'
import offerRace from './07-offer-race'
import rlsAndConstraints from './08-rls-and-constraints'
import propertyAndViewings from './09-property-and-viewings'
import legacyData from './10-legacy-data'
import enquiryIntake from './11-enquiry-intake'
import mandateExpiry from './12-mandate-expiry'
import commissionsPublicCapacity from './13-commissions-public-capacity'
import projectsAndMedia from './14-projects-and-media'
import developerLeads from './15-developer-leads'
import developerSales from './16-developer-sales'
import developerAlerts from './17-developer-alerts'
import smtpProvider from './18-smtp-provider'
import emailStarters from './19-email-starters'
import workspaceCurrency from './20-workspace-currency'
import leadIntake from './21-lead-intake'

const NO_DATABASE_NEEDED = new Set(['01', '14', '15', '16', '17', '18', '19', '20', '21', '24'])

async function main() {
  const scenarios: { id: string; run: () => Promise<ScenarioResult> }[] = [
    { id: '01', run: criteriaEngine },
    { id: '02', run: segmentRefresh },
    { id: '03', run: enrollmentCollision },
    { id: '04', run: orphanPurge },
    { id: '05', run: recipientDedup },
    { id: '06', run: newListingMatch },
    { id: '07', run: offerRace },
    { id: '08', run: rlsAndConstraints },
    { id: '09', run: propertyAndViewings },
    { id: '10', run: legacyData },
    { id: '11', run: enquiryIntake },
    { id: '12', run: mandateExpiry },
    { id: '13', run: commissionsPublicCapacity },
    { id: '14', run: projectsAndMedia },
    { id: '15', run: developerLeads },
    { id: '16', run: developerSales },
    { id: '17', run: developerAlerts },
    { id: '18', run: smtpProvider },
    { id: '19', run: emailStarters },
    { id: '20', run: workspaceCurrency },
    { id: '21', run: leadIntake },
  ]

  const hasDatabase = Boolean(process.env.VERIFY_DATABASE_URL)
  if (!hasDatabase) {
    console.log('VERIFY_DATABASE_URL is not set — running only the scenarios that need no database.\n')
  }

  const results: ScenarioResult[] = []
  const skipped: string[] = []

  for (const scenario of scenarios) {
    if (!hasDatabase && !NO_DATABASE_NEEDED.has(scenario.id)) {
      skipped.push(scenario.id)
      continue
    }
    results.push(await scenario.run())
  }

  console.log('\n===== summary =====')
  for (const result of results) {
    console.log(`${result.passed ? 'PASS' : 'FAIL'}  ${result.name}  ${result.ms}ms${result.error ? ` — ${result.error}` : ''}`)
  }
  if (skipped.length > 0) {
    console.log(`SKIP  ${skipped.join(', ')} (no VERIFY_DATABASE_URL)`)
  }

  const failed = results.filter(r => !r.passed).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  if (failed > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
