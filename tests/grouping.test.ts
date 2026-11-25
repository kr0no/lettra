import { describe, expect, it } from 'vitest'
import type { ScannedFile } from '../src/main/local/scanner'
import { buildFaces, faceId, groupFamilies } from '../src/main/local/grouping'

type Parsed = ScannedFile['faces'][number]

const parsed = (overrides: Partial<Parsed>): Parsed =>
  ({
    collectionIndex: null,
    familyName: 'Test',
    styleName: 'Regular',
    postscriptName: 'Test-Regular',
    weight: 400,
    italic: false,
    width: 5,
    isVariable: false,
    ...overrides,
  }) as Parsed

const file = (path: string, faces: Parsed[], source: 'user' | 'system' = 'user'): ScannedFile =>
  ({
    path,
    mtimeMs: 1,
    size: 1,
    format: 'ttf',
    faces,
    root: { path: '/', source, removable: source === 'user' },
  }) as unknown as ScannedFile

describe('faceId', () => {
  it('is stable and depends on the collection index', () => {
    expect(faceId('/a.ttc', 0)).toBe(faceId('/a.ttc', null))
    expect(faceId('/a.ttc', 1)).not.toBe(faceId('/a.ttc', 0))
    expect(faceId('/a.ttc', 1)).toHaveLength(16)
  })

  it('changes when the file changes', () => {
    expect(faceId('/a.ttf', null, '1:100')).not.toBe(faceId('/a.ttf', null, '2:100'))
  })
})

describe('buildFaces', () => {
  const faces = buildFaces(
    [
      file('/u/A.ttf', [parsed({ postscriptName: 'A-Regular', familyName: 'A' })]),
      file('/s/A.ttf', [parsed({ postscriptName: 'A-Regular', familyName: 'A' })], 'system'),
      file('/s/Hidden.ttf', [parsed({ postscriptName: '.SFNS-Regular', familyName: '.SF NS' })], 'system'),
    ],
    (path) => path === '/u/A.ttf',
  )

  it('links faces that share a PostScript name', () => {
    expect(faces[0]!.duplicateFaceIds).toEqual([faces[1]!.id])
    expect(faces[1]!.duplicateFaceIds).toEqual([faces[0]!.id])
    expect(faces[2]!.duplicateFaceIds).toEqual([])
  })

  it('marks hidden system faces, ownership and removability', () => {
    expect(faces[2]!.hiddenSystemFont).toBe(true)
    expect(faces[0]!.installedByLettra).toBe(true)
    expect(faces[1]!.installedByLettra).toBe(false)
    expect(faces[0]!.removable).toBe(true)
    expect(faces[1]!.removable).toBe(false)
  })
})

describe('groupFamilies', () => {
  const faces = buildFaces([
    file('/u/b.ttf', [parsed({ familyName: 'beta', postscriptName: 'beta-Bold', weight: 700 })]),
    file('/u/b2.ttf', [parsed({ familyName: 'Beta', postscriptName: 'Beta-Regular' })]),
    file('/u/b3.ttf', [parsed({ familyName: 'Beta', postscriptName: 'Beta-Italic', italic: true })]),
    file('/s/a.ttf', [parsed({ familyName: 'Alpha', postscriptName: 'Alpha-Regular' })], 'system'),
  ])
  const families = groupFamilies(faces)

  it('groups case-insensitively and sorts by name', () => {
    expect(families.map((f) => f.name)).toEqual(['Alpha', 'Beta'])
  })

  it('uses the most common spelling and sorts styles upright first by weight', () => {
    const beta = families[1]!
    expect(beta.faces.map((f) => f.postscriptName)).toEqual(['Beta-Regular', 'beta-Bold', 'Beta-Italic'])
    expect(beta.sources).toEqual(['user'])
    expect(beta.removable).toBe(true)
  })
})
