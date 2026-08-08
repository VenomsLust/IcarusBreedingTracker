import {
  STAT_NAMES,
  phenotypeKey,
  type Animal,
  type Bloodline,
  type ScoreConfig,
  type SpeciesDefinition,
  type Stats
} from './types'

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
  // Isolated components so pairs can be ranked by a single dimension
  // (Genotype/Bloodline/Phenotype) instead of only the combined Score.
  genotypeScore: number
  bloodlineBonus: number
  phenotypeBonus: number
}

/**
 * Ceiling estimate for a candidate mate pair. Icarus inherits each stat as
 * one of the two parents' values (never averaged), so the best-possible
 * outcome per stat is the higher parent's value; bloodline and phenotype are
 * likewise whichever parent's trait scores better under this species' formula.
 */
export function estimateOffspringCeiling(
  a: Animal,
  b: Animal,
  species: SpeciesDefinition
): OffspringEstimate {
  const stats = Object.fromEntries(
    STAT_NAMES.map((stat) => [stat, Math.max(a.stats[stat], b.stats[stat])])
  ) as Stats

  const bloodlineBonusA = species.scoreConfig.bloodlineBonuses[a.bloodline] ?? 0
  const bloodlineBonusB = species.scoreConfig.bloodlineBonuses[b.bloodline] ?? 0
  const bloodline = bloodlineBonusA >= bloodlineBonusB ? a.bloodline : b.bloodline
  const bloodlineBonus = Math.max(bloodlineBonusA, bloodlineBonusB)

  const phenotypeBonusA = species.scoreConfig.phenotypeBonuses[phenotypeKey(a.phenotype)] ?? 0
  const phenotypeBonusB = species.scoreConfig.phenotypeBonuses[phenotypeKey(b.phenotype)] ?? 0
  const phenotype = phenotypeBonusA >= phenotypeBonusB ? a.phenotype : b.phenotype
  const phenotypeBonus = Math.max(phenotypeBonusA, phenotypeBonusB)

  const genotypeScore = STAT_NAMES.reduce(
    (sum, stat) => sum + species.scoreConfig.statWeights[stat] * stats[stat],
    species.scoreConfig.constant
  )

  return {
    stats,
    bloodline,
    phenotype,
    score: computeScore(stats, bloodline, phenotype, species.scoreConfig),
    genotypeScore,
    bloodlineBonus,
    phenotypeBonus
  }
}

export interface MatePair {
  male: Animal
  female: Animal
  estimate: OffspringEstimate
}

export function rankMatePairs(
  animals: Animal[],
  species: SpeciesDefinition,
  options?: { forAnimalId?: string }
): MatePair[] {
  // Retired and deceased animals aren't candidates for breeding.
  const pool = animals.filter((animal) => {
    if (animal.speciesId !== species.id) return false
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
      pairs.push({ male, female, estimate: estimateOffspringCeiling(male, female, species) })
    }
  }

  return pairs.sort((x, y) => y.estimate.score - x.estimate.score)
}

export type MateCategory = 'genotype' | 'bloodline' | 'phenotype'

const CATEGORY_KEY: Record<MateCategory, keyof OffspringEstimate> = {
  genotype: 'genotypeScore',
  bloodline: 'bloodlineBonus',
  phenotype: 'phenotypeBonus'
}

/** Ranks pairs by a single dimension, breaking ties with the overall Score. */
export function sortMatePairsByCategory(pairs: MatePair[], category: MateCategory): MatePair[] {
  const key = CATEGORY_KEY[category]
  return [...pairs].sort((x, y) => {
    const diff = (y.estimate[key] as number) - (x.estimate[key] as number)
    return diff !== 0 ? diff : y.estimate.score - x.estimate.score
  })
}
