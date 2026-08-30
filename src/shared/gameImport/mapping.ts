import type { Bloodline, Sex, StatName, Stats } from '../types'
import { BLOODLINES, emptyStats } from '../types'
import type { RawGenetics } from './ueBinary'

// The game's internal genetics field names map 1:1 (by position and theme -
// Endurance~Stamina, Muscle~melee/carry, Agility~movement speed,
// Hardiness~environmental resistance, Utility~utility output, same word) to
// our app's stat names.
const GENETIC_NAME_TO_STAT: Record<string, StatName> = {
  Vitality: 'vigor',
  Endurance: 'fitness',
  Muscle: 'physique',
  Agility: 'reflex',
  Toughness: 'toughness',
  Hardiness: 'adaptation',
  Utility: 'instinct'
}

export function mapGeneticsToStats(genetics: RawGenetics | null): Stats {
  const stats = emptyStats()
  if (!genetics) return stats
  for (const [geneticName, value] of Object.entries(genetics)) {
    const stat = GENETIC_NAME_TO_STAT[geneticName]
    if (stat) stats[stat] = Math.max(0, Math.min(10, Math.round(value)))
  }
  return stats
}

// Confirmed by cross-referencing real named animals against their known Sex.
export function mapSex(rawSex: number | null): Sex | null {
  if (rawSex === 1) return 'Female'
  if (rawSex === 2) return 'Male'
  return null
}

export function mapBloodline(lineage: string | null): Bloodline | null {
  if (!lineage) return null
  return (BLOODLINES as readonly string[]).includes(lineage) ? (lineage as Bloodline) : null
}

// Raw save-file actor class names mapped to the built-in Species name (see
// BUILTIN_SPECIES_TEMPLATES in types.ts) they belong to, so a fresh import
// of these common creatures doesn't need manual class-name mapping. Ram and
// Sheep share one entry: they're the same breeding species, just displayed
// by in-game sex. Entries are either confirmed against a real save file
// directly, or cross-referenced from github.com/jodagreyhame/icarus-mount-editor's
// reverse-engineering notes (which independently agreed with every entry
// this project had already confirmed first-hand).
// Extend this as more real class names get confirmed - never guess one in,
// since a wrong entry would silently misclassify a whole species.
export const KNOWN_CLASS_NAME_SPECIES: Record<string, string> = {
  BP_Tamed_Wolf_C: 'Wolves',
  BP_Tame_Sheep_C: 'Sheep',
  BP_Tame_Ram_C: 'Sheep',
  BP_Tame_Boar_C: 'Wild Boars',
  BP_Tame_Dog_D2_C: 'Dogs',
  BP_Tame_Pig_C: 'Pigs',
  BP_Mount_Buffalo_C: 'Buffalos',
  BP_Mount_Horse_C: 'Terrenus',
  BP_Mount_Moa_C: 'Moas',
  BP_Mount_Arctic_Moa_C: 'Arctic Moas',
  BP_Mount_Tusker_C: 'Tuskers',
  BP_Mount_WoollyMammoth_C: 'Woolly Mammoths',
  BP_Mount_SwampBird_C: 'Swamp Birds',
  BP_Mount_Raptor_C: 'Raptors',
  BP_Mount_Slinker_C: 'Slinkers',
  BP_Mount_Zebra_C: 'Zebras',
  BP_Mount_Wooly_Zebra_C: 'Woolly Zebras',
  BP_Mount_Horse_Standard_C: 'Horses'
}
