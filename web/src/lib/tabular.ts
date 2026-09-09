/** Converts uploaded tabular files (Excel, TSV, semicolon-delimited) to the
 * CSV text the engine loaders consume. Everything runs in the browser. */
import * as XLSX from 'xlsx'

const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods']

function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

function csvEscape(field: string): string {
  return /[",\n\r]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
}

function rowsToCsv(rows: string[][]): string {
  const kept = rows.filter((r) => r.some((cell) => cell.trim() !== ''))
  return kept.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n'
}

/** Parses delimiter-separated text with quoted fields ("" escapes). */
function parseDelimited(text: string, delimiter: string): string[][] {
  if (text.startsWith('\uFEFF')) text = text.slice(1)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Picks the delimiter whose count in the header line (outside quotes) is highest. */
function sniffDelimiter(text: string): string {
  const header = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (const c of header) {
    if (c === '"') inQuotes = !inQuotes
    else if (!inQuotes && c in counts) counts[c]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function isoDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function numberToString(n: number): string {
  if (Number.isInteger(n)) return String(n)
  const fixed = n.toFixed(2)
  return Math.abs(Number(fixed) - n) < 1e-9 ? fixed : String(n)
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return isoDate(cell)
  if (typeof cell === 'number') return numberToString(cell)
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE'
  return String(cell)
}

function excelToCsv(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('workbook has no sheets')
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  })
  return rowsToCsv(rows.map((r) => r.map(cellToString)))
}

/** The engine's loaders need at least these columns; a header row without them
 * means the file is not a statement/ledger table (e.g. garbage bytes that
 * SheetJS's text fallback still "parses"). */
function checkHeader(csv: string, name: string): string {
  const noBom = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
  const headerLine = noBom.slice(0, noBom.indexOf('\n') === -1 ? noBom.length : noBom.indexOf('\n'))
  const columns = headerLine.split(',').map((h) => h.trim().replaceAll('"', '').toLowerCase())
  if (!columns.includes('ref') || !columns.includes('date')) {
    throw new Error(
      `${name} does not look like a statement or ledger table (no "ref" and "date" columns in the first row)`,
    )
  }
  return csv
}

/** Reads an uploaded statement/ledger file and returns engine-ready CSV text.
 * Accepts CSV, TSV, semicolon-delimited text, and Excel workbooks. */
export async function fileToCsvText(file: File): Promise<string> {
  const ext = extension(file.name)
  if (EXCEL_EXTENSIONS.includes(ext)) {
    return checkHeader(excelToCsv(await file.arrayBuffer()), file.name)
  }
  const text = await file.text()
  const delimiter = ext === '.tsv' ? '\t' : sniffDelimiter(text)
  if (delimiter === ',') return checkHeader(text, file.name)
  return checkHeader(rowsToCsv(parseDelimited(text, delimiter)), file.name)
}
