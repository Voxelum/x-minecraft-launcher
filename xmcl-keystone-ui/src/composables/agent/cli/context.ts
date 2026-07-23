import type { InstanceOptionsService, InstanceSavesService } from '@xmcl/runtime-api'
import type { AgentContext } from '../tools'

export interface ParsedPath {
  kind: string
  rest: string
}

export interface CliContext {
  ctx: AgentContext
  optionsService: InstanceOptionsService
  savesService: InstanceSavesService
  pathKind: (path: string) => ParsedPath
  stripDisabled: (name: string) => string
  modByPathOrId: (needle: string) => any
  findResourcePack: (name: string) => any
  findShaderPack: (name: string) => any
  summarizeInstallInstruction: (instruction: any) => any
  knownRoutes: readonly string[]
}
