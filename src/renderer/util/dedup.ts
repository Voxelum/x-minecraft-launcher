export function dedup<T>(arr: T[], key: (a: T) => string | number) {
  return arr.reduce((result, v) => result.find(x => key(x) === key(v)) ? result : [...result, v], [] as T[])
}
