/**
 * This package contains the resource manipulation core logics
 */
export * from './worker'

import type { ResourceContext, ResourceManager } from '@xmcl/resource'
import type { InjectionKey } from '~/app'

export interface ResourceDatabaseTelemetry {
  attempts: number
  durationMs: number
  migrationFailures: number
  ready: boolean
  recovered: boolean
}

export const kResourceContext: InjectionKey<ResourceContext> = Symbol('resourceContext')
export const kResourceManager: InjectionKey<ResourceManager> = Symbol('resourceManager')
export const kResourceDatabaseTelemetry: InjectionKey<ResourceDatabaseTelemetry> = Symbol('resourceDatabaseTelemetry')
