import { readFileSync } from 'fs'
import { describe, expect, test } from 'vitest'
import { serialize, TagType } from '@xmcl/nbt'
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
  test('should read modern server.dat with unknown fields (preventsChatReports/hidden)', async () => {
    // Newer Minecraft writes extra per-server fields that our ServerInfo schema
    // does not declare. They must be skipped without corrupting the entries
    // that follow them in the same compound.
    class ModernServerInfo {
      @TagType(TagType.Byte)
      preventsChatReports = 1

      @TagType(TagType.String)
      icon = 'icon-data'

      @TagType(TagType.String)
      name = '常大生存服'

      @TagType(TagType.String)
      ip = 'je.czumc.cn'

      @TagType(TagType.Byte)
      acceptTextures = 1

      @TagType(TagType.Byte)
      hidden = 0
    }
    class ModernServersData {
      @TagType([ModernServerInfo])
      servers = [new ModernServerInfo()]
    }
    const buf = await serialize(new ModernServersData())
    const infos = await readServerInfo(buf)
    expect(infos).toHaveLength(1)
    expect(infos[0].name).toEqual('常大生存服')
    expect(infos[0].ip).toEqual('je.czumc.cn')
    expect(infos[0].icon).toEqual('icon-data')
    expect(infos[0].acceptTextures).toEqual(1)
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
