export const sep = window.navigator.platform.startsWith('Win') ? '\\' : '/'

export function join(...paths: string[]) {
  return paths.join(sep)
}

export function basename(path: string) {
  return path.substring(path.lastIndexOf(sep) + 1)
}

export function dirname(path: string) {
  return path.substring(0, path.lastIndexOf(sep))
}
