import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ServiceCategory, ServiceRecord } from '../types'

export function useServiceCatalog() {
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    let active = true

    async function loadCatalog() {
      const categoriesPromise = supabase!.from('service_categories')
        .select('id,name,slug,description')
        .eq('is_published', true)
        .order('sort_order')
      const allServices: ServiceRecord[] = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error: serviceError } = await supabase!.from('services')
          .select('id,category_id,name,category,description,required_documents,eligibility,official_portal_url,search_keywords,is_active,is_published,is_featured,created_at,service_categories(name,slug)')
          .eq('is_published', true)
          .eq('is_active', true)
          .order('name')
          .range(offset, offset + 999)
        if (serviceError) return { categoryResult: await categoriesPromise, serviceError, services: allServices }
        allServices.push(...(data ?? []).map(({ service_categories, ...service }) => ({
          ...service,
          service_categories: service_categories?.[0] ?? null,
        })) as ServiceRecord[])
        if ((data?.length ?? 0) < 1000) break
      }
      return { categoryResult: await categoriesPromise, serviceError: null, services: allServices }
    }

    void loadCatalog().then(({ categoryResult, serviceError, services: loadedServices }) => {
      if (!active) return
      if (categoryResult.error || serviceError) {
        setError(categoryResult.error?.message ?? serviceError?.message ?? 'Could not load the service catalogue.')
        setIsLoading(false)
        return
      }
      setCategories(categoryResult.data ?? [])
      setServices(loadedServices)
      setIsLoading(false)
    }).catch((loadError: unknown) => {
      if (!active) return
      setError(loadError instanceof Error ? loadError.message : 'Could not load the service catalogue.')
      setIsLoading(false)
    })

    return () => { active = false }
  }, [])

  return { categories, services, error, isLoading }
}
