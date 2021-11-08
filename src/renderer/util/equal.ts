export function isStringArrayEquals(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => b[i] === x)
}
