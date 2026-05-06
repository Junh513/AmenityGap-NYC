import { gridDisk } from 'h3-js'

export function calculateOpportunityScores(amenities, populationData, amenityType, resolution, config) {
  if (!amenities || !populationData) return {}

  const {
    amenityWeights,
    boroughMultipliers,
    minLandFraction,
    minPopulation,
    cellMetadata,
    jobsData = [],
    daytimeWeight = 0,
    demandSpillover = { ring1: 0.5, ring2: 0.2 },
    supplySpillover = { ring1: 0.5, ring2: 0.2 },
  } = config
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

  const jobsLookup = {}
  for (const { h3_index, jobs } of jobsData) {
    jobsLookup[h3_index] = jobs
  }

  const blendedPop = (cell) => {
    const residents = popLookup[cell] || 0
    const workers = jobsLookup[cell] || 0
    return (1 - daytimeWeight) * residents + daytimeWeight * workers
  }

  const scores = {}
  const idealRatio = amenityWeights[amenityType] || 2000

  for (const [cellId, meta] of Object.entries(cellMetadata)) {
    if (Number(meta.resolution) !== resolution) continue

    if (meta.land_fraction < minLandFraction) {
      scores[cellId] = null
      continue
    }

    const disk2 = gridDisk(cellId, 2)
    const disk1Set = new Set(gridDisk(cellId, 1))
    let ring1Demand = 0, ring2Demand = 0
    let ring1Supply = 0, ring2Supply = 0
    for (const n of disk2) {
      if (n === cellId) continue
      const isRing1 = disk1Set.has(n)
      const d = blendedPop(n)
      const s = counts[n] || 0
      if (isRing1) { ring1Demand += d; ring1Supply += s }
      else { ring2Demand += d; ring2Supply += s }
    }

    const ownDemand = blendedPop(cellId)
    const effectiveDemand =
      ownDemand +
      demandSpillover.ring1 * ring1Demand +
      demandSpillover.ring2 * ring2Demand

    if (effectiveDemand < minPopulation) {
      scores[cellId] = null
      continue
    }

    const multiplier = boroughMultipliers[meta.borough] || 1.0
    const effectivePop = effectiveDemand * multiplier

    const ownSupply = counts[cellId] || 0
    const effectiveSupply =
      ownSupply +
      supplySpillover.ring1 * ring1Supply +
      supplySpillover.ring2 * ring2Supply

    const expectedNeed = effectivePop / idealRatio
    const gap = expectedNeed - effectiveSupply
    const score = Math.max(-100, Math.min(100, Math.round((gap / Math.max(expectedNeed, 0.01)) * 100)))

    scores[cellId] = score
  }

  return scores
}