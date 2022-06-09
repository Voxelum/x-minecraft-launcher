export const modrinthDenyHost = ['edge.forgecdn.net', 'media.forgecdn.net']
export const modrinthAllowHost = ['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com']
export function isAllowInModrinthModpack(url: string, strict = true) {
  // @ts-ignore
  const result = new URL(url)
  if (result.protocol !== 'http:' && result.protocol !== 'https:') {
    return false
  }
  if (modrinthDenyHost.indexOf(result.host) !== -1) {
    return false
  }
  if (!strict) {
    return true
  }
  if (modrinthAllowHost.indexOf(result.host) === -1) {
    return false
  }
  return true
}
