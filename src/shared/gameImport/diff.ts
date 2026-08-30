import type { Animal, AppData, Bloodline, SpeciesDefinition, StatName, Stats } from '../types'
import { STAT_NAMES } from '../types'
import type { DetectedCreature } from './types'
import { KNOWN_CLASS_NAME_SPECIES } from './mapping'

export type CreatureAction = 'add' | 'update' | 'conflict' | 'unchanged'

export interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

export interface CreatureRow {
  detected: DetectedCreature
  /** Resolved app Species id, or null if this creature's game class name hasn't been mapped yet. */
  speciesId: string | null
  /** Existing tracked Animal this row matches (by gameActorId, or by name+species fallback), if any. */
  existing: Animal | null
  action: CreatureAction
  /** Non-genetic differences (name, backfillable Sire/Dam, save-file link) - applied automatically. */
  changes: FieldChange[]
  /** Genetics/Bloodline/Sex differences on an already-tracked animal - the user picks Replace or Append. */
  conflicts: FieldChange[]
}

/**
 * Finds the Species this creature's actor class belongs to: an explicit
 * gameClassNames mapping first, falling back to KNOWN_CLASS_NAME_SPECIES
 * (matched by Species name) for common creatures nobody's had to map yet.
 */
export function resolveSpecies(actorClassName: string | null, species: SpeciesDefinition[]): SpeciesDefinition | null {
  if (!actorClassName) return null
  const mapped = species.find((s) => s.gameClassNames?.includes(actorClassName))
  if (mapped) return mapped
  const knownName = KNOWN_CLASS_NAME_SPECIES[actorClassName]
  if (!knownName) return null
  return species.find((s) => s.name === knownName) ?? null
}

/** Known class names resolved by name (not yet explicitly saved to gameClassNames) among these detected creatures. */
export function unpersistedKnownMappings(
  detected: DetectedCreature[],
  species: SpeciesDefinition[]
): Array<{ species: SpeciesDefinition; className: string }> {
  const found = new Map<string, { species: SpeciesDefinition; className: string }>()
  for (const d of detected) {
    const className = d.actorClassName
    if (!className || found.has(className)) continue
    const knownName = KNOWN_CLASS_NAME_SPECIES[className]
    if (!knownName) continue
    const match = species.find((s) => s.name === knownName)
    if (match && !match.gameClassNames?.includes(className)) {
      found.set(className, { species: match, className })
    }
  }
  return [...found.values()]
}

/** Every distinct actorClassName among detected creatures with no Species mapping yet. */
export function unresolvedClassNames(detected: DetectedCreature[], species: SpeciesDefinition[]): string[] {
  const names = new Set<string>()
  for (const d of detected) {
    if (d.actorClassName && !resolveSpecies(d.actorClassName, species)) names.add(d.actorClassName)
  }
  return [...names]
}

function findExisting(detected: DetectedCreature, speciesId: string, animals: Animal[]): Animal | null {
  if (detected.gameActorId != null) {
    const byId = animals.find((a) => a.gameActorId === detected.gameActorId)
    if (byId) return byId
  }
  // Fallback for hand-entered animals matching a save file for the first time.
  return animals.find((a) => a.speciesId === speciesId && a.gameActorId == null && a.name === detected.name) ?? null
}

function statsDiffer(a: Stats, b: Stats): StatName[] {
  return STAT_NAMES.filter((s) => a[s] !== b[s])
}

/** "speciesId:name" -> animal id, for resolving a Mother/FatherName to an already-tracked Animal. */
function buildNameIndex(animals: Animal[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const a of animals) index.set(`${a.speciesId}:${a.name}`, a.id)
  return index
}

function resolveParentId(byNameKey: Map<string, string>, speciesId: string, name: string): string | null {
  return name ? (byNameKey.get(`${speciesId}:${name}`) ?? null) : null
}

/** "speciesId:name" keys for every creature in this import batch, so a parent arriving in the same file resolves too. */
function buildBatchNameKeys(detected: DetectedCreature[], species: SpeciesDefinition[]): Set<string> {
  const keys = new Set<string>()
  for (const d of detected) {
    const speciesId = resolveSpecies(d.actorClassName, species)?.id
    if (speciesId) keys.add(`${speciesId}:${d.name}`)
  }
  return keys
}

