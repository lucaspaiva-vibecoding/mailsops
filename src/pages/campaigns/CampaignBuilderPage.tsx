import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { VariableChipNode } from '../../components/campaigns/VariableChipNode'
import { VariableSlashCommand } from '../../components/campaigns/VariableSlashCommand'
import { CampaignEditorToolbar } from '../../components/campaigns/CampaignEditorToolbar'
import { CampaignPreview } from '../../components/campaigns/CampaignPreview'
import { SchedulingSection } from '../../components/campaigns/SchedulingSection'
import { TestSendSection } from '../../components/campaigns/TestSendSection'
import { VARIABLES } from '../../components/campaigns/VariableDropdown'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useCampaigns } from '../../hooks/campaigns/useCampaigns'
import { useCampaign } from '../../hooks/campaigns/useCampaign'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { supabase } from '../../lib/supabase'
import { SaveAsTemplateModal } from '../../components/templates/SaveAsTemplateModal'
import type { CampaignStatus } from '../../types/database'

export function CampaignBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromTemplateId = searchParams.get('from_template')
  const { showToast } = useToast()
  const { profile } = useAuth()

  // Data hooks
  const { createCampaign } = useCampaigns()
  const { campaign, loading: campaignLoading, updateCampaign, sendCampaign } = useCampaign(id)
  const { lists } = useContactLists()

  // Form state
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [contactListId, setContactListId] = useState<string | null>(null)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [populated, setPopulated] = useState(false)
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false)

  // Subject variable insertion
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const [subjectVarOpen, setSubjectVarOpen] = useState(false)
  const subjectVarDropdownRef = useRef<HTMLDivElement>(null)

  // TipTap editor
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
    content: '',
    onUpdate: () => setDirty(true),
  })

  // Populate form from existing campaign (edit mode)
  useEffect(() => {
    if (campaign && !populated && editor) {
      setName(campaign.name ?? '')
      setSubject(campaign.subject ?? '')
      setPreviewText(campaign.preview_text ?? '')
      setFromName(campaign.from_name ?? '')
      setFromEmail(campaign.from_email ?? '')
      setContactListId(campaign.contact_list_id ?? null)
      if (campaign.scheduled_at) {
        setScheduleMode('later')
        // Convert UTC ISO string to datetime-local format (YYYY-MM-DDTHH:MM)
        const dt = new Date(campaign.scheduled_at)
        const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
        setScheduledAt(localIso)
      }
      if (campaign.body_json) {
        editor.commands.setContent(campaign.body_json)
      } else if (campaign.body_html) {
        editor.commands.setContent(campaign.body_html)
      }
      setDirty(false)
      setPopulated(true)
    }
  }, [campaign, editor, populated])

  // Populate form from template (new campaign from template via ?from_template param)
  useEffect(() => {
    if (fromTemplateId && !populated && editor) {
      supabase
        .from('templates')
        .select('*')
        .eq('id', fromTemplateId)
        .single()
        .then(({ data }) => {
          if (data) {
            setSubject(data.subject ?? '')
            setFromName(data.from_name ?? '')
            setFromEmail(data.from_email ?? '')
            setPreviewText(data.preview_text ?? '')
            if (data.body_json) editor.commands.setContent(data.body_json)
            else if (data.body_html) editor.commands.setContent(data.body_html)
            setPopulated(true)
          }
        })
    }
  }, [fromTemplateId, populated, editor])

  // Pre-fill sender defaults for new campaigns (no id, no template)
  useEffect(() => {
    if (!id && !fromTemplateId && !populated && profile) {
      if (profile.default_sender_name) setFromName(profile.default_sender_name)
      if (profile.default_sender_email) setFromEmail(profile.default_sender_email)
    }
  }, [id, fromTemplateId, populated, profile])

  // beforeunload guard (D-23)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Click-outside handler for subject variable dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (subjectVarDropdownRef.current && !subjectVarDropdownRef.current.contains(e.target as Node)) {
        setSubjectVarOpen(false)
      }
    }
    if (subjectVarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [subjectVarOpen])

  // Subject variable insertion handler (D-07)
  const handleSubjectVariableInsert = useCallback((variableValue: string) => {
    const input = subjectInputRef.current
    if (!input) return
    const start = input.selectionStart ?? subject.length
    const end = input.selectionEnd ?? subject.length
    const token = `{{${variableValue}}}`
    const newValue = subject.slice(0, start) + token + subject.slice(end)
    setSubject(newValue)
    setDirty(true)
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      input.focus()
      const newCursorPos = start + token.length
      input.setSelectionRange(newCursorPos, newCursorPos)
    })
  }, [subject])

  // Validation
  const validate = (forSchedule: boolean) => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Campaign name is required.'
    if (!subject.trim()) newErrors.subject = 'Subject line is required.'
    if (!fromName.trim()) newErrors.fromName = 'Sender name is required.'
    if (!fromEmail.trim()) newErrors.fromEmail = 'Sender email is required.'
    if (!contactListId) newErrors.contactListId = 'Please select a target list.'
    const bodyHtml = editor?.getHTML() ?? ''
    if (!bodyHtml || bodyHtml === '<p></p>') newErrors.body = 'Email body cannot be empty.'
    if (forSchedule && scheduleMode === 'later' && !scheduledAt) {
      newErrors.scheduledAt = 'Please select a send date and time.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save draft handler
  const handleSaveDraft = async () => {
    setSaving(true)
    const payload = {
      name: name || 'Untitled campaign',
      status: 'draft' as CampaignStatus,
      subject,
      preview_text: previewText,
      from_name: fromName,
      from_email: fromEmail,
      body_html: editor?.getHTML() ?? '',
      body_json: editor?.getJSON() ?? null,
      contact_list_id: contactListId || null,
      scheduled_at: null,
      reply_to_email: null,
      segment_filter: null,
      settings: {},
    }
    if (id && campaign) {
      // Edit mode — update existing
      const { error } = await updateCampaign(payload)
      if (error) {
        showToast(error, 'error')
      } else {
        showToast('Draft saved.', 'success')
        setDirty(false)
      }
    } else {
      // Create mode
      const { data, error } = await createCampaign(payload)
      if (error) {
        showToast(error, 'error')
      } else if (data) {
        showToast('Draft saved.', 'success')
        setDirty(false)
        navigate(`/campaigns/${data.id}/edit`, { replace: true })
      }
    }
    setSaving(false)
  }

  // Schedule/Send handler
  const handleScheduleSend = async () => {
    if (!validate(true)) return

    if (scheduleMode === 'now') {
      // Confirm before sending
      const confirmed = window.confirm(
        'Send this campaign to all contacts in the selected list? This action cannot be undone.'
      )
      if (!confirmed) return

      setSending(true)

      const savePayload = {
        name: name || 'Untitled campaign',
        subject,
        preview_text: previewText,
        from_name: fromName,
        from_email: fromEmail,
        body_html: editor?.getHTML() ?? '',
        body_json: editor?.getJSON() ?? null,
        contact_list_id: contactListId || null,
        scheduled_at: null,
        reply_to_email: null,
        segment_filter: null,
        settings: {},
      }

      let campaignIdToSend: string | undefined = id

      if (id && campaign) {
        // Edit mode — save latest content first
        const { error: saveError } = await updateCampaign(savePayload)
        if (saveError) {
          showToast(saveError, 'error')
          setSending(false)
          return
        }
        // sendCampaign from the hook uses the id from useParams
        const { error: sendError, sent, total } = await sendCampaign()
        if (sendError) {
          showToast(sendError, 'error')
          setSending(false)
          return
        }
        showToast(`Campaign sent to ${sent ?? 0} of ${total ?? 0} contacts.`, 'success')
        setDirty(false)
        navigate('/campaigns')
      } else {
        // Create mode — create as draft first, then invoke send-campaign directly with the new ID
        const { data: newCampaign, error: createError } = await createCampaign({
          ...savePayload,
          status: 'draft' as CampaignStatus,
        })
        if (createError || !newCampaign) {
          showToast(createError || 'Failed to create campaign', 'error')
          setSending(false)
          return
        }
        campaignIdToSend = newCampaign.id
        // Invoke send-campaign directly with the new campaign ID
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          showToast('Session expired. Please refresh the page.', 'error')
          setSending(false)
          navigate(`/campaigns/${campaignIdToSend}/edit`, { replace: true })
          return
        }
        const { data, error: invokeError } = await supabase.functions.invoke('send-campaign', {
          body: { campaign_id: campaignIdToSend },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (invokeError) {
          showToast(invokeError.message || 'Failed to send campaign', 'error')
          setSending(false)
          navigate(`/campaigns/${campaignIdToSend}/edit`, { replace: true })
          return
        }
        if (data && !data.ok) {
          showToast(data.error || 'Campaign send failed', 'error')
          setSending(false)
          navigate(`/campaigns/${campaignIdToSend}/edit`, { replace: true })
          return
        }
        showToast(`Campaign sent to ${data?.sent ?? 0} of ${data?.total ?? 0} contacts.`, 'success')
        setDirty(false)
        navigate('/campaigns')
      }

      setSending(false)
    } else {
      // Schedule mode — save with status 'scheduled' and navigate
      setSaving(true)
      // datetime-local returns 'YYYY-MM-DDTHH:MM', new Date() interprets as local time
      const scheduledAtUtc = new Date(scheduledAt).toISOString()

      const payload = {
        name: name || 'Untitled campaign',
        status: 'scheduled' as CampaignStatus,
        subject,
        preview_text: previewText,
        from_name: fromName,
        from_email: fromEmail,
        body_html: editor?.getHTML() ?? '',
        body_json: editor?.getJSON() ?? null,
        contact_list_id: contactListId || null,
        scheduled_at: scheduledAtUtc,
        reply_to_email: null,
        segment_filter: null,
        settings: {},
      }

      let saveError: string | null = null

      if (id && campaign) {
        const result = await updateCampaign(payload)
        saveError = result.error
      } else {
        const result = await createCampaign(payload)
        saveError = result.error
      }

      if (saveError) {
        showToast(saveError, 'error')
      } else {
        showToast('Campaign scheduled.', 'success')
        setDirty(false)
        navigate('/campaigns')
      }
      setSaving(false)
    }
  }

  // Send eligibility — block re-sending already-sent or currently-sending campaigns
  const canSend = !campaign || campaign.status === 'draft' || campaign.status === 'scheduled'

  // Button label for the schedule/send action
  const sendButtonLabel = campaign?.status === 'sent'
    ? 'Already Sent'
    : sending
      ? 'Sending...'
      : scheduleMode === 'now'
        ? 'Send Now'
        : 'Schedule'

  // Loading state for edit mode
  if (id && campaignLoading && !populated) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-4">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true) }}
          placeholder="Campaign name..."
          className="text-xl font-semibold text-gray-100 bg-transparent border-0 border-b border-gray-700 focus:border-indigo-500 focus:outline-none flex-1 py-1"
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        <div className="flex gap-2 shrink-0">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowSaveAsTemplate(true)}
            type="button"
          >
            Save as template
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={saving}
            onClick={handleSaveDraft}
            type="button"
          >
            Save draft
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={sending}
            disabled={!canSend || sending}
            onClick={handleScheduleSend}
            type="button"
          >
            {sendButtonLabel}
          </Button>
        </div>
      </div>
      {errors.name && (
        <p id="name-error" className="text-sm text-red-400 -mt-6" role="alert">
          {errors.name}
        </p>
      )}

      {/* Section 1 — Details */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Details
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subject line with variable insertion */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Subject line</label>
            <div className="flex gap-2 items-start">
              <input
                ref={subjectInputRef}
                type="text"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setDirty(true) }}
                placeholder="Your email subject..."
                className={`flex-1 bg-gray-800 border text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.subject ? 'border-red-500' : 'border-gray-700'}`}
                aria-describedby={errors.subject ? 'subject-error' : undefined}
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
                        onClick={() => { handleSubjectVariableInsert(v.value); setSubjectVarOpen(false) }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {errors.subject && (
              <p id="subject-error" className="text-sm text-red-400" role="alert">
                {errors.subject}
              </p>
            )}
          </div>

          {/* Preview text */}
          <Input
            label="Preview text"
            value={previewText}
            onChange={(e) => { setPreviewText(e.target.value); setDirty(true) }}
            placeholder="Short preview shown in inbox..."
          />

          {/* Sender name */}
          <Input
            label="Sender name"
            value={fromName}
            onChange={(e) => { setFromName(e.target.value); setDirty(true) }}
            placeholder="e.g. Alex from MailOps"
            error={errors.fromName}
            aria-describedby={errors.fromName ? 'from-name-error' : undefined}
          />

          {/* Sender email */}
          <Input
            label="Sender email"
            type="email"
            value={fromEmail}
            onChange={(e) => { setFromEmail(e.target.value); setDirty(true) }}
            placeholder="noreply@yourdomain.com"
            error={errors.fromEmail}
            aria-describedby={errors.fromEmail ? 'from-email-error' : undefined}
          />
        </div>
      </section>

      {/* Section 2 — Content */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Content
        </p>
        {/* Edit/Preview toggle */}
        <div
          role="tablist"
          className="flex gap-0 border border-gray-700 rounded-lg overflow-hidden w-fit mb-4"
        >
          <button
            role="tab"
            aria-selected={mode === 'edit'}
            type="button"
            onClick={() => setMode('edit')}
            className={`px-4 py-1.5 text-sm ${
              mode === 'edit'
                ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-500'
                : 'bg-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Edit
          </button>
          <button
            role="tab"
            aria-selected={mode === 'preview'}
            type="button"
            onClick={() => setMode('preview')}
            className={`px-4 py-1.5 text-sm ${
              mode === 'preview'
                ? 'bg-gray-800 text-indigo-400 border-b-2 border-indigo-500'
                : 'bg-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Preview
          </button>
        </div>

        {/* Editor */}
        {mode === 'edit' && editor && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <CampaignEditorToolbar editor={editor} />
            <EditorContent
              editor={editor}
              className="min-h-[320px] p-4 text-gray-100 text-sm leading-relaxed bg-gray-900 focus:outline-none prose-invert"
            />
          </div>
        )}
        {mode === 'preview' && (
          <CampaignPreview
          bodyHtml={editor?.getHTML() ?? ''}
          signatureHtml={profile?.signature_html ?? undefined}
        />
        )}
        {errors.body && (
          <p className="text-sm text-red-400 mt-2" role="alert">
            {errors.body}
          </p>
        )}
      </section>

      {/* Section 3 — Target & Schedule */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Target &amp; Schedule
        </p>
        <div className="flex flex-col gap-6">
          {/* Contact list selector */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Target list</label>
            <select
              value={contactListId ?? ''}
              onChange={(e) => { setContactListId(e.target.value || null); setDirty(true) }}
              className={`bg-gray-800 border text-gray-100 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.contactListId ? 'border-red-500' : 'border-gray-700'}`}
              aria-describedby={errors.contactListId ? 'list-error' : undefined}
            >
              <option value="" disabled>Select a contact list...</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.contact_count} contacts)
                </option>
              ))}
            </select>
            {errors.contactListId && (
              <p id="list-error" className="text-sm text-red-400" role="alert">
                {errors.contactListId}
              </p>
            )}
          </div>

          {/* Scheduling section */}
          <SchedulingSection
            scheduleMode={scheduleMode}
            onScheduleModeChange={setScheduleMode}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
            timezone={timezone}
            onTimezoneChange={setTimezone}
            error={errors.scheduledAt}
          />

          {/* Test send section */}
          <TestSendSection
            subject={subject}
            bodyHtml={editor?.getHTML() ?? ''}
            fromName={fromName}
            fromEmail={fromEmail}
            previewText={previewText}
          />
        </div>
      </section>

      {/* Bottom action bar */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-800 mt-8">
        <Button
          variant="secondary"
          size="md"
          loading={saving}
          onClick={handleSaveDraft}
          type="button"
        >
          Save draft
        </Button>
        <Button
          variant="primary"
          size="md"
          loading={sending}
          disabled={!canSend || sending}
          onClick={handleScheduleSend}
          type="button"
        >
          {sendButtonLabel}
        </Button>
      </div>
      {showSaveAsTemplate && (
        <SaveAsTemplateModal
          defaultName={name || 'Untitled campaign'}
          subject={subject}
          previewText={previewText}
          fromName={fromName}
          fromEmail={fromEmail}
          bodyHtml={editor?.getHTML() ?? ''}
          bodyJson={editor?.getJSON() ?? null}
          onClose={() => setShowSaveAsTemplate(false)}
          onSaved={() => setShowSaveAsTemplate(false)}
        />
      )}
    </div>
  )
}
