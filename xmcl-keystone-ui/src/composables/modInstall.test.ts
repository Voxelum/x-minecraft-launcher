import { FileRelationType } from '@xmcl/curseforge'
import { describe, expect, test } from 'vitest'
import { getReplacedModFiles, getRequiredCurseforgeInstallFiles, getRequiredForgeModIds, getRequiredModrinthInstallVersions } from './modInstall'

describe('mod install planning', () => {
  test('replaces installed marketplace versions of staged mods', () => {
    const files = [
      { path: 'mods/sodium-new.jar', hashes: {}, modrinth: { projectId: 'sodium', versionId: 'new' } },
      { path: 'mods/jei-new.jar', hashes: {}, curseforge: { projectId: 238222, fileId: 2 } },
    ]
    const installed = [
      { fileName: 'sodium-old.jar.disabled', hash: 'sodium-sha1', size: 10, modrinth: { projectId: 'sodium' } },
      { fileName: 'jei-old.jar', hash: 'jei-sha1', size: 20, curseforge: { projectId: 238222 } },
      { fileName: 'unrelated.jar', hash: 'other-sha1', size: 30, modrinth: { projectId: 'other' } },
    ]

    expect(getReplacedModFiles(files, installed)).toEqual([
      { path: 'mods/sodium-old.jar.disabled', hashes: { sha1: 'sodium-sha1' }, size: 10 },
      { path: 'mods/jei-old.jar', hashes: { sha1: 'jei-sha1' }, size: 20 },
    ])
  })

  test('selects required NeoForge artifact dependencies', () => {
    expect(getRequiredForgeModIds([{ dependencies: [
      { modId: 'minecraft', type: 'required' },
      { modId: 'sodium', type: 'required' },
      { modId: 'embeddium', type: 'incompatible' },
    ] }])).toEqual(['minecraft', 'sodium'])
  })

  test('includes required Modrinth dependencies and the exact root version', () => {
    const result = getRequiredModrinthInstallVersions({ id: 'iris-version' }, [
      { type: 'required', project: { id: 'sodium', icon_url: 'sodium.png' }, recommendedVersion: { id: 'sodium-version' } },
      { type: 'optional', project: { id: 'optional-api' }, recommendedVersion: { id: 'optional-version' } },
      { type: 'required', project: { id: 'installed-api' }, recommendedVersion: { id: 'installed-version' } },
      { type: 'required', project: { id: 'sodium' }, recommendedVersion: { id: 'older-sodium-version' } },
    ], new Set(['installed-api']))

    expect(result).toEqual([
      { versionId: 'older-sodium-version', icon: undefined },
      { versionId: 'iris-version', icon: undefined },
    ])
  })

  test('includes required CurseForge dependencies and the exact root file', () => {
    const result = getRequiredCurseforgeInstallFiles({ id: 10 }, [
      { type: FileRelationType.RequiredDependency, project: { id: 20, logo: { url: 'dep.png' } }, file: { id: 21 } },
      { type: FileRelationType.OptionalDependency, project: { id: 30 }, file: { id: 31 } },
      { type: FileRelationType.RequiredDependency, project: { id: 40 }, file: { id: 41 } },
    ], new Set([40]))

    expect(result).toEqual([
      { fileId: 21, icon: 'dep.png' },
      { fileId: 10, icon: undefined },
    ])
  })
})