import { Button } from '../ui/Button'

interface StartSequenceModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading: boolean
  enrollCount: number
  listName: string
}

export function StartSequenceModal({
  open,
  onClose,
  onConfirm,
  loading,
  enrollCount,
  listName,
}: StartSequenceModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Start this sequence?</h3>
        <p className="text-sm text-gray-400 mb-6">
          This will enroll {enrollCount} active contacts from {listName}.
          Emails will begin sending automatically.
          Contacts added after this point will not be enrolled.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Keep Editing
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} loading={loading}>
            Start Sequence
          </Button>
        </div>
      </div>
    </div>
  )
}
