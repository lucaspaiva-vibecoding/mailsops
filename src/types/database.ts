export interface Profile {
  id: string
  workspace_id: string
  full_name: string | null
  avatar_url: string | null
  company_name: string | null
  timezone: string
  default_sender_name: string | null
  default_sender_email: string | null
  resend_api_key: string | null
  unsubscribe_footer_text: string | null
  signature_html: string | null
  signature_json: Record<string, unknown> | null
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

export type CampaignType = 'regular' | 'ab_test' | 'ab_variant' | 'csv_personalized'

export interface CsvRow {
  first_name: string
  last_name: string
  email: string
  subject: string
  body: string
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'

export interface Campaign {
  id: string
  workspace_id: string
  name: string
  status: CampaignStatus
  from_name: string
  from_email: string
  reply_to_email: string | null
  subject: string
  preview_text: string | null
  body_html: string
  body_json: Record<string, unknown> | null
  contact_list_id: string | null
  segment_filter: Record<string, unknown> | null
  scheduled_at: string | null
  sent_at: string | null
  total_recipients: number
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  total_replied: number
  total_bounced: number
  total_unsubscribed: number
  settings: Record<string, unknown>
  campaign_type: CampaignType
  parent_campaign_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AbTestSettings {
  split_percentage: number
  hold_back_contact_ids?: string[]
}

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'archived'
export type SequenceEnrollmentStatus = 'active' | 'completed' | 'unsubscribed' | 'bounced'

export interface Sequence {
  id: string
  workspace_id: string
  name: string
  status: SequenceStatus
  contact_list_id: string | null
  from_name: string
  from_email: string
  reply_to_email: string | null
  created_at: string
  updated_at: string
}

export interface SequenceStep {
  id: string
  sequence_id: string
  step_number: number
  delay_days: number
  subject: string
  body_html: string
  body_json: Record<string, unknown> | null
  created_at: string
}

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id: string
  workspace_id: string
  status: SequenceEnrollmentStatus
  current_step: number
  enrolled_at: string
  next_send_at: string
  completed_at: string | null
}

export interface SequenceStepSend {
  id: string
  sequence_enrollment_id: string
  sequence_step_id: string
  campaign_recipient_id: string
  step_number: number
  workspace_id: string
  sent_at: string
}

export interface Template {
  id: string
  workspace_id: string
  name: string
  subject: string
  preview_text: string | null
  from_name: string
  from_email: string
  body_html: string
  body_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type TemplateInsert = Omit<Template, 'id' | 'created_at' | 'updated_at'>

export type SequenceInsert = Omit<Sequence, 'id' | 'created_at' | 'updated_at'>
export type SequenceUpdate = Partial<Omit<Sequence, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>

export type SequenceStepInsert = Omit<SequenceStep, 'id' | 'created_at'>
export type SequenceStepUpdate = Partial<Omit<SequenceStep, 'id' | 'sequence_id' | 'created_at'>>

export type CampaignInsert = Omit<Campaign, 'id' | 'total_recipients' | 'total_sent' | 'total_delivered' | 'total_opened' | 'total_clicked' | 'total_replied' | 'total_bounced' | 'total_unsubscribed' | 'created_at' | 'updated_at' | 'deleted_at' | 'sent_at' | 'campaign_type' | 'parent_campaign_id'> & {
  campaign_type?: CampaignType
  parent_campaign_id?: string | null
}

export type CampaignUpdate = Partial<Omit<Campaign, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'deleted_at'>>

export type RecipientStatus =
  | 'pending' | 'queued' | 'sent' | 'delivered' | 'opened'
  | 'clicked' | 'replied' | 'bounced' | 'unsubscribed' | 'failed'

export interface CampaignRecipient {
  id: string
  campaign_id: string
  contact_id: string
  workspace_id: string
  status: RecipientStatus
  resend_message_id: string | null
  variables: Record<string, string>
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  replied_at: string | null
  bounced_at: string | null
  unsubscribed_at: string | null
  tracking_id: string
  personalized_subject: string | null
  personalized_body: string | null
  created_at: string
}

export type CampaignEventType =
  | 'sent' | 'delivered' | 'opened' | 'clicked'
  | 'replied' | 'bounced' | 'unsubscribed' | 'complained'

export interface CampaignEvent {
  id: string
  campaign_id: string
  recipient_id: string
  workspace_id: string
  event_type: CampaignEventType
  link_url: string | null
  link_index: number | null
  ip_address: string | null
  user_agent: string | null
  device_type: string | null
  email_client: string | null
  country: string | null
  city: string | null
  bounce_type: 'hard' | 'soft' | null
  bounce_reason: string | null
  created_at: string
}

export interface CampaignLink {
  id: string
  campaign_id: string
  original_url: string
  link_index: number
  click_count: number
  unique_clicks: number
  created_at: string
}

export interface CampaignEventWithContact extends CampaignEvent {
  contacts: Pick<Contact, 'email' | 'first_name' | 'last_name'> | null
}

export interface CampaignRecipientWithContact extends CampaignRecipient {
  contacts: Pick<Contact, 'email' | 'first_name' | 'last_name'> | null
}

export interface RecipientStatusCounts {
  all: number
  opened: number
  clicked: number
  bounced: number
  unsubscribed: number
}

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
      campaigns: {
        Row: Campaign
        Insert: CampaignInsert
        Update: CampaignUpdate
      }
      campaign_recipients: {
        Row: CampaignRecipient
        Insert: Omit<CampaignRecipient, 'id' | 'created_at' | 'tracking_id'>
        Update: Partial<Omit<CampaignRecipient, 'id' | 'created_at' | 'campaign_id' | 'contact_id' | 'workspace_id'>>
      }
      campaign_events: {
        Row: CampaignEvent
        Insert: Omit<CampaignEvent, 'id' | 'created_at'>
        Update: never
      }
      campaign_links: {
        Row: CampaignLink
        Insert: Omit<CampaignLink, 'id' | 'created_at'>
        Update: Partial<Pick<CampaignLink, 'click_count' | 'unique_clicks'>>
      }
      sequences: {
        Row: Sequence
        Insert: SequenceInsert
        Update: SequenceUpdate
      }
      sequence_steps: {
        Row: SequenceStep
        Insert: SequenceStepInsert
        Update: SequenceStepUpdate
      }
      sequence_enrollments: {
        Row: SequenceEnrollment
        Insert: Omit<SequenceEnrollment, 'id' | 'enrolled_at' | 'completed_at'>
        Update: Partial<Omit<SequenceEnrollment, 'id' | 'sequence_id' | 'contact_id' | 'workspace_id' | 'enrolled_at'>>
      }
      sequence_step_sends: {
        Row: SequenceStepSend
        Insert: Omit<SequenceStepSend, 'id' | 'sent_at'>
        Update: never
      }
      templates: {
        Row: Template
        Insert: TemplateInsert
        Update: Partial<Omit<Template, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
