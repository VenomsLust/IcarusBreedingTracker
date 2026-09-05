import { BLOODLINES, STAT_NAMES, phenotypeKey, type Animal, type Bloodline, type ScoreConfig, type Stats } from './types'

export function computeTotal(stats: Stats): number {
  return STAT_NAMES.reduce((sum, stat) => sum + stats[stat], 0)
}

export interface TargetProfile {
  // Only stats whose weight is nonzero have a target — a zero-weighted stat
  // doesn't matter to this Classification, so it's neither hit nor missed.
  statTargets: Partial<Record<(typeof STAT_NAMES)[number], number>>
  // null when no Bloodline has a positive bonus configured — i.e. this
  // Classification doesn't actually favor any one Bloodline over the rest.
  bloodlineTargets: Set<Bloodline> | null
}

/**
 * The literal "perfect animal" for a Classification: 10 in every positively-
 * weighted stat, 0 in every negatively-weighted (dump) stat, and whichever
 * Bloodline(s) carry the top bonus.
 */
export function computeTargetProfile(config: ScoreConfig): TargetProfile {
  const statTargets: TargetProfile['statTargets'] = {}
  for (const stat of STAT_NAMES) {
    const weight = config.statWeights[stat]
    if (weight > 0) statTargets[stat] = 10
    else if (weight < 0) statTargets[stat] = 0
  }

  const maxBonus = Math.max(0, ...BLOODLINES.map((b) => config.bloodlineBonuses[b] ?? 0))
  const bloodlineTargets =
    maxBonus > 0 ? new Set(BLOODLINES.filter((b) => (config.bloodlineBonuses[b] ?? 0) === maxBonus)) : null

  return { statTargets, bloodlineTargets }
}

// The Bloodline a user picks (in MateRecommendations) to favor — defaults to
// whichever Bloodline carries this Classification's top bonus, if any.
export function favoredBloodline(target: TargetProfile): Bloodline | null {
  if (!target.bloodlineTargets) return null
  return BLOODLINES.find((b) => target.bloodlineTargets!.has(b)) ?? null
}

export interface OffspringEstimate {
  stats: Stats
  bloodline: Bloodline
  phenotype: string | null
}

/**
 * Ceiling estimate for a candidate mate pair — MatePair.statTotal is derived
 * from this (see buildMatePairs), so it's bounded the same way a real
 * animal's stats are (10 per stat) rather than able to run up to double that
 * by adding two parents' stats together. Icarus inherits each stat as one of
 * the two parents' values (never averaged), so the best-possible outcome per
 * stat is whichever parent's value scores higher under this Classification's
 * weight for that stat — the higher value for a positively-weighted stat,
 * but the lower value for a dump stat (negative weight); bloodline and
 * phenotype are likewise whichever parent's trait scores better under this
 * Classification's formula.
 */
export function estimateOffspringCeiling(a: Animal, b: Animal, scoreConfig: ScoreConfig): OffspringEstimate {
  const stats = Object.fromEntries(
    STAT_NAMES.map((stat) => {
      const weight = scoreConfig.statWeights[stat]
      const best = weight < 0 ? Math.min(a.stats[stat], b.stats[stat]) : Math.max(a.stats[stat], b.stats[stat])
      return [stat, best]
    })
  ) as Stats

  const bloodlineBonusA = scoreConfig.bloodlineBonuses[a.bloodline] ?? 0
  const bloodlineBonusB = scoreConfig.bloodlineBonuses[b.bloodline] ?? 0
  const bloodline = bloodlineBonusA >= bloodlineBonusB ? a.bloodline : b.bloodline

  const phenotypeBonusA = scoreConfig.phenotypeBonuses[phenotypeKey(a.phenotype)] ?? 0
  const phenotypeBonusB = scoreConfig.phenotypeBonuses[phenotypeKey(b.phenotype)] ?? 0
  const phenotype = phenotypeBonusA >= phenotypeBonusB ? a.phenotype : b.phenotype

  return { stats, bloodline, phenotype }
}

export interface MatePair {
  male: Animal
  female: Animal
  estimate: OffspringEstimate
  // Both parents' own actual Dump Stat values, summed — how close this real
  // pair already is to a qualifying 0-Dump-Stat base pair. Deliberately not
  // the ceiling estimate: breeding progress is about where these two
  // specific animals actually stand today, not their best-case offspring.
  dumpTotal: number
  // Sum of the ceiling estimate's non-Dump stats (see estimateOffspringCeiling)
  // — this pairing's best-case single-offspring total, so it's capped the
  // same way one real animal's stats are rather than able to exceed that by
  // adding two parents together.
  statTotal: number
}

// Retired and deceased animals aren't candidates for breeding.
function filterBreedingPool(animals: Animal[], speciesId: string): Animal[] {
  return animals.filter((animal) => {
    if (animal.speciesId !== speciesId) return false
    if (animal.status === 'deceased') return false
    if (animal.status === 'retired') return false
    return true
  })
}

