export type Version = string | number
export enum VersionIs {
  LessThan = -1,
  EqualTo = 0,
  GreaterThan = 1,
}

/**
 * Compare two versions quickly.
 * @param current Is this version greater, equal to, or less than the other?
 * @param other The version to compare against the current version
 * @return 1 if current is greater than other, 0 if they are equal or equivalent, and -1 if current is less than other
 */
export function versionCompare(
  current: Version,
  other: Version,
): VersionIs {
  const cp = String(current).split('.')
  const op = String(other).split('.')
  for (let depth = 0; depth < Math.min(cp.length, op.length); depth++) {
    const cn = Number(cp[depth])
    const on = Number(op[depth])
    if (cn > on) return VersionIs.GreaterThan
    if (on > cn) return VersionIs.LessThan
    if (!isNaN(cn) && isNaN(on)) return VersionIs.GreaterThan
    if (isNaN(cn) && !isNaN(on)) return VersionIs.LessThan
  }
  return VersionIs.EqualTo
}

export type Range = Version | Version[]

const regex = /^([<>=]*)\s*([\d.]+)\s*$/

/**
 * Compare two versions quickly.
 * @param current Is this version greater, equal to, or less than the other?
 * @param other The version to compare against the current version
 * @return 1 if current is greater than other, 0 if they are equal or equivalent, and -1 if current is less than other
 */
export function withinVersionRange(
  subject: Version,
  range: Range,
): boolean {
  let result = false
  if (!Array.isArray(range)) range = String(range).split(/\s*\|\|\s*/)
  for (const part of range) {
    const parts = String(part).match(regex) || []
    const [_, comparator, version] = parts
    if (!version) { throw new Error(`version range was invalid: ${JSON.stringify(part)}`) }
    const diff = versionCompare(subject, version)
    let pass = false
    switch (comparator) {
      case '>=':
        pass = diff >= 0
        break
      case '>':
        pass = diff === 1
        break
      case '<':
        pass = diff === -1
        break
      case '<=':
        pass = diff <= 0
        break
      case '=':
      case '':
        pass = diff === 0
        break
      default:
        throw new Error(
          `version range comparator was invalid: ${JSON.stringify(part)}`,
        )
    }
    if (pass) result = true
  }
  return result
}
