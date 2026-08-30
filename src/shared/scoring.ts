import { BLOODLINES, STAT_NAMES, phenotypeKey, type Animal, type Bloodline, type ScoreConfig, type Stats } from './types'

export function computeTotal(stats: Stats): number {
  return STAT_NAMES.reduce((sum, stat) => sum + stats[stat], 0)
}

export function computeScore(
  stats: Stats,
  bloodline: Bloodline,
  phenotype: string | null,
  config: ScoreConfig
): number {
  const weighted = STAT_NAMES.reduce((sum, stat) => sum + config.statWeights[stat] * stats[stat], 0)
  const bloodlineBonus = config.bloodlineBonuses[bloodline] ?? 0
  const phenotypeBonus = config.phenotypeBonuses[phenotypeKey(phenotype)] ?? 0
  return weighted + config.constant + bloodlineBonus + phenotypeBonus
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

export interface TargetsHit {
  hit: number
  possible: number
}

// How many of the "perfect animal" stat targets an offspring estimate
// actually reaches. Bloodline is handled separately by classifyBloodlineTier
// (it's an all-or-nothing trait, not a fuzzy target to blend into a stat
// count) and phenotype isn't included — there's no single "correct"
// phenotype the way there's a top Bloodline, it's just a bonus.
export function countTargetsHit(estimate: { stats: Stats }, target: TargetProfile): TargetsHit {
  let hit = 0
  let possible = 0
  for (const [stat, statTarget] of Object.entries(target.statTargets) as [(typeof STAT_NAMES)[number], number][]) {
    possible += 1
    if (estimate.stats[stat] === statTarget) hit += 1
  }
  return { hit, possible }
}

export interface TargetOdds {
  // Sum of each target's hit probability — a smooth, comparable "how good is
  // this pairing" number even when no single target is likely.
  expectedHits: number
  // Chance every target is hit simultaneously (independence assumed).
  probabilityAllHit: number
}

// Icarus rolls each stat 40% from the Sire's value, 40% from the Dam's, 20%
// random-or-mutation. That last 20% has no known distribution (see
// AnimalDetails' "Random Roll / Mutation" label), so it's treated as
// contributing zero chance of landing exactly on a target — these are floor
// odds from the two known 40% paths, not the true (higher) odds. Bloodline is
// excluded here — see classifyBloodlineTier.
export function computeTargetOdds(a: Animal, b: Animal, target: TargetProfile): TargetOdds {
  let expectedHits = 0
  let probabilityAllHit = 1

  for (const [stat, statTarget] of Object.entries(target.statTargets) as [(typeof STAT_NAMES)[number], number][]) {
    const p = (a.stats[stat] === statTarget ? 0.4 : 0) + (b.stats[stat] === statTarget ? 0.4 : 0)
    expectedHits += p
    probabilityAllHit *= p
  }

  return { expectedHits, probabilityAllHit }
}

export type BloodlineTier = 'purebred' | 'crossbred' | 'outcross'

// Bloodline doesn't have partial credit the way a stat does (no "8 out of
// 10 toward target"), so instead of blending it into Expected Hits it sorts
// a pair into one of three tiers by how many parents already carry a top
// Bloodline: null when this Classification doesn't favor any Bloodline, so
// there's nothing to tier by.
export function classifyBloodlineTier(a: Animal, b: Animal, target: TargetProfile): BloodlineTier | null {
  if (!target.bloodlineTargets) return null
  const aHas = target.bloodlineTargets.has(a.bloodline)
  const bHas = target.bloodlineTargets.has(b.bloodline)
  if (aHas && bHas) return 'purebred'
  if (aHas || bHas) return 'crossbred'
  return 'outcross'
}

export interface OffspringEstimate {
  stats: Stats
  bloodline: Bloodline
  phenotype: string | null
  score: number
  targets: TargetsHit
  odds: TargetOdds
}

/**
 * Ceiling estimate for a candidate mate pair. Icarus inherits each stat as
 * one of the two parents' values (never averaged), so the best-possible
 * outcome per stat is whichever parent's value scores higher under this
 * Classification's weight for that stat — the higher value for a
 * positively-weighted stat, but the lower value for a dump stat (negative
 * weight); bloodline and phenotype are likewise whichever parent's trait
 * scores better under this Classification's formula.
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

  const target = computeTargetProfile(scoreConfig)

  return {
    stats,
    bloodline,
    phenotype,
    score: computeScore(stats, bloodline, phenotype, scoreConfig),
    targets: countTargetsHit({ stats }, target),
    odds: computeTargetOdds(a, b, target)
  }
}

export interface MatePair {
  male: Animal
  female: Animal
  estimate: OffspringEstimate
}

export function rankMatePairs(
  animals: Animal[],
  speciesId: string,
  scoreConfig: ScoreConfig,
  options?: { forAnimalId?: string }
): MatePair[] {
  // Retired and deceased animals aren't candidates for breeding.
  const pool = animals.filter((animal) => {
    if (animal.speciesId !== speciesId) return false
    if (animal.status === 'deceased') return false
    if (animal.status === 'retired') return false
    return true
  })

  const males = pool.filter((a) => a.sex === 'Male')
  const females = pool.filter((a) => a.sex === 'Female')

  const pairs: MatePair[] = []
  for (const male of males) {
    for (const female of females) {
      if (options?.forAnimalId && male.id !== options.forAnimalId && female.id !== options.forAnimalId) {
        continue
      }
      pairs.push({ male, female, estimate: estimateOffspringCeiling(male, female, scoreConfig) })
    }
  }

  // Rank primarily by expected targets hit — the sum of each target's actual
  // 40%-Sire/40%-Dam odds — rather than just whether the ceiling reaches it,
  // since a pair that's one likely stat away from perfect should outrank one
  // that's technically capable of perfect but needs six unlikely rolls to get
  // there. Ceiling targets.hit breaks ties (prefer the higher upside), then
  // predicted Score.
  return pairs.sort((x, y) => {
    const oddsDiff = y.estimate.odds.expectedHits - x.estimate.odds.expectedHits
    if (oddsDiff !== 0) return oddsDiff
    const targetDiff = y.estimate.targets.hit - x.estimate.targets.hit
    if (targetDiff !== 0) return targetDiff
    return y.estimate.score - x.estimate.score
  })
}

export interface TieredMatePairs {
  purebred: MatePair[]
  crossbred: MatePair[]
  outcross: MatePair[]
}

const TIER_CAP = 5

// Splits already-ranked pairs into Bloodline tiers, capping each at
// TIER_CAP so the working view stays uncluttered. Relative order within
// each tier is preserved from rankMatePairs (i.e. still stat-Expected-Hits
// first). Null when this Classification doesn't favor any Bloodline — there's
// nothing to tier by, so the caller should fall back to a flat list.
export function groupMatePairsByBloodlineTier(pairs: MatePair[], target: TargetProfile): TieredMatePairs | null {
  if (!target.bloodlineTargets) return null

  const tiers: TieredMatePairs = { purebred: [], crossbred: [], outcross: [] }
  for (const pair of pairs) {
    const tier = classifyBloodlineTier(pair.male, pair.female, target)
    if (!tier || tiers[tier].length >= TIER_CAP) continue
    tiers[tier].push(pair)
  }
  return tiers
}
