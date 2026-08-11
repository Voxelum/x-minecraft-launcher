import { join } from 'path'

let cached: typeof import('koffi') | undefined

export function getKoffi() {
  if (!cached) {
    cached = require(join(__dirname, 'koffi.node')) as typeof import('koffi')
  }
  return cached
}