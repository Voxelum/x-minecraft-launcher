import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packagesDirectory = new URL('.', import.meta.url)
// Published packages only expose their bundled entry points, so a runtime
// import of another package's internal file works in the workspace but fails
// for npm consumers.
const deepRuntimeImport = /^\s*(?:import|export)\s+(?!type\b)[^'"]*from\s+['"](@xmcl\/[^/'"]+\/[^'"]+)['"]/gm

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__mocks__') return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.ts$/.test(entry.name) && !/\.(test|d)\.ts$/.test(entry.name) ? [path] : []
  })
}

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

    if (manifest.private) continue

    it(`${manifest.name} imports other packages only through their entry points`, () => {
      const directory = fileURLToPath(new URL(entry.name, packagesDirectory))
      const deepImports = sourceFiles(directory).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(deepRuntimeImport)].map(
          (match) => `${file.slice(directory.length + 1)}: ${match[1]}`,
        ),
      )

      expect(deepImports).toEqual([])
    })
  }
})
