import { describe, expect, it } from 'vitest'
import { InstanceDataSchema } from './instance'

describe('instance server configuration', () => {
  it('keeps desired server state independent from the remote result', () => {
    const parsed = InstanceDataSchema.parse({
      name: 'server',
      serverConfig: {
        eula: true,
        motd: 'Expected state',
        port: 25570,
        maxPlayers: 12,
        onlineMode: true,
        nogui: true,
        world: { mode: 'instance', saveName: 'survival' },
        mods: ['mods/a.jar'],
        deployment: {
          config: { policy: 'mirror', files: ['config/server.toml'] },
          mods: { policy: 'mirror' },
          world: { policy: 'initialize' },
          extra: { policy: 'overlay', files: ['plugins/bridge.jar'] },
        },
        service: {
          enabled: true,
          name: 'xmcl-survival',
          startCommand: '/bin/sh server.sh',
        },
      },
      remoteServer: {
        name: 'Production',
        host: 'example.com',
        port: 22,
        username: 'minecraft',
        remotePath: '/srv/minecraft',
        authMethod: 'privateKey',
      },
    })

    expect(parsed.serverConfig?.motd).toBe('Expected state')
    expect(parsed.serverConfig?.world).toEqual({ mode: 'instance', saveName: 'survival' })
    expect(parsed.serverConfig?.service).toEqual({
      enabled: true,
      name: 'xmcl-survival',
      startCommand: '/bin/sh server.sh',
    })
    expect(parsed.serverConfig?.deployment).toEqual({
      config: { policy: 'mirror', files: ['config/server.toml'] },
      mods: { policy: 'mirror' },
      world: { policy: 'initialize' },
      extra: { policy: 'overlay', files: ['plugins/bridge.jar'] },
    })
    expect(parsed.remoteServer?.name).toBe('Production')
  })

  it('keeps SSH target metadata independent from deployment behavior', () => {
    const parsed = InstanceDataSchema.parse({
      name: 'legacy',
      remoteServer: {
        host: 'example.com',
        username: 'minecraft',
        remotePath: '/srv/minecraft',
        authMethod: 'password',
      },
    })

    expect(parsed.serverConfig).toBeUndefined()
    expect(parsed.remoteServer).toEqual({
      name: 'SSH Target',
      host: 'example.com',
      port: 22,
      username: 'minecraft',
      remotePath: '/srv/minecraft',
      authMethod: 'password',
    })
  })

  it('defaults service registration to disabled', () => {
    const parsed = InstanceDataSchema.parse({
      name: 'local',
      serverConfig: {
        eula: true,
        motd: 'Local server',
        port: 25565,
        maxPlayers: 20,
        onlineMode: false,
        nogui: true,
        world: { mode: 'create' },
      },
    })

    expect(parsed.serverConfig?.service).toEqual({ enabled: false, name: '' })
    expect(parsed.serverConfig?.deployment).toEqual({
      config: { policy: 'mirror' },
      mods: { policy: 'mirror' },
      world: { policy: 'initialize' },
      extra: { policy: 'overlay' },
    })
  })
})