export const getExpectedSize = (size: number, unitText = 'B', fix = 2) => {
  size = size / 1024
  let unit = 'K' + unitText
  if (size > 1024) {
    size /= 1024
    unit = 'M' + unitText
  }
  if (size > 1024) {
    size /= 1024
    unit = 'G' + unitText
  }
  return `${size.toFixed(fix)}${unit}`
}
