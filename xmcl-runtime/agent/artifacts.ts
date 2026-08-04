import type { AgentConversationKey } from '@xmcl/runtime-api'
import { createHash, randomUUID } from 'crypto'
import { ensureDir, pathExists, readFile, readdir, rename, rm, stat, writeFile } from 'fs-extra'
import { basename, dirname, join } from 'path'

export const AGENT_ARTIFACT_READ_DEFAULT_LIMIT = 8_000
export const AGENT_ARTIFACT_READ_MAX_LIMIT = 24_000

export interface AgentArtifactInfo {
  path: string
  length: number
  createdAt: number
}

export interface AgentArtifactRead extends AgentArtifactInfo {
  offset: number
  limit: number
  content: string
  hasMore: boolean
}

export interface AgentArtifactGrepMatch {
  line: number
  text: string
}

function grepSnippet(line: string, matchIndex: number) {
  if (line.length <= 400) return line
  const contentLength = 394
  const start = Math.min(Math.max(0, matchIndex - 120), line.length - contentLength)
  const end = start + contentLength
  return `${start > 0 ? '...' : ''}${line.slice(start, end)}${end < line.length ? '...' : ''}`
}

function keyId(key: AgentConversationKey) {
  return createHash('sha256').update(`${key.agentId}\0${key.scope}`).digest('hex')
}

function artifactName(path: string) {
  const normalized = path.replace(/^\.\//, '')
  if (!normalized.startsWith('artifacts/')) throw new Error(`Not an Agent artifact path: ${path}`)
  const name = normalized.slice('artifacts/'.length)
  if (basename(name) !== name || !/^[a-z0-9._-]+\.(?:json|txt)$/i.test(name)) {
    throw new Error(`Invalid Agent artifact path: ${path}`)
  }
  return name
}

function pageValue(value: number | undefined, fallback: number, minimum: number, maximum: number, label: string) {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`)
  }
  return result
}

export class AgentArtifactStore {
  constructor(private root: string) {}

  private directory(key: AgentConversationKey) {
    return join(this.root, key.agentId, keyId(key))
  }

  private archiveDirectory(key: AgentConversationKey, archiveId: string) {
    return join(this.root, key.agentId, 'archive', keyId(key), archiveId)
  }

  private file(key: AgentConversationKey, path: string) {
    return join(this.directory(key), artifactName(path))
  }

  async write(key: AgentConversationKey, content: string, toolName: string): Promise<AgentArtifactInfo> {
    const trimmed = content.trimStart()
    const extension = trimmed.startsWith('{') || trimmed.startsWith('[') ? 'json' : 'txt'
    const slug = toolName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tool-output'
    const name = `${slug}-${Date.now()}-${randomUUID()}.${extension}`
    const directory = this.directory(key)
    await ensureDir(directory)
    await writeFile(join(directory, name), content, 'utf8')
    return { path: `artifacts/${name}`, length: content.length, createdAt: Date.now() }
  }

  async list(key: AgentConversationKey): Promise<AgentArtifactInfo[]> {
    const directory = this.directory(key)
    const names = await readdir(directory).catch(() => [])
    const entries = await Promise.all(names.filter(name => /^[a-z0-9._-]+\.(?:json|txt)$/i.test(name)).map(async (name) => {
      const file = join(directory, name)
      const [content, metadata] = await Promise.all([readFile(file, 'utf8'), stat(file)])
      return { path: `artifacts/${name}`, length: content.length, createdAt: metadata.mtimeMs }
    }))
    return entries.sort((left, right) => right.createdAt - left.createdAt)
  }

  async read(key: AgentConversationKey, path: string, offset?: number, limit?: number): Promise<AgentArtifactRead> {
    const start = pageValue(offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset')
    const count = pageValue(limit, AGENT_ARTIFACT_READ_DEFAULT_LIMIT, 1, AGENT_ARTIFACT_READ_MAX_LIMIT, 'limit')
    const file = this.file(key, path)
    const [content, metadata] = await Promise.all([readFile(file, 'utf8'), stat(file)])
    return {
      path: `artifacts/${artifactName(path)}`,
      length: content.length,
      createdAt: metadata.mtimeMs,
      offset: start,
      limit: count,
      content: content.slice(start, start + count),
      hasMore: start + count < content.length,
    }
  }

  async grep(key: AgentConversationKey, path: string, pattern: string, ignoreCase: boolean, offset = 0, limit = 50) {
    const start = pageValue(offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset')
    const count = pageValue(limit, 50, 1, 200, 'limit')
    const expression = new RegExp(pattern, ignoreCase ? 'i' : '')
    const content = await readFile(this.file(key, path), 'utf8')
    const matches: AgentArtifactGrepMatch[] = []
    let totalMatches = 0
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      expression.lastIndex = 0
      const match = expression.exec(line)
      if (!match) continue
      if (totalMatches >= start && matches.length < count) matches.push({ line: index + 1, text: grepSnippet(line, match.index) })
      totalMatches++
    }
    return {
      path: `artifacts/${artifactName(path)}`,
      offset: start,
      limit: count,
      totalMatches,
      hasMore: start + matches.length < totalMatches,
      matches,
    }
  }

  reset(key: AgentConversationKey) {
    return rm(this.directory(key), { recursive: true, force: true })
  }

  async archive(key: AgentConversationKey, archiveId: string) {
    const source = this.directory(key)
    if (!await pathExists(source)) return false
    const destination = this.archiveDirectory(key, archiveId)
    await ensureDir(dirname(destination))
    await rename(source, destination)
    return true
  }

  async restoreArchive(key: AgentConversationKey, archiveId: string) {
    const source = this.archiveDirectory(key, archiveId)
    if (!await pathExists(source)) return false
    const destination = this.directory(key)
    await ensureDir(dirname(destination))
    await rename(source, destination)
    return true
  }
}