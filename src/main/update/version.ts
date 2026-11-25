// "v1.2.3-beta.1" -> [1, 2, 3]. Pre-release suffixes are ignored.
const parts = (v: string): number[] =>
  v
    .replace(/^v/, '')
    .split('-')[0]!
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)

/** a > b for x.y.z versions. */
export function isNewer(a: string, b: string): boolean {
  const pa = parts(a)
  const pb = parts(b)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}
