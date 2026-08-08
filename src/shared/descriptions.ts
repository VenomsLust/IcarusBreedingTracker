import type { Bloodline, StatName } from './types'

export const BLOODLINE_DESCRIPTIONS: Record<Bloodline, string> = {
  Alpha: 'Rare (1.36%). +20% size, plus melee damage and health growth per level.',
  Ambitious: '+50% experience gained. No growth stats.',
  Bold: '-10 physical resistance. +max stamina every 2 levels.',
  Brave: '-10% max stamina. +melee damage every 2 levels.',
  Careful: '-10% movement speed. -1% perceived threat per level.',
  Hardy: '+10% food consumption. Enhanced health/stamina regeneration.',
  Resolute: 'Rare (3.4%). -10% max health. Improved stamina regen and fertilization recovery.',
  Stout: '+10% perceived threat. +weight capacity per level.',
  Savage: 'Rare (3.4%). -50% health regeneration. Chance to life-steal on attacks.',
  Timid: '-10% melee damage. +movement speed per level.',
  Unstable: 'Rare (3.4%). -50% fertilization recovery. +mutation chance.',
  Wild: 'Most common (40.8%). +5% water/food consumption. Minor hemorrhage chance on hits.'
}

// Community-sourced (not from official patch notes) — the wiki itself only
// says these range 0-10 with 3 as baseline, without documenting each one's
// effect. Worth double-checking against your own in-game experience.
export const STAT_DESCRIPTIONS: Record<StatName, string> = {
  vigor: 'Health.',
  fitness: 'Stamina.',
  physique: 'Melee damage and weight/carry capacity.',
  reflex: 'Movement speed.',
  toughness: 'Physical resistance (defense).',
  adaptation: 'Cold and heat resistance.',
  instinct: 'Utility output (mount cargo, wool/egg/milk production) — largely a "dead stat" on combat companions like wolves.'
}
