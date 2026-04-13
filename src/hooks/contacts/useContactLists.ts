import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { ContactList } from '../../types/database'

export function useContactLists() {
  const { profile } = useAuth()
  const [lists, setLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLists = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('contact_lists')
      .select('id, workspace_id, name, description, color, contact_count, created_at, updated_at, deleted_at')
      .eq('workspace_id', profile.workspace_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setLists((data as ContactList[]) ?? [])
    }
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  const createList = async (name: string, description: string | null, color: string | null) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase.from('contact_lists').insert({
      workspace_id: profile.workspace_id,
      name,
      description,
      color,
    })
    if (error) return { error: error.message }
    await fetchLists()
    return { error: null }
  }

  const updateList = async (id: string, updates: { name?: string; description?: string | null; color?: string | null }) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('contact_lists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchLists()
    return { error: null }
  }

  const deleteList = async (id: string) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('contact_lists')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchLists()
    return { error: null }
  }

  return { lists, loading, error, refetch: fetchLists, createList, updateList, deleteList }
}
