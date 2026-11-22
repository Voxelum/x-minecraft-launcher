import type { Instance } from '@xmcl/instance'
import { InstancesSchema } from '../../../xmcl-runtime-api/src/entities/instance.schema'
import { describe, expect, it } from 'vitest'
import { compareMinecraftVersions, performAutoGroup, reconcileInstanceGroups } from './instanceAutoGroup'

const releaseTimes = new Map([
  ['1.21.4', Date.parse('2024-12-03T10:12:57Z')],
  ['25w02a', Date.parse('2025-01-08T13:42:18Z')],
  ['1.21.5-pre1', Date.parse('2025-03-11T12:49:44Z')],
  ['1.21.5', Date.parse('2025-03-25T12:14:58Z')],
])

describe('Minecraft version ordering', () => {
  it('sorts official releases and snapshots by release time rather than inferred patch number', () => {
    const versions = ['1.21.4', '25w02a', '1.21.5', '1.21.5-pre1', '99.0-custom']
    expect(versions.sort((a, b) => compareMinecraftVersions(a, b, releaseTimes)))
      .toEqual(['1.21.5', '1.21.5-pre1', '25w02a', '1.21.4', '99.0-custom'])
  })

  it('keeps deterministic offline ordering when release metadata is unavailable', () => {
    expect(['13w01a', '1.21.1-pre1', '1.21.1', '1.21.1-rc1'].sort(compareMinecraftVersions))
      .toEqual(['1.21.1', '1.21.1-rc1', '1.21.1-pre1', '13w01a'])
  })
})

function instance(path: string, forge = true, minecraft = '1.20.1'): Instance {
  return { path, runtime: { minecraft, forge: forge ? '47.0.0' : '' } } as Instance
}

const modloader = { enabled: true, strategy: 'modloader' } as const
const version = { enabled: true, strategy: 'version' } as const

function manualGroup(name: string) {
  return { id: 'manual', name, color: '', instances: ['deliberately-placed'] }
}

describe('background instance grouping', () => {
  it('creates a separate automatic folder even when a manual folder has the same name', () => {
    const manual = manualGroup('Forge')
    const result = reconcileInstanceGroups([manual, 'top-level'], [
      instance('deliberately-placed', false), instance('top-level'), instance('new-forge'), instance('another-forge'),
    ], modloader)

    expect(result).toEqual([
      manual, 'top-level', expect.objectContaining({
        name: 'Forge',
        autoGroup: { strategy: 'modloader', bucket: 'Forge' },
        instances: ['new-forge', 'another-forge'],
      }),
    ])
    expect(manual.instances).toEqual(['deliberately-placed'])
  })

  it('reuses a renamed automatic folder by its persisted ownership, not its name', () => {
    const manual = manualGroup('Forge')
    const renamed = {
      id: 'automatic', name: 'My renamed folder', color: '', instances: ['first-forge'],
      autoGroup: { strategy: 'modloader', bucket: 'Forge' },
    }
    const { groups } = InstancesSchema.parse(JSON.parse(JSON.stringify({ groups: [manual, renamed] })))
    const instances = [instance('deliberately-placed', false), instance('first-forge'), instance('new-forge')]
    const result = reconcileInstanceGroups(groups, instances, modloader)

    expect(result).toEqual([manual, { ...renamed, instances: ['first-forge', 'new-forge'] }])
    expect(reconcileInstanceGroups(result, instances, modloader)).toEqual(result)
  })

  it('keeps placements when switching strategies, but does not reuse another strategy’s folder', () => {
    const previous = {
      id: 'automatic', name: 'Bedrock', color: '', instances: ['first-bedrock'],
      autoGroup: { strategy: 'modloader' as const, bucket: 'Bedrock' },
    }
    const result = reconcileInstanceGroups([previous], [
      { ...instance('first-bedrock'), edition: 'bedrock' }, { ...instance('new-bedrock'), edition: 'bedrock' },
    ], version)

    expect(result).toEqual([previous, expect.objectContaining({
      name: 'Bedrock',
      autoGroup: { strategy: 'version', bucket: 'Bedrock' },
      instances: ['new-bedrock'],
    })])
  })

  it('leaves a manual version folder untouched and orders renamed automatic folders by bucket', () => {
    const manual = { ...manualGroup('1.20.x'), instances: ['older', 'newer'] }
    const renamed = {
      id: 'automatic', name: '1.10.x', color: '', instances: ['previous'],
      autoGroup: { strategy: 'version' as const, bucket: '1.21.x' },
    }
    const result = reconcileInstanceGroups([manual, renamed], [
      instance('older'), instance('newer', true, '1.20.4'), instance('previous', true, '1.21.1'),
      instance('new-forge'), instance('newer-forge', true, '1.20.4'),
    ], version)

    expect(result).toEqual([manual, renamed, expect.objectContaining({
      name: '1.20.x',
      instances: ['newer-forge', 'new-forge'],
    })])
  })

  it('uses the same release metadata for explicit regrouping and newly imported instances', () => {
    const release = instance('release', true, '1.21.4')
    const snapshot = instance('snapshot', true, '25w02a')
    const initial = reconcileInstanceGroups([], [release], version)
    const routed = reconcileInstanceGroups(initial, [release, snapshot], version, releaseTimes)
    const expected = expect.objectContaining({ name: '1.21.x', instances: ['snapshot', 'release'] })
    expect(routed).toEqual([expected])
    expect.assertions(2)
    performAutoGroup([release, snapshot], 'version', (groups) => expect(groups).toEqual([expected]), releaseTimes)
  })

  it('corrects version folders created before metadata arrives without sorting manual folders', () => {
    const managedInstances = [instance('release', true, '1.21.4'), instance('snapshot', true, '25w02a')]
    const manual = { ...manualGroup('1.21.x'), instances: ['manual-release', 'manual-snapshot'] }
    const allInstances = [...managedInstances, instance('manual-release', true, '1.21.4'), instance('manual-snapshot', true, '25w02a')]
    const initial = reconcileInstanceGroups([manual], allInstances, version)
    expect(initial[1]).toEqual(expect.objectContaining({ instances: ['release', 'snapshot'] }))
    const corrected = reconcileInstanceGroups(initial, allInstances, version, releaseTimes, true)
    expect(corrected).toEqual([manual, expect.objectContaining({ instances: ['snapshot', 'release'] })])
  })

  it('reuses folders created by the explicit regroup action', () => {
    const initial = [instance('first-forge')]
    expect.assertions(2)
    performAutoGroup(initial, 'modloader', (groups) => {
      const [group] = groups
      if (!group || typeof group === 'string') throw new Error('Expected an automatic folder')
      const reconciled = reconcileInstanceGroups(groups, [...initial, instance('new-forge')], modloader)
      expect(groups).toHaveLength(1)
      expect(reconciled).toEqual([{ ...group, instances: ['first-forge', 'new-forge'] }])
    })
  })
})
