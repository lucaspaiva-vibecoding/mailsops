import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import { PAGE_SIZE } from '../../lib/analyticsUtils'
import type {
  Campaign,
  CampaignEvent,
  CampaignLink,
  CampaignRecipientWithContact,
  RecipientStatusCounts,
} from '../../types/database'

interface ContactRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

interface RecipientRow {
  id: string
  contact_id: string
}

export function useCampaignAnalytics(campaignId: string | undefined) {
  const { profile } = useAuth()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [events, setEvents] = useState<CampaignEvent[]>([])
  const [eventsTotal, setEventsTotal] = useState(0)
  const [eventsPage, setEventsPage] = useState(1)
  const [eventTypeFilter, setEventTypeFilterState] = useState<string | null>(null)
  const [links, setLinks] = useState<CampaignLink[]>([])
  const [recipients, setRecipients] = useState<CampaignRecipientWithContact[]>([])
  const [recipientsTotal, setRecipientsTotal] = useState(0)
  const [recipientsPage, setRecipientsPage] = useState(1)
  const [recipientStatusFilter, setRecipientStatusFilterState] = useState<string | null>(null)
  const [recipientStatusCounts, setRecipientStatusCounts] = useState<RecipientStatusCounts>({
    all: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Wrap filter setters to also reset page
  const setEventTypeFilter = useCallback((filter: string | null) => {
    setEventTypeFilterState(filter)
    setEventsPage(1)
  }, [])

  const setRecipientStatusFilter = useCallback((filter: string | null) => {
    setRecipientStatusFilterState(filter)
    setRecipientsPage(1)
  }, [])

  // Fetch campaign row
  const fetchCampaign = useCallback(async () => {
    if (!campaignId || !profile?.workspace_id) return
    const { data, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('workspace_id', profile.workspace_id)
      .single()
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setCampaign((data as Campaign) ?? null)
    }
  }, [campaignId, profile?.workspace_id])

  // Fetch paginated + filtered events
  const fetchEvents = useCallback(async () => {
    if (!campaignId || !profile?.workspace_id) return
    setLoading(true)
    setError(null)
    try {
      const from = (eventsPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('campaign_events')
        .select('*', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .eq('workspace_id', profile.workspace_id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (eventTypeFilter) {
        query = query.eq('event_type', eventTypeFilter)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setEvents((data as CampaignEvent[]) ?? [])
        setEventsTotal(count ?? 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [campaignId, profile?.workspace_id, eventsPage, eventTypeFilter])

  // Fetch links (no pagination — typically few links per campaign)
  const fetchLinks = useCallback(async () => {
    if (!campaignId || !profile?.workspace_id) return
    const { data, error: fetchError } = await supabase
      .from('campaign_links')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('link_index', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setLinks((data as CampaignLink[]) ?? [])
    }
  }, [campaignId, profile?.workspace_id])

  // Fetch paginated + filtered recipients with contacts join, and compute status counts
  const fetchRecipients = useCallback(async () => {
    if (!campaignId || !profile?.workspace_id) return
    setLoading(true)
    setError(null)
    try {
      const from = (recipientsPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('campaign_recipients')
        .select('*, contacts ( email, first_name, last_name )', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .eq('workspace_id', profile.workspace_id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (recipientStatusFilter) {
        query = query.eq('status', recipientStatusFilter)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRecipients((data as CampaignRecipientWithContact[]) ?? [])
        setRecipientsTotal(count ?? 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recipients')
    } finally {
      setLoading(false)
    }
  }, [campaignId, profile?.workspace_id, recipientsPage, recipientStatusFilter])

  // Fetch all recipient statuses for tab count badges (lightweight — only 'status' column)
  // Runs only when campaignId changes, not on filter/page change
  const fetchRecipientStatusCounts = useCallback(async () => {
    if (!campaignId || !profile?.workspace_id) return
    const { data: allStatuses } = await supabase
      .from('campaign_recipients')
      .select('status')
      .eq('campaign_id', campaignId)
      .eq('workspace_id', profile.workspace_id)

    const counts: RecipientStatusCounts = {
      all: allStatuses?.length ?? 0,
      opened: allStatuses?.filter(r => r.status === 'opened').length ?? 0,
      clicked: allStatuses?.filter(r => r.status === 'clicked').length ?? 0,
      bounced: allStatuses?.filter(r => r.status === 'bounced').length ?? 0,
      unsubscribed: allStatuses?.filter(r => r.status === 'unsubscribed').length ?? 0,
    }
    setRecipientStatusCounts(counts)
  }, [campaignId, profile?.workspace_id])

  // Two-step event-to-contact resolution (per RESEARCH.md Pitfall 5)
  // Fetch recipients by recipient_id, then fetch contacts by contact_id
  const resolveEventContacts = useCallback(async (eventList: CampaignEvent[]) => {
    if (eventList.length === 0) return eventList

    const recipientIds = [...new Set(eventList.map(e => e.recipient_id))]

    const { data: recipientRows } = await supabase
      .from('campaign_recipients')
      .select('id, contact_id')
      .in('id', recipientIds)
      .eq('workspace_id', profile?.workspace_id ?? '')

    const contactIds = [...new Set((recipientRows as RecipientRow[] ?? []).map(r => r.contact_id))]

    const { data: contactRows } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .in('id', contactIds)

    const contactMap = new Map<string, ContactRow>()
    for (const c of (contactRows as ContactRow[] ?? [])) {
      contactMap.set(c.id, c)
    }

    const recipientContactMap = new Map<string, ContactRow | null>()
    for (const r of (recipientRows as RecipientRow[] ?? [])) {
      recipientContactMap.set(r.id, contactMap.get(r.contact_id) ?? null)
    }

    return eventList.map(e => ({
      ...e,
      contacts: recipientContactMap.get(e.recipient_id) ?? null,
    }))
  }, [profile?.workspace_id])

  // Campaign — fetch once on campaignId change
  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  // Events — fetch on campaignId, page, or filter change
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // Links — fetch once on campaignId change
  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  // Recipients + status counts — recipient count query only re-runs on campaignId change
  useEffect(() => {
    fetchRecipients()
    fetchRecipientStatusCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, profile?.workspace_id])

  // Recipients paginated list — re-runs on page or filter change
  useEffect(() => {
    fetchRecipients()
  }, [fetchRecipients])

  // Expose resolveEventContacts for consumers that need contact info on events
  void resolveEventContacts

  return {
    campaign,
    events,
    eventsTotal,
    eventsPage,
    setEventsPage,
    eventTypeFilter,
    setEventTypeFilter,
    links,
    recipients,
    recipientsTotal,
    recipientsPage,
    setRecipientsPage,
    recipientStatusFilter,
    setRecipientStatusFilter,
    recipientStatusCounts,
    loading,
    error,
    refetchCampaign: fetchCampaign,
  }
}
