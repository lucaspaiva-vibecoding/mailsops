import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Sequence, SequenceInsert, SequenceUpdate } from '../../types/database'

export function useSequences() {
  const { profile } = useAuth()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSequences = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('sequences')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    else setSequences((data as Sequence[]) ?? [])
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => { fetchSequences() }, [fetchSequences])

  // createSequence: insert new sequence row, return data
  const createSequence = async (seq: Omit<SequenceInsert, 'workspace_id'>) => {
    if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('sequences')
      .insert({ ...seq, workspace_id: profile.workspace_id })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    await fetchSequences()
    return { data: data as Sequence, error: null }
  }

  // updateSequence: update by id + workspace_id
  const updateSequence = async (id: string, updates: SequenceUpdate) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('sequences')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchSequences()
    return { error: null }
  }

  // deleteSequence: hard delete (only for draft with no enrollments, per D-04)
  const deleteSequence = async (id: string) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('sequences')
      .delete()
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchSequences()
    return { error: null }
  }

  // archiveSequence: set status = 'archived'
  const archiveSequence = async (id: string) => {
    return updateSequence(id, { status: 'archived' })
  }

  // pauseSequence: set status = 'paused'
  const pauseSequence = async (id: string) => {
    return updateSequence(id, { status: 'paused' })
  }

  // resumeSequence: set status = 'active'
  const resumeSequence = async (id: string) => {
    return updateSequence(id, { status: 'active' })
  }

  // startSequence: enroll contacts from contact list, set status = 'active' (per D-04)
  // Parameters: sequenceId, contactListId, firstStepDelayDays
  const startSequence = async (sequenceId: string, contactListId: string, firstStepDelayDays: number) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated', count: 0 }

    // 1. Fetch active contacts from contact list (same pattern as sendAbTestVariants)
    const { data: members, error: membersError } = await supabase
      .from('contact_list_members')
      .select('contact_id, contacts(id, status)')
      .eq('contact_list_id', contactListId)

    if (membersError) return { error: membersError.message, count: 0 }

    type MemberRow = { contacts: { id: string; status: string } | null }
    const activeContactIds = ((members ?? []) as unknown as MemberRow[])
      .filter((m) => m.contacts && m.contacts.status === 'active')
      .map((m) => (m.contacts as { id: string; status: string }).id)

    if (activeContactIds.length === 0) return { error: 'No active contacts in target list', count: 0 }

    // 2. Compute next_send_at = now() + firstStepDelayDays days (per D-03)
    const now = new Date()
    const nextSendAt = new Date(now.getTime() + firstStepDelayDays * 24 * 60 * 60 * 1000).toISOString()

    // 3. Bulk insert sequence_enrollments with ON CONFLICT DO NOTHING (Pitfall 3)
    const enrollmentRows = activeContactIds.map((contactId: string) => ({
      sequence_id: sequenceId,
      contact_id: contactId,
      workspace_id: profile.workspace_id,
      status: 'active' as const,
      current_step: 1,
      next_send_at: nextSendAt,
    }))

    const { error: insertError } = await supabase
      .from('sequence_enrollments')
      .upsert(enrollmentRows, { onConflict: 'sequence_id,contact_id', ignoreDuplicates: true })

    if (insertError) return { error: insertError.message, count: 0 }

    // 4. Set sequence status = 'active'
    const { error: statusError } = await supabase
      .from('sequences')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', sequenceId)
      .eq('workspace_id', profile.workspace_id)

    if (statusError) return { error: statusError.message, count: activeContactIds.length }

    await fetchSequences()
    return { error: null, count: activeContactIds.length }
  }

  return {
    sequences, loading, error, refetch: fetchSequences,
    createSequence, updateSequence, deleteSequence,
    archiveSequence, pauseSequence, resumeSequence, startSequence,
  }
}
