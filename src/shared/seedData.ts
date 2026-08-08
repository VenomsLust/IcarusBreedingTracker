import { v4 as uuid } from 'uuid'
import { defaultScoreConfig, type AppData, type ScoreConfig } from './types'

// Matches the score formula the old Electron app's xlsx importer hardcoded
// for Wolves: Instinct is a dump stat (largely irrelevant on a combat
// companion), and Alpha/Savage bloodlines get a flat bonus for their rarity.
const WOLVES_SCORE_CONFIG: ScoreConfig = {
  statWeights: {
    vigor: 1,
    fitness: 1,
    physique: 1,
    reflex: 1,
    toughness: 1,
    adaptation: 1,
    instinct: -1
  },
  constant: 10,
  bloodlineBonuses: { Alpha: 8, Savage: 4 },
  phenotypeBonuses: {}
}

const SEED_SPECIES_NAMES = ['Wolves', 'Buffalos', 'Moas'] as const

export function seedAppData(): AppData {
  return {
    schemaVersion: 1,
    prospects: [],
    animals: [],
    species: SEED_SPECIES_NAMES.map((name) => ({
      id: uuid(),
      name,
      scoreConfig: name === 'Wolves' ? WOLVES_SCORE_CONFIG : defaultScoreConfig()
    }))
  }
}
