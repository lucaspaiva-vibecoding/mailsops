import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { VariableChipNode } from '../campaigns/VariableChipNode'
import { VariableSlashCommand } from '../campaigns/VariableSlashCommand'
import { CampaignEditorToolbar } from '../campaigns/CampaignEditorToolbar'
import { VARIABLES } from '../campaigns/VariableDropdown'
import { Button } from '../ui/Button'

interface StepEditorPanelStep {
  localId: string
  delayDays: number
  subject: string
  bodyHtml: string
  bodyJson: Record<string, unknown> | null
}

interface StepEditorPanelProps {
  step: StepEditorPanelStep
  stepIndex: number
  isFirst: boolean
  isLast: boolean
  isOnly: boolean
  delayError: string | null
  onChange: (updated: StepEditorPanelStep) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function StepEditorPanel({
  step,
  stepIndex,
  isFirst,
  isLast,
  isOnly,
  delayError,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepEditorPanelProps) {
  const stepNumber = stepIndex + 1
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const [subjectVarOpen, setSubjectVarOpen] = useState(false)
  const subjectVarDropdownRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Write your email content here...' }),
      VariableChipNode,
      VariableSlashCommand,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: step.bodyJson ?? step.bodyHtml ?? '',
    onUpdate: ({ editor: e }) => {
      onChange({
        ...step,
        bodyHtml: e.getHTML(),
        bodyJson: e.getJSON() as Record<string, unknown>,
      })
    },
  })

  const handleSubjectVariableInsert = (key: string) => {
    const input = subjectInputRef.current
    const token = ` {{${key}}} `
    if (!input) {
      onChange({ ...step, subject: step.subject + token })
      setSubjectVarOpen(false)
      return
    }
    const start = input.selectionStart ?? step.subject.length
    const end = input.selectionEnd ?? step.subject.length
    const newValue = step.subject.slice(0, start) + token + step.subject.slice(end)
    onChange({ ...step, subject: newValue })
    setSubjectVarOpen(false)
    requestAnimationFrame(() => {
      input.focus()
      const newCursorPos = start + token.length
      input.setSelectionRange(newCursorPos, newCursorPos)
    })
  }

  return (
    <div className="border border-gray-700 rounded-lg p-6 bg-gray-900">
      {/* Step header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-full bg-gray-800 text-gray-300 text-xs font-semibold flex items-center justify-center shrink-0">
            {stepNumber}
          </div>
          <span className="text-sm text-gray-300 ml-2">Step {stepNumber}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isFirst && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label="Move step up"
              onClick={onMoveUp}
              className="p-1"
            >
              <ChevronUp size={16} />
            </Button>
          )}
          {!isLast && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label="Move step down"
              onClick={onMoveDown}
              className="p-1"
            >
              <ChevronDown size={16} />
            </Button>
          )}
          {!isOnly && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-label={`Remove step ${stepNumber}`}
              onClick={onRemove}
              className="p-1 text-gray-500 hover:text-red-400"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Delay input row */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-300">Send on day</span>
        <input
          type="number"
          min={0}
          value={step.delayDays}
          onChange={(e) => onChange({ ...step, delayDays: parseInt(e.target.value, 10) || 0 })}
          className="w-20 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-400">(days after enrollment)</span>
        {delayError && (
          <span role="alert" className="text-sm text-red-400 ml-1">
            {delayError}
          </span>
        )}
      </div>

      {/* Subject row */}
      <div className="flex flex-col gap-1 mb-4">
        <label className="text-sm font-medium text-gray-300">Subject</label>
        <div className="flex gap-2 items-start">
          <input
            ref={subjectInputRef}
            type="text"
            value={step.subject}
            onChange={(e) => onChange({ ...step, subject: e.target.value })}
            placeholder="Email subject for this step..."
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="relative" ref={subjectVarDropdownRef}>
            <button
              type="button"
              onClick={() => setSubjectVarOpen(!subjectVarOpen)}
              className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 text-sm"
              title="Insert variable"
            >
              {'{{ }}'}
            </button>
            {subjectVarOpen && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-20 min-w-[180px]">
                {VARIABLES.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md cursor-pointer w-full text-left"
                    onClick={() => handleSubjectVariableInsert(v.value)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TipTap editor */}
      {editor && (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <CampaignEditorToolbar editor={editor} />
          <EditorContent
            editor={editor}
            className="prose prose-invert max-w-none p-4 min-h-[280px] text-sm leading-relaxed text-gray-100 focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
