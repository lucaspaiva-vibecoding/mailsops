import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { VariableChipNode } from '../../components/campaigns/VariableChipNode'
import { VariableSlashCommand } from '../../components/campaigns/VariableSlashCommand'
import { CampaignEditorToolbar } from '../../components/campaigns/CampaignEditorToolbar'
import { VARIABLES } from '../../components/campaigns/VariableDropdown'
import { VariantTabStrip } from '../../components/campaigns/VariantTabStrip'
import { SplitPercentageInput } from '../../components/campaigns/SplitPercentageInput'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Card } from '../../components/ui/Card'
import { useCampaigns } from '../../hooks/campaigns/useCampaigns'
import { useAbTest } from '../../hooks/campaigns/useAbTest'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { useToast } from '../../components/ui/Toast'
import type { AbTestSettings } from '../../types/database'

export function AbTestBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isNew = !id

  // Data hooks
  const { createAbTest, sendAbTestVariants, updateCampaign } = useCampaigns()
  const { parent, variantA: existingA, variantB: existingB, loading: abLoading } = useAbTest(id)
  const { lists } = useContactLists()

  // Shared settings state
  const [name, setName] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [contactListId, setContactListId] = useState<string | null>(null)
  const [splitPercentage, setSplitPercentage] = useState(40)

  // Per-variant state
  const [subjectA, setSubjectA] = useState('')
  const [subjectB, setSubjectB] = useState('')
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A')
  const [populatedA, setPopulatedA] = useState(false)
  const [populatedB, setPopulatedB] = useState(false)

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Subject variable insertion refs (per variant)
  const subjectARef = useRef<HTMLInputElement>(null)
  const subjectBRef = useRef<HTMLInputElement>(null)
  const [subjectVarOpen, setSubjectVarOpen] = useState(false)
  const subjectVarDropdownRef = useRef<HTMLDivElement>(null)

  // Two TipTap editor instances — both always mounted, display toggled via CSS block/hidden
  // onUpdate guards against populatedA/B to avoid false dirty detection during setContent
  const editorA = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Write Variant A email content here...' }),
      VariableChipNode,
      VariableSlashCommand,
    ],
    content: '',
    onUpdate: () => { if (!populatedA) return },
  })

  const editorB = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Write Variant B email content here...' }),
      VariableChipNode,
      VariableSlashCommand,
    ],
    content: '',
    onUpdate: () => { if (!populatedB) return },
  })

  // Edit mode population (from useAbTest data)
  useEffect(() => {
    if (parent && !populatedA && !populatedB && editorA && editorB) {
      // Shared settings from parent
      setName(parent.name ?? '')
      setFromName(parent.from_name ?? '')
      setFromEmail(parent.from_email ?? '')
      setReplyTo(parent.reply_to_email ?? '')
      setContactListId(parent.contact_list_id ?? null)
      const settings = parent.settings as unknown as AbTestSettings | null
      setSplitPercentage(settings?.split_percentage ?? 40)

      // Variant A
      if (existingA) {
        setSubjectA(existingA.subject ?? '')
        if (existingA.body_json) {
          editorA.commands.setContent(existingA.body_json)
        } else if (existingA.body_html) {
          editorA.commands.setContent(existingA.body_html)
        }
      }
      setPopulatedA(true)

      // Variant B
      if (existingB) {
        setSubjectB(existingB.subject ?? '')
        if (existingB.body_json) {
          editorB.commands.setContent(existingB.body_json)
        } else if (existingB.body_html) {
          editorB.commands.setContent(existingB.body_html)
        }
      }
      setPopulatedB(true)
    }
  }, [parent, existingA, existingB, editorA, editorB, populatedA, populatedB])

  // Click-outside handler for subject variable dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (subjectVarDropdownRef.current && !subjectVarDropdownRef.current.contains(e.target as Node)) {
        setSubjectVarOpen(false)
      }
    }
    if (subjectVarOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [subjectVarOpen])

  // Subject variable insertion handler
  const handleSubjectVariableInsert = useCallback((variableValue: string) => {
    const input = activeTab === 'A' ? subjectARef.current : subjectBRef.current
    const currentSubject = activeTab === 'A' ? subjectA : subjectB
    const setter = activeTab === 'A' ? setSubjectA : setSubjectB
    if (!input) return
    const start = input.selectionStart ?? currentSubject.length
    const end = input.selectionEnd ?? currentSubject.length
    const token = `{{${variableValue}}}`
    const newValue = currentSubject.slice(0, start) + token + currentSubject.slice(end)
    setter(newValue)
    requestAnimationFrame(() => {
      input.focus()
      const pos = start + token.length
      input.setSelectionRange(pos, pos)
    })
  }, [activeTab, subjectA, subjectB])

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Test name is required.'
    if (!fromName.trim()) newErrors.fromName = 'Sender name is required.'
    if (!fromEmail.trim()) newErrors.fromEmail = 'Sender email is required.'
    if (!contactListId) newErrors.contactListId = 'Please select a target list.'
    if (!subjectA.trim()) newErrors.subjectA = 'Variant A subject is required.'
    if (!subjectB.trim()) newErrors.subjectB = 'Variant B subject is required.'
    const bodyA = editorA?.getHTML() ?? ''
    const bodyB = editorB?.getHTML() ?? ''
    if (!bodyA || bodyA === '<p></p>') newErrors.bodyA = 'Variant A body cannot be empty.'
    if (!bodyB || bodyB === '<p></p>') newErrors.bodyB = 'Variant B body cannot be empty.'
    if (splitPercentage < 8 || splitPercentage > 90) newErrors.split = 'Test group must be between 8% and 90%.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save draft handler
  const handleSaveDraft = async () => {
    setSaving(true)
    if (isNew) {
      const { data, error } = await createAbTest({
        name: name || 'Untitled A/B test',
        fromName,
        fromEmail,
        replyTo: replyTo || null,
        contactListId: contactListId!,
        splitPercentage,
        variantA: {
          subject: subjectA,
          bodyHtml: editorA?.getHTML() ?? '',
          bodyJson: editorA?.getJSON() ?? null,
        },
        variantB: {
          subject: subjectB,
          bodyHtml: editorB?.getHTML() ?? '',
          bodyJson: editorB?.getJSON() ?? null,
        },
      })
      if (error) {
        showToast(error, 'error')
      } else if (data) {
        showToast('A/B test draft saved.', 'success')
        navigate(`/campaigns/${data.parent.id}/ab-test/edit`, { replace: true })
      }
    } else {
      // Edit mode — update parent + both variants
      const parentUpdate = await updateCampaign(id!, {
        name: name || 'Untitled A/B test',
        from_name: fromName,
        from_email: fromEmail,
        reply_to_email: replyTo || null,
        contact_list_id: contactListId,
        settings: { split_percentage: splitPercentage } as unknown as Record<string, unknown>,
      })
      if (parentUpdate.error) { showToast(parentUpdate.error, 'error'); setSaving(false); return }

      if (existingA) {
        const vaUpdate = await updateCampaign(existingA.id, {
          subject: subjectA,
          body_html: editorA?.getHTML() ?? '',
          body_json: editorA?.getJSON() ?? null,
          from_name: fromName,
          from_email: fromEmail,
          reply_to_email: replyTo || null,
          contact_list_id: contactListId,
        })
        if (vaUpdate.error) { showToast(vaUpdate.error, 'error'); setSaving(false); return }
      }

      if (existingB) {
        const vbUpdate = await updateCampaign(existingB.id, {
          subject: subjectB,
          body_html: editorB?.getHTML() ?? '',
          body_json: editorB?.getJSON() ?? null,
          from_name: fromName,
          from_email: fromEmail,
          reply_to_email: replyTo || null,
          contact_list_id: contactListId,
        })
        if (vbUpdate.error) { showToast(vbUpdate.error, 'error'); setSaving(false); return }
      }

      showToast('A/B test draft saved.', 'success')
    }
    setSaving(false)
  }

  // Send test variants handler
  const handleSendVariants = async () => {
    if (!validate()) return
    if (!contactListId) return

    setSending(true)

    let parentId = id
    let vaId = existingA?.id
    let vbId = existingB?.id

    if (isNew) {
      const { data, error } = await createAbTest({
        name: name || 'Untitled A/B test',
        fromName,
        fromEmail,
        replyTo: replyTo || null,
        contactListId,
        splitPercentage,
        variantA: {
          subject: subjectA,
          bodyHtml: editorA?.getHTML() ?? '',
          bodyJson: editorA?.getJSON() ?? null,
        },
        variantB: {
          subject: subjectB,
          bodyHtml: editorB?.getHTML() ?? '',
          bodyJson: editorB?.getJSON() ?? null,
        },
      })
      if (error || !data) {
        showToast(error || 'Failed to create A/B test', 'error')
        setSending(false)
        return
      }
      parentId = data.parent.id
      vaId = data.variantA.id
      vbId = data.variantB.id
    } else {
      // Save latest changes first
      await handleSaveDraft()
      if (!existingA || !existingB) {
        showToast('Variants not loaded. Please refresh.', 'error')
        setSending(false)
        return
      }
    }

    // Send both variants
    const { error: sendError } = await sendAbTestVariants(
      parentId!,
      vaId!,
      vbId!,
      splitPercentage,
      contactListId
    )

    if (sendError) {
      showToast(sendError, 'error')
    } else {
      showToast('A/B test variants are sending.', 'success')
      navigate('/campaigns')
    }
    setSending(false)
  }

  // Loading state for edit mode
  if (!isNew && abLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const canSend = !parent || parent.status === 'draft'

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="A/B test name..."
          className="text-xl font-semibold text-gray-100 bg-transparent border-0 border-b border-gray-700 focus:border-indigo-500 focus:outline-none flex-1 py-1"
        />
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" loading={saving} onClick={handleSaveDraft}>
            Save draft
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={sending}
            disabled={!canSend || sending}
            onClick={handleSendVariants}
          >
            {sending ? 'Sending...' : 'Send test variants'}
          </Button>
        </div>
      </div>
      {errors.name && <p className="text-sm text-red-400 -mt-6" role="alert">{errors.name}</p>}

      {/* Shared Settings */}
      <Card>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Shared Settings</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="From name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="e.g. Alex from MailOps"
            error={errors.fromName}
          />
          <Input
            label="From email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="noreply@yourdomain.com"
            error={errors.fromEmail}
          />
          <Input
            label="Reply-to (optional)"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="replies@yourdomain.com"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Target list</label>
            <select
              value={contactListId ?? ''}
              onChange={(e) => setContactListId(e.target.value || null)}
              className={`bg-gray-800 border text-gray-100 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.contactListId ? 'border-red-500' : 'border-gray-700'}`}
            >
              <option value="" disabled>Select a contact list...</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>{list.name} ({list.contact_count} contacts)</option>
              ))}
            </select>
            {errors.contactListId && <p className="text-sm text-red-400" role="alert">{errors.contactListId}</p>}
          </div>
        </div>
        <div className="mt-4">
          <SplitPercentageInput value={splitPercentage} onChange={setSplitPercentage} />
        </div>
      </Card>

      {/* Variant Tab Strip */}
      <VariantTabStrip activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Variant A Editor Panel — always mounted, shown/hidden via CSS */}
      <div className={activeTab === 'A' ? 'block' : 'hidden'}>
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium text-gray-300">Subject line</label>
          <div className="flex gap-2 items-start">
            <input
              ref={subjectARef}
              type="text"
              value={subjectA}
              onChange={(e) => setSubjectA(e.target.value)}
              placeholder="Variant A subject..."
              className={`flex-1 bg-gray-800 border text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.subjectA ? 'border-red-500' : 'border-gray-700'}`}
            />
            <div className="relative" ref={activeTab === 'A' ? subjectVarDropdownRef : undefined}>
              <button
                type="button"
                onClick={() => setSubjectVarOpen(!subjectVarOpen)}
                className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 text-sm"
                title="Insert variable"
              >
                {'{{ }}'}
              </button>
              {subjectVarOpen && activeTab === 'A' && (
                <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-20 min-w-[180px]">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md cursor-pointer w-full text-left"
                      onClick={() => { handleSubjectVariableInsert(v.value); setSubjectVarOpen(false) }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {errors.subjectA && <p className="text-sm text-red-400" role="alert">{errors.subjectA}</p>}
        </div>
        {editorA && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <CampaignEditorToolbar editor={editorA} />
            <EditorContent
              editor={editorA}
              className="min-h-[320px] p-4 text-gray-100 text-sm leading-relaxed bg-gray-900 focus:outline-none prose-invert"
            />
          </div>
        )}
        {errors.bodyA && <p className="text-sm text-red-400 mt-2" role="alert">{errors.bodyA}</p>}
      </div>

      {/* Variant B Editor Panel — always mounted, shown/hidden via CSS */}
      <div className={activeTab === 'B' ? 'block' : 'hidden'}>
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium text-gray-300">Subject line</label>
          <div className="flex gap-2 items-start">
            <input
              ref={subjectBRef}
              type="text"
              value={subjectB}
              onChange={(e) => setSubjectB(e.target.value)}
              placeholder="Variant B subject..."
              className={`flex-1 bg-gray-800 border text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.subjectB ? 'border-red-500' : 'border-gray-700'}`}
            />
            <div className="relative" ref={activeTab === 'B' ? subjectVarDropdownRef : undefined}>
              <button
                type="button"
                onClick={() => setSubjectVarOpen(!subjectVarOpen)}
                className="px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 text-sm"
                title="Insert variable"
              >
                {'{{ }}'}
              </button>
              {subjectVarOpen && activeTab === 'B' && (
                <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-2 z-20 min-w-[180px]">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md cursor-pointer w-full text-left"
                      onClick={() => { handleSubjectVariableInsert(v.value); setSubjectVarOpen(false) }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {errors.subjectB && <p className="text-sm text-red-400" role="alert">{errors.subjectB}</p>}
        </div>
        {editorB && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <CampaignEditorToolbar editor={editorB} />
            <EditorContent
              editor={editorB}
              className="min-h-[320px] p-4 text-gray-100 text-sm leading-relaxed bg-gray-900 focus:outline-none prose-invert"
            />
          </div>
        )}
        {errors.bodyB && <p className="text-sm text-red-400 mt-2" role="alert">{errors.bodyB}</p>}
      </div>
    </div>
  )
}
