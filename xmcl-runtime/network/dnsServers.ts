import { getServers, setServers } from 'dns/promises'
import { request } from 'undici'

const currentDNS = getServers()

export async function decideNetworkCondition() {
  await Promise.any([
    request('https://google.com', { method: 'HEAD' }).then(() => 'global', () => false),
    request('https://yandex.com', { method: 'HEAD' }).then(() => 'yandex', () => false),
  ])
}

export function resetDns() {
  setServers(currentDNS)
}

export function overrideDns(networkEnv: 'yandex' | 'global' | 'cn') {
  if (networkEnv === 'cn') {
    setServers([
      '223.5.5.5', // ali
      '223.6.6.6', // ali
      '2400:3200::1', // ali
      '2400:3200:baba::1', // ali
      '119.29.29.29', // tencent
      '180.76.76.76', // baidu,
      ...currentDNS,
    ])
  } else if (networkEnv === 'yandex') {
    setServers([
      '77.88.8.8',
      '2a02:6b8::feed:0ff',
      '77.88.8.1',
      '2a02:6b8:0:1::feed:0ff',
      ...currentDNS,
    ])
  } else {
    setServers([
      '8.8.8.8',
      '8.8.8.4',
      '1.1.1.1',
      ...currentDNS,
    ])
  }
}
