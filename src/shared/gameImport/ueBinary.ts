// Reverse-engineered Icarus/Unreal creature-recorder binary property format,
// as embedded in Mounts.json's RecorderBlob.BinaryData and (once decompressed)
// a Prospect save's ProspectBlob "actors" data.
//
// Leaf properties (Int/UInt32/Float/Bool/Str/Name/Enum) are laid out as
// [Size:Int64][flag byte][value bytes] after their name+type headers.
// Container properties (StructProperty, ArrayProperty) have no flag byte —
// their payload follows the Size field immediately. An ArrayProperty of
// StructProperty packages ALL of its elements inside one wrapper tag (same
// field name repeated, type=StructProperty) whose value is
// [structTypeName][16-byte guid][pad byte][elements as back-to-back
// self-terminating property lists] — this holds regardless of element count.
//
// This is deliberately a *targeted* extractor, not a general-purpose walker:
// it locates specific named fields by byte-pattern search within a known
// creature record range, using the leaf/array decoding rules above. Fields
// we don't care about (Talents, inventory, transform, etc.) are never
// visited, sidestepping edge cases in constructs this file doesn't decode.

export interface RawGenetics {
  [statName: string]: number
}

export interface ExtractedCreature {
  mountName: string | null
  ownerName: string | null
  actorClassName: string | null
  gameActorId: number | null
  bIsWildTame: boolean | null
  sex: number | null
  variation: number | null
  lineage: string | null
  motherName: string
  fatherName: string
  genetics: RawGenetics | null
}

function readInt32(buf: Uint8Array, pos: number): number {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getInt32(pos, true)
}

function readUInt32(buf: Uint8Array, pos: number): number {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(pos, true)
}

function readFloat(buf: Uint8Array, pos: number): number {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getFloat32(pos, true)
}

const textDecoder = new TextDecoder('utf-8')

function readName(buf: Uint8Array, pos: number): { value: string; pos: number } {
  const len = readInt32(buf, pos)
  if (len <= 0) return { value: '', pos: pos + 4 }
  const value = textDecoder.decode(buf.subarray(pos + 4, pos + 4 + len - 1))
  return { value, pos: pos + 4 + len }
}

function nameBytes(s: string): Uint8Array {
  const strBytes = new TextEncoder().encode(s + '\0')
  const out = new Uint8Array(4 + strBytes.length)
  new DataView(out.buffer).setInt32(0, strBytes.length, true)
  out.set(strBytes, 4)
  return out
}

