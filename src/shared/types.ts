export const STAT_NAMES = [
  'vigor',
  'fitness',
  'physique',
  'reflex',
  'toughness',
  'adaptation',
  'instinct'
] as const

export type StatName = (typeof STAT_NAMES)[number]

export type Stats = Record<StatName, number>

export const BLOODLINES = [
  'Alpha',
  'Ambitious',
  'Bold',
  'Brave',
  'Careful',
  'Hardy',
  'Resolute',
  'Stout',
  'Savage',
  'Timid',
  'Unstable',
  'Wild'
] as const

export type Bloodline = (typeof BLOODLINES)[number]

export type Sex = 'Male' | 'Female'

export type AnimalStatus = 'active' | 'retired' | 'deceased'

export interface ScoreConfig {
  statWeights: Record<StatName, number>
  constant: number
  bloodlineBonuses: Partial<Record<Bloodline, number>>
  // Keyed by the exact Phenotype text (case-sensitive). The base/blank
  // phenotype (stored as `null` on Animal) is not addressable here.
  phenotypeBonuses: Record<string, number>
}

export function phenotypeKey(phenotype: string | null): string {
  return phenotype ?? ''
}

export interface Classification {
  id: string
  name: string
  scoreConfig: ScoreConfig
}

export interface SpeciesDefinition {
  id: string
  name: string
  classificationId: string
  // Game save actor class names (e.g. "BP_Tamed_Wolf_C") the user has
  // confirmed map to this Species, so re-imports don't ask again.
  gameClassNames?: string[]
}

export interface Prospect {
  id: string
  name: string
}

export interface Animal {
  id: string
  speciesId: string
  name: string
  sex: Sex
  sireId: string | null
  damId: string | null
  bloodline: Bloodline
  phenotype: string | null
  stats: Stats
  status?: AnimalStatus
  prospectId: string | null
  // Stable in-game actor id (IcarusActorGUID), set on import from a save
  // file - lets re-imports recognize "this is the same creature" instead of
  // creating a duplicate. Absent for hand-entered animals.
  gameActorId?: number
}

export interface AppData {
  schemaVersion: number
  species: SpeciesDefinition[]
  classifications: Classification[]
  prospects: Prospect[]
  animals: Animal[]
}

// Starter set covering the common Icarus breeding roles. Users can rename,
// edit, delete, or add their own beyond these.
export const BUILTIN_CLASSIFICATION_NAMES = [
  'Combat Pet',
  'Combat Mount',
  'Swift Mount',
  'Pack Animal',
  'Ranch Animal',
  'House Pet'
] as const

export function defaultScoreConfig(): ScoreConfig {
  return {
    statWeights: {
      vigor: 1,
      fitness: 1,
      physique: 1,
      reflex: 1,
      toughness: 1,
      adaptation: 1,
      instinct: 1
    },
    constant: 0,
    bloodlineBonuses: {},
    phenotypeBonuses: {}
  }
}

// Icarus mechanics don't allow every stat to max out on one animal — one stat
// has to be sacrificed (weight -1) so the rest can reach 10.
export function dumpStatScoreConfig(dumpStat: StatName): ScoreConfig {
  return {
    ...defaultScoreConfig(),
    statWeights: Object.fromEntries(STAT_NAMES.map((s) => [s, s === dumpStat ? -1 : 1])) as Record<StatName, number>
  }
}

