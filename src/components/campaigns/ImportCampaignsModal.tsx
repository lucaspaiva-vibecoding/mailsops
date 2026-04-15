import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { UploadCloud, Check, X, ChevronRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { ContactInsert } from '../../types/database'

interface ImportCampaignsModalProps {
  open: boolean
  onClose: () => void
  onImportComplete: () => void
}

type Step = 1 | 2 | 3 | 4

type CampaignFieldMapping = 'email' | 'subject' | 'body_text' | 'first_name' | 'last_name' | 'skip'

interface CampaignGroup {
  subject: string
  body_text: string
  rows: string[][]
}

interface ImportResult {
  campaignsCreated: number
  contactsCreated: number
  contactsMatched: number
  errors: number
}

const STEP_LABELS: Record<Step, string> = {
  1: 'Upload',
  2: 'Map Columns',
  3: 'Preview',
  4: 'Import',
}

const FIELD_OPTIONS: { value: CampaignFieldMapping; label: string }[] = [
  { value: 'skip', label: '(skip column)' },
  { value: 'email', label: 'Email address *' },
  { value: 'subject', label: 'Subject *' },
  { value: 'body_text', label: 'Body (plain text) *' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
]

function autoDetectField(header: string): CampaignFieldMapping {
  const h = header.toLowerCase().trim()
  if (h === 'email' || h === 'email address' || h === 'e-mail') return 'email'
  if (h === 'subject' || h === 'email subject' || h === 'subject line') return 'subject'
  if (h === 'body' || h === 'body_text' || h === 'body text' || h === 'text' || h === 'message' || h === 'content') return 'body_text'
  if (h === 'first_name' || h === 'firstname' || h === 'first name') return 'first_name'
  if (h === 'last_name' || h === 'lastname' || h === 'last name') return 'last_name'
  return 'skip'
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImportCampaignsModal({ open, onClose, onImportComplete }: ImportCampaignsModalProps) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])

  // Step 2 state
  const [columnMapping, setColumnMapping] = useState<CampaignFieldMapping[]>([])
  const [mappingError, setMappingError] = useState<string | null>(null)

  // Step 3 state
  const [groups, setGroups] = useState<CampaignGroup[]>([])
  const [existingMap, setExistingMap] = useState<Map<string, string>>(new Map())
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

  function parseCsv(selected: File) {
    Papa.parse<string[]>(selected, {
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file only.')
      return
    }
    setFile(selected)
    setParseError(null)
    parseCsv(selected)
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
    parseCsv(dropped)
  }

  function handleMappingChange(index: number, value: CampaignFieldMapping) {
    const updated = [...columnMapping]
    updated[index] = value
    setColumnMapping(updated)
    setMappingError(null)
  }

  function getMappedValue(row: string[], field: CampaignFieldMapping): string {
    const idx = columnMapping.findIndex((m) => m === field)
    return idx >= 0 ? (row[idx]?.trim() ?? '') : ''
  }

  function validateMapping(): string | null {
    if (!columnMapping.includes('email')) return 'Email column must be mapped.'
    if (!columnMapping.includes('subject')) return 'Subject column must be mapped.'
    if (!columnMapping.includes('body_text')) return 'Body (plain text) column must be mapped.'
    const nonSkip = columnMapping.filter((m) => m !== 'skip')
    if (new Set(nonSkip).size !== nonSkip.length) return 'Each field can only be mapped once.'
    return null
  }

  async function handleNextToPreview() {
    const err = validateMapping()
    if (err) {
      setMappingError(err)
      return
    }
    setMappingError(null)
    setPreviewLoading(true)

    try {
      // Pre-fetch workspace contacts for dedup
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, email')
        .eq('workspace_id', profile!.workspace_id)
        .is('deleted_at', null)

      const map = new Map(
        (existing ?? []).map((c: { id: string; email: string }) => [c.email.toLowerCase(), c.id])
      )
      setExistingMap(map)

      // Group rows by (subject, body_text)
      const groupMap = new Map<string, CampaignGroup>()
      for (const row of csvRows) {
        const subject = getMappedValue(row, 'subject')
        const body = getMappedValue(row, 'body_text')
        if (!subject || !body) continue
        const key = `${subject}|||${body}`
        if (!groupMap.has(key)) groupMap.set(key, { subject, body_text: body, rows: [] })
        groupMap.get(key)!.rows.push(row)
      }
      setGroups(Array.from(groupMap.values()))
    } catch {
      setGroups([])
      setExistingMap(new Map())
    } finally {
      setPreviewLoading(false)
    }

    setStep(3)
  }

  async function executeImport() {
    if (!profile?.workspace_id) {
      showToast('Session expired. Please sign in again.', 'error')
      return
    }
    setImporting(true)
    setImportError(null)
    const workspaceId = profile.workspace_id
    const fromName = profile.full_name ?? ''
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    let campaignsCreated = 0
    let contactsCreated = 0
    let contactsMatched = 0
    let errors = 0

    // Clone existing map so we can add new contacts during import
    const localExistingMap = new Map(existingMap)

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]

      try {
        // 1. Create contact list for this group
        const listName = `Import – ${group.subject.slice(0, 40)} – ${dateStr}`
        const { data: listData, error: listError } = await supabase
          .from('contact_lists')
          .insert({ workspace_id: workspaceId, name: listName, description: null, color: null })
          .select('id')
          .single()

        if (listError || !listData) {
          errors++
          setProgress(Math.round(((gi + 1) / groups.length) * 100))
          continue
        }
        const listId = listData.id

        // 2. Collect emails and split into new vs existing
        const toInsert: ContactInsert[] = []
        const contactIds: string[] = []

        for (const row of group.rows) {
          const email = getMappedValue(row, 'email').toLowerCase()
          if (!email) continue

          const existingId = localExistingMap.get(email)
          if (existingId) {
            contactIds.push(existingId)
            contactsMatched++
          } else {
            toInsert.push({
              email,
              first_name: getMappedValue(row, 'first_name') || null,
              last_name: getMappedValue(row, 'last_name') || null,
              company: null,
              tags: [],
              custom_fields: {},
              workspace_id: workspaceId,
              status: 'active',
              unsubscribed_at: null,
              bounce_type: null,
              bounced_at: null,
            })
          }
        }

        // 3. Batch insert new contacts (500-row chunks)
        const CHUNK_SIZE = 500
        for (let ci = 0; ci < toInsert.length; ci += CHUNK_SIZE) {
          const chunk = toInsert.slice(ci, ci + CHUNK_SIZE)
          const { data: inserted, error: insertError } = await supabase
            .from('contacts')
            .insert(chunk)
            .select('id, email')

          if (insertError || !inserted) {
            errors += chunk.length
          } else {
            for (const c of inserted as { id: string; email: string }[]) {
              localExistingMap.set(c.email.toLowerCase(), c.id)
              contactIds.push(c.id)
              contactsCreated++
            }
          }
        }

        // 4. Insert contact list members
        if (contactIds.length > 0) {
          const members = contactIds.map((contact_id) => ({ contact_list_id: listId, contact_id }))
          const { error: membersError } = await supabase
            .from('contact_list_members')
            .insert(members)

          if (membersError) errors++
        }

        // 5. Create campaign
        const { error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            workspace_id: workspaceId,
            name: group.subject.slice(0, 60),
            status: 'draft',
            from_name: fromName,
            from_email: '',
            reply_to_email: null,
            subject: group.subject,
            preview_text: null,
            body_html: textToHtml(group.body_text),
            body_json: null,
            contact_list_id: listId,
            segment_filter: null,
            scheduled_at: null,
            settings: {},
          })

        if (campaignError) {
          errors++
        } else {
          campaignsCreated++
        }
      } catch {
        errors++
      }

      setProgress(Math.round(((gi + 1) / groups.length) * 100))
    }

    setImportResult({ campaignsCreated, contactsCreated, contactsMatched, errors })
    setImporting(false)

    if (campaignsCreated > 0) {
      showToast(`${campaignsCreated} campaign${campaignsCreated > 1 ? 's' : ''} imported.`, 'success')
      onImportComplete()
    } else {
      showToast('Import failed. No campaigns were created.', 'error')
      setImportError('No campaigns were created. Check your CSV and try again.')
    }
  }

  function handleClose() {
    setStep(1)
    setFile(null)
    setParseError(null)
    setCsvHeaders([])
    setCsvRows([])
    setColumnMapping([])
    setMappingError(null)
    setGroups([])
    setExistingMap(new Map())
    setPreviewLoading(false)
    setImporting(false)
    setProgress(0)
    setImportResult(null)
    setImportError(null)
    onClose()
  }

  // Compute new vs matched totals for step 3 summary
  const allEmails = groups.flatMap((g) =>
    g.rows.map((r) => getMappedValue(r, 'email').toLowerCase()).filter(Boolean)
  )
  const previewNewCount = allEmails.filter((e) => !existingMap.has(e)).length
  const previewMatchedCount = allEmails.filter((e) => existingMap.has(e)).length

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
                <p className="text-xs text-gray-500 mt-1">
                  Required columns: email, subject, body (plain text)
                </p>
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
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-gray-200">Map Columns</p>
              <p className="text-xs text-gray-400">
                Map the required fields: email, subject, and body (plain text).
              </p>
              <div className="flex flex-col gap-2">
                {csvHeaders.map((header, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-sm text-gray-200 w-40 truncate shrink-0">{header}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                    <select
                      value={columnMapping[i] ?? 'skip'}
                      onChange={(e) => handleMappingChange(i, e.target.value as CampaignFieldMapping)}
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

              {mappingError && (
                <p className="text-sm text-red-400 mt-1">{mappingError}</p>
              )}
            </div>
          )}

          {/* Step 3: Preview Groups */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-sm text-gray-200">
                      <span className="font-semibold">{groups.length}</span> campaign{groups.length !== 1 ? 's' : ''} to create
                      {' · '}
                      <span className="font-semibold">{previewNewCount}</span> new contacts
                      {' · '}
                      <span className="font-semibold">{previewMatchedCount}</span> matched
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {groups.map((group, gi) => {
                      const groupEmails = group.rows
                        .map((r) => getMappedValue(r, 'email').toLowerCase())
                        .filter(Boolean)
                      const preview = groupEmails.slice(0, 2)
                      return (
                        <div key={gi} className="bg-gray-800/40 rounded-lg p-3">
                          <p className="text-sm font-semibold text-gray-200 truncate">
                            {group.subject}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {group.rows.length} recipient{group.rows.length !== 1 ? 's' : ''}
                            {preview.length > 0 && (
                              <span className="ml-2 text-gray-500">
                                {preview.join(', ')}
                                {groupEmails.length > 2 && ` +${groupEmails.length - 2} more`}
                              </span>
                            )}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {groups.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No valid rows found. Check that subject and body_html columns are mapped.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Import */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              {!importing && !importResult && !importError && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-gray-200">
                    Ready to create{' '}
                    <span className="font-semibold">{groups.length}</span>{' '}
                    campaign{groups.length !== 1 ? 's' : ''}.
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
                  <p className="text-sm text-gray-400 text-center">Creating campaigns...</p>
                </div>
              )}

              {importResult && !importError && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-green-400">
                    Import complete — {importResult.campaignsCreated} campaign{importResult.campaignsCreated !== 1 ? 's' : ''} created,{' '}
                    {importResult.contactsCreated} contact{importResult.contactsCreated !== 1 ? 's' : ''} added,{' '}
                    {importResult.contactsMatched} matched.
                    {importResult.errors > 0 && ` ${importResult.errors} errors.`}
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

            {step === 3 && groups.length > 0 && (
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
