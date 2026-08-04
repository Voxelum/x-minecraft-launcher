import type { AgentDocument, AgentDocumentMetadata, AgentDocumentSearchResult } from '@xmcl/runtime-api'
import { createReadStream } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { load } from 'js-yaml'
import { join } from 'path'
import type { InjectionKey } from '~/app'

export const kAgentDocumentDirectory: InjectionKey<string> = Symbol('AgentDocumentDirectory')

interface AgentDocumentFile extends AgentDocumentMetadata {
  tags: string[]
  file: string
}

function normalize(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function metadata(document: AgentDocumentFile): AgentDocumentMetadata {
  return {
    id: document.id,
    description: document.description,
  }
}

function parseFrontmatter(file: string, content: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)
  if (!match) throw new Error(`Agent document ${file} has no valid frontmatter`)
  const value = load(match[1])
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Agent document ${file} has invalid frontmatter`)
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) throw new Error(`Agent document ${file} id must use kebab-case`)
  if (typeof entry.description !== 'string') throw new Error(`Agent document ${entry.id} has no description`)
  if (!Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== 'string')) throw new Error(`Agent document ${entry.id} has invalid tags`)
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    tags: entry.tags as string[],
    file,
    bodyOffset: match[0].length,
  }
}

async function readMetadata(directory: string, file: string): Promise<AgentDocumentFile> {
  const stream = createReadStream(join(directory, file), { encoding: 'utf8', highWaterMark: 4096 })
  let prefix = ''
  for await (const chunk of stream) {
    prefix += chunk
    const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(prefix)
    if (match) {
      stream.destroy()
      const { bodyOffset: _, ...document } = parseFrontmatter(file, prefix)
      return document
    }
    if (prefix.length > 64 * 1024) {
      stream.destroy()
      throw new Error(`Agent document ${file} frontmatter exceeds 64 KiB`)
    }
  }
  throw new Error(`Agent document ${file} has no valid frontmatter`)
}

export class AgentDocumentStore {
  constructor(private readonly directory: string) {}

  private async loadDocuments() {
    const files = (await readdir(this.directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
      .map(entry => entry.name)
      .sort()
    const documents = await Promise.all(files.map(file => readMetadata(this.directory, file)))
    const ids = new Set<string>()
    for (const document of documents) {
      const id = normalize(document.id)
      if (ids.has(id)) throw new Error(`Duplicate Agent document id: ${document.id}`)
      ids.add(id)
    }
    return documents
  }

  async list(): Promise<AgentDocumentMetadata[]> {
    return (await this.loadDocuments()).map(metadata)
  }

  async search(query: string, limit = 5): Promise<AgentDocumentSearchResult[]> {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery) throw new Error('Document search query must not be empty')
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) throw new Error('Document search limit must be between 1 and 25')
    const terms = normalizedQuery.split(' ')
    return (await this.loadDocuments()).flatMap((document) => {
      const id = normalize(document.id)
      const tags = normalize(document.tags.join(' '))
      const description = normalize(document.description)
      let score = 0
      for (const term of terms) {
        if (id.includes(term)) score += 8
        if (tags.includes(term)) score += 4
        if (description.includes(term)) score += 2
      }
      if (!score) return []
      if (id.includes(normalizedQuery)) score += 8
      if (tags.includes(normalizedQuery)) score += 4
      return [{ ...metadata(document), score }]
    }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)).slice(0, limit)
  }

  async read(id: string): Promise<AgentDocument> {
    const document = (await this.loadDocuments()).find(entry => entry.id === id)
    if (!document) throw new Error(`Unknown document: ${id}`)
    const content = await readFile(join(this.directory, document.file), 'utf8')
    const { bodyOffset, ...currentDocument } = parseFrontmatter(document.file, content)
    return { ...metadata(currentDocument), body: content.slice(bodyOffset) }
  }
}