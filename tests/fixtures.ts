import type { GoogleFamily, LocalFace, LocalFamily } from '@shared/types'

export function face(overrides: Partial<LocalFace> = {}): LocalFace {
  return {
    id: 'id',
    filePath: '/Library/Fonts/Test.ttf',
    collectionIndex: null,
    format: 'ttf',
    source: 'local',
    removable: false,
    familyName: 'Test',
    styleName: 'Regular',
    postscriptName: 'Test-Regular',
    weight: 400,
    italic: false,
    width: 5,
    isVariable: false,
    hiddenSystemFont: false,
    duplicateFaceIds: [],
    installedByLettra: false,
    fileSize: 1000,
    ...overrides,
  }
}

export function family(faces: LocalFace[], overrides: Partial<LocalFamily> = {}): LocalFamily {
  return {
    key: 'test',
    name: 'Test',
    faces,
    sources: ['local'],
    removable: false,
    hasDuplicates: false,
    hidden: false,
    ...overrides,
  }
}

export function google(overrides: Partial<GoogleFamily> = {}): GoogleFamily {
  return {
    key: 'inter',
    family: 'Inter',
    category: 'sans-serif',
    variants: ['400', '700'],
    axes: [],
    subsets: ['latin'],
    primaryScript: '',
    designers: [],
    popularity: 1,
    dateAdded: '',
    lastModified: '',
    ...overrides,
  }
}
