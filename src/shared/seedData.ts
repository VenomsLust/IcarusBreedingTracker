import { v4 as uuid } from 'uuid'
import {
  BUILTIN_CLASSIFICATION_NAMES,
  defaultScoreConfig,
  type AppData,
  type Classification,
  type ScoreConfig
} from './types'

// Matches the score formula the old Electron app's xlsx importer hardcoded
// for Wolves: Instinct is a dump stat (largely irrelevant on a combat
// companion), and Alpha/Savage bloodlines get a flat bonus for their rarity.
const COMBAT_PET_SCORE_CONFIG: ScoreConfig = {
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

const BUILTIN_SCORE_CONFIGS: Partial<Record<(typeof BUILTIN_CLASSIFICATION_NAMES)[number], ScoreConfig>> = {
  'Combat Pet': COMBAT_PET_SCORE_CONFIG
}

export function seedAppData(): AppData {
  const classifications: Classification[] = BUILTIN_CLASSIFICATION_NAMES.map((name) => ({
    id: uuid(),
    name,
    scoreConfig: BUILTIN_SCORE_CONFIGS[name] ?? defaultScoreConfig()
  }))
  const classificationIdByName = (name: (typeof BUILTIN_CLASSIFICATION_NAMES)[number]): string =>
    classifications.find((c) => c.name === name)!.id

  return {
    schemaVersion: 2,
    prospects: [],
    animals: [],
    classifications,
    species: [
      { id: uuid(), name: 'Wolves', classificationId: classificationIdByName('Combat Pet') },
      { id: uuid(), name: 'Buffalos', classificationId: classificationIdByName('Pack Animal') },
      { id: uuid(), name: 'Moas', classificationId: classificationIdByName('Swift Mount') }
    ]
  }
}