// Default dump stat + bonuses for each built-in Classification, reasoned from
// each role (see STAT_DESCRIPTIONS in descriptions.ts) and cross-checked
// against the Icarus wiki (Fitness/Stamina only matters on Mounts; Instinct
// governs mount cargo / wool-egg-milk output, so it's dead weight on
// anything that isn't a utility mount or farm animal). Bloodline picks are
// reasoned from BLOODLINE_DESCRIPTIONS' actual mechanical effects, not just
// rarity. Shared by seedData.ts (fresh installs) and validation.ts
// (backfilling built-ins missing from a migrated save) so the two can't
// drift apart.
export const BUILTIN_CLASSIFICATION_SCORE_CONFIGS: Record<(typeof BUILTIN_CLASSIFICATION_NAMES)[number], ScoreConfig> = {
  // Instinct (utility output) is irrelevant on a non-mount combat companion.
  // Alpha (+size/melee/health growth) and Savage (lifesteal, offsetting its
  // own regen penalty) are the rare, combat-favoring bloodlines.
  'Combat Pet': { ...dumpStatScoreConfig('instinct'), constant: 10, bloodlineBonuses: { Alpha: 8, Savage: 4 } },
  // Same reasoning as Combat Pet — cargo/utility isn't the point of a mount built to fight.
  'Combat Mount': { ...dumpStatScoreConfig('instinct'), bloodlineBonuses: { Alpha: 8, Savage: 4 } },
  // A pure speed mount isn't meant to fight or haul heavy cargo. Timid trades
  // away melee damage (already deprioritized) for +movement speed/level —
  // a direct match for the role.
  'Swift Mount': { ...dumpStatScoreConfig('physique'), bloodlineBonuses: { Timid: 6 } },
  // Kept out of danger while hauling, so health matters least (also has the
  // smallest HP swing of any stat, per community breeding guides — cheap to
  // sacrifice). Stout's +weight capacity per level is the role's whole point.
  'Pack Animal': { ...dumpStatScoreConfig('vigor'), bloodlineBonuses: { Stout: 6 } },
  // Not a fighter or a mount — melee damage/carry capacity matters least next
  // to Instinct, its actual output. Careful's -perceived-threat keeps
  // stationary livestock safer without needing combat stats.
  'Ranch Animal': { ...dumpStatScoreConfig('physique'), bloodlineBonuses: { Careful: 6 } },
  // No utility role at all, so Instinct is the clearest dump stat. Ambitious
  // (+50% XP, no growth stats) suits a low-stakes companion you just want to
  // level painlessly rather than min-max.
  'House Pet': { ...dumpStatScoreConfig('instinct'), bloodlineBonuses: { Ambitious: 6 } }
}

// Starter Species per built-in Classification, reasoned from the Icarus
// wiki (see BUILTIN_CLASSIFICATION_SCORE_CONFIGS above for the role
// reasoning). Shared by seedData.ts (fresh installs) and SpeciesEditor's
// "Set to Default" (resets an existing Species' Classification back to this
// if its name matches one of these templates).
export interface BuiltinSpeciesTemplate {
  name: string
  classificationName: (typeof BUILTIN_CLASSIFICATION_NAMES)[number]
}

export const BUILTIN_SPECIES_TEMPLATES: BuiltinSpeciesTemplate[] = [
  // Combat Pet — non-mount hunting companions (Snare Trap + bait tames).
  { name: 'Wolves', classificationName: 'Combat Pet' },
  { name: 'Snow Wolves', classificationName: 'Combat Pet' },
  { name: 'Wild Boars', classificationName: 'Combat Pet' },
  { name: 'Hyenas', classificationName: 'Combat Pet' },
  // Combat Mount — Tuskers have the highest health/regen/carry of any
  // mount, built to tank rather than haul or race.
  { name: 'Tuskers', classificationName: 'Combat Mount' },
  // Swift Mount — Moa-family speed mounts.
  { name: 'Moas', classificationName: 'Swift Mount' },
  { name: 'Arctic Moas', classificationName: 'Swift Mount' },
  { name: 'Ubis', classificationName: 'Swift Mount' },
  // Pack Animal — Buffalo, Terrenus, and Woolly Mammoths all prioritize carry capacity.
  { name: 'Buffalos', classificationName: 'Pack Animal' },
  { name: 'Terrenus', classificationName: 'Pack Animal' },
  { name: 'Woolly Mammoths', classificationName: 'Pack Animal' },
  // Ranch Animal — Homestead livestock (eggs/wool/milk).
  { name: 'Chickens', classificationName: 'Ranch Animal' },
  { name: 'Sheep', classificationName: 'Ranch Animal' },
  { name: 'Cows', classificationName: 'Ranch Animal' },
  // House Pet — cosmetic companions, no combat/utility role.
  { name: 'Cats', classificationName: 'House Pet' }
]

export function emptyStats(): Stats {
  return {
    vigor: 0,
    fitness: 0,
    physique: 0,
    reflex: 0,
    toughness: 0,
    adaptation: 0,
    instinct: 0
  }
}
