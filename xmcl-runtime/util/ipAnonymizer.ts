import { networkInterfaces } from 'os'
import { request } from 'undici'

export interface UserIpInfo {
  ip: string
  country: string
}

let userIpPromise: Promise<UserIpInfo | null> | null = null

export function getUserLocalIps(): string[] {
  try {
    const list = Object.values(networkInterfaces())
      .flat()
      .map((i) => i?.address)
      .filter((addr): addr is string => !!addr && addr !== '127.0.0.1' && addr !== '::1')
    return [...new Set(list)]
  } catch {
    return []
  }
}

export async function getUserPublicIp(timeoutMs = 2500): Promise<UserIpInfo | null> {
  if (!userIpPromise) {
    userIpPromise = (async () => {
      try {
        const res = await request('https://api.country.is/', { signal: AbortSignal.timeout(timeoutMs) })
        if (res.statusCode === 200) {
          const data = (await res.body.json()) as { ip?: string; country?: string }
          if (data?.ip && data.country) {
            return { ip: data.ip, country: data.country.toUpperCase() }
          }
        }
      } catch {}
      return null
    })()
  }
  return userIpPromise
}

export async function anonymizeIpAddresses(
  content: string,
  getUserIp: () => Promise<UserIpInfo | null> = getUserPublicIp,
  getLocalIps: () => string[] = getUserLocalIps,
): Promise<string> {
  if (!content) return ''

  const [publicInfo, localIps] = await Promise.all([getUserIp(), getLocalIps()])
  let result = content

  if (publicInfo?.ip) {
    const escaped = publicInfo.ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), `[Country: ${publicInfo.country}]`)
  }

  if (localIps.length > 0) {
    const localPattern = localIps.map((ip) => ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    result = result.replace(new RegExp(`\\b(?:${localPattern})\\b`, 'g'), '[Local IP]')
  }

  return result
}
