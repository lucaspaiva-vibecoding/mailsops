import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Sequence, SequenceStep, SequenceUpdate, SequenceStepInsert } from '../../types/database'

export function useSequence(id: string | undefined) {
  const { profile } = useAuth()
  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSequence = useCallback(async () => {
    if (!profile?.workspace_id || !id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    // Fetch sequence
    const { data: seqData, error: seqError } = await supabase
      .from('sequences')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
      .single()

    if (seqError) {
      setError(seqError.message)
      setSequence(null)
      setSteps([])
      setLoading(false)
      return
    }

    setSequence(seqData as Sequence)

    // Fetch steps ordered by step_number
    const { data: stepsData, error: stepsError } = await supabase
      .from('sequence_steps')
      .select('*')
      .eq('sequence_id', id)
      .order('step_number', { ascending: true })

    if (stepsError) {
      setError(stepsError.message)
    } else {
      setSteps((stepsData as SequenceStep[]) ?? [])
    }
    setLoading(false)
  }, [profile?.workspace_id, id])

  useEffect(() => { fetchSequence() }, [fetchSequence])

  const updateSequence = async (updates: SequenceUpdate) => {
    if (!profile?.workspace_id || !id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('sequences')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchSequence()
    return { error: null }
  }

  // saveSteps: delete all existing steps for this sequence, then bulk insert new ones
  // This is simpler than diffing individual step changes and handles reordering cleanly
  const saveSteps = async (newSteps: Omit<SequenceStepInsert, 'sequence_id'>[]) => {
    if (!id) return { error: 'No sequence ID' }

    // Delete existing steps
    const { error: deleteError } = await supabase
      .from('sequence_steps')
      .delete()
      .eq('sequence_id', id)

    if (deleteError) return { error: deleteError.message }

    // Insert new steps with sequence_id and correct step_number
    if (newSteps.length > 0) {
      const rows = newSteps.map((step, index) => ({
        ...step,
        sequence_id: id,
        step_number: index + 1,
      }))

      const { error: insertError } = await supabase
        .from('sequence_steps')
        .insert(rows)

      if (insertError) return { error: insertError.message }
    }

    await fetchSequence()
    return { error: null }
  }

  return { sequence, steps, loading, error, refetch: fetchSequence, updateSequence, saveSteps }
}
