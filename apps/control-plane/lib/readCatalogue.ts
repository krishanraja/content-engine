import { supabase } from '../api/_supabase.js'
import { CATALOGUE_FROM, catalogue, type CataloguePiece } from '../api/_publicationCatalogue.js'

export async function readCatalogue(limit = 1000) {
  const { data, error } = await supabase.from('content_ideas').select('id, idea, lane_slot, published_at, published_url, meta, transformed_outputs')
    .eq('state', 'published').is('buried_at', null).gte('published_at', CATALOGUE_FROM)
    .order('published_at', { ascending: false }).order('id').limit(limit)
  if (error || !data) throw Error('catalogue_unavailable')
  return catalogue(data as CataloguePiece[])
}
