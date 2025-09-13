/* eslint-disable no-dupe-class-members */
import type { ResourceContext } from '@xmcl/resource'
import type { InjectionKey } from '~/app'

export const kResourceContext: InjectionKey<ResourceContext> = Symbol('resourceContext')
