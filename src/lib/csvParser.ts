import Papa from 'papaparse'
import type { CsvRow } from '../types/database'

export interface CsvParseResult {
  rows: CsvRow[]
  error: string | null
  totalRows: number
}

export interface CsvRawParseResult {
  headers: string[]
  rawData: Record<string, string>[]
  error: string | null
}

export type CsvFieldKey = 'first_name' | 'last_name' | 'email' | 'subject' | 'body'

export interface ColumnMapping {
  first_name: string
  last_name: string
  email: string
  subject: string
  body: string
}

/** Parse CSV and return raw headers + data without column validation */
export function parseRawCsv(file: File): Promise<CsvRawParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        if (headers.length === 0) {
          resolve({ headers: [], rawData: [], error: 'CSV has no columns.' })
          return
        }
        if (results.data.length === 0) {
          resolve({ headers, rawData: [], error: 'CSV has no data rows.' })
          return
        }
        resolve({ headers, rawData: results.data, error: null })
      },
      error: (err) => {
        resolve({ headers: [], rawData: [], error: err.message })
      },
    })
  })
}

/** Auto-detect column mapping from header names using fuzzy matching */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

  const score = (header: string, keywords: string[]): number => {
    const h = normalize(header)
    for (let i = 0; i < keywords.length; i++) {
      if (h === normalize(keywords[i])) return keywords.length - i + 1 // exact match wins
      if (h.includes(normalize(keywords[i]))) return keywords.length - i
    }
    return 0
  }

  const bestMatch = (keywords: string[], exclude: string[] = []): string => {
    let best = ''
    let bestScore = 0
    for (const h of headers) {
      if (exclude.includes(h)) continue
      const s = score(h, keywords)
      if (s > bestScore) { bestScore = s; best = h }
    }
    return best
  }

  const email = bestMatch(['email', 'e-mail', 'mail', 'emailaddress'])
  const first_name = bestMatch(['firstname', 'first_name', 'nome', 'first', 'name', 'primeironome'], [email])
  const last_name = bestMatch(['lastname', 'last_name', 'sobrenome', 'surname', 'last', 'ultimonome'], [email, first_name])
  const subject = bestMatch(['subject', 'assunto', 'subjectline', 'titulo', 'title'], [email, first_name, last_name])
  const body = bestMatch(['body', 'corpo', 'content', 'conteudo', 'html', 'message', 'mensagem', 'text', 'texto'], [email, first_name, last_name, subject])

  return { first_name, last_name, email, subject, body }
}

/** Apply a column mapping to raw CSV data and return typed CsvRow[] */
export function applyMapping(rawData: Record<string, string>[], mapping: ColumnMapping): CsvParseResult {
  const validRows = rawData.filter(row => {
    const emailVal = row[mapping.email]?.trim()
    return emailVal && emailVal !== ''
  })

  if (validRows.length === 0) {
    return { rows: [], error: 'No valid rows found. Ensure the email column has values.', totalRows: 0 }
  }

  const rows: CsvRow[] = validRows.map(row => ({
    first_name: (mapping.first_name ? row[mapping.first_name] : '') ?? '',
    last_name: (mapping.last_name ? row[mapping.last_name] : '') ?? '',
    email: row[mapping.email].toLowerCase().trim(),
    subject: (mapping.subject ? row[mapping.subject] : '') ?? '',
    body: (mapping.body ? row[mapping.body] : '') ?? '',
  }))

  return { rows, error: null, totalRows: rows.length }
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

export function truncateBody(html: string, maxChars = 100): string {
  const plain = stripHtml(html)
  return plain.length > maxChars ? plain.slice(0, maxChars) + '...' : plain
}
