export function getLocalDateString(s: string | number) {
  return new Date(s).toLocaleDateString()
}
export function getLocalTimeString(s: string | number) {
  return new Date(s).toLocaleString()
}