/** Classifies each detected creature against current app data. */
export function buildRows(detected: DetectedCreature[], data: AppData): CreatureRow[] {
  const byNameKey = buildNameIndex(data.animals)
  const batchNameKeys = buildBatchNameKeys(detected, data.species)
  const parentWillResolve = (speciesId: string, name: string): boolean =>
    resolveParentId(byNameKey, speciesId, name) !== null || (!!name && batchNameKeys.has(`${speciesId}:${name}`))

  return detected.map((d) => {
    const speciesId = resolveSpecies(d.actorClassName, data.species)?.id ?? null
    if (!speciesId) {
      return { detected: d, speciesId: null, existing: null, action: 'add', changes: [], conflicts: [] }
    }
    const existing = findExisting(d, speciesId, data.animals)
    if (!existing) {
      return { detected: d, speciesId, existing: null, action: 'add', changes: [], conflicts: [] }
    }

    const conflicts: FieldChange[] = []
    if (statsDiffer(existing.stats, d.stats).length > 0) {
      conflicts.push({ field: 'Stats', from: existing.stats, to: d.stats })
    }
    if (d.bloodline && d.bloodline !== existing.bloodline) {
      conflicts.push({ field: 'Bloodline', from: existing.bloodline, to: d.bloodline })
    }
    if (d.sex && d.sex !== existing.sex) {
      conflicts.push({ field: 'Sex', from: existing.sex, to: d.sex })
    }

    const changes: FieldChange[] = []
    if (d.name !== existing.name) changes.push({ field: 'Name', from: existing.name, to: d.name })
    if (existing.gameActorId == null && d.gameActorId != null) {
      changes.push({ field: 'Linked to save file', from: null, to: d.gameActorId })
    }
    if (existing.sireId === null && parentWillResolve(speciesId, d.fatherName)) {
      changes.push({ field: 'Sire', from: 'Wild Caught', to: d.fatherName })
    }
    if (existing.damId === null && parentWillResolve(speciesId, d.motherName)) {
      changes.push({ field: 'Dam', from: 'Wild Caught', to: d.motherName })
    }

    if (conflicts.length > 0) return { detected: d, speciesId, existing, action: 'conflict', changes, conflicts }
    if (changes.length > 0) return { detected: d, speciesId, existing, action: 'update', changes, conflicts }
    return { detected: d, speciesId, existing, action: 'unchanged', changes, conflicts }
  })
}

export interface RowDecision {
  row: CreatureRow
  include: boolean
  /** Required when row.action === 'conflict' and include is true. */
  conflictResolution?: 'replace' | 'append'
}

/**
 * Builds the full list of Animal upserts for a batch of decisions. Resolving
 * Sire/Dam names happens in two passes so a parent and child arriving in the
 * same file link up on this import, not just on a later re-import: first
 * every included row is assigned the id it will end up with (existing id, or
 * a freshly minted one), then a second pass resolves Mother/FatherName
 * against tracked animals plus every id assigned in the first pass.
 */
export function applyRows(
  data: AppData,
  decisions: RowDecision[],
  newId: () => string,
  targetProspectId: string | null
): Animal[] {
  const batchIndex = buildNameIndex(data.animals)
  const included = decisions.filter(
    ({ row, include, conflictResolution }) =>
      include && row.speciesId && row.action !== 'unchanged' && (row.action !== 'conflict' || conflictResolution)
  )

  const ids = included.map(({ row, conflictResolution }) => {
    const id = row.action === 'conflict' && conflictResolution === 'append' ? newId() : (row.existing?.id ?? newId())
    batchIndex.set(`${row.speciesId}:${row.detected.name}`, id)
    return id
  })

  const resolveParent = (name: string, speciesId: string): string | null => resolveParentId(batchIndex, speciesId, name)
  const upserts: Animal[] = []

  included.forEach(({ row, conflictResolution }, i) => {
    const speciesId = row.speciesId as string
    const d = row.detected
    const id = ids[i]

    if (row.action === 'conflict') {
      if (!row.existing) return
      if (conflictResolution === 'replace') {
        const replaced: Animal = {
          ...row.existing,
          name: d.name,
          sex: d.sex ?? row.existing.sex,
          bloodline: (d.bloodline ?? row.existing.bloodline) as Bloodline,
          stats: d.stats,
          gameActorId: d.gameActorId ?? row.existing.gameActorId
        }
        upserts.push(replaced)
      } else if (conflictResolution === 'append') {
        upserts.push({ ...row.existing, gameActorId: undefined })
        const appended: Animal = {
          id,
          speciesId,
          name: d.name,
          sex: d.sex ?? 'Female',
          sireId: resolveParent(d.fatherName, speciesId),
          damId: resolveParent(d.motherName, speciesId),
          bloodline: (d.bloodline ?? 'Wild') as Bloodline,
          phenotype: d.phenotype,
          stats: d.stats,
          status: 'active',
          prospectId: targetProspectId,
          gameActorId: d.gameActorId ?? undefined
        }
        upserts.push(appended)
      }
      return
    }

    const existing = row.existing
    const animal: Animal = existing
      ? {
          ...existing,
          name: d.name,
          gameActorId: d.gameActorId ?? existing.gameActorId,
          sireId: existing.sireId ?? resolveParent(d.fatherName, speciesId),
          damId: existing.damId ?? resolveParent(d.motherName, speciesId)
        }
      : {
          id,
          speciesId,
          name: d.name,
          sex: d.sex ?? 'Female',
          sireId: resolveParent(d.fatherName, speciesId),
          damId: resolveParent(d.motherName, speciesId),
          bloodline: (d.bloodline ?? 'Wild') as Bloodline,
          phenotype: d.phenotype,
          stats: d.stats,
          status: 'active',
          prospectId: targetProspectId,
          gameActorId: d.gameActorId ?? undefined
        }
    upserts.push(animal)
  })

  return upserts
}
