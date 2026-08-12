import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from 'crypto'

export interface XmclDpopJwk {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
}

export interface XmclDpopKey {
  privateKey: KeyObject
  privateJwk: Record<string, string>
  publicJwk: XmclDpopJwk
}

export function generateXmclDpopKey(): XmclDpopKey {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  })
  return createXmclDpopKey(privateKey, publicKey)
}

export function restoreXmclDpopKey(value: string): XmclDpopKey | undefined {
  try {
    const privateKey = createPrivateKey({
      key: JSON.parse(value),
      format: 'jwk',
    })
    return createXmclDpopKey(privateKey, createPublicKey(privateKey))
  } catch {
    return undefined
  }
}

export function serializeXmclDpopKey(key: XmclDpopKey): string {
  return JSON.stringify(key.privateJwk)
}

export function createXmclDpopProof(
  key: XmclDpopKey,
  method: string,
  url: string | URL,
  accessToken?: string,
): string {
  const normalizedUrl = new URL(url)
  normalizedUrl.search = ''
  normalizedUrl.hash = ''
  const header = {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: key.publicJwk,
  }
  const payload: Record<string, string | number> = {
    jti: randomUUID(),
    htm: method.toUpperCase(),
    htu: normalizedUrl.toString(),
    iat: Math.floor(Date.now() / 1000),
  }
  if (accessToken !== undefined) {
    payload.ath = createHash('sha256').update(accessToken).digest('base64url')
  }
  const encodedHeader = encodeJson(header)
  const encodedPayload = encodeJson(payload)
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: key.privateKey,
    dsaEncoding: 'ieee-p1363',
  })
  return `${signingInput}.${signature.toString('base64url')}`
}

function createXmclDpopKey(privateKey: KeyObject, publicKey: KeyObject): XmclDpopKey {
  const privateJwk = privateKey.export({ format: 'jwk' }) as Record<string, string>
  const publicJwk = publicKey.export({ format: 'jwk' }) as XmclDpopJwk
  if (
    publicJwk.kty !== 'EC' ||
    publicJwk.crv !== 'P-256' ||
    typeof publicJwk.x !== 'string' ||
    typeof publicJwk.y !== 'string' ||
    typeof privateJwk.d !== 'string'
  ) {
    throw new TypeError('Invalid DPoP P-256 key')
  }
  return { privateKey, privateJwk, publicJwk }
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
