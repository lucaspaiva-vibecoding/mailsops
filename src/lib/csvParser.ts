import Papa from 'papaparse'
import type { CsvRow } from '../types/database'

export interface CsvParseResult {
  rows: CsvRow[]
  error: string | null
  totalRows: number
}

const REQUIRED_COLUMNS = ['first_name', 'last_name', 'email', 'subject', 'body'] as const

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? []
        const missing = REQUIRED_COLUMNS.filter(col => !fields.includes(col))
        if (missing.length > 0) {
          resolve({ rows: [], error: `Missing required columns: ${missing.join(', ')}`, totalRows: 0 })
          return
        }

        const validRows = results.data.filter(row => row.email && row.email.trim() !== '')
        if (validRows.length === 0) {
          resolve({ rows: [], error: 'No valid rows found. Ensure each row has an email address.', totalRows: 0 })
          return
        }

        const rows: CsvRow[] = validRows.map(row => ({
          first_name: row.first_name ?? '',
          last_name: row.last_name ?? '',
          email: row.email.toLowerCase().trim(),
          subject: row.subject ?? '',
          body: row.body ?? '',
        }))

        resolve({ rows, error: null, totalRows: rows.length })
      },
      error: (err) => {
        resolve({ rows: [], error: err.message, totalRows: 0 })
      },
    })
  })
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

export function truncateBody(html: string, maxChars = 100): string {
  const plain = stripHtml(html)
  return plain.length > maxChars ? plain.slice(0, maxChars) + '...' : plain
}
