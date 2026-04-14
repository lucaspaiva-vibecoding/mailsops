import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { StepEditorPanel } from '../../components/sequences/StepEditorPanel'
import { StartSequenceModal } from '../../components/sequences/StartSequenceModal'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { useSequences } from '../../hooks/sequences/useSequences'
import { useSequence } from '../../hooks/sequences/useSequence'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import { supabase } from '../../lib/supabase'

interface LocalStep {
  localId: string
  dbId: string | null
  delayDays: number
  subject: string
  bodyHtml: string
  bodyJson: Record<string, unknown> | null
}

function makeEmptyStep(defaultDelayDays = 0): LocalStep {
  return {
    localId: crypto.randomUUID(),
    dbId: null,
    delayDays: defaultDelayDays,
    subject: '',
    bodyHtml: '',
    bodyJson: null,
  }
}

export function SequenceBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Data hooks
  const { createSequence, startSequence } = useSequences()
  const { sequence, steps: dbSteps, loading, updateSequence, saveSteps } = useSequence(id)
  const { lists: contactLists } = useContactLists()

  // Form state
  const [name, setName] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [contactListId, setContactListId] = useState('')
  const [steps, setSteps] = useState<LocalStep[]>([makeEmptyStep(0)])
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [populated, setPopulated] = useState(false)
  const [enrollCount, setEnrollCount] = useState(0)

  // Edit mode population — guarded by populated flag
  useEffect(() => {
    if (sequence && dbSteps && !populated) {
      setName(sequence.name)
      setFromName(sequence.from_name)
      setFromEmail(sequence.from_email)
      setReplyTo(sequence.reply_to_email ?? '')
      setContactListId(sequence.contact_list_id ?? '')
      setSteps(
        dbSteps.length > 0
          ? dbSteps.map((s) => ({
              localId: crypto.randomUUID(),
              dbId: s.id,
              delayDays: s.delay_days,
              subject: s.subject,
              bodyHtml: s.body_html,
              bodyJson: s.body_json,
            }))
          : [makeEmptyStep(0)]
      )
      setPopulated(true)
    }
  }, [sequence, dbSteps, populated])

  // Compute delay validation errors
  const delayErrors = new Map<string, string>()
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].delayDays <= steps[i - 1].delayDays) {
      delayErrors.set(
        steps[i].localId,
        'Step delays must be strictly increasing (each step\'s day must be greater than the previous step\'s day).'
      )
    }
  }

  // Step operations
  const addStep = () => {
    const lastStep = steps[steps.length - 1]
    const defaultDelay = lastStep ? lastStep.delayDays + 1 : 0
    setSteps((prev) => [...prev, makeEmptyStep(defaultDelay)])
  }

  const removeStep = (localId: string) => {
    setSteps((prev) => prev.filter((s) => s.localId !== localId))
  }

  const moveStep = (localId: string, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const index = prev.findIndex((s) => s.localId === localId)
      if (index === -1) return prev
      const newSteps = [...prev]
      if (direction === 'up' && index > 0) {
        ;[newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]]
      } else if (direction === 'down' && index < newSteps.length - 1) {
        ;[newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]]
      }
      return newSteps
    })
  }

  const updateStep = (localId: string, updates: Partial<LocalStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...updates } : s))
    )
  }

  // Build step payload for saveSteps
  const buildStepPayload = () =>
    steps.map((s) => ({
      step_number: 0, // saveSteps handles step_number assignment
      delay_days: s.delayDays,
      subject: s.subject,
      body_html: s.bodyHtml,
      body_json: s.bodyJson,
    }))

  // Save draft flow
  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      if (id && sequence) {
        // Edit mode
        const { error: updateError } = await updateSequence({
          name: name || 'Untitled Sequence',
          from_name: fromName,
          from_email: fromEmail,
          reply_to_email: replyTo || null,
          contact_list_id: contactListId || null,
        })
        if (updateError) {
          showToast('Failed to save sequence. Please try again.', 'error')
          setSaving(false)
          return
        }
        const { error: stepsError } = await saveSteps(buildStepPayload())
        if (stepsError) {
          showToast('Failed to save sequence steps. Please try again.', 'error')
          setSaving(false)
          return
        }
        showToast('Sequence saved', 'success')
      } else {
        // Create mode
        const { data: newSeq, error: createError } = await createSequence({
          name: name || 'Untitled Sequence',
          status: 'draft',
          from_name: fromName,
          from_email: fromEmail,
          reply_to_email: replyTo || null,
          contact_list_id: contactListId || null,
        })
        if (createError || !newSeq) {
          showToast('Failed to save sequence. Please try again.', 'error')
          setSaving(false)
          return
        }
        // Insert steps directly for new sequence
        if (steps.length > 0) {
          const stepRows = steps.map((s, index) => ({
            sequence_id: newSeq.id,
            step_number: index + 1,
            delay_days: s.delayDays,
            subject: s.subject,
            body_html: s.bodyHtml,
            body_json: s.bodyJson,
          }))
          const { error: stepsError } = await supabase
            .from('sequence_steps')
            .insert(stepRows)
          if (stepsError) {
            showToast('Failed to save sequence steps. Please try again.', 'error')
            setSaving(false)
            return
          }
        }
        showToast('Sequence saved', 'success')
        navigate(`/sequences/${newSeq.id}/edit`, { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  // Start sequence flow — open modal with enrollment count
  const handleStartClick = async () => {
    if (!contactListId) {
      showToast('Please select a target contact list before starting.', 'error')
      return
    }
    if (steps.length === 0) {
      showToast('Please add at least one step before starting.', 'error')
      return
    }
    if (steps.some((s) => !s.subject.trim())) {
      showToast('All steps must have a subject before starting.', 'error')
      return
    }
    if (delayErrors.size > 0) {
      showToast('Please fix step delay errors before starting.', 'error')
      return
    }

    // Fetch active contact count for the selected list
    const { data: members } = await supabase
      .from('contact_list_members')
      .select('contact_id, contacts(id, status)')
      .eq('contact_list_id', contactListId)

    type MemberRow = { contacts: { id: string; status: string } | null }
    const activeCount = ((members ?? []) as unknown as MemberRow[]).filter(
      (m) => m.contacts && m.contacts.status === 'active'
    ).length

    setEnrollCount(activeCount)
    setShowStartModal(true)
  }

  // Start sequence confirm
  const handleStartConfirm = async () => {
    setStarting(true)
    // Save first
    await handleSaveDraft()

    // Determine the sequence ID to start
    const seqId = id ?? sequence?.id
    if (!seqId || !contactListId) {
      showToast('Failed to start sequence. Missing sequence or contact list.', 'error')
      setStarting(false)
      setShowStartModal(false)
      return
    }

    const { error: startError } = await startSequence(
      seqId,
      contactListId,
      steps[0]?.delayDays ?? 0
    )

    if (startError) {
      showToast(`Failed to start sequence. ${startError}`, 'error')
      setStarting(false)
      setShowStartModal(false)
      return
    }

    showToast('Sequence started!', 'success')
    setStarting(false)
    setShowStartModal(false)
    navigate(`/sequences/${seqId}/results`)
  }

  // Disable start button conditions
  const startDisabled =
    steps.length === 0 ||
    !contactListId ||
    steps.some((s) => !s.subject.trim()) ||
    delayErrors.size > 0

  // Read-only guard — non-draft sequences
  const isReadOnly = !!(sequence && sequence.status !== 'draft')

  // Loading state for edit mode
  if (id && loading && !populated) {
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
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled Sequence"
          disabled={isReadOnly}
          className="text-xl font-semibold bg-transparent border-none text-gray-100 focus:outline-none w-full disabled:opacity-60"
        />
        <div className="flex gap-2 shrink-0">
          {!isReadOnly && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveDraft}
              loading={saving}
              type="button"
            >
              Save draft
            </Button>
          )}
          {!isReadOnly && (
            <Button
              variant="primary"
              size="md"
              onClick={handleStartClick}
              loading={starting}
              disabled={startDisabled || starting}
              type="button"
            >
              Start Sequence
            </Button>
          )}
        </div>
      </div>

      {/* Read-only notice */}
      {isReadOnly && (
        <div className="text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded-lg px-4 py-3">
          This sequence is {sequence?.status} and cannot be edited. View results or manage enrollment from the sequences list.
        </div>
      )}

      {/* Shared Settings */}
      <Card padding="md">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">
          Sequence Settings
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="From name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="e.g. Alex from MailOps"
            disabled={isReadOnly}
          />
          <Input
            label="From email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="noreply@yourdomain.com"
            disabled={isReadOnly}
          />
          <Input
            label="Reply-to (optional)"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="replies@yourdomain.com"
            disabled={isReadOnly}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-300">Target list</label>
            <select
              value={contactListId}
              onChange={(e) => setContactListId(e.target.value)}
              disabled={isReadOnly}
              className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            >
              <option value="">Select a list...</option>
              {contactLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Steps section */}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Steps</p>
      <div className="flex flex-col gap-6">
        {steps.map((step, index) => (
          <StepEditorPanel
            key={step.localId}
            step={step}
            stepIndex={index}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
            isOnly={steps.length === 1}
            delayError={delayErrors.get(step.localId) ?? null}
            onChange={(updated) => updateStep(step.localId, updated)}
            onRemove={() => removeStep(step.localId)}
            onMoveUp={() => moveStep(step.localId, 'up')}
            onMoveDown={() => moveStep(step.localId, 'down')}
          />
        ))}
        {!isReadOnly && (
          <Button
            variant="secondary"
            onClick={addStep}
            type="button"
            className="w-full border-dashed border border-gray-700 text-gray-400 hover:text-gray-200"
          >
            <Plus size={16} />
            Add Step
          </Button>
        )}
      </div>

      {/* Start Sequence Modal */}
      <StartSequenceModal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        onConfirm={handleStartConfirm}
        loading={starting}
        enrollCount={enrollCount}
        listName={contactLists.find((l) => l.id === contactListId)?.name ?? 'Unknown list'}
      />
    </div>
  )
}
