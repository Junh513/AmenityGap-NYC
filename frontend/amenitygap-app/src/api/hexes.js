import { supabase } from './supabaseClient'

export async function getHexes(amenityType = "laundry", res = 8) {
  const { data, error } = await supabase.rpc('get_hex_counts', {
    amenity_type_param: amenityType,
    res: res
  })

  if (error) {
    console.error(error)
    return []
  }

  return data
}
