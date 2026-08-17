import { v4 as uuid } from 'uuid'
import { BUILTIN_CLASSIFICATION_NAMES, BUILTIN_CLASSIFICATION_SCORE_CONFIGS, type AppData, type Classification } from './types'

export function seedAppData(): AppData {
  const classifications: Classification[] = BUILTIN_CLASSIFICATION_NAMES.map((name) => ({
    id: uuid(),
    name,
    scoreConfig: BUILTIN_CLASSIFICATION_SCORE_CONFIGS[name]
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
