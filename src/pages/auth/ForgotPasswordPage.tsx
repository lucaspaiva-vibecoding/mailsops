import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Reset password</h1>
          <p className="text-gray-400 mt-1">
            {success ? 'Check your inbox for the reset link' : "We'll send you a reset link"}
          </p>
        </div>

        <Card>
          {success ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-gray-300 text-sm mb-4">
                If an account exists for <span className="font-medium text-gray-100">{email}</span>, you&apos;ll
                receive a password reset email shortly.
              </p>
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Input
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  required
                  autoComplete="email"
                />

                <Button type="submit" loading={loading} className="w-full mt-2">
                  Send reset link
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
