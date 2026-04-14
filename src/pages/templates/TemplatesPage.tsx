import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, FileText } from 'lucide-react'
import { useTemplates } from '../../hooks/templates/useTemplates'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

export function TemplatesPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { templates, loading, deleteTemplate } = useTemplates()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close menu on click outside
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete '${name}'? This cannot be undone.`)) return
    const { error } = await deleteTemplate(id)
    if (error) showToast(error, 'error')
    else showToast('Template deleted.', 'success')
    setOpenMenuId(null)
  }

  const handleToggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setOpenMenuId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Templates</h1>
      </div>

      <Card padding="sm" className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={40} className="text-gray-600 mb-4" />
            <h3 className="text-base font-semibold text-gray-200 mb-2">No templates yet</h3>
            <p className="text-sm text-gray-400">
              Save any campaign as a reusable template to speed up future campaigns.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" ref={openMenuId ? menuRef : undefined}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Template name
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Subject line
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 text-left">
                    Date saved
                  </th>
                  <th className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-900 px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr
                    key={template.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-gray-100">
                      {template.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {template.subject}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(template.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0 justify-center"
                        aria-label="Template actions"
                        onClick={(e) => handleToggleMenu(e, template.id)}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                      {openMenuId === template.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-4 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]"
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(null)
                              navigate('/campaigns/new?from_template=' + template.id)
                            }}
                          >
                            Use template
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(template.id, template.name)
                            }}
                          >
                            Delete
                          </button>
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
