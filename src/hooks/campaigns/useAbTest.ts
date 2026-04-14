import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Campaign } from '../../types/database'

export function useAbTest(parentId: string | undefined) {
  const { profile } = useAuth()
  const [parent, setParent] = useState<Campaign | null>(null)
  const [variantA, setVariantA] = useState<Campaign | null>(null)
  const [variantB, setVariantB] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!parentId || !profile?.workspace_id) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .or(`id.eq.${parentId},parent_campaign_id.eq.${parentId}`)
      .is('deleted_at', null)

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const rows = (data as Campaign[]) ?? []
    setParent(rows.find(r => r.id === parentId) ?? null)
    const variants = rows
      .filter(r => r.parent_campaign_id === parentId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    setVariantA(variants[0] ?? null)
    setVariantB(variants[1] ?? null)
    setLoading(false)
  }, [parentId, profile?.workspace_id])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { parent, variantA, variantB, loading, error, refetch: fetchAll }
}