function buildMatePairs(pool: Animal[], scoreConfig: ScoreConfig, options?: { forAnimalId?: string }): MatePair[] {
  const males = pool.filter((a) => a.sex === 'Male')
  const females = pool.filter((a) => a.sex === 'Female')
  const dumpStats = STAT_NAMES.filter((stat) => scoreConfig.statWeights[stat] < 0)

  const pairs: MatePair[] = []
  for (const male of males) {
    for (const female of females) {
      if (options?.forAnimalId && male.id !== options.forAnimalId && female.id !== options.forAnimalId) {
        continue
      }
      const dumpTotal = dumpStats.reduce((sum, stat) => sum + male.stats[stat] + female.stats[stat], 0)
      const estimate = estimateOffspringCeiling(male, female, scoreConfig)
      const dumpCeiling = dumpStats.reduce((sum, stat) => sum + estimate.stats[stat], 0)
      const statTotal = computeTotal(estimate.stats) - dumpCeiling
      pairs.push({ male, female, estimate, dumpTotal, statTotal })
    }
  }
  return pairs
}

// Icarus never averages stats — a 10 in every other stat is worthless on an
// animal that still passes on a nonzero Dump Stat — so pairs are ranked by
// the parents' own current Dump Stat first (lower is better, summed across
// the pair), then by their combined Total excluding the Dump Stat.
export function rankMatePairs(
  animals: Animal[],
  speciesId: string,
  scoreConfig: ScoreConfig,
  options?: { forAnimalId?: string }
): MatePair[] {
  const pool = filterBreedingPool(animals, speciesId)
  const pairs = buildMatePairs(pool, scoreConfig, options)

  return pairs.sort((x, y) => {
    const dumpDiff = x.dumpTotal - y.dumpTotal
    if (dumpDiff !== 0) return dumpDiff
    return y.statTotal - x.statTotal
  })
}

// Recommendation groups are capped so the working view stays uncluttered.
export const RECOMMENDATION_CAP = 5

// A breeder's first step: drive the Dump Stat down to 0 in both parents
// before chasing anything else — a usable base breeding pair is a Male and a
// Female that already each carry 0 in every Dump Stat. Until that exists,
// this surfaces the top RECOMMENDATION_CAP pairs off the same ranking
// rankMatePairs already produces (Dump Stat first, then Stat Total), since
// that's exactly the order that builds toward a qualifying pair fastest.
// Returns null once there's nothing left to breed down — no Dump Stat is
// configured for this Classification, or a qualifying pair already exists.
export function computeBreedDownPairs(
  animals: Animal[],
  speciesId: string,
  scoreConfig: ScoreConfig,
  options?: { forAnimalId?: string }
): MatePair[] | null {
  const target = computeTargetProfile(scoreConfig)
  const dumpStats = STAT_NAMES.filter((stat) => target.statTargets[stat] === 0)
  if (dumpStats.length === 0) return null

  const pool = filterBreedingPool(animals, speciesId)
  const isZeroDump = (a: Animal): boolean => dumpStats.every((stat) => a.stats[stat] === 0)
  const hasBasePair = pool.some((a) => a.sex === 'Male' && isZeroDump(a)) && pool.some((a) => a.sex === 'Female' && isZeroDump(a))
  if (hasBasePair) return null

  return rankMatePairs(animals, speciesId, scoreConfig, options).slice(0, RECOMMENDATION_CAP)
}

export interface BloodlineFilteredPairs {
  purebred: MatePair[]
  crossbred: MatePair[]
}

// Splits already-ranked pairs by a user-chosen Bloodline (not necessarily
// this Classification's configured favorite — see favoredBloodline for the
// default) into Purebred (both parents carry it) and Crossbred (one does),
// each capped at RECOMMENDATION_CAP. Order within each is preserved from the
// input (still Dump Stat, then Stat Total). A pair where neither parent
// carries it belongs to neither bucket — Outcross ignores Bloodline
// entirely and is just the plain stat-ranked pair list, so it isn't built
// here.
export function filterMatePairsByBloodline(pairs: MatePair[], bloodline: Bloodline): BloodlineFilteredPairs {
  const purebred: MatePair[] = []
  const crossbred: MatePair[] = []
  for (const pair of pairs) {
    const maleHas = pair.male.bloodline === bloodline
    const femaleHas = pair.female.bloodline === bloodline
    if (maleHas && femaleHas) {
      if (purebred.length < RECOMMENDATION_CAP) purebred.push(pair)
    } else if (maleHas || femaleHas) {
      if (crossbred.length < RECOMMENDATION_CAP) crossbred.push(pair)
    }
  }
  return { purebred, crossbred }
}
