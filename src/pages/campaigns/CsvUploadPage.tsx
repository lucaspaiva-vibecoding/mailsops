import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, X, FileText, ArrowRight } from 'lucide-react'
import {
  parseRawCsv,
  autoDetectMapping,
  applyMapping,
  truncateBody,
} from '../../lib/csvParser'
import type { ColumnMapping, CsvFieldKey } from '../../lib/csvParser'
import { useCsvCampaign } from '../../hooks/campaigns/useCsvCampaign'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { CsvRow } from '../../types/database'

type Step = 'upload' | 'mapping' | 'preview'

const FIELD_LABELS: Record<CsvFieldKey, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  subject: 'Subject',
  body: 'Body (HTML)',
}

const REQUIRED_FIELDS: CsvFieldKey[] = ['email', 'subject', 'body']

export function CsvUploadPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { createCsvCampaign } = useCsvCampaign()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawData, setRawData] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ first_name: '', last_name: '', email: '', subject: '', body: '' })
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [campaignName, setCampaignName] = useState('')
  const [creating, setCreating] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // ─── File handling ────────────────────────────────────────────────────────

  const handleFile = async (file: File) => {
    setParseError(null)
    setCsvRows([])
    setFileName(null)

    const result = await parseRawCsv(file)
    if (result.error) {
      setParseError(result.error)
      return
    }

    setFileName(file.name)
    setHeaders(result.headers)
    setRawData(result.rawData)

    const detected = autoDetectMapping(result.headers)
    setMapping(detected)
    setStep('mapping')
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(true) }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(false) }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleReset = () => {
    setStep('upload')
    setCsvRows([])
    setFileName(null)
    setParseError(null)
    setMappingError(null)
    setCampaignName('')
    setHeaders([])
    setRawData([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Mapping step ─────────────────────────────────────────────────────────

  const handleMappingChange = (field: CsvFieldKey, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value }))
    setMappingError(null)
  }

  const handleConfirmMapping = () => {
    const missingRequired = REQUIRED_FIELDS.filter(f => !mapping[f])
    if (missingRequired.length > 0) {
      setMappingError(`Please map the required fields: ${missingRequired.map(f => FIELD_LABELS[f]).join(', ')}`)
      return
    }

    const result = applyMapping(rawData, mapping)
    if (result.error) {
      setMappingError(result.error)
      return
    }

    setCsvRows(result.rows)
    setStep('preview')
  }

  // ─── Create campaign ──────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!campaignName.trim()) {
      showToast('Please enter a campaign name.', 'error')
      return
    }
    setCreating(true)
    try {
      const { data, error } = await createCsvCampaign({ name: campaignName, rows: csvRows })
      if (error) {
        showToast(error, 'error')
      } else if (data) {
        showToast(`Campaign created with ${data.recipientCount} recipients`, 'success')
        navigate(`/campaigns/${data.campaignId}/csv-review`)
      }
    } finally {
      setCreating(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <h1 className="text-xl font-semibold text-gray-100">CSV Personalized Campaign</h1>
        <Button variant="ghost" size="sm" type="button" onClick={() => navigate('/campaigns')}>
          Back to campaigns
        </Button>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Upload CSV
          </p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed
              px-8 py-12 cursor-pointer transition-colors duration-150
              ${dragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-gray-600 bg-gray-900/50 hover:border-gray-500 hover:bg-gray-900'
              }
            `}
          >
            <UploadCloud className="w-10 h-10 text-gray-400" />
            <p className="text-sm text-gray-300 font-medium">
              Drop your CSV file here or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Any column names — you'll map them to the right fields in the next step
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />
        </section>
      )}

      {/* Error display */}
      {parseError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-700 bg-red-900/50 px-4 py-3">
          <p className="text-sm text-red-300">{parseError}</p>
          <button type="button" onClick={() => setParseError(null)} className="shrink-0 text-red-400 hover:text-red-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* File info bar (mapping + preview steps) */}
      {fileName && step !== 'upload' && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="text-sm text-gray-200 flex-1 truncate">{fileName}</span>
          <span className="text-sm text-gray-400 shrink-0">{rawData.length} rows detected</span>
          <Button variant="ghost" size="sm" type="button" onClick={handleReset}>
            Change file
          </Button>
        </div>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {step === 'mapping' && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Map columns
          </p>
          <p className="text-sm text-gray-400 mb-4">
            Match each field to the corresponding column in your CSV. Fields marked * are required.
          </p>
          <Card padding="md">
            <div className="flex flex-col gap-4">
              {(Object.keys(FIELD_LABELS) as CsvFieldKey[]).map((field) => (
                <div key={field} className="flex items-center gap-4">
                  <div className="w-36 shrink-0">
                    <span className="text-sm font-medium text-gray-200">
                      {FIELD_LABELS[field]}
                      {REQUIRED_FIELDS.includes(field) && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
                  <select
                    value={mapping[field]}
                    onChange={(e) => handleMappingChange(field, e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— Not mapped{REQUIRED_FIELDS.includes(field) ? ' (required)' : ' (optional)'} —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  {/* Preview of first value */}
                  {mapping[field] && rawData[0]?.[mapping[field]] && (
                    <span className="text-xs text-gray-500 truncate max-w-[160px]" title={rawData[0][mapping[field]]}>
                      e.g. "{rawData[0][mapping[field]]}"
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {mappingError && (
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-red-700 bg-red-900/50 px-4 py-3">
              <p className="text-sm text-red-300">{mappingError}</p>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <Button variant="primary" size="md" type="button" onClick={handleConfirmMapping}>
              Confirm mapping →
            </Button>
          </div>
        </section>
      )}

      {/* ── Step 3: Preview + Campaign name ── */}
      {step === 'preview' && (
        <>
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Preview (first 5 rows)
              </p>
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ← Edit mapping
              </button>
            </div>
            <Card padding="sm" className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-400 text-left">
                    <th className="px-3 py-2 font-medium border-b border-gray-800 w-10">#</th>
                    <th className="px-3 py-2 font-medium border-b border-gray-800">First Name</th>
                    <th className="px-3 py-2 font-medium border-b border-gray-800">Last Name</th>
                    <th className="px-3 py-2 font-medium border-b border-gray-800">Email</th>
                    <th className="px-3 py-2 font-medium border-b border-gray-800">Subject</th>
                    <th className="px-3 py-2 font-medium border-b border-gray-800">Body Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(0, 5).map((row, index) => (
                    <tr key={index} className="border-b border-gray-800 last:border-0">
                      <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                      <td className="px-3 py-2 text-gray-200">{row.first_name || <span className="text-gray-600">—</span>}</td>
                      <td className="px-3 py-2 text-gray-200">{row.last_name || <span className="text-gray-600">—</span>}</td>
                      <td className="px-3 py-2 text-gray-200">{row.email}</td>
                      <td className="px-3 py-2 text-gray-200">{row.subject}</td>
                      <td className="px-3 py-2 text-gray-400">{truncateBody(row.body, 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {csvRows.length > 5 && (
              <p className="text-xs text-gray-500 mt-2">{csvRows.length - 5} more rows not shown</p>
            )}
          </section>

          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Campaign details
            </p>
            <div className="max-w-md">
              <Input
                label="Campaign name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. April newsletter personalized"
              />
            </div>
          </section>

          <div className="flex justify-end items-center pt-6 border-t border-gray-800 mt-2">
            <Button
              variant="primary"
              size="md"
              loading={creating}
              onClick={handleCreate}
              type="button"
            >
              Create campaign ({csvRows.length} recipients)
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
