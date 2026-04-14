import { FormEvent, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { VariableChipNode } from '../../components/campaigns/VariableChipNode'
import { VariableSlashCommand } from '../../components/campaigns/VariableSlashCommand'
import { CampaignEditorToolbar } from '../../components/campaigns/CampaignEditorToolbar'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { User, Building2, Globe, Mail, Key } from 'lucide-react'
import { TIMEZONES } from '../../lib/constants'

type SettingsTab = 'profile' | 'workspace' | 'integrations'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'integrations', label: 'Integrations' },
]

export function SettingsPage() {
  const { profile, user, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as SettingsTab) ?? 'profile'

  const switchTab = (tab: SettingsTab) => {
    setSearchParams(tab === 'profile' ? {} : { tab })
  }

  // Profile tab state
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [profileLoading, setProfileLoading] = useState(false)

  // Workspace tab state
  const [defaultSenderName, setDefaultSenderName] = useState('')
  const [defaultSenderEmail, setDefaultSenderEmail] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(false)

  // Integrations tab state
  const [apiKey, setApiKey] = useState('')
  const [apiKeyExists, setApiKeyExists] = useState(false)
  const [apiKeyDirty, setApiKeyDirty] = useState(false)
  const [unsubscribeFooter, setUnsubscribeFooter] = useState('')
  const [integrationsLoading, setIntegrationsLoading] = useState(false)

  // Signature editor — one-time population guard
  const signaturePopulated = useRef(false)

  // Signature TipTap editor
  const signatureEditor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension,
      Placeholder.configure({ placeholder: 'Add your signature\u2026' }),
      VariableChipNode,
      VariableSlashCommand,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
  })

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setCompanyName(profile.company_name ?? '')
      setTimezone(profile.timezone ?? 'UTC')
      setDefaultSenderName(profile.default_sender_name ?? '')
      setDefaultSenderEmail(profile.default_sender_email ?? '')
      setUnsubscribeFooter(profile.unsubscribe_footer_text ?? 'To unsubscribe from future emails, click here: {{unsubscribe_url}}')
      setApiKeyExists(!!profile.resend_api_key)

      // Populate signature editor once (guard prevents re-population on profile refresh)
      if (signatureEditor && !signaturePopulated.current && profile.signature_json) {
        signatureEditor.commands.setContent(profile.signature_json as Record<string, unknown>)
        signaturePopulated.current = true
      } else if (signatureEditor && !signaturePopulated.current && profile.signature_html) {
        signatureEditor.commands.setContent(profile.signature_html)
        signaturePopulated.current = true
      }
    }
  }, [profile, signatureEditor])

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        company_name: companyName || null,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user?.id ?? '')
    setProfileLoading(false)
    if (error) showToast(error.message, 'error')
    else { showToast('Saved successfully.'); await refreshProfile() }
  }

  const handleWorkspaceSave = async (e: FormEvent) => {
    e.preventDefault()
    setWorkspaceLoading(true)
    const sigHtml = signatureEditor?.getHTML()
    const isEmptySig = !sigHtml || sigHtml === '<p></p>'
    const { error } = await supabase
      .from('profiles')
      .update({
        default_sender_name: defaultSenderName || null,
        default_sender_email: defaultSenderEmail || null,
        signature_html: isEmptySig ? null : sigHtml,
        signature_json: isEmptySig ? null : (signatureEditor?.getJSON() ?? null),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user?.id ?? '')
    setWorkspaceLoading(false)
    if (error) showToast(error.message, 'error')
    else { showToast('Saved successfully.'); await refreshProfile() }
  }

  const handleIntegrationsSave = async (e: FormEvent) => {
    e.preventDefault()
    setIntegrationsLoading(true)
    const updates: Record<string, unknown> = {
      unsubscribe_footer_text: unsubscribeFooter || null,
      updated_at: new Date().toISOString(),
    }
    if (apiKeyDirty) {
      updates.resend_api_key = apiKey || null
    }
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user?.id ?? '')
    setIntegrationsLoading(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Saved successfully.')
      if (apiKeyDirty) {
        setApiKeyExists(!!apiKey)
        setApiKey('')
        setApiKeyDirty(false)
      }
      await refreshProfile()
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* Tab navigation strip */}
      <div className="flex gap-0 border-b border-gray-800 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <>
          <div className="flex items-center gap-4">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="lg" />
            <div>
              <p className="text-base font-semibold text-gray-100">{profile?.full_name ?? 'Your Name'}</p>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-gray-100 mb-4">Personal Information</h2>
            <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
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
                <Button type="submit" loading={profileLoading}>
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
        </>
      )}

      {/* Workspace tab */}
      {activeTab === 'workspace' && (
        <form onSubmit={handleWorkspaceSave} className="flex flex-col gap-6">
          <Card>
            <h2 className="text-sm font-semibold text-gray-100 mb-4">Sending Defaults</h2>
            <div className="flex flex-col gap-4">
              <Input
                label="Default sender name"
                type="text"
                placeholder="Your Company"
                value={defaultSenderName}
                onChange={(e) => setDefaultSenderName(e.target.value)}
                icon={<User className="w-4 h-4" />}
              />
              <Input
                label="Default sender email"
                type="email"
                placeholder="hello@yourcompany.com"
                value={defaultSenderEmail}
                onChange={(e) => setDefaultSenderEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-gray-100 mb-1">Email Signature</h2>
            <p className="text-xs text-gray-500 mb-4">
              Appended below every email you send. Supports formatting and personalization variables.
            </p>
            {signatureEditor && (
              <div className="border border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                <CampaignEditorToolbar editor={signatureEditor} />
                <EditorContent
                  editor={signatureEditor}
                  className="min-h-[120px] p-4 text-gray-100 text-sm leading-relaxed bg-gray-900 focus:outline-none prose prose-invert prose-sm max-w-none"
                />
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={workspaceLoading}>Save workspace settings</Button>
          </div>
        </form>
      )}

      {/* Integrations tab */}
      {activeTab === 'integrations' && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-100 mb-4">Resend Integration</h2>
          <form onSubmit={handleIntegrationsSave} className="flex flex-col gap-4">
            {/* API Key - masked per D-11 */}
            <Input
              label="Resend API key"
              type="password"
              placeholder={apiKeyExists ? '••••••••••••••••' : 'sk_live_...'}
              value={apiKeyDirty ? apiKey : ''}
              onChange={(e) => { setApiKey(e.target.value); setApiKeyDirty(true) }}
              autoComplete="off"
              icon={<Key className="w-4 h-4" />}
            />

            {/* Sending domain - read-only per D-12 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-300">Sending domain</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">resend.dev shared domain</span>
                <Badge variant="success">Active</Badge>
              </div>
            </div>

            {/* Unsubscribe footer text */}
            <div className="flex flex-col gap-1">
              <label htmlFor="unsubscribe-footer" className="text-sm font-semibold text-gray-300">
                Unsubscribe footer text
              </label>
              <textarea
                id="unsubscribe-footer"
                rows={3}
                value={unsubscribeFooter}
                onChange={(e) => setUnsubscribeFooter(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-none"
              />
              <p className="text-xs text-gray-500">
                Use {'{{unsubscribe_url}}'} as the placeholder for the unsubscribe link.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={integrationsLoading}>Save changes</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
