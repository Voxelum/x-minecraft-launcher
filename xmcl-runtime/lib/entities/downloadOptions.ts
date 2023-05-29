import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { InjectionKey } from '../util/objectRegistry'

export const kDownloadOptions : InjectionKey<DownloadBaseOptions> = Symbol('DownloadOptions')
