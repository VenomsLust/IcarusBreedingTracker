import { v4 as uuid } from 'uuid'
import {
  BUILTIN_CLASSIFICATION_NAMES,
  BUILTIN_CLASSIFICATION_SCORE_CONFIGS,
  defaultScoreConfig,
  type Animal,
  type AppData,
  type Classification,
  type Prospect,
  type SpeciesDefinition
} from './types'

const SCHEMA_VERSION = 2

// Save files from before Classifications existed had each Species carry its
// own scoreConfig directly. Map the two known "gameplay role" species onto
// their closest named Classification; anything else keeps its own
// Classification named after the species so no scoring data is lost.
const LEGACY_CLASSIFICATION_NAME_BY_SPECIES: Record<string, string> = {
  Wolves: 'Combat Pet',
  Buffalos: 'Pack Animal',
  Moas: 'Swift Mount'
}

export class ValidationError extends Error {}

export function emptyAppData(): AppData {
  return { schemaVersion: SCHEMA_VERSION, species: [], classifications: [], prospects: [], animals: [] }
}

interface LegacySpecies {
  id: string
  name: string
  scoreConfig?: unknown
}

/**
 * Converts a pre-Classification save (schemaVersion 1: each Species carries
 * its own scoreConfig) into the current shape by turning each Species'
 * scoreConfig into a standalone Classification.
 */
function migrateLegacySpeciesScoreConfigs(data: AppData): AppData {
  const classifications: Classification[] = []
  const species: SpeciesDefinition[] = (data.species as unknown as LegacySpecies[]).map((s) => {
    const name = LEGACY_CLASSIFICATION_NAME_BY_SPECIES[s.name] ?? s.name
    const classification: Classification = {
      id: uuid(),
      name,
      scoreConfig: {
        ...defaultScoreConfig(),
        ...(s.scoreConfig as object),
        phenotypeBonuses: (s.scoreConfig as { phenotypeBonuses?: Record<string, number> })?.phenotypeBonuses ?? {}
      }
    }
    classifications.push(classification)
    return { id: s.id, name: s.name, classificationId: classification.id }
  })

  for (const name of BUILTIN_CLASSIFICATION_NAMES) {
    if (!classifications.some((c) => c.name === name)) {
      classifications.push({ id: uuid(), name, scoreConfig: BUILTIN_CLASSIFICATION_SCORE_CONFIGS[name] })
    }
  }

  return { ...data, species, classifications }
}

// Backfills fields added after older save files were written, so files
// saved before the `prospects`/`prospectId`/`phenotypeBonuses`/`classifications`
// fields existed still load cleanly.
function normalize(data: AppData): AppData {
  const isLegacyShape =
    !Array.isArray(data.classifications) || (data.species as unknown as LegacySpecies[]).some((s) => 'scoreConfig' in s)
  const migrated = isLegacyShape ? migrateLegacySpeciesScoreConfigs(data) : data

  return {
    ...migrated,
    schemaVersion: SCHEMA_VERSION,
    prospects: migrated.prospects ?? [],
    classifications: migrated.classifications.map((c) => ({
      ...c,
      scoreConfig: { ...c.scoreConfig, phenotypeBonuses: c.scoreConfig.phenotypeBonuses ?? {} }
    })),
    animals: migrated.animals.map((a) => ({ ...a, prospectId: a.prospectId ?? null }))
  }
}

export function parseAppData(raw: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ValidationError('That file is not valid JSON.')
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as AppData).species) ||
    !Array.isArray((parsed as AppData).animals)
  ) {
    throw new ValidationError('That file does not look like an Icarus Breeding Tracker save.')
  }
  return normalize(parsed as AppData)
}

function assertSpeciesExists(data: AppData, speciesId: string): SpeciesDefinition {
  const species = data.species.find((s) => s.id === speciesId)
  if (!species) throw new ValidationError(`Species ${speciesId} does not exist`)
  return species
}

