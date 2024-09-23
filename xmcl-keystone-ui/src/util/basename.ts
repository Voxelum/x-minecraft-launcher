export const sep = window.navigator.platform.startsWith('Win') ? '\\' : '/'

export function join(...paths: string[]) {
  return paths.join(sep)
}

export function basename(path: string, s = sep) {
  return path.substring(path.lastIndexOf(s) + 1)
}

export function dirname(path: string, s = sep) {
  return path.substring(0, path.lastIndexOf(sep))
}
