export const getExpectedSize = (size: number, unitText = 'B') => {
  size = size / 1024
  let unit = 'K' + unitText
  if (size > 1024) {
    size /= 1024
    unit = 'M' + unitText
  }
  return `${size.toFixed(2)}${unit}`
}
