import { extractCreature } from './ueBinary'
import { toDetectedCreature } from './toDetectedCreature'
import type { DetectedCreature } from './types'

interface MountsJsonEntry {
  RecorderBlob?: {
    BinaryData?: number[]
  }
}

interface MountsJson {
  SavedMounts?: MountsJsonEntry[]
}

/** Parses a Mounts.json file's text content - every entry here is parked at the Station. */
export function parseMountsFile(text: string): DetectedCreature[] {
  const raw = JSON.parse(text) as MountsJson
  if (!Array.isArray(raw.SavedMounts)) {
    throw new Error('This does not look like a Mounts.json file (missing SavedMounts).')
  }

  const creatures: DetectedCreature[] = []
  for (const entry of raw.SavedMounts) {
    const bytes = entry.RecorderBlob?.BinaryData
    if (!Array.isArray(bytes)) continue
    const buf = new Uint8Array(bytes)
    const extracted = extractCreature(buf, 0, buf.length)
    const detected = toDetectedCreature(extracted, 'station', null)
    if (detected) creatures.push(detected)
  }
  return creatures
}
