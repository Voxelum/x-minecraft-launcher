import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { join } from 'node:path'
import * as core from '@actions/core'
import { sync as parseCommit } from 'conventional-commits-parser'
import semver from 'semver'

interface Commit {
  hash: string
  header: string
  type?: string
  scope?: string
  subject?: string
  notes: Array<{ title: string }>
}

interface PackageInfo {
  dir: string
  file: string
  content: PackageJson
  level?: number
  newVersion?: string
  passive?: boolean
  reasons: Array<Commit | string>
}

interface PackageJson {
  name: string
  version: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const DRY = !process.env.CI
const appPackageDirs = ['xmcl-keystone-ui', 'xmcl-runtime', 'xmcl-runtime-api']

function runGit(args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function readJson(file: string): PackageJson {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PackageJson
}

function getPackageInfos() {
  const packageDirs = fs.readdirSync('packages', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('packages', entry.name))
    .concat(appPackageDirs)

  return packageDirs
    .map((dir): PackageInfo | undefined => {
      const file = join(dir, 'package.json')
      if (!fs.existsSync(file)) return undefined
      const content = readJson(file)
      return { dir, file, content, reasons: [] }
    })
    .filter((pkg): pkg is PackageInfo => !!pkg)
}

function getVersionBaseline(file: string) {
  return runGit([
    'log',
    '-1',
    '--format=%H',
    '-G',
    '^[[:space:]]*"version"[[:space:]]*:',
    '--',
    file,
  ])
}

function getCommitsSince(pkg: PackageInfo): Commit[] {
  const baseline = getVersionBaseline(pkg.file)
  if (!baseline) return []

  const output = execFileSync('git', [
    'log',
    '--format=%H%x1f%s%x1f%b%x1e',
    `${baseline}..HEAD`,
    '--',
    pkg.dir,
  ], { encoding: 'utf8' })

  return output.split('\x1e').map((record) => {
    const [hash, subject, body] = record.split('\x1f')
    if (!hash || !subject) return undefined
    const parsed = parseCommit(body ? `${subject}\n\n${body}` : subject) as unknown as Commit
    return { ...parsed, hash, header: subject }
  }).filter((commit): commit is Commit => !!commit)
}

function getBumpLevel(commit: Commit) {
  if (commit.notes.some((note) => note.title === 'BREAKING CHANGE')) return 0
  if (commit.type === 'feat') return 1
  if (commit.type === 'fix' || commit.type === 'refactor' || commit.type === 'patch') return 2
  return undefined
}

function getReleaseType(level: number) {
  return ['major', 'minor', 'patch'][level]
}

function scanPackageChanges(packages: PackageInfo[]) {
  for (const pkg of packages) {
    const commits = getCommitsSince(pkg)
    for (const commit of commits) {
      const level = getBumpLevel(commit)
      if (level === undefined) continue
      pkg.level = Math.min(pkg.level ?? 3, level)
      pkg.reasons.push(commit)
    }
    if (pkg.level !== undefined) {
      pkg.newVersion = semver.inc(pkg.content.version, getReleaseType(pkg.level) as semver.ReleaseType) || undefined
    }
  }
}

function buildDependencyGraph(packages: PackageInfo[]) {
  const byName = new Map(packages.map((pkg) => [pkg.content.name, pkg]))
  const dependents = new Map<string, PackageInfo[]>()

  for (const pkg of packages) {
    const dependencies = {
      ...pkg.content.dependencies,
      ...pkg.content.optionalDependencies,
      ...pkg.content.peerDependencies,
    }
    for (const dependency of Object.keys(dependencies)) {
      if (!byName.has(dependency)) continue
      const list = dependents.get(dependency) ?? []
      list.push(pkg)
      dependents.set(dependency, list)
    }
  }

  return dependents
}

function bumpDependents(packages: PackageInfo[]) {
  const dependents = buildDependencyGraph(packages)
  const visited = new Set<string>()

  function bump(pkg: PackageInfo) {
    for (const dependent of dependents.get(pkg.content.name) ?? []) {
      const key = `${pkg.content.name}->${dependent.content.name}`
      if (visited.has(key)) continue
      visited.add(key)

      if (dependent.newVersion === undefined) {
        dependent.level = 2
        dependent.newVersion = semver.inc(dependent.content.version, 'patch') || undefined
        dependent.passive = true
        dependent.reasons.push(`Dependency ${pkg.content.name} bump **patch**`)
        bump(dependent)
      }
    }
  }

  for (const pkg of packages.filter((pkg) => pkg.newVersion)) bump(pkg)
}

function getJsonFormatting(file: string) {
  const source = fs.readFileSync(file, 'utf8')
  const indent = source.match(/^(\s+)"/m)?.[1] || '  '
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const trailingNewline = source.endsWith('\n')
  return { indent, newline, trailingNewline }
}

function writeJson(file: string, content: PackageJson) {
  const { indent, newline, trailingNewline } = getJsonFormatting(file)
  let output = JSON.stringify(content, null, indent)
  if (newline !== '\n') output = output.replaceAll('\n', newline)
  if (trailingNewline) output += newline
  fs.writeFileSync(file, output)
}

function writeVersions(packages: PackageInfo[], rootVersion: string) {
  for (const pkg of packages) {
    if (!pkg.newVersion) continue
    if (DRY) {
      console.log(`Mock write ${pkg.file}: ${pkg.content.version} -> ${pkg.newVersion}`)
      continue
    }
    writeJson(pkg.file, { ...pkg.content, version: pkg.newVersion })
  }

  const rootFile = 'package.json'
  if (DRY) {
    console.log(`Mock write ${rootFile}: ${readJson(rootFile).version} -> ${rootVersion}`)
    return
  }
  writeJson(rootFile, { ...readJson(rootFile), version: rootVersion })

  const electronFile = 'xmcl-electron-app/package.json'
  writeJson(electronFile, { ...readJson(electronFile), version: rootVersion })
}

function getCommitInfoText(packages: PackageInfo[]) {
  let body = ''
  for (const pkg of packages.sort((a, b) => Number(!!a.passive) - Number(!!b.passive))) {
    if (!pkg.newVersion) continue
    body += `- **${pkg.content.name}: ${pkg.content.version}** -> ${pkg.newVersion}\n`
    for (const reason of pkg.reasons) {
      if (typeof reason === 'string') {
        body += `  - ${reason}\n`
      } else {
        body += `  - ${reason.header} ([${reason.hash}](https://github.com/Voxelum/x-minecraft-launcher/commit/${reason.hash}))\n`
      }
    }
  }
  return body
}

function getAppChangelog(version: string) {
  const baseline = getVersionBaseline('package.json')
  if (!baseline) return `## ${version}\n`

  const output = execFileSync('git', [
    'log',
    '--format=%H%x1f%s%x1f%b%x1e',
    `${baseline}..HEAD`,
  ], { encoding: 'utf8' })
  const commits = output.split('\x1e').map((record) => {
    const [hash, subject, body] = record.split('\x1f')
    if (!hash || !subject) return undefined
    const parsed = parseCommit(body ? `${subject}\n\n${body}` : subject) as unknown as Commit
    return { ...parsed, hash, header: subject }
  }).filter((commit): commit is Commit => !!commit)

  const sections = [
    { title: '🛰️ BREAKING CHANGES', matches: (commit: Commit) => commit.notes.some((note) => note.title === 'BREAKING CHANGE') },
    { title: '🚀 Features', matches: (commit: Commit) => commit.type === 'feat' },
    { title: '🐛 Bug Fixes & Patches', matches: (commit: Commit) => commit.type === 'fix' || commit.type === 'patch' },
    { title: '🏗️ Refactors', matches: (commit: Commit) => commit.type === 'refactor' },
  ]
  let body = `## ${version}\n`
  for (const section of sections) {
    const matched = commits.filter(section.matches)
    if (matched.length === 0) continue
    body += `\n### ${section.title}\n\n`
    for (const commit of matched) {
      const scope = commit.scope ? `**${commit.scope}**: ` : ''
      body += `- ${scope}${commit.subject || commit.header} ([${commit.hash}](https://github.com/Voxelum/x-minecraft-launcher/commit/${commit.hash}))\n`
    }
  }
  return body
}

function setOutputs(version: string, packages: PackageInfo[], release: boolean) {
  const body = [
    'This PR is auto-generated by',
    '[create-pull-request](https://github.com/peter-evans/create-pull-request)',
    `to prepare new releases for changed packages.\n\n${getAppChangelog(version)}\n### Package Changes\n\n${getCommitInfoText(packages)}`,
  ].join('\n')
  const output = process.env.GITHUB_OUTPUT ? core.setOutput : (key: string, value: unknown) => console.log(`${key}: ${value}`)
  output('title', `Prepare Release ${version}`)
  output('body', body)
  output('changelog', body)
  output('message', `chore(release): bump version ${version}`)
  output('release', release)
}

function main() {
  const packages = getPackageInfos()
  scanPackageChanges(packages)
  bumpDependents(packages)

  const levels = packages
    .filter((pkg) => pkg.newVersion && pkg.level !== undefined)
    .map((pkg) => pkg.level as number)
  if (levels.length === 0) {
    setOutputs(readJson('package.json').version, packages, false)
    return
  }

  const root = readJson('package.json')
  const rootLevel = Math.min(...levels)
  const version = semver.inc(root.version, getReleaseType(rootLevel) as semver.ReleaseType)
  if (!version) {
    setOutputs(root.version, packages, false)
    return
  }

  writeVersions(packages, version)
  setOutputs(version, packages, true)
}

main()