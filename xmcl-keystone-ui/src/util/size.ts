export const getExpectedSize = (size: number) => {
  size = size / 1024
  let unit = 'KB'
  if (size > 1024) {
    size /= 1024
    unit = 'MB'
  }
  return `${size.toFixed(2)}${unit}`
}
