const firstBigrams = new Map()
export function getDiceCoefficient(first: string, second: string) {
  first = first.replace(/\s+/g, '')
  second = second.replace(/\s+/g, '')

  if (first === second) return 1 // identical or empty
  if (first.length < 2 || second.length < 2) return 0 // if either is a 0-letter or 1-letter string

  firstBigrams.clear()
  for (let i = 0; i < first.length - 1; i++) {
    const bigram = first.substring(i, i + 2)
    const count = firstBigrams.has(bigram)
      ? firstBigrams.get(bigram) + 1
      : 1

    firstBigrams.set(bigram, count)
  }

  let intersectionSize = 0
  for (let i = 0; i < second.length - 1; i++) {
    const bigram = second.substring(i, i + 2)
    const count = firstBigrams.has(bigram)
      ? firstBigrams.get(bigram)
      : 0

    if (count > 0) {
      firstBigrams.set(bigram, count - 1)
      intersectionSize++
    }
  }

  return (2.0 * intersectionSize) / (first.length + second.length - 2)
}

export function findBestMatch(mainString: string, targetStrings: string[]) {
  const ratings = []
  let bestMatchIndex = 0

  for (let i = 0; i < targetStrings.length; i++) {
    const currentTargetString = targetStrings[i]
    const currentRating = getDiceCoefficient(mainString, currentTargetString)
    ratings.push({ target: currentTargetString, rating: currentRating })
    if (currentRating > ratings[bestMatchIndex].rating) {
      bestMatchIndex = i
    }
  }

  const bestMatch = ratings[bestMatchIndex]

  return { ratings, bestMatch, bestMatchIndex }
}
