import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { useToast } from '../../components/ui/Toast'
import { User, Building2, Globe } from 'lucide-react'
import { TIMEZONES } from '../../lib/constants'

export function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setCompanyName(profile.company_name ?? '')
      setTimezone(profile.timezone ?? 'UTC')
    }
  }, [profile])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Optimistic update
    const optimisticProfile = profile
      ? { ...profile, full_name: fullName, company_name: companyName, timezone }
      : null

    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        company_name: companyName || null,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user?.id ?? '')

    setLoading(false)

    if (error) {
      showToast(error.message, 'error')
      // Revert optimistic update
      if (optimisticProfile) {
        setFullName(optimisticProfile.full_name ?? '')
        setCompanyName(optimisticProfile.company_name ?? '')
        setTimezone(optimisticProfile.timezone)
      }
    } else {
      showToast('Profile saved successfully')
      await refreshProfile()
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar src={profile?.avatar_url} name={profile?.full_name} size="lg" />
        <div>
          <p className="text-base font-semibold text-gray-100">{profile?.full_name ?? 'Your Name'}</p>
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-gray-100 mb-4">Personal Information</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Full name"
            type="text"
            placeholder="Jane Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User className="w-4 h-4" />}
          />

          <Input
            label="Company name"
            type="text"
            placeholder="Acme Inc."
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            icon={<Building2 className="w-4 h-4" />}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="timezone" className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              Timezone
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={loading}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gray-100 mb-2">Account</h2>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm text-gray-300">Email address</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-gray-800">
          <div>
            <p className="text-sm text-gray-300">Workspace ID</p>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{profile?.workspace_id}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
