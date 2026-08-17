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
