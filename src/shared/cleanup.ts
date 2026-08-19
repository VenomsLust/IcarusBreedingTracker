import type { Animal } from './types'

// Deceased animals that no other animal references as sire or dam. These carry no
// pedigree information worth keeping, so they're safe to bulk-delete without the
// "reference nulled out on delete" side effect losing anything.
export function findRemovableDeceased(animals: Animal[]): Animal[] {
  const referenced = new Set<string>()
  for (const a of animals) {
    if (a.sireId) referenced.add(a.sireId)
    if (a.damId) referenced.add(a.damId)
  }
  return animals.filter((a) => a.status === 'deceased' && !referenced.has(a.id))
}