// Uint8Array has no native indexOf-for-subsequence; a small naive search is
// plenty fast enough for these file sizes (tens of MB at most).
function findBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  const end = haystack.length - needle.length
  outer: for (let i = Math.max(from, 0); i <= end; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function findBytesBefore(haystack: Uint8Array, needle: Uint8Array, before: number): number {
  const limit = Math.min(before, haystack.length - needle.length)
  outer: for (let i = limit; i >= 0; i--) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function readLeafValue(buf: Uint8Array, type: string, afterType: number): number | string | boolean | null {
  const valueStart = afterType + 8 + 1 // size:8 + flag:1
  switch (type) {
    case 'IntProperty':
      return readInt32(buf, valueStart)
    case 'UInt32Property':
      return readUInt32(buf, valueStart)
    case 'FloatProperty':
      return readFloat(buf, valueStart)
    case 'BoolProperty':
      return buf[afterType + 8] !== 0 // bool value sits where the flag byte would be
    case 'StrProperty':
    case 'NameProperty':
      return readName(buf, valueStart).value
    default:
      return null
  }
}

interface FlatPropertyListResult {
  props: Record<string, number | string | boolean | null>
  pos: number
}

// Reads a self-terminating property list of simple leaf fields (e.g. one
// Genetics element: {GeneticValueName, Value}). Stops at "None".
function readFlatPropertyList(buf: Uint8Array, pos: number): FlatPropertyListResult {
  const props: Record<string, number | string | boolean | null> = {}
  for (;;) {
    const { value: name, pos: p1 } = readName(buf, pos)
    if (name === 'None' || name === '') {
      pos = p1
      break
    }
    const { value: type, pos: p2 } = readName(buf, p1)
    const size = readInt32(buf, p2)
    const valueStart = p2 + 8 + 1
    props[name] = readLeafValue(buf, type, p2)
    pos = valueStart + size
  }
  return { props, pos }
}

// Reads an ArrayProperty<StructProperty> value given the position right
// after the "ArrayProperty" type name. See module doc comment for the wire
// format this decodes.
function readStructArray(buf: Uint8Array, afterType: number): { items: Record<string, unknown>[]; end: number } {
  const valueStart = afterType + 8
  const { value: innerType, pos: p1 } = readName(buf, valueStart)
  const items: Record<string, unknown>[] = []
  if (innerType !== 'StructProperty') return { items, end: p1 }
  const count = readInt32(buf, p1 + 1) // extra pad byte before count
  const wrapperStart = p1 + 1 + 4
  const { pos: afterWrapperName } = readName(buf, wrapperStart) // wrapper's own field name
  const { pos: afterWrapperType } = readName(buf, afterWrapperName) // 'StructProperty'
  const wrapperSize = readInt32(buf, afterWrapperType)
  const wrapperValueStart = afterWrapperType + 8
  const wrapperEnd = wrapperValueStart + wrapperSize
  const { pos: structContentStart } = readName(buf, wrapperValueStart) // real struct type name
  let cur = structContentStart + 16 + 1 // skip struct guid + extra pad byte
  for (let i = 0; i < count; i++) {
    const { props, pos } = readFlatPropertyList(buf, cur)
    items.push(props)
    cur = pos
  }
  return { items, end: wrapperEnd }
}

function findLeaf(
  buf: Uint8Array,
  fieldName: string,
  type: string,
  from: number,
  to: number
): number | string | boolean | null {
  const needle = concatBytes(nameBytes(fieldName), nameBytes(type))
  const idx = findBytes(buf, needle, from)
  if (idx === -1 || idx >= to) return null
  return readLeafValue(buf, type, idx + needle.length)
}

// Finds the LAST occurrence at or before `before` - used for fields
// duplicated inside ChildDNA (a not-yet-born-offspring placeholder) earlier
// in the record; the real (topmost) copy is the one closest to `before`.
function findLeafLast(
  buf: Uint8Array,
  fieldName: string,
  type: string,
  before: number
): number | string | boolean | null {
  const needle = concatBytes(nameBytes(fieldName), nameBytes(type))
  const idx = findBytesBefore(buf, needle, before)
  if (idx === -1) return null
  return readLeafValue(buf, type, idx + needle.length)
}

function findGenetics(buf: Uint8Array, fieldName: string, from: number, to: number): RawGenetics | null {
  const needle = concatBytes(nameBytes(fieldName), nameBytes('ArrayProperty'))
  const idx = findBytes(buf, needle, from)
  if (idx === -1 || idx >= to) return null
  const { items } = readStructArray(buf, idx + needle.length)
  const stats: RawGenetics = {}
  for (const item of items) {
    const name = item.GeneticValueName
    const value = item.Value
    if (typeof name === 'string' && typeof value === 'number') stats[name] = value
  }
  return stats
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/**
 * Extracts one creature's fields from its byte segment [start, end) within
 * a larger buffer (a Mounts.json entry's whole BinaryData, or one segment
 * of a decompressed Prospect actors blob).
 */
export function extractCreature(buf: Uint8Array, start: number, end: number): ExtractedCreature {
  // Sex/Variation live before ChildDNA. Lineage/MotherName/FatherName are
  // duplicated *inside* ChildDNA too, but the real (topmost) copy comes
  // right after it closes, anchored here by the FoodLevel field that follows.
  const childDnaIdx = findBytes(buf, nameBytes('ChildDNA'), start)
  const ownFieldsEnd = childDnaIdx !== -1 && childDnaIdx < end ? childDnaIdx : end
  const foodLevelIdx = findBytes(buf, nameBytes('FoodLevel'), start)
  const lineageFieldsBefore = foodLevelIdx !== -1 && foodLevelIdx < end ? foodLevelIdx : end

  const guidNeedle = concatBytes(nameBytes('IcarusActorGUID'), nameBytes('IntProperty'))
  const guidIdx = findBytes(buf, guidNeedle, start)
  const gameActorId =
    guidIdx !== -1 && guidIdx < end ? (readLeafValue(buf, 'IntProperty', guidIdx + guidNeedle.length) as number) : null

  const classNeedle = concatBytes(nameBytes('ActorClassName'), nameBytes('NameProperty'))
  const classIdx = findBytes(buf, classNeedle, start)
  const actorClassName =
    classIdx !== -1 && classIdx < end
      ? (readLeafValue(buf, 'NameProperty', classIdx + classNeedle.length) as string)
      : null

  // bIsWildTame lives in a BoolVariables[] element: {VariableName:"bIsWildTame", bVariable:<bool>}.
  const wildTameIdx = findBytes(buf, nameBytes('bIsWildTame'), start)
  let bIsWildTame: boolean | null = null
  if (wildTameIdx !== -1 && wildTameIdx < end) {
    const bvNeedle = concatBytes(nameBytes('bVariable'), nameBytes('BoolProperty'))
    const bvIdx = findBytes(buf, bvNeedle, wildTameIdx)
    if (bvIdx !== -1 && bvIdx < wildTameIdx + 200) {
      bIsWildTame = Boolean(readLeafValue(buf, 'BoolProperty', bvIdx + bvNeedle.length))
    }
  }

  return {
    mountName: findLeaf(buf, 'MountName', 'StrProperty', start, end) as string | null,
    ownerName: findLeaf(buf, 'OwnerName', 'StrProperty', start, end) as string | null,
    actorClassName,
    gameActorId,
    bIsWildTame,
    sex: findLeaf(buf, 'Sex', 'IntProperty', start, ownFieldsEnd) as number | null,
    variation: findLeaf(buf, 'Variation', 'IntProperty', start, ownFieldsEnd) as number | null,
    lineage: findLeafLast(buf, 'Lineage', 'NameProperty', lineageFieldsBefore) as string | null,
    motherName: (findLeafLast(buf, 'MotherName', 'StrProperty', lineageFieldsBefore) as string | null) ?? '',
    fatherName: (findLeafLast(buf, 'FatherName', 'StrProperty', lineageFieldsBefore) as string | null) ?? '',
    genetics: findGenetics(buf, 'Genetics', start, ownFieldsEnd)
  }
}

/**
 * Splits a buffer containing back-to-back creature records into segments,
 * using each "MountName" field occurrence as a segment boundary (every
 * tamed creature - mount or pet alike - carries exactly one).
 */
export function segmentCreatures(buf: Uint8Array): Array<{ start: number; end: number }> {
  const needle = nameBytes('MountName')
  const starts: number[] = []
  let idx = 0
  for (;;) {
    idx = findBytes(buf, needle, idx)
    if (idx === -1) break
    starts.push(idx)
    idx += needle.length
  }
  return starts.map((s, i) => ({ start: s, end: i + 1 < starts.length ? starts[i + 1] : buf.length }))
}
