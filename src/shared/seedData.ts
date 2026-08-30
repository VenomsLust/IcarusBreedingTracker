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
      // Combat Pet — non-mount hunting companions (Snare Trap + bait tames).
      { id: uuid(), name: 'Wolves', classificationId: classificationIdByName('Combat Pet') },
      { id: uuid(), name: 'Snow Wolves', classificationId: classificationIdByName('Combat Pet') },
      { id: uuid(), name: 'Wild Boars', classificationId: classificationIdByName('Combat Pet') },
      { id: uuid(), name: 'Hyenas', classificationId: classificationIdByName('Combat Pet') },
      // Combat Mount — Tuskers have the highest health/regen/carry of any
      // mount, built to tank rather than haul or race.
      { id: uuid(), name: 'Tuskers', classificationId: classificationIdByName('Combat Mount') },
      // Swift Mount — Moa-family speed mounts.
      { id: uuid(), name: 'Moas', classificationId: classificationIdByName('Swift Mount') },
      { id: uuid(), name: 'Arctic Moas', classificationId: classificationIdByName('Swift Mount') },
      { id: uuid(), name: 'Ubis', classificationId: classificationIdByName('Swift Mount') },
      // Pack Animal — Buffalo and Terrenus both prioritize carry capacity.
      { id: uuid(), name: 'Buffalos', classificationId: classificationIdByName('Pack Animal') },
      { id: uuid(), name: 'Terrenus', classificationId: classificationIdByName('Pack Animal') },
      // Ranch Animal — Homestead livestock (eggs/wool/milk).
      { id: uuid(), name: 'Chickens', classificationId: classificationIdByName('Ranch Animal') },
      { id: uuid(), name: 'Sheep', classificationId: classificationIdByName('Ranch Animal') },
      { id: uuid(), name: 'Cows', classificationId: classificationIdByName('Ranch Animal') },
      // House Pet — cosmetic companions, no combat/utility role.
      { id: uuid(), name: 'Cats', classificationId: classificationIdByName('House Pet') }
    ]
  }
}
