import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { UploadCloud, Check, X, ChevronRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Spinner } from '../ui/Spinner'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { ContactInsert } from '../../types/database'

interface ImportWizardModalProps {
  open: boolean
  onClose: () => void
  onImportComplete: () => void
}

type Step = 1 | 2 | 3 | 4

type FieldMapping = 'email' | 'first_name' | 'last_name' | 'company' | 'skip'

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: number
}

const STEP_LABELS: Record<Step, string> = {
  1: 'Upload',
  2: 'Map Columns',
  3: 'Preview',
  4: 'Confirm',
}

const FIELD_OPTIONS: { value: FieldMapping; label: string }[] = [
  { value: 'skip', label: '(skip column)' },
  { value: 'email', label: 'Email address *' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'company', label: 'Company' },
]

function autoDetectField(header: string): FieldMapping {
  const h = header.toLowerCase().trim()
  if (h === 'email' || h === 'email address' || h === 'e-mail') return 'email'
  if (h === 'first_name' || h === 'firstname' || h === 'first name') return 'first_name'
  if (h === 'last_name' || h === 'lastname' || h === 'last name') return 'last_name'
  if (h === 'company' || h === 'company name' || h === 'organization') return 'company'
  return 'skip'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImportWizardModal({ open, onClose, onImportComplete }: ImportWizardModalProps) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])

  // Step 2 state
  const [columnMapping, setColumnMapping] = useState<FieldMapping[]>([])
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip')
  const [tagsInput, setTagsInput] = useState('')
  const [emailMappingError, setEmailMappingError] = useState(false)

  // Step 3 state
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Step 4 state
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  if (!open) return null

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file only.')
      return
    }
    setFile(selected)
    setParseError(null)

    Papa.parse<string[]>(selected, {
      skipEmptyLines: true,
      complete: (results) => {
        const [headers, ...rows] = results.data
        setCsvHeaders(headers)
        setCsvRows(rows)
        // Auto-detect mappings
        const mappings = headers.map((h) => autoDetectField(h))
        setColumnMapping(mappings)
      },
      error: (error) => {
        setParseError(error.message)
        setFile(null)
      },
    })
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click()
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return
    if (!dropped.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file only.')
      return
    }
    setFile(dropped)
    setParseError(null)

    Papa.parse<string[]>(dropped, {
      skipEmptyLines: true,
      complete: (results) => {
        const [headers, ...rows] = results.data
        setCsvHeaders(headers)
        setCsvRows(rows)
        const mappings = headers.map((h) => autoDetectField(h))
        setColumnMapping(mappings)
      },
      error: (error) => {
        setParseError(error.message)
        setFile(null)
      },
    })
  }

  function handleMappingChange(index: number, value: FieldMapping) {
    const updated = [...columnMapping]
    updated[index] = value
    setColumnMapping(updated)
    if (value === 'email') setEmailMappingError(false)
  }

  function isEmailMapped(): boolean {
    return columnMapping.includes('email')
  }

  function getMappedValue(row: string[], field: FieldMapping): string {
    const idx = columnMapping.findIndex((m) => m === field)
    return idx >= 0 ? (row[idx]?.trim() ?? '') : ''
  }

  async function handleNextToPreview() {
    if (!isEmailMapped()) {
      setEmailMappingError(true)
      return
    }
    const nonSkipMappings = columnMapping.filter((m) => m !== 'skip')
    const hasDuplicateMappings = new Set(nonSkipMappings).size !== nonSkipMappings.length
    if (hasDuplicateMappings) {
      setEmailMappingError(true)
      return
    }
    setEmailMappingError(false)
    setPreviewLoading(true)

    try {
      // Fetch existing emails to compute duplicate count
      const { data: existing } = await supabase
        .from('contacts')
        .select('email')
        .eq('workspace_id', profile!.workspace_id)
        .is('deleted_at', null)

      const existingEmails = new Set(
        (existing ?? []).map((c: { email: string }) => c.email.toLowerCase())
      )

      const emailIdx = columnMapping.findIndex((m) => m === 'email')
      let dupes = 0
      let skipped = 0

      for (const row of csvRows) {
        const email = emailIdx >= 0 ? row[emailIdx]?.trim().toLowerCase() : ''
        if (!email) {
          skipped++
        } else if (existingEmails.has(email)) {
          dupes++
        }
      }

      setDuplicateCount(dupes)
      setSkippedCount(skipped)
    } catch {
      // Proceed even if fetch fails — show 0 duplicates
      setDuplicateCount(0)
      setSkippedCount(0)
    } finally {
      setPreviewLoading(false)
    }

    setStep(3)
  }

  async function executeImport() {
    setImporting(true)
    setImportError(null)
    const workspaceId = profile!.workspace_id

    // 1. Fetch all existing emails in workspace
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, email')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)

    const existingMap = new Map(
      (existing ?? []).map((c: { id: string; email: string }) => [c.email.toLowerCase(), c.id])
    )

    const importTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const toInsert: ContactInsert[] = []
    const toUpdate: { id: string; data: Partial<ContactInsert> }[] = []
    let skipped = 0
    let errors = 0
    let insertedCount = 0
    let updatedCount = 0
    const errorDetails: Array<{ row: number; reason: string }> = []

    // 2. Route each row to insert, update, or skip
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i]
      const emailIdx = columnMapping.findIndex((m) => m === 'email')
      const email = emailIdx >= 0 ? row[emailIdx]?.trim().toLowerCase() : ''

      if (!email) {
        errors++
        errorDetails.push({ row: i + 2, reason: 'Missing email' })
        continue
      }

      const contactData: Partial<ContactInsert> = {
        email,
        first_name: getMappedValue(row, 'first_name') || null,
        last_name: getMappedValue(row, 'last_name') || null,
        company: getMappedValue(row, 'company') || null,
        tags: importTags,
        workspace_id: workspaceId,
        status: 'active' as const,
        custom_fields: {},
      }

      const existingId = existingMap.get(email)
      if (existingId) {
        if (duplicateStrategy === 'skip') {
          skipped++
        } else {
          toUpdate.push({ id: existingId, data: contactData })
        }
      } else {
        toInsert.push(contactData as ContactInsert)
      }
    }

    // 3. Batch insert (500-row chunks)
    const CHUNK_SIZE = 500
    const total = toInsert.length + toUpdate.length

    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase.from('contacts').insert(chunk)
      if (error) {
        errors += chunk.length
        errorDetails.push({ row: 0, reason: `Batch insert error: ${error.message}` })
      } else {
        insertedCount += chunk.length
      }
      if (total > 0) {
        setProgress(Math.round(((i + chunk.length) / total) * 100))
      }
    }

    // 4. Update existing (individual updates)
    for (let i = 0; i < toUpdate.length; i++) {
      const { id, data } = toUpdate[i]
      const { error } = await supabase.from('contacts').update(data).eq('id', id)
      if (error) {
        errors++
        errorDetails.push({ row: 0, reason: `Update error: ${error.message}` })
      } else {
        updatedCount++
      }
      if (total > 0) {
        setProgress(Math.round(((toInsert.length + i + 1) / total) * 100))
      }
    }

    // 5. Log to contact_import_logs
    await supabase.from('contact_import_logs').insert({
      workspace_id: workspaceId,
      total_rows: csvRows.length,
      imported: insertedCount,
      updated: updatedCount,
      skipped,
      errors,
      error_details: errorDetails,
    })

    setImportResult({ imported: insertedCount, updated: updatedCount, skipped, errors })
    setImporting(false)

    if (errors === 0 || toInsert.length > 0 || toUpdate.length > 0) {
      showToast('Contacts imported successfully.', 'success')
      onImportComplete()
    } else {
      showToast('Import failed. Check your CSV and try again.', 'error')
      setImportError(`Import failed. ${errors} rows had errors. Review and try again.`)
    }
  }

  function handleClose() {
    // Reset all state
    setStep(1)
    setFile(null)
    setParseError(null)
    setCsvHeaders([])
    setCsvRows([])
    setColumnMapping([])
    setDuplicateStrategy('skip')
    setTagsInput('')
    setEmailMappingError(false)
    setDuplicateCount(0)
    setSkippedCount(0)
    setImporting(false)
    setProgress(0)
    setImportResult(null)
    setImportError(null)
    onClose()
  }

  const previewRows = csvRows.slice(0, 5)
  const mappedFieldLabels = columnMapping
    .map((m, i) => (m !== 'skip' ? { field: m, header: csvHeaders[i] } : null))
    .filter(Boolean) as { field: FieldMapping; header: string }[]

  const importCount = csvRows.length - skippedCount - (duplicateStrategy === 'skip' ? duplicateCount : 0)

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Step progress indicator */}
        <div className="flex items-center justify-center gap-4 p-4 border-b border-gray-800">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              {s < step ? (
                <div
                  className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 text-xs flex items-center justify-center"
                  aria-label={`Step ${s} of 4: ${STEP_LABELS[s]} (completed)`}
                >
                  <Check className="w-3 h-3" />
                </div>
              ) : s === step ? (
                <div
                  className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-semibold"
                  aria-label={`Step ${s} of 4: ${STEP_LABELS[s]}`}
                >
                  {s}
                </div>
              ) : (
                <div
                  className="w-6 h-6 rounded-full bg-gray-800 text-gray-400 text-xs flex items-center justify-center"
                  aria-label={`Step ${s} of 4: ${STEP_LABELS[s]} (upcoming)`}
                >
                  {s}
                </div>
              )}
              <span className={`text-xs mt-1 ${s === step ? 'text-indigo-400' : 'text-gray-400'}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Step 1: Upload CSV */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div
                className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-indigo-500 hover:bg-indigo-600/5"
                onClick={handleDropZoneClick}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <UploadCloud className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-300">Drop a CSV file or click to browse</p>
                <p className="text-xs text-gray-500 mt-1">Accepts .csv files only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {parseError && (
                <p className="text-sm text-red-400">{parseError}</p>
              )}

              {file && !parseError && (
                <div className="bg-gray-800/50 rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(file.size)} · {csvRows.length} rows detected
                    </p>
                  </div>
                  <button
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      setCsvHeaders([])
                      setCsvRows([])
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              {/* Column mapping table */}
              <div>
                <p className="text-sm font-semibold text-gray-200 mb-3">Map Columns</p>
                <div className="flex flex-col gap-2">
                  {csvHeaders.map((header, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-sm text-gray-200 w-40 truncate shrink-0">{header}</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                      <select
                        value={columnMapping[i] ?? 'skip'}
                        onChange={(e) => handleMappingChange(i, e.target.value as FieldMapping)}
                        className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {emailMappingError && (
                  <p className="text-sm text-red-400 mt-2">
                    Email is required and must map to a column.
                  </p>
                )}
              </div>

              {/* Duplicate handling */}
              <div>
                <p className="text-sm font-semibold text-gray-200 mb-2">Duplicate email handling</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="skip"
                      checked={duplicateStrategy === 'skip'}
                      onChange={() => setDuplicateStrategy('skip')}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <div>
                      <p className="text-sm text-gray-200">Skip duplicate emails (recommended)</p>
                      <p className="text-xs text-gray-400">
                        Contacts with matching emails will not be modified
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value="update"
                      checked={duplicateStrategy === 'update'}
                      onChange={() => setDuplicateStrategy('update')}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <div>
                      <p className="text-sm text-gray-200">Update existing contacts with new data</p>
                      <p className="text-xs text-gray-400">
                        Existing contacts with matching emails will be overwritten
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tags input */}
              <div>
                <p className="text-sm font-semibold text-gray-200 mb-1">
                  Apply tags to all imported contacts
                </p>
                <Input
                  placeholder="e.g. newsletter, 2026-import"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <>
                  {/* Summary block */}
                  <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-200">
                      <span className="font-semibold">{importCount}</span> contacts to import
                      {' · '}
                      <span className="font-semibold">{duplicateCount}</span> duplicates
                      {' · '}
                      <span className="font-semibold">{skippedCount}</span> rows skipped
                    </p>
                    {duplicateStrategy === 'skip' && duplicateCount > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Duplicate emails will be skipped
                      </p>
                    )}
                    {duplicateStrategy === 'update' && duplicateCount > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Duplicate emails will be updated with new data
                      </p>
                    )}
                  </div>

                  {/* Preview table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          {mappedFieldLabels.map((mf) => (
                            <th
                              key={mf.field}
                              className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4"
                            >
                              {mf.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-800/50">
                            {mappedFieldLabels.map((mf) => {
                              const idx = columnMapping.findIndex((m) => m === mf.field)
                              const val = idx >= 0 ? row[idx]?.trim() ?? '' : ''
                              return (
                                <td
                                  key={mf.field}
                                  className="py-2 pr-4 text-sm text-gray-200 max-w-[200px] truncate"
                                >
                                  {val || <span className="text-gray-500">—</span>}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvRows.length > 5 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Showing 5 of {csvRows.length} rows
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4: Confirm Import */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              {!importing && !importResult && !importError && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-gray-200">
                    Ready to import{' '}
                    <span className="font-semibold">{importCount}</span> contacts
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    loading={importing}
                    onClick={executeImport}
                  >
                    Start Import
                  </Button>
                </div>
              )}

              {importing && (
                <div className="flex flex-col gap-3 py-4">
                  <div className="bg-gray-800 rounded-full h-2 w-full">
                    <div
                      className="bg-indigo-600 rounded-full h-2 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400 text-center">Importing contacts...</p>
                </div>
              )}

              {importResult && !importError && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-green-400">
                    Import complete — {importResult.imported} contacts added.
                    {importResult.updated > 0 && ` ${importResult.updated} updated.`}
                    {importResult.skipped > 0 && ` ${importResult.skipped} skipped.`}
                  </p>
                  <Button variant="primary" size="md" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              )}

              {importError && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-red-400">{importError}</p>
                  <Button variant="secondary" size="md" onClick={handleClose}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation footer */}
        <div className="flex justify-between p-4 border-t border-gray-800">
          <div>
            {step > 1 && !importing && !importResult && !importError && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setStep((s) => (s - 1) as Step)}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!importing && !importResult && !importError && (
              <button
                className="text-gray-400 hover:text-gray-200 transition-colors p-1"
                onClick={handleClose}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {step === 1 && (
              <Button
                variant="primary"
                size="md"
                disabled={!file || !!parseError}
                onClick={() => setStep(2)}
              >
                Next
              </Button>
            )}

            {step === 2 && (
              <Button
                variant="primary"
                size="md"
                onClick={handleNextToPreview}
              >
                Next
              </Button>
            )}

            {step === 3 && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setStep(4)}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
