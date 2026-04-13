import { useState, useEffect } from 'react'
import { Upload, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { ContactImportLog } from '../../types/database'

interface ImportHistoryModalProps {
  open: boolean
  onClose: () => void
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

export function ImportHistoryModal({ open, onClose }: ImportHistoryModalProps) {
  const { profile } = useAuth()
  const [logs, setLogs] = useState<ContactImportLog[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !profile?.workspace_id) return

    async function fetchLogs() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('contact_import_logs')
          .select('*')
          .eq('workspace_id', profile!.workspace_id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) {
          console.error('Failed to fetch import logs:', error.message)
        } else {
          setLogs((data as ContactImportLog[]) ?? [])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [open, profile?.workspace_id])

  if (!open) return null

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-100">Import History</h2>
          <button
            className="text-gray-400 hover:text-gray-200 transition-colors p-1"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Upload className="text-gray-600 w-10 h-10 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-300">No imports yet</h3>
              <p className="text-sm text-gray-500 mt-1 text-center">
                Your past CSV imports will appear here with row counts and any error details.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {logs.map((log, index) => {
                const isExpanded = expandedRows.has(log.id)
                const hasErrors = log.errors > 0
                const errorDetails = log.error_details ?? []

                return (
                  <div
                    key={log.id}
                    className={`py-3 ${index < logs.length - 1 ? 'border-b border-gray-800' : ''}`}
                  >
                    {/* Date */}
                    <p className="text-sm text-gray-200 mb-1">
                      {formatRelativeDate(log.created_at)}
                    </p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <span>
                        <span className="text-xs text-gray-400">Total: </span>
                        <span className="text-xs text-gray-200">{log.total_rows}</span>
                      </span>
                      <span>
                        <span className="text-xs text-gray-400">Imported: </span>
                        <span className="text-xs text-gray-200">{log.imported}</span>
                      </span>
                      <span>
                        <span className="text-xs text-gray-400">Updated: </span>
                        <span className="text-xs text-gray-200">{log.updated}</span>
                      </span>
                      <span>
                        <span className="text-xs text-gray-400">Skipped: </span>
                        <span className="text-xs text-gray-200">{log.skipped}</span>
                      </span>
                      <span>
                        <span className="text-xs text-gray-400">Errors: </span>
                        <span className={`text-xs ${log.errors > 0 ? 'text-red-400' : 'text-gray-200'}`}>
                          {log.errors}
                        </span>
                      </span>

                      {hasErrors && (
                        <button
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors ml-auto"
                          onClick={() => toggleExpand(log.id)}
                          aria-label={isExpanded ? 'Hide error details' : 'Show error details'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          {isExpanded ? 'Hide details' : 'Show details'}
                        </button>
                      )}
                    </div>

                    {/* Expandable error details */}
                    {hasErrors && isExpanded && (
                      <div className="mt-2 flex flex-col gap-1 pl-2 border-l border-gray-700">
                        {errorDetails.map((detail, di) => (
                          <p key={di} className="text-xs text-red-400">
                            {detail.row > 0 ? `Row ${detail.row}: ` : ''}{detail.reason}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
