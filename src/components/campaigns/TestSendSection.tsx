import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import { supabase } from '../../lib/supabase'

interface TestSendSectionProps {
  subject: string
  bodyHtml: string
  fromName: string
  fromEmail: string
  previewText: string
}

export function TestSendSection({
  subject,
  bodyHtml,
  fromName,
  fromEmail,
  previewText,
}: TestSendSectionProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [sending, setSending] = useState(false)

  const handleSendTest = async () => {
    if (!user?.email) return
    setSending(true)
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          to: user.email,
          subject,
          body_html: bodyHtml,
          from_name: fromName,
          from_email: fromEmail,
          preview_text: previewText,
        },
      })
      if (error) throw error
      showToast('Test email sent.', 'success')
    } catch {
      showToast('Test send failed. Check your Resend configuration.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Test send
      </p>
      <p className="text-sm text-gray-400 mb-3">
        Send a test email to your account email address to verify content and formatting.
      </p>
      {user?.email && (
        <p className="text-sm text-gray-300 mb-3">{user.email}</p>
      )}
      <Button
        variant="secondary"
        size="sm"
        loading={sending}
        onClick={handleSendTest}
        type="button"
      >
        <Send size={14} />
        Send test email
      </Button>
    </div>
  )
}
