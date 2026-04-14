import { useState } from 'react'
import { useTemplates } from '../../hooks/templates/useTemplates'
import { useToast } from '../ui/Toast'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface SaveAsTemplateModalProps {
  defaultName: string
  subject: string
  previewText: string
  fromName: string
  fromEmail: string
  bodyHtml: string
  bodyJson: Record<string, unknown> | null
  onClose: () => void
  onSaved: () => void
}

export function SaveAsTemplateModal({
  defaultName,
  subject,
  previewText,
  fromName,
  fromEmail,
  bodyHtml,
  bodyJson,
  onClose,
  onSaved,
}: SaveAsTemplateModalProps) {
  const [templateName, setTemplateName] = useState(defaultName || 'Untitled campaign')
  const [saving, setSaving] = useState(false)
  const { createTemplate } = useTemplates()
  const { showToast } = useToast()

  const handleSave = async () => {
    if (!templateName.trim()) return
    setSaving(true)
    const { error } = await createTemplate({
      name: templateName.trim(),
      subject,
      preview_text: previewText || null,
      from_name: fromName,
      from_email: fromEmail,
      body_html: bodyHtml,
      body_json: bodyJson,
    })
    setSaving(false)
    if (error) {
      showToast(error, 'error')
    } else {
      showToast('Template saved.', 'success')
      onSaved()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col gap-4 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-100">Save as template</h2>
        <Input
          label="Template name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Discard
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={saving}
            onClick={handleSave}
          >
            Save template
          </Button>
        </div>
      </div>
    </div>
  )
}
