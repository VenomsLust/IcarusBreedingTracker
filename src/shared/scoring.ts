import { STAT_NAMES, phenotypeKey, type Animal, type Bloodline, type ScoreConfig, type Stats } from './types'

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

export interface OffspringEstimate {
  stats: Stats
  bloodline: Bloodline
  phenotype: string | null
  score: number
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

  return {
    stats,
    bloodline,
    phenotype,
    score: computeScore(stats, bloodline, phenotype, scoreConfig)
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

  return pairs.sort((x, y) => y.estimate.score - x.estimate.score)
}
