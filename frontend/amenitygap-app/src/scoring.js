import { gridDisk } from 'h3-js'

const res9NeighborCache = new Map()

function buildRes9Cache(cellMetadata) {
  const built = new Map()
  for (const [id, meta] of Object.entries(cellMetadata)) {
    if (Number(meta.resolution) !== 9) continue
    const disk1 = new Set(gridDisk(id, 1))
    const disk2 = gridDisk(id, 2)
    const ring1 = []
    const ring2 = []
    for (const n of disk2) {
      if (n === id) continue
      if (disk1.has(n)) ring1.push(n)
      else ring2.push(n)
    }
    built.set(id, { ring1, ring2 })
  }
  return built
}

function getRingsCached(cellId, resolution, cellMetadata) {
  if (resolution === 9) {
    if (!res9NeighborCache.has(cellMetadata)) {
      res9NeighborCache.set(cellMetadata, buildRes9Cache(cellMetadata))
    }
    return res9NeighborCache.get(cellMetadata).get(cellId) || { ring1: [], ring2: [] }
  }
  const disk1 = new Set(gridDisk(cellId, 1))
  const disk2 = gridDisk(cellId, 2)
  const ring1 = []
  const ring2 = []
  for (const n of disk2) {
    if (n === cellId) continue
    if (disk1.has(n)) ring1.push(n)
    else ring2.push(n)
  }
  return { ring1, ring2 }
}

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
    minAmenityCount = 0,
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

    if ((counts[cellId] || 0) < minAmenityCount) {
      scores[cellId] = null
      continue
    }

    const { ring1, ring2 } = getRingsCached(cellId, resolution, cellMetadata)
    let ring1Demand = 0, ring2Demand = 0
    let ring1Supply = 0, ring2Supply = 0
    for (const n of ring1) {
      ring1Demand += blendedPop(n)
      ring1Supply += counts[n] || 0
    }
    for (const n of ring2) {
      ring2Demand += blendedPop(n)
      ring2Supply += counts[n] || 0
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