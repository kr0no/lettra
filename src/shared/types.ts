// Types shared by main, preload and renderer. Keep this file free of runtime imports.

export type FontSource = 'user' | 'local' | 'system' | 'apple-asset'
export type FontFormat = 'ttf' | 'otf' | 'ttc' | 'otc' | 'dfont' | 'woff' | 'woff2'
/** Normalized family name; the same key is used for local and Google families. */
export type FamilyKey = string

export interface VariationAxis {
  tag: string
  name: string
  min: number
  default: number
  max: number
}

export interface NamedInstance {
  name: string
  coordinates: Record<string, number>
}

export interface LocalFace {
  /** Hash of file path, collection index, mtime and size: changes when the file is rewritten. */
  id: string
  filePath: string
  /** Index inside a .ttc/.otc/.dfont, or null for single-font files. */
  collectionIndex: number | null
  format: FontFormat
  source: FontSource
  /** True only for files under ~/Library/Fonts. */
  removable: boolean
  /** Typographic family (nameID 16), falling back to nameID 1. */
  familyName: string
  /** Typographic subfamily (nameID 17), falling back to nameID 2. */
  styleName: string
  postscriptName: string
  /** OS/2 usWeightClass, 1-1000. */
  weight: number
  italic: boolean
  /** OS/2 usWidthClass, 1-9 (5 = normal). */
  width: number
  isVariable: boolean
  axes?: VariationAxis[]
  instances?: NamedInstance[]
  version?: string
  designer?: string
  /** Dot-prefixed system faces such as .SFNS; not addressable by CSS name. */
  hiddenSystemFont: boolean
  /** Other faces with the same PostScript name. */
  duplicateFaceIds: string[]
  installedByLettra: boolean
  /** Bytes this face takes to load (the face alone for collection faces). */
  fileSize: number
}

export interface LocalFamily {
  key: FamilyKey
  name: string
  faces: LocalFace[]
  sources: FontSource[]
  /** At least one face can be uninstalled (lives in ~/Library/Fonts). */
  removable: boolean
  hasDuplicates: boolean
  /** Every face is a hidden system face. */
  hidden: boolean
}

export interface ScanStatus {
  state: 'idle' | 'scanning'
  /** Files parsed in this pass (cache misses). */
  parsed: number
  /** Files that needed parsing in this pass. */
  toParse: number
  totalFaces: number
  lastScanMs: number | null
}

export type Language = 'system' | 'en' | 'es'
export type Theme = 'system' | 'light' | 'dark'
export type InstallMode = 'static' | 'variable'
export type ViewMode = 'grid' | 'list'

export interface Settings {
  language: Language
  theme: Theme
  installMode: InstallMode
  offline: boolean
  googleApiKey?: string
  checkUpdates: boolean
  preview: { text: string; size: number; view: ViewMode }
}

// Google Fonts

export type GoogleCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace'
export const GOOGLE_CATEGORIES: readonly GoogleCategory[] = [
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
]

export interface GoogleFamily {
  key: FamilyKey
  family: string
  category: GoogleCategory
  /** Variant keys as Google names them: '400', '700i', '100'... sorted upright first, by weight. */
  variants: string[]
  axes: VariationAxis[]
  /** Subsets without Google's internal 'menu' subset. */
  subsets: string[]
  /** ISO 15924 script for non-Latin families ('Jpan', 'Arab'...), else ''. */
  primaryScript: string
  designers: string[]
  /** Popularity rank: 1 = most popular. */
  popularity: number
  dateAdded: string
  lastModified: string
}

export interface Catalog {
  families: GoogleFamily[]
  fetchedAt: string
  origin: 'network' | 'cache' | 'snapshot'
}

export type GoogleLicense = 'ofl' | 'apache' | 'ufl'

export interface GoogleFamilyInfo {
  license: GoogleLicense | null
  /** Variable font files in the google/fonts repo; empty when the family has none. */
  variableFiles: string[]
}

/** One @font-face from Google's CSS2 API, used for in-memory previews. */
export interface PreviewFace {
  url: string
  weight: string
  style: 'normal' | 'italic'
  unicodeRange?: string
}

export interface InstallRecord {
  key: FamilyKey
  family: string
  mode: InstallMode
  /** Folder Lettra created under ~/Library/Fonts. */
  dir: string
  files: string[]
  installedAt: string
  /** Catalog lastModified at install time; drives update detection. */
  lastModified: string
}

export interface InstallPlan {
  family: string
  /** Mode that will actually be used (variable falls back to static when there are no variable files). */
  mode: InstallMode
  fileCount: number
  /** A local family with the same name that Lettra didn't install. */
  conflict: { name: string; sources: FontSource[]; removableFaces: number } | null
  /** Lettra already installed this family (reinstall/update/mode switch replaces it). */
  replacesOwn: boolean
}

export type ConflictChoice = 'cancel' | 'install-anyway' | 'replace'

export interface InstallProgress {
  key: FamilyKey
  phase: 'resolving' | 'downloading' | 'verifying' | 'committing' | 'done' | 'error'
  done: number
  total: number
  error?: string
}

export interface GoogleUpdate {
  key: FamilyKey
  family: string
  installed: string
  latest: string
}

// Uninstall (local)

export type UninstallTarget = { familyKey: FamilyKey } | { faceIds: string[] }

export interface UninstallPlan {
  /** Files that will be moved to the Trash. */
  files: string[]
  /** Every face inside those files, including collection siblings not explicitly chosen. */
  faces: { id: string; name: string }[]
  /** True when removing a .ttc/.otc also removes faces that weren't selected. */
  collectionWarning: boolean
  /** Faces in the target that can't be removed (system or /Library). */
  readOnlyFaces: number
}

// Favorites & collections

export interface Collection {
  id: string
  name: string
  /** Family keys; a key can be a local family, a Google family, or both. */
  familyKeys: FamilyKey[]
}

export interface Library {
  favorites: FamilyKey[]
  collections: Collection[]
}

// Drag-and-drop install

export interface InstallFilesResult {
  installed: string[]
  skipped: { name: string; reason: 'not-a-font' | 'already-installed' | 'unreadable' }[]
}

/** Commands from the app menu to the window. */
export type AppCommand = 'settings' | 'find' | 'view-grid' | 'view-list'

// App updates

export interface AppUpdate {
  version: string
  /** Release page on GitHub. */
  url: string
  /** False when Lettra can't replace itself (see `blocker`); the user downloads it by hand. */
  canInstall: boolean
  blocker?: 'dev' | 'location' | 'no-zip'
}

export type UpdateProgress =
  | { phase: 'downloading'; received: number; total: number }
  | { phase: 'verifying' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string }
