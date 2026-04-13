export interface Profile {
  id: string
  workspace_id: string
  full_name: string | null
  avatar_url: string | null
  company_name: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  workspace_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  tags: string[]
  custom_fields: Record<string, string>
  status: 'active' | 'unsubscribed' | 'bounced' | 'complained'
  unsubscribed_at: string | null
  bounce_type: 'hard' | 'soft' | null
  bounced_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ContactList {
  id: string
  workspace_id: string
  name: string
  description: string | null
  color: string | null
  contact_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ContactListMember {
  id: string
  contact_list_id: string
  contact_id: string
  added_at: string
}

export interface ContactImportLog {
  id: string
  workspace_id: string
  total_rows: number
  imported: number
  updated: number
  skipped: number
  errors: number
  error_details: Array<{ row: number; reason: string }>
  created_at: string
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
export type ContactUpdate = Partial<Omit<Contact, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'deleted_at'>>

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string }
        Update: Partial<Profile>
      }
      contacts: {
        Row: Contact
        Insert: ContactInsert
        Update: ContactUpdate
      }
      contact_lists: {
        Row: ContactList
        Insert: Omit<ContactList, 'id' | 'contact_count' | 'created_at' | 'updated_at' | 'deleted_at'>
        Update: Partial<Omit<ContactList, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'deleted_at'>>
      }
      contact_list_members: {
        Row: ContactListMember
        Insert: Omit<ContactListMember, 'id' | 'added_at'>
        Update: Partial<Omit<ContactListMember, 'id' | 'added_at'>>
      }
      contact_import_logs: {
        Row: ContactImportLog
        Insert: Omit<ContactImportLog, 'id' | 'created_at'>
        Update: never
      }
    }
  }
}
