/**
 * Scenario 19 — the starter templates are editable and their fields are real.
 *
 * Two promises are easy to break silently and expensive to discover in an
 * inbox. The first is that a starter opens in the editor: that holds only while
 * its HTML is the editor's own format, which the old starters — 600px tables of
 * imported markup — were not. The second is that every `{{token}}` written into
 * a starter is one the send path can fill; an invented one renders as nothing,
 * so the email goes out saying "at  ." with a hole where the price was.
 *
 * No database, no network.
 */

import { detectEditorMode, htmlToSimple, simpleToHtml } from '../../src/lib/email-editor-mode'
import { emailStarterTemplates, starterTemplateCategories, STARTER_LOCALES } from '../../src/lib/email/starters'
import { EMAIL_TOKENS } from '../../src/lib/email/tokens'
import { assert, assertEq, runScenario, section } from './_harness'

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

const tokensIn = (text: string): string[] =>
  Array.from(text.matchAll(TOKEN_PATTERN)).map(match => match[1].toLowerCase())

export default function scenario() {
  return runScenario('19 email starter templates (no DB)', async () => {
    const known = new Set(EMAIL_TOKENS.map(entry => entry.name))

    section('every starter opens in the editor')
    for (const locale of STARTER_LOCALES) {
      for (const template of emailStarterTemplates(locale)) {
        const where = `${template.id} (${locale})`
        assertEq(detectEditorMode(template.htmlContent), 'simple', `${where} is the editor's own format`)

        // Round-trip: what the editor reads back out, written again, is the
        // same document. If this drifts, opening a starter and saving it
        // without typing anything would change it.
        const read = htmlToSimple(template.htmlContent)
        assert(read.bodyHtml.length > 0, `${where} has a body the editor can read`)
        assertEq(
          simpleToHtml(read.bodyHtml, { unsubscribe: read.unsubscribe }),
          template.htmlContent,
          `${where} survives a round-trip through the editor`
        )
      }
    }

    section('every field in a starter is one the send path fills in')
    for (const locale of STARTER_LOCALES) {
      for (const template of emailStarterTemplates(locale)) {
        const where = `${template.id} (${locale})`
        for (const token of [...tokensIn(template.subject), ...tokensIn(template.htmlContent), ...tokensIn(template.textContent)]) {
          assert(known.has(token), `${where} uses {{${token}}}, which the renderer knows`)
        }
        // And what it declares matches what it uses, since the editor offers the
        // declared list as this template's own fields.
        for (const declared of template.variables) {
          assert(known.has(declared), `${where} declares {{${declared}}}, which the renderer knows`)
        }
      }
    }

    section('an unsubscribe link is always there')
    for (const locale of STARTER_LOCALES) {
      for (const template of emailStarterTemplates(locale)) {
        assert(
          template.htmlContent.includes('{{unsubscribe_url}}'),
          `${template.id} (${locale}) carries a way out`
        )
      }
    }

    section('the two languages offer the same ten templates')
    const english = emailStarterTemplates('en')
    const french = emailStarterTemplates('fr')
    assertEq(english.length, 10, 'ten starters')
    assertEq(
      french.map(template => template.id).join(','),
      english.map(template => template.id).join(','),
      'same ids, same order'
    )
    for (const [index, template] of french.entries()) {
      assert(template.name !== english[index].name, `${template.id} is actually translated`)
      assert(template.subject.length > 0, `${template.id} has a French subject`)
    }

    section('a language the starters are not written in reads the English set')
    for (const locale of ['es', 'de', 'ar']) {
      assertEq(
        emailStarterTemplates(locale).map(template => template.name).join(','),
        english.map(template => template.name).join(','),
        `${locale} falls back to English`
      )
    }

    section('the gallery can filter them')
    const categories = starterTemplateCategories('en')
    assertEq(categories[0], 'All', 'the first chip shows everything')
    assert(categories.length > 2, 'there is more than one category to choose between')
    for (const template of english) {
      assert(categories.includes(template.category), `${template.id}'s category has a chip`)
    }
  })
}

if (require.main === module) {
  scenario()
}
