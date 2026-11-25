import type { FamilyKey } from './types'

/** Normalizes a family name so local and Google entries for the same family match. */
export function familyKey(name: string): FamilyKey {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}
