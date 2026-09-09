// Generates Excel/TSV/semicolon versions of the golden CSV fixtures for
// testing the multi-format upload path. Run from web/ so it can use its
// node_modules: `node ../fixtures/make_excel_fixtures.mjs`
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const XLSX = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../web/'))('xlsx')

const here = dirname(fileURLToPath(import.meta.url))

function parseCsv(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => line.split(','))
}

function convert(base, dateCol, numericCols) {
  const rows = parseCsv(readFileSync(join(here, `${base}.csv`), 'utf8'))
  const header = rows[0]

  // Excel: dates as real Date cells, amounts as numbers.
  const data = rows.slice(1).map((r) =>
    r.map((cell, j) => {
      if (header[j] === dateCol) return new Date(`${cell}T00:00:00`)
      if (numericCols.includes(header[j])) return Number(cell)
      return cell
    }),
  )
  const ws = XLSX.utils.aoa_to_sheet([header, ...data], { cellDates: true })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, join(here, `${base}.xlsx`), { cellDates: true })

  // TSV and semicolon-delimited text versions.
  writeFileSync(join(here, `${base}.tsv`), rows.map((r) => r.join('\t')).join('\n') + '\n')
  writeFileSync(
    join(here, `${base}_semicolon.csv`),
    rows.map((r) => r.join(';')).join('\n') + '\n',
  )
}

convert('meridian_stmt', 'date', ['amount'])
convert('acme_ledger', 'date', ['original', 'open'])
console.log('wrote xlsx/tsv/semicolon fixtures')
