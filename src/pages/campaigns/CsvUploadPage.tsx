import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, X, FileText } from 'lucide-react'
import { parseCsvFile, truncateBody } from '../../lib/csvParser'
import { useCsvCampaign } from '../../hooks/campaigns/useCsvCampaign'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import type { CsvRow } from '../../types/database'

export function CsvUploadPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { createCsvCampaign } = useCsvCampaign()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [creating, setCreating] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFile = async (file: File) => {
    setParseError(null)
    setCsvRows([])
    setFileName(null)

    const result = await parseCsvFile(file)
    if (result.error) {
      setParseError(result.error)
      return
    }
    setCsvRows(result.rows)
    setFileName(file.name)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleReset = () => {
    setCsvRows([])
    setFileName(null)
    setParseError(null)
    setCampaignName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <h1 className="text-xl font-semibold text-gray-100">CSV Personalized Campaign</h1>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => navigate('/campaigns')}
        >
          Back to campaigns
        </Button>
      </div>

      {/* Section 1 — Upload CSV */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Upload CSV
        </p>

        {/* Dropzone */}
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
            Required columns: first_name, last_name, email, subject, body
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

      {/* Error display */}
      {parseError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-700 bg-red-900/50 px-4 py-3">
          <p className="text-sm text-red-300">{parseError}</p>
          <button
            type="button"
            onClick={() => setParseError(null)}
            className="shrink-0 text-red-400 hover:text-red-200 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* File info bar */}
      {fileName && (
        <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
          <span className="text-sm text-gray-200 flex-1 truncate">{fileName}</span>
          <span className="text-sm text-gray-400 shrink-0">{csvRows.length} rows</span>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleReset}
          >
            Remove
          </Button>
        </div>
      )}

      {/* Section 2 — Preview */}
      {csvRows.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Preview (first 5 rows)
          </p>
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
                    <td className="px-3 py-2 text-gray-200">{row.first_name}</td>
                    <td className="px-3 py-2 text-gray-200">{row.last_name}</td>
                    <td className="px-3 py-2 text-gray-200">{row.email}</td>
                    <td className="px-3 py-2 text-gray-200">{row.subject}</td>
                    <td className="px-3 py-2 text-gray-400">{truncateBody(row.body, 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* Section 3 — Campaign Details */}
      {csvRows.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Campaign Details
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
      )}

      {/* Bottom action bar */}
      {csvRows.length > 0 && (
        <div className="flex justify-end items-center pt-6 border-t border-gray-800 mt-2">
          <Button
            variant="primary"
            size="md"
            loading={creating}
            onClick={handleCreate}
            type="button"
          >
            Create campaign
          </Button>
        </div>
      )}
    </div>
  )
}
