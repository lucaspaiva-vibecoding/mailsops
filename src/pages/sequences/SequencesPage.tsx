import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreHorizontal } from 'lucide-react'
import { useSequences } from '../../hooks/sequences/useSequences'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import type { Sequence, SequenceStatus } from '../../types/database'

function statusBadgeVariant(status: SequenceStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'active': return 'success'
    case 'paused': return 'warning'
    case 'draft':
    case 'archived':
    default: return 'default'
  }
}

export function SequencesPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { profile } = useAuth()
  const { sequences, loading, deleteSequence, archiveSequence, pauseSequence, resumeSequence } = useSequences()
  const { lists } = useContactLists()

  const [stepCounts, setStepCounts] = useState<Record<string, number>>({})
  const [enrollCounts, setEnrollCounts] = useState<Record<string, number>>({})
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const listNameMap = Object.fromEntries(lists.map((l) => [l.id, l.name]))

  // Fetch step counts and enrollment counts when sequences load
  useEffect(() => {
    if (sequences.length === 0 || !profile?.workspace_id) return

    const seqIds = sequences.map((s) => s.id)

    // Fetch step counts
    supabase
      .from('sequence_steps')
      .select('sequence_id')
      .in('sequence_id', seqIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {}
        ;(data ?? []).forEach((row: any) => {
          counts[row.sequence_id] = (counts[row.sequence_id] ?? 0) + 1
        })
        setStepCounts(counts)
      })

    // Fetch enrollment counts
    supabase
      .from('sequence_enrollments')
      .select('sequence_id')
      .in('sequence_id', seqIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {}
        ;(data ?? []).forEach((row: any) => {
          counts[row.sequence_id] = (counts[row.sequence_id] ?? 0) + 1
        })
        setEnrollCounts(counts)
      })
  }, [sequences, profile?.workspace_id])

  // Close dropdown on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId) {
      document.addEventListener('mousedown', handleMouseDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [openMenuId])

  const handleRowClick = (seq: Sequence) => {
    if (seq.status === 'draft' || seq.status === 'paused') {
      navigate(`/sequences/${seq.id}/edit`)
    } else {
      navigate(`/sequences/${seq.id}/results`)
    }
  }

  const handleToggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setOpenMenuId((prev) => (prev === id ? null : id))
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    const { error } = await deleteSequence(id)
    if (error) showToast(error, 'error')
    else showToast('Sequence deleted.', 'success')
    setOpenMenuId(null)
  }

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`Archive "${name}"? Active enrollments will stop receiving steps.`)) return
    const { error } = await archiveSequence(id)
    if (error) showToast(error, 'error')
    else showToast('Sequence archived.', 'success')
    setOpenMenuId(null)
  }

  const handlePause = async (id: string) => {
    if (!window.confirm('Pause this sequence? Active contacts will stop receiving steps until you resume.')) return
    const { error } = await pauseSequence(id)
    if (error) showToast(error, 'error')
    else showToast('Sequence paused.', 'success')
    setOpenMenuId(null)
  }

  const handleResume = async (id: string) => {
    const { error } = await resumeSequence(id)
    if (error) showToast(error, 'error')
    else showToast('Sequence resumed.', 'success')
    setOpenMenuId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Button variant="primary" size="md" onClick={() => navigate('/sequences/new')}>
          <Plus size={16} />
          New Sequence
        </Button>
      </div>

      <Card padding="sm" className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : sequences.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">No sequences yet</h3>
            <p className="text-sm text-gray-400 mb-6">
              Create your first drip sequence to automatically follow up with your audience.
            </p>
            <Button variant="primary" size="md" onClick={() => navigate('/sequences/new')}>
              <Plus size={16} />
              New Sequence
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto" ref={openMenuId ? menuRef : undefined}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Sequence
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Status
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Contact list
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Steps
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Enrolled
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq) => (
                  <tr
                    key={seq.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => handleRowClick(seq)}
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-gray-100">{seq.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(seq.status)}>{seq.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {listNameMap[seq.contact_list_id ?? ''] ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {stepCounts[seq.id] ?? 0} steps
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {enrollCounts[seq.id] ?? 0} enrolled
                    </td>
                    <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0 justify-center"
                        aria-label="Sequence actions"
                        onClick={(e) => handleToggleMenu(e, seq.id)}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                      {openMenuId === seq.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-4 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]"
                        >
                          {/* Draft: Edit, Delete */}
                          {seq.status === 'draft' && (
                            <>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(null)
                                  navigate(`/sequences/${seq.id}/edit`)
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(seq.id, seq.name)
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {/* Active: View Results, Pause, Archive */}
                          {seq.status === 'active' && (
                            <>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(null)
                                  navigate(`/sequences/${seq.id}/results`)
                                }}
                              >
                                View Results
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handlePause(seq.id)
                                }}
                              >
                                Pause
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleArchive(seq.id, seq.name)
                                }}
                              >
                                Archive
                              </button>
                            </>
                          )}

                          {/* Paused: View Results, Resume, Archive */}
                          {seq.status === 'paused' && (
                            <>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(null)
                                  navigate(`/sequences/${seq.id}/results`)
                                }}
                              >
                                View Results
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleResume(seq.id)
                                }}
                              >
                                Resume
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleArchive(seq.id, seq.name)
                                }}
                              >
                                Archive
                              </button>
                            </>
                          )}

                          {/* Archived: View Results only */}
                          {seq.status === 'archived' && (
                            <button
                              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(null)
                                navigate(`/sequences/${seq.id}/results`)
                              }}
                            >
                              View Results
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
