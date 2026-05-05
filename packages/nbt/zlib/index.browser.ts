import pako from 'pako'

export function gzip(buffer: Uint8Array) {
  return Promise.resolve(pako.gzip(buffer))
}
export function gzipSync(buffer: Uint8Array) {
  return pako.gzip(buffer)
}
export function ungzip(buffer: Uint8Array) {
  return Promise.resolve(pako.ungzip(buffer))
}
export function gunzipSync(buffer: Uint8Array) {
  return pako.ungzip(buffer)
}
export function inflate(buffer: Uint8Array) {
  return Promise.resolve(pako.inflate(buffer))
}
export function deflate(buffer: Uint8Array) {
  return Promise.resolve(pako.deflate(buffer))
}
export function inflateSync(buffer: Uint8Array) {
  return pako.inflate(buffer)
}
export function deflateSync(buffer: Uint8Array) {
  return pako.deflate(buffer)
}
