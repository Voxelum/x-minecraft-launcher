import type { TransferDescription } from '@xmcl/runtime-api'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const tokenPrefix = 'm1.'

function toBase64(data: Uint8Array) {
  let binary = ''
  const chunkSize = 32 * 1024
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const result = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index)
  return result
}

async function transform(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter()
  const output = new Response(stream.readable).arrayBuffer()
  await writer.write(input.slice().buffer)
  await writer.close()
  return new Uint8Array(await output)
}

export async function encodeDescription(description: TransferDescription): Promise<string> {
  const compressed = await transform(
    encoder.encode(JSON.stringify(description)),
    new CompressionStream('gzip'),
  )
  return tokenPrefix + toBase64(compressed)
}

export async function decodeDescription(value: string): Promise<TransferDescription> {
  if (!value.startsWith(tokenPrefix)) throw new Error('multiplayer_incompatible_description')
  const decompressed = await transform(
    fromBase64(value.substring(tokenPrefix.length)),
    new DecompressionStream('gzip'),
  )
  const description = JSON.parse(decoder.decode(decompressed)) as unknown
  if (!description || typeof description !== 'object' || Array.isArray(description)) {
    throw new Error('multiplayer_invalid_description')
  }
  const record = description as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.session !== 'string' ||
    typeof record.sdp !== 'string' ||
    !Array.isArray(record.candidates)
  ) {
    throw new Error('multiplayer_invalid_description')
  }
  return description as TransferDescription
}
