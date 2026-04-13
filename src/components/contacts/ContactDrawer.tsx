import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import { useContactLists } from '../../hooks/contacts/useContactLists'
import type { Contact, ContactList } from '../../types/database'

interface ContactDrawerProps {
  contact: Contact | null
  isNew?: boolean
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

interface ListMembership {
  id: string
  contact_list_id: string
  contact_lists: { id: string; name: string; color: string | null } | null
}

type StatusVariant = 'success' | 'warning' | 'danger' | 'default'

function getStatusVariant(status: Contact['status']): StatusVariant {
  switch (status) {
    case 'active': return 'success'
    case 'unsubscribed': return 'warning'
    case 'bounced': return 'danger'
    case 'complained': return 'warning'
    default: return 'default'
  }
}

export function ContactDrawer({ contact, isNew = false, onClose, onUpdated, onDeleted }: ContactDrawerProps) {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const { lists } = useContactLists()

  // Edit state
  const [editing, setEditing] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form fields
  const [email, setEmail] = useState(contact?.email ?? '')
  const [firstName, setFirstName] = useState(contact?.first_name ?? '')
  const [lastName, setLastName] = useState(contact?.last_name ?? '')
  const [company, setCompany] = useState(contact?.company ?? '')
  const [tagsInput, setTagsInput] = useState((contact?.tags ?? []).join(', '))
  const [emailError, setEmailError] = useState<string | null>(null)

  // List membership
  const [memberships, setMemberships] = useState<ListMembership[]>([])
  const [membershipsLoading, setMembershipsLoading] = useState(false)
  const [selectedListId, setSelectedListId] = useState('')

  const isOpen = contact !== null || isNew

  // Reset form when contact changes
  useEffect(() => {
    setEmail(contact?.email ?? '')
    setFirstName(contact?.first_name ?? '')
    setLastName(contact?.last_name ?? '')
    setCompany(contact?.company ?? '')
    setTagsInput((contact?.tags ?? []).join(', '))
    setEditing(isNew)
    setConfirmDelete(false)
    setEmailError(null)
  }, [contact, isNew])

  // Fetch list memberships when contact changes
  useEffect(() => {
    if (!contact?.id) {
      setMemberships([])
      return
    }
    fetchMemberships(contact.id)
  }, [contact?.id])

  async function fetchMemberships(contactId: string) {
    setMembershipsLoading(true)
    const { data } = await supabase
      .from('contact_list_members')
      .select('*, contact_lists(id, name, color)')
      .eq('contact_id', contactId)
    setMemberships((data as ListMembership[]) ?? [])
    setMembershipsLoading(false)
  }

  const handleDiscard = () => {
    setEmail(contact?.email ?? '')
    setFirstName(contact?.first_name ?? '')
    setLastName(contact?.last_name ?? '')
    setCompany(contact?.company ?? '')
    setTagsInput((contact?.tags ?? []).join(', '))
    setEmailError(null)
    setEditing(false)
    if (isNew) onClose()
  }

  const handleSave = async () => {
    if (!email.trim()) {
      setEmailError('Email is required.')
      return
    }
    if (!profile?.workspace_id) return

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      if (isNew) {
        const { error } = await supabase.from('contacts').insert({
          email: email.trim(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          company: company.trim() || null,
          tags,
          workspace_id: profile.workspace_id,
          status: 'active',
          custom_fields: {},
        })
        if (error) {
          showToast(error.message, 'error')
        } else {
          showToast('Contact added.', 'success')
          onUpdated()
          onClose()
        }
      } else if (contact) {
        const { error } = await supabase
          .from('contacts')
          .update({
            email: email.trim(),
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            company: company.trim() || null,
            tags,
          })
          .eq('id', contact.id)
          .eq('workspace_id', profile.workspace_id)
        if (error) {
          showToast(error.message, 'error')
        } else {
          showToast('Contact saved.', 'success')
          setEditing(false)
          onUpdated()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact || !profile?.workspace_id) return
    setDeleting(true)
    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', contact.id)
      .eq('workspace_id', profile.workspace_id)
    setDeleting(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Contact deleted.', 'success')
      onDeleted()
      onClose()
    }
  }

  const handleAddToList = async () => {
    if (!contact?.id || !selectedListId) return
    const { error } = await supabase.from('contact_list_members').insert({
      contact_list_id: selectedListId,
      contact_id: contact.id,
    })
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Contact added to list.', 'success')
      setSelectedListId('')
      await fetchMemberships(contact.id)
    }
  }

  const handleRemoveFromList = async (contactListId: string) => {
    if (!contact?.id) return
    const { error } = await supabase
      .from('contact_list_members')
      .delete()
      .eq('contact_list_id', contactListId)
      .eq('contact_id', contact.id)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Contact removed from list.', 'success')
      await fetchMemberships(contact.id)
    }
  }

  const memberListIds = new Set(memberships.map((m) => m.contact_list_id))
  const availableLists: ContactList[] = lists.filter((l) => !memberListIds.has(l.id))

  const displayName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
    : 'New Contact'

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-800 z-50 overflow-y-auto shadow-xl transition-transform duration-200 translate-x-0"
        role="dialog"
        aria-modal="true"
        aria-label={displayName}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <span className="text-base font-semibold text-gray-100">{displayName}</span>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-6 overflow-y-auto">

          {/* Section 1: Contact Details */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Contact Details
            </h3>

            {editing ? (
              <div className="flex flex-col gap-3">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  error={emailError ?? undefined}
                  required
                />
                <Input
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <Input
                  label="Company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
                <Input
                  label="Tags (comma-separated)"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. newsletter, vip"
                />

                <div className="flex gap-2 mt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={saving}
                    onClick={handleSave}
                  >
                    Save changes
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscard}
                    disabled={saving}
                  >
                    Discard changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm text-gray-100">{contact?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">First Name</p>
                  <p className="text-sm text-gray-100">{contact?.first_name || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Name</p>
                  <p className="text-sm text-gray-100">{contact?.last_name || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Company</p>
                  <p className="text-sm text-gray-100">{contact?.company || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {contact && (
                    <Badge variant={getStatusVariant(contact.status)} className="mt-0.5">
                      {contact.status}
                    </Badge>
                  )}
                </div>
                {contact && contact.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Tags</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="default">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="mt-1 self-start"
                >
                  Edit
                </Button>
              </div>
            )}
          </section>

          {/* Section 2: List Membership (only for existing contacts) */}
          {!isNew && contact && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Lists
              </h3>

              {membershipsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {memberships.length === 0 ? (
                    <p className="text-sm text-gray-500">Not in any lists.</p>
                  ) : (
                    memberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                membership.contact_lists?.color || '#64748b',
                            }}
                          />
                          <span className="text-sm text-gray-200">
                            {membership.contact_lists?.name ?? 'Unknown list'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFromList(membership.contact_list_id)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))
                  )}

                  {availableLists.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Add to list...</option>
                        {availableLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAddToList}
                        disabled={!selectedListId}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Section 3: Danger Zone (only for existing contacts) */}
          {!isNew && contact && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Danger Zone
              </h3>

              {confirmDelete ? (
                <div aria-live="polite">
                  <p className="text-sm text-gray-300 mb-3">
                    Are you sure you want to delete{' '}
                    {contact.first_name ? contact.first_name : 'this contact'}? This cannot be
                    undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deleting}
                      onClick={handleDelete}
                    >
                      Yes, delete contact
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Keep contact
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Contact
                </Button>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
