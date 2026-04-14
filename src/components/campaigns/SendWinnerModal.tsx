import { Button } from '../ui/Button'

interface SendWinnerModalProps {
  open: boolean
  variantLabel: string
  holdBackCount: number
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function SendWinnerModal({ open, variantLabel, holdBackCount, loading, onConfirm, onCancel }: SendWinnerModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4 z-10">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          Send the winning variant
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Send Variant {variantLabel} to the remaining {holdBackCount.toLocaleString()} contacts? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="md" loading={loading} onClick={onConfirm}>
            Send Variant {variantLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