function assertClassificationExists(data: AppData, classificationId: string): Classification {
  const classification = data.classifications.find((c) => c.id === classificationId)
  if (!classification) throw new ValidationError(`Classification ${classificationId} does not exist`)
  return classification
}

function assertStatsValid(stats: Animal['stats']): void {
  for (const [stat, value] of Object.entries(stats)) {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 10) {
      throw new ValidationError(`Stat ${stat} must be a number between 0 and 10`)
    }
  }
}

function assertParentValid(data: AppData, animal: Animal, parentId: string | null, label: string): void {
  if (parentId === null) return
  if (parentId === animal.id) throw new ValidationError(`${label} cannot reference itself`)
  const parent = data.animals.find((a) => a.id === parentId)
  if (!parent) throw new ValidationError(`${label} ${parentId} does not exist`)
  if (parent.speciesId !== animal.speciesId) {
    throw new ValidationError(`${label} must belong to the same species`)
  }
}

function assertProspectValid(data: AppData, prospectId: string | null): void {
  if (prospectId === null) return
  if (!data.prospects.some((p) => p.id === prospectId)) {
    throw new ValidationError(`Prospect ${prospectId} does not exist`)
  }
}

export function applySaveAnimal(data: AppData, animal: Animal): AppData {
  assertSpeciesExists(data, animal.speciesId)
  assertStatsValid(animal.stats)
  assertParentValid(data, animal, animal.sireId, 'Sire')
  assertParentValid(data, animal, animal.damId, 'Dam')
  assertProspectValid(data, animal.prospectId)

  return { ...data, animals: [...data.animals.filter((a) => a.id !== animal.id), animal] }
}

export function applyDeleteAnimal(data: AppData, animalId: string): AppData {
  return applyDeleteAnimals(data, [animalId])
}

export function applyDeleteAnimals(data: AppData, animalIds: string[]): AppData {
  const idSet = new Set(animalIds)
  return {
    ...data,
    animals: data.animals
      .filter((a) => !idSet.has(a.id))
      .map((a) => ({
        ...a,
        sireId: a.sireId && idSet.has(a.sireId) ? null : a.sireId,
        damId: a.damId && idSet.has(a.damId) ? null : a.damId
      }))
  }
}

export function applySaveSpecies(data: AppData, species: SpeciesDefinition): AppData {
  if (!species.name.trim()) throw new ValidationError('Species name is required')
  assertClassificationExists(data, species.classificationId)

  return { ...data, species: [...data.species.filter((s) => s.id !== species.id), species] }
}

export function applyDeleteSpecies(data: AppData, speciesId: string): AppData {
  const stillUsed = data.animals.some((a) => a.speciesId === speciesId)
  if (stillUsed) {
    throw new ValidationError('Cannot delete a species that still has animals')
  }
  return { ...data, species: data.species.filter((s) => s.id !== speciesId) }
}

export function applySaveClassification(data: AppData, classification: Classification): AppData {
  if (!classification.name.trim()) throw new ValidationError('Classification name is required')

  return {
    ...data,
    classifications: [...data.classifications.filter((c) => c.id !== classification.id), classification]
  }
}

export function applyDeleteClassification(data: AppData, classificationId: string): AppData {
  const stillUsed = data.species.some((s) => s.classificationId === classificationId)
  if (stillUsed) {
    throw new ValidationError('Cannot delete a Classification that is still assigned to a Species')
  }
  return { ...data, classifications: data.classifications.filter((c) => c.id !== classificationId) }
}

export function applySaveProspect(data: AppData, prospect: Prospect): AppData {
  if (!prospect.name.trim()) throw new ValidationError('Prospect name is required')

  return { ...data, prospects: [...data.prospects.filter((p) => p.id !== prospect.id), prospect] }
}

export function applyDeleteProspect(data: AppData, prospectId: string): AppData {
  return {
    ...data,
    prospects: data.prospects.filter((p) => p.id !== prospectId),
    animals: data.animals.map((a) => ({
      ...a,
      prospectId: a.prospectId === prospectId ? null : a.prospectId
    }))
  }
}
