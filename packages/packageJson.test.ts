import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packagesDirectory = new URL('.', import.meta.url)
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

describe('package manifests', () => {
  for (const entry of readdirSync(packagesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const packageJsonPath = new URL(`${entry.name}/package.json`, packagesDirectory)
    if (!existsSync(packageJsonPath)) continue
    const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

    it(`${manifest.name} uses publishable workspace ranges`, () => {
      const invalidRanges = dependencyFields.flatMap((field) =>
        Object.entries(manifest[field] ?? {})
          .filter(([, version]) => typeof version === 'string' && /^workspace:[~^]\*$/.test(version))
          .map(([name, version]) => `${field}.${name}: ${version}`),
      )

      expect(invalidRanges).toEqual([])
    })
  }
})
