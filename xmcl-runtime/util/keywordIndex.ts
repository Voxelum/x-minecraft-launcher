export function tokenize(word: string) {
  const keywords = word.split(' ').map(v => v.toLowerCase())
  const clean = keywords.map(v => v.replace(/[aeiou]/g, ''))
  return [...keywords, ...clean]
}
