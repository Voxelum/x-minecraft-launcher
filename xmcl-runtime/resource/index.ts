/**
 * This package contains the resource manipulation core logics
 */
export * from './worker'

import type { ResourceContext, ResourceManager } from '@xmcl/resource'
import type { InjectionKey } from '~/app'

export const kResourceContext: InjectionKey<ResourceContext> = Symbol('resourceContext')
export const kResourceManager: InjectionKey<ResourceManager> = Symbol('resourceManager')
