import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Contact } from '../../types/database'

export interface ContactFilters {
  search?: string
  status?: string
  tag?: string
  customFieldKey?: string
  customFieldValue?: string
  listId?: string
  page?: number
  pageSize?: number
}

export function useContacts(filters: ContactFilters = {}) {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  const pageSize = filters.pageSize ?? 50
  const page = filters.page ?? 1

  const fetchContacts = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    setError(null)

    try {
      // If filtering by list, first get contact IDs in that list.
      // NOTE: capped at 10,000 to avoid unbounded memory/request size.
      // TODO: replace with a server-side subquery filter when PostgREST supports it.
      let listContactIds: string[] | null = null
      if (filters.listId) {
        const { data: members } = await supabase
          .from('contact_list_members')
          .select('contact_id')
          .eq('contact_list_id', filters.listId)
          .limit(10000)
        listContactIds = (members ?? []).map((m: { contact_id: string }) => m.contact_id)
        if (listContactIds.length === 0) {
          setContacts([])
          setTotalCount(0)
          setLoading(false)
          return
        }
      }

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('workspace_id', profile.workspace_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (filters.search) {
        const safe = filters.search.trim()
        query = query.or(
          `email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`
        )
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.tag) {
        query = query.contains('tags', [filters.tag])
      }

      if (filters.customFieldKey && filters.customFieldValue) {
        query = query.contains('custom_fields', {
          [filters.customFieldKey]: filters.customFieldValue,
        })
      }

      if (listContactIds) {
        query = query.in('id', listContactIds)
      }

      // Pagination
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error: fetchError, count } = await query

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setContacts((data as Contact[]) ?? [])
        setTotalCount(count ?? 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts')
    } finally {
      setLoading(false)
    }
  }, [profile?.workspace_id, filters.search, filters.status, filters.tag, filters.customFieldKey, filters.customFieldValue, filters.listId, page, pageSize])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  return { contacts, loading, error, refetch: fetchContacts, totalCount }
}
