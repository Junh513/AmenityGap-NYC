import { supabase } from './supabaseClient'

export async function getAmenities(amenityType = "laundry") {
  const { data, error } = await supabase
    .from('amenities')
    .select('*')
    .eq('amenity_type', amenityType)

  console.log("DATA:", data)
  console.log("ERROR:", error)

  if (error) {
    return []
  }

  return data
}
