import type { Animal, AppData, Prospect, SpeciesDefinition } from './types'

const SCHEMA_VERSION = 1

export class ValidationError extends Error {}

export function emptyAppData(): AppData {
  return { schemaVersion: SCHEMA_VERSION, species: [], prospects: [], animals: [] }
}

// Backfills fields added after older save files were written, so files
// saved before the `prospects`/`prospectId`/`phenotypeBonuses` fields existed
// still load cleanly.
function normalize(data: AppData): AppData {
  return {
    ...data,
    prospects: data.prospects ?? [],
    species: data.species.map((s) => ({
      ...s,
      scoreConfig: { ...s.scoreConfig, phenotypeBonuses: s.scoreConfig.phenotypeBonuses ?? {} }
    })),
    animals: data.animals.map((a) => ({ ...a, prospectId: a.prospectId ?? null }))
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
  return {
    ...data,
    animals: data.animals
      .filter((a) => a.id !== animalId)
      .map((a) => ({
        ...a,
        sireId: a.sireId === animalId ? null : a.sireId,
        damId: a.damId === animalId ? null : a.damId
      }))
  }
}

export function applySaveSpecies(data: AppData, species: SpeciesDefinition): AppData {
  if (!species.name.trim()) throw new ValidationError('Species name is required')

  return { ...data, species: [...data.species.filter((s) => s.id !== species.id), species] }
}

export function applyDeleteSpecies(data: AppData, speciesId: string): AppData {
  const stillUsed = data.animals.some((a) => a.speciesId === speciesId)
  if (stillUsed) {
    throw new ValidationError('Cannot delete a species that still has animals')
  }
  return { ...data, species: data.species.filter((s) => s.id !== speciesId) }
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
