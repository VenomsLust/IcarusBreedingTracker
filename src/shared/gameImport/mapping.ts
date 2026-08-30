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
