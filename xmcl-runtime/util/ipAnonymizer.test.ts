import { describe, expect, it } from 'vitest'
import { anonymizeIpAddresses } from './ipAnonymizer'

describe('ipAnonymizer', () => {
  it('hides user public IP with country and user local IP with [Local IP]', async () => {
    const log = '[INFO] [9/4/2026, 9:51:58 AM] User 188.163.92.114 (local 192.168.0.107) connected to mc.hypixel.net (172.65.201.188)'
    const getUserIp = async () => ({ ip: '188.163.92.114', country: 'UA' })
    const getLocalIps = () => ['192.168.0.107']

    const result = await anonymizeIpAddresses(log, getUserIp, getLocalIps)
    expect(result).toBe(
      '[INFO] [9/4/2026, 9:51:58 AM] User [Country: UA] (local [Local IP]) connected to mc.hypixel.net (172.65.201.188)'
    )
  })

  it('preserves external service IPs and log timestamps untouched', async () => {
    const log = '[9:44:29] Connected to Curseforge 104.18.28.120 and Cloudflare 1.1.1.1'
    const getUserIp = async () => ({ ip: '188.163.92.114', country: 'UA' })
    const getLocalIps = () => ['192.168.0.107']

    const result = await anonymizeIpAddresses(log, getUserIp, getLocalIps)
    expect(result).toBe(log)
  })
})
