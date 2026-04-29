export function calculateOpportunityScores(amenities, populationData, amenityType, resolution, config) {
  if (!amenities || !populationData) return {}
  
  const { amenityWeights, boroughMultipliers, minLandFraction, minPopulation, cellMetadata } = config
  const h3Key = `h3_res${resolution}`

  const counts = {}
  for (const a of amenities) {
    const cell = a[h3Key]
    if (cell) counts[cell] = (counts[cell] || 0) + 1
  }

  const popLookup = {}
  for (const { h3_index, population } of populationData) {
    popLookup[h3_index] = population
  }

  const scores = {}
  const idealRatio = amenityWeights[amenityType] || 2000

  for (const [cellId, meta] of Object.entries(cellMetadata)) {
    if (Number(meta.resolution) !== resolution) continue

    // Cells that don't meet criteria = null (greyed out)
    if (meta.land_fraction < minLandFraction) {
      scores[cellId] = null
      continue
    }

    const pop = popLookup[cellId] || 0
    if (pop < minPopulation) {
      scores[cellId] = null
      continue
    }

    const multiplier = boroughMultipliers[meta.borough] || 1.0
    const effectivePop = pop * multiplier

    const cellCount = counts[cellId] || 0
    const expectedNeed = effectivePop / idealRatio
    const gap = expectedNeed - cellCount
    const score = Math.max(-100, Math.min(100, Math.round((gap / Math.max(expectedNeed, 0.01)) * 100)))

    scores[cellId] = score
  }

  return scores
}