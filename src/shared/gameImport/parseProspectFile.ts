import { extractCreature, segmentCreatures } from './ueBinary'
import { toDetectedCreature } from './toDetectedCreature'
import type { DetectedCreature } from './types'

interface ProspectJson {
  ProspectInfo?: { ProspectID?: string }
  ProspectBlob?: { BinaryBlob?: string }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream('deflate'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

export interface ParsedProspectFile {
  prospectGameId: string | null
  creatures: DetectedCreature[]
}

/** Parses a Prospect save file's text content - every creature here is deployed in that world. */
export async function parseProspectFile(text: string): Promise<ParsedProspectFile> {
  const raw = JSON.parse(text) as ProspectJson
  const blob = raw.ProspectBlob?.BinaryBlob
  if (!blob) {
    throw new Error('This does not look like an Icarus Prospect save file (missing ProspectBlob).')
  }
  const prospectGameId = raw.ProspectInfo?.ProspectID ?? null

  const compressed = base64ToBytes(blob)
  const inflated = await inflateZlib(compressed)

  const creatures: DetectedCreature[] = []
  for (const { start, end } of segmentCreatures(inflated)) {
    const extracted = extractCreature(inflated, start, end)
    const detected = toDetectedCreature(extracted, 'prospect', prospectGameId)
    if (detected) creatures.push(detected)
  }
  return { prospectGameId, creatures }
}
