import fs from 'node:fs/promises'
import chalk from 'chalk'
import {name as isIdentifier} from 'estree-util-is-identifier-name'

/* eslint-disable no-await-in-loop */

const base = new URL('../node_modules/highlight.js/', import.meta.url)
const doc = String(await fs.readFile(new URL('lib/index.js', base)))

const category = /\/\*.*?Category: (.*?)\r?\n/s
const register = /hljs\.registerLanguage\('(.+?)'/g
let index = -1
/** @type {Array<string>} */
const all = []
/** @type {Array<string>} */
const common = []
/** @type {Array<string>} */
let uncommon = []
/** @type {RegExpMatchArray|null} */
let match

while ((match = register.exec(doc))) all.push(match[1])

while (++index < all.length) {
  const doc = String(
    await fs.readFile(new URL('lib/languages/' + all[index] + '.js', base))
  )

  const match = category.exec(doc)

  if (match && match[1].split(/,\s?/).includes('common')) {
    common.push(all[index])
  }
}

common.sort((a, b) => a.localeCompare(b))

uncommon = all
  .filter((d) => !common.includes(d))
  .sort((a, b) => a.localeCompare(b))

await fs.writeFile(
  new URL('../lib/common.js', import.meta.url),
  generate(common, 'core')
)
await fs.writeFile(
  new URL('../lib/all.js', import.meta.url),
  generate(uncommon, 'common')
)

await fs.writeFile(
  new URL('../script/data.json', import.meta.url),
  JSON.stringify({common, uncommon}, null, 2) + '\n'
)

console.log(
  '%s wrote `lib/common.js` (%d languages)',
  chalk.green('✓'),
  common.length
)

console.log(
  '%s wrote `lib/all.js` (%d more languages; %d total)',
  chalk.green('✓'),
  uncommon.length,
  all.length
)

/**
 * @param {Array<string>} list
 * @param {string} base
 * @returns {string}
 */
function generate(list, base) {
  return [
    '// @ts-expect-error: this registers types for the language files.',
    "/** @typedef {import('highlight.js/types/index.js')} DoNotTochItRegistersLanguageFiles */",
    '',
    ...list.map(
      (d) => 'import ' + id(d) + " from 'highlight.js/lib/languages/" + d + "'"
    ),
    "import {lowlight} from './" + base + ".js'",
    '',
    ...list.map((d) => "lowlight.registerLanguage('" + d + "', " + id(d) + ')'),
    '',
    "export {lowlight} from './" + base + ".js'",
    ''
  ].join('\n')
}

/**
 * @param {string} name
 * @returns {string}
 */
function id(name) {
  const cleaned = name.replace(/[_-][a-z]/, (d) => d.charAt(1).toUpperCase())
  if (isIdentifier(cleaned)) return cleaned
  if (isIdentifier('$' + cleaned)) return '$' + cleaned
  throw new Error('Could not generate id for `' + name + '`')
}

/* eslint-enable no-await-in-loop */
