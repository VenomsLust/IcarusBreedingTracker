import type { Bloodline, Sex, Stats } from '../types'

export type ImportSource = 'station' | 'prospect'

// A creature as read out of a save file, before being matched/merged against
// anything already tracked in the app.
export interface DetectedCreature {
  gameActorId: number | null
  name: string
  actorClassName: string | null
  sex: Sex | null
  stats: Stats
  bloodline: Bloodline | null
  /** Raw phenotype/variation index from the save file - 0 means "Base"; we
   *  don't have a name mapping for nonzero values, so those surface as a
   *  plain "Variation N" placeholder the user can rename. */
  phenotype: string | null
  motherName: string
  fatherName: string
  isWildTame: boolean | null
  source: ImportSource
  /** The in-game Prospect ID (e.g. "Beastland") for prospect-sourced creatures. */
  sourceProspectGameId: string | null
}
