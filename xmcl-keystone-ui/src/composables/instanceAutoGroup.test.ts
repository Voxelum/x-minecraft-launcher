import type { Instance } from '@xmcl/instance'
import { InstancesSchema } from '../../../xmcl-runtime-api/src/entities/instance.schema'
import { describe, expect, it } from 'vitest'
import { performAutoGroup, reconcileInstanceGroups } from './instanceAutoGroup'

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
