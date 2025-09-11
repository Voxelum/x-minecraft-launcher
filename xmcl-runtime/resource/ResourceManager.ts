/* eslint-disable no-dupe-class-members */
import { ResourceContext } from '@xmcl/resource'
import { InjectionKey } from '~/app'

export const kResourceContext: InjectionKey<ResourceContext> = Symbol('resourceContext')

export { ResourceManager } from '@xmcl/resource'
