import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../useAuth'
import type { Template, TemplateInsert } from '../../types/database'

export function useTemplates() {
  const { profile } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!profile?.workspace_id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('workspace_id', profile.workspace_id)
      .order('created_at', { ascending: false })
    if (!error) setTemplates((data as Template[]) ?? [])
    setLoading(false)
  }, [profile?.workspace_id])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const createTemplate = async (tmpl: Omit<TemplateInsert, 'workspace_id'>) => {
    if (!profile?.workspace_id) return { data: null, error: 'Not authenticated' }
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...tmpl, workspace_id: profile.workspace_id })
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    await fetchTemplates()
    return { data: data as Template, error: null }
  }

  const deleteTemplate = async (id: string) => {
    if (!profile?.workspace_id) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('workspace_id', profile.workspace_id)
    if (error) return { error: error.message }
    await fetchTemplates()
    return { error: null }
  }

  return { templates, loading, fetchTemplates, createTemplate, deleteTemplate }
}
