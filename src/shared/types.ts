export const STAT_NAMES = [
  'vigor',
  'fitness',
  'physique',
  'reflex',
  'toughness',
  'adaptation',
  'instinct'
] as const

export type StatName = (typeof STAT_NAMES)[number]

export type Stats = Record<StatName, number>

export const BLOODLINES = [
  'Alpha',
  'Ambitious',
  'Bold',
  'Brave',
  'Careful',
  'Hardy',
  'Resolute',
  'Stout',
  'Savage',
  'Timid',
  'Unstable',
  'Wild'
] as const

export type Bloodline = (typeof BLOODLINES)[number]

export type Sex = 'Male' | 'Female'

export type AnimalStatus = 'active' | 'retired' | 'deceased'

export interface ScoreConfig {
  statWeights: Record<StatName, number>
  constant: number
  bloodlineBonuses: Partial<Record<Bloodline, number>>
  // Keyed by the exact Phenotype text (case-sensitive). The base/blank
  // phenotype (stored as `null` on Animal) is not addressable here.
  phenotypeBonuses: Record<string, number>
}

export function phenotypeKey(phenotype: string | null): string {
  return phenotype ?? ''
}

export interface Classification {
  id: string
  name: string
  scoreConfig: ScoreConfig
}

export interface SpeciesDefinition {
  id: string
  name: string
  classificationId: string
}

export interface Prospect {
  id: string
  name: string
}

export interface Animal {
  id: string
  speciesId: string
  name: string
  sex: Sex
  sireId: string | null
  damId: string | null
  bloodline: Bloodline
  phenotype: string | null
  stats: Stats
  status?: AnimalStatus
  prospectId: string | null
}

export interface AppData {
  schemaVersion: number
  species: SpeciesDefinition[]
  classifications: Classification[]
  prospects: Prospect[]
  animals: Animal[]
}

// Starter set covering the common Icarus breeding roles. Users can rename,
// edit, delete, or add their own beyond these.
export const BUILTIN_CLASSIFICATION_NAMES = [
  'Combat Pet',
  'Combat Mount',
  'Swift Mount',
  'Pack Animal',
  'Ranch Animal',
  'House Pet'
] as const

export function defaultScoreConfig(): ScoreConfig {
  return {
    statWeights: {
      vigor: 1,
      fitness: 1,
      physique: 1,
      reflex: 1,
      toughness: 1,
      adaptation: 1,
      instinct: 1
    },
    constant: 0,
    bloodlineBonuses: {},
    phenotypeBonuses: {}
  }
}

// Icarus mechanics don't allow every stat to max out on one animal — one stat
// has to be sacrificed (weight -1) so the rest can reach 10.
export function dumpStatScoreConfig(dumpStat: StatName): ScoreConfig {
  return {
    ...defaultScoreConfig(),
    statWeights: Object.fromEntries(STAT_NAMES.map((s) => [s, s === dumpStat ? -1 : 1])) as Record<StatName, number>
  }
}

// Default dump stat + bonuses for each built-in Classification, reasoned from
// each role (see STAT_DESCRIPTIONS in descriptions.ts): Instinct governs mount
// cargo / wool-egg-milk output, so it's dead weight on anything that isn't a
// utility mount or farm animal. Shared by seedData.ts (fresh installs) and
// validation.ts (backfilling built-ins missing from a migrated save) so the
// two can't drift apart.
export const BUILTIN_CLASSIFICATION_SCORE_CONFIGS: Record<(typeof BUILTIN_CLASSIFICATION_NAMES)[number], ScoreConfig> = {
  // Instinct (utility output) is irrelevant on a non-mount combat companion.
  // Alpha/Savage are the rare, combat-favoring bloodlines.
  'Combat Pet': { ...dumpStatScoreConfig('instinct'), constant: 10, bloodlineBonuses: { Alpha: 8, Savage: 4 } },
  // Same reasoning as Combat Pet — cargo/utility isn't the point of a mount built to fight.
  'Combat Mount': dumpStatScoreConfig('instinct'),
  // A pure speed mount isn't meant to fight or haul heavy cargo.
  'Swift Mount': dumpStatScoreConfig('physique'),
  // Kept out of danger while hauling, so health matters least.
  'Pack Animal': dumpStatScoreConfig('vigor'),
  // Not a fighter or a mount — melee damage/carry capacity matters least next to Instinct, its actual output.
  'Ranch Animal': dumpStatScoreConfig('physique'),
  // No utility role at all, so Instinct is the clearest dump stat.
  'House Pet': dumpStatScoreConfig('instinct')
}

export function emptyStats(): Stats {
  return {
    vigor: 0,
    fitness: 0,
    physique: 0,
    reflex: 0,
    toughness: 0,
    adaptation: 0,
    instinct: 0
  }
}
