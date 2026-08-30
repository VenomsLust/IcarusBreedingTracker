import type { ExtractedCreature } from './ueBinary'
import type { DetectedCreature, ImportSource } from './types'
import { mapBloodline, mapGeneticsToStats, mapSex } from './mapping'

export function toDetectedCreature(
  extracted: ExtractedCreature,
  source: ImportSource,
  sourceProspectGameId: string | null
): DetectedCreature | null {
  if (!extracted.mountName) return null

  const variation = extracted.variation ?? 0
  return {
    gameActorId: extracted.gameActorId,
    name: extracted.mountName,
    actorClassName: extracted.actorClassName,
    sex: mapSex(extracted.sex),
    stats: mapGeneticsToStats(extracted.genetics),
    bloodline: mapBloodline(extracted.lineage),
    phenotype: variation === 0 ? null : `Variation ${variation}`,
    motherName: extracted.motherName,
    fatherName: extracted.fatherName,
    isWildTame: extracted.bIsWildTame,
    source,
    sourceProspectGameId
  }
}
