import { ResourceDomain } from '../entities/resource.schema'

export const diagnoseSemaphore = 'diagnose'
export const resourceLoadSemaphore = (domain: ResourceDomain) => `${domain}:resource`

