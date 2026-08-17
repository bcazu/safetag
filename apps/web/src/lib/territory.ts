import { supabase } from './supabase'

// Etiquetas de divisiones territoriales (comunas/corregimientos).
// Fuente: territorial_divisions (0016), mismos slugs que kobo/media/*.csv.
// Fallback: slugs del formulario anterior a T5b ('villa_santana', 'cali_3').

let cache: Promise<Map<string, string>> | null = null

async function fetchDivisionNames(): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('territorial_divisions')
    .select('code, name')
    .eq('level', 'division')
  const map = new Map<string, string>()
  for (const row of (data ?? []) as { code: string; name: string }[]) {
    map.set(row.code, row.name)
  }
  return map
}

export function divisionNames(): Promise<Map<string, string>> {
  cache ??= fetchDivisionNames()
  return cache
}

export function communeLabel(
  slug: string,
  names?: Map<string, string>,
): string {
  const named = names?.get(slug)
  if (named) return named
  // slugs del formulario viejo
  const s = slug.replace(/^cali_/, 'comuna ').replaceAll('_', ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
