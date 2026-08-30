import { parseMountsFile } from './parseMountsFile'
import { parseProspectFile } from './parseProspectFile'
import type { DetectedCreature } from './types'

export interface ParsedSaveFile {
  creatures: DetectedCreature[]
  prospectGameId: string | null
}

/** Detects whether `text` is a Mounts.json (Station) or a Prospect save file, and parses accordingly. */
export async function parseSaveFile(text: string): Promise<ParsedSaveFile> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  if (raw && typeof raw === 'object' && 'SavedMounts' in raw) {
    return { creatures: parseMountsFile(text), prospectGameId: null }
  }
  if (raw && typeof raw === 'object' && 'ProspectBlob' in raw) {
    return parseProspectFile(text)
  }
  throw new Error("This doesn't look like a Mounts.json or Icarus Prospect save file.")
}
