/**
 * Scenario 24 — amounts in words, as a receipt states them.
 *
 *  a. French: the "et un" rule, quatre-vingt(s), cent(s), invariable mille,
 *     million(s), and "de" after a round million.
 *  b. The currency name and its plural come from Intl; minor units follow the
 *     currency (two decimals for the dinar, three for the Tunisian dinar).
 *  c. English, Spanish, German and Arabic, one representative value each.
 *
 * No database.
 */

import { amountInWords, numberInWords, wordsLanguage } from '../../src/lib/documents/amount-in-words'
import { assert, assertEq, runScenario, section } from './_harness'

export default function scenario() {
  return runScenario('24 amount in words (no DB)', async () => {
    section('French numbers')
    const fr: [number, string][] = [
      [0, 'zéro'], [1, 'un'], [16, 'seize'], [17, 'dix-sept'], [21, 'vingt et un'], [22, 'vingt-deux'],
      [70, 'soixante-dix'], [71, 'soixante et onze'], [72, 'soixante-douze'], [80, 'quatre-vingts'],
      [81, 'quatre-vingt-un'], [91, 'quatre-vingt-onze'], [99, 'quatre-vingt-dix-neuf'], [100, 'cent'],
      [101, 'cent un'], [180, 'cent quatre-vingts'], [200, 'deux cents'], [201, 'deux cent un'],
      [1000, 'mille'], [1001, 'mille un'], [2000, 'deux mille'], [80000, 'quatre-vingt mille'],
      [200000, 'deux cent mille'], [1000000, 'un million'], [2000000, 'deux millions'],
      [1980, 'mille neuf cent quatre-vingts'], [3000000000, 'trois milliards'],
    ]
    for (const [n, words] of fr) assertEq(numberInWords(n, 'fr'), words, `${n} in French`)

    section('French amounts')
    assertEq(
      amountInWords(1409971.5, 'DZD', 'fr'),
      'un million quatre cent neuf mille neuf cent soixante et onze dinars algériens et cinquante centimes',
      'a receipt amount in dinars'
    )
    assertEq(amountInWords(1, 'EUR', 'fr'), 'un euro', 'one is singular')
    assertEq(amountInWords(2000000, 'EUR', 'fr'), 'deux millions d’euros', 'a round million takes de, elided before a vowel')
    assertEq(amountInWords(3000000, 'DZD', 'fr'), 'trois millions de dinars algériens', 'and de before a consonant')
    assertEq(amountInWords(12.345, 'TND', 'fr'), 'douze dinars tunisiens et trois cent quarante-cinq millimes', 'three decimals for the Tunisian dinar')
    assertEq(amountInWords(0.01, 'EUR', 'fr'), 'zéro euro et un centime', 'one centime')
    assertEq(amountInWords(-5, 'EUR', 'fr'), 'cinq euros', 'the sign is not written')

    section('other languages')
    assertEq(numberInWords(1409971, 'en'), 'one million four hundred nine thousand nine hundred seventy-one', 'English')
    assertEq(amountInWords(21000, 'EUR', 'es'), 'veintiún mil euros', 'Spanish: veintiún before mil')
    assertEq(amountInWords(1000000, 'EUR', 'es'), 'un millón de euros', 'Spanish: un millón de')
    assertEq(amountInWords(121.01, 'EUR', 'es'), 'ciento veintiún euros con un céntimo', 'Spanish: ciento, un céntimo')
    assertEq(numberInWords(1409971, 'de'), 'eine Million vierhundertneuntausendneunhunderteinundsiebzig', 'German compounds')
    assertEq(numberInWords(409000, 'ar'), 'أربعمائة وتسعة آلاف', 'Arabic: agreement on the last two digits')
    assertEq(numberInWords(20000, 'ar'), 'عشرون ألف', 'Arabic: 20 thousand takes the singular')
    assert(amountInWords(2, 'DZD', 'ar').startsWith('ديناران'), 'Arabic: two is the dual alone')

    section('the language follows the receipt locale')
    assertEq(wordsLanguage('ar-u-nu-latn'), 'ar', 'Arabic with Latin digits')
    assertEq(wordsLanguage('fr'), 'fr', 'French')
    assertEq(wordsLanguage('it'), 'fr', 'anything else reads as French')
  })
}
