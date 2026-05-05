import { readFileSync } from 'fs'
import { describe, expect, test } from 'vitest'
import { readServerInfo, readServerInfoSync, writeServerInfo, writeServerInfoSync } from './index'

describe('Server Info', () => {
  test('should read server.dat file', async ({ mock }) => {
    const data = readFileSync(`${mock}/servers.dat`)
    const infos = await readServerInfo(data)
    expect(infos[0].name).toEqual('nyaacat')
    expect(infos[1].name).toEqual('himajin')
    expect(infos[2].name).toEqual('mcJp')
    expect(infos[3].name).toEqual('Minecraft Server')
  })
  test('should sync read server.dat file', async ({ mock }) => {
    const data = readFileSync(`${mock}/servers.dat`)
    const infos = readServerInfoSync(data)
    expect(infos[0].name).toEqual('nyaacat')
    expect(infos[1].name).toEqual('himajin')
    expect(infos[2].name).toEqual('mcJp')
    expect(infos[3].name).toEqual('Minecraft Server')
  })
  test('should write to nbt data right', async () => {
    const byte = await writeServerInfo([
      {
        name: 'abc',
        ip: 'ip!',
        icon: '',
        acceptTextures: 0,
      },
    ])
    const readBack = await readServerInfo(byte)
    expect(readBack[0]).toBeTruthy()
    expect(readBack[0].name).toEqual('abc')
    expect(readBack[0].ip).toEqual('ip!')
  })
  test('should sync write to nbt data right', async () => {
    const byte = writeServerInfoSync([
      {
        name: 'abc',
        ip: 'ip!',
        icon: '',
        acceptTextures: 0,
      },
    ])
    const readBack = await readServerInfo(byte)
    expect(readBack[0]).toBeTruthy()
    expect(readBack[0].name).toEqual('abc')
    expect(readBack[0].ip).toEqual('ip!')
  })
})
