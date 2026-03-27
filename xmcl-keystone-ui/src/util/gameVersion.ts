export function isSelectableGameVersion(version: string) {
  return !version.includes('-') && /^\d+(\.\d+)*$/.test(version)
}

export function getSelectableGameVersionIds(versions: string[], current?: string) {
  const result = versions.filter(isSelectableGameVersion)
  if (current && isSelectableGameVersion(current) && !result.includes(current)) {
    result.unshift(current)
  }
  return result
}
