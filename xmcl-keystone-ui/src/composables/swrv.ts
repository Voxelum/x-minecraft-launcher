import { SWRVModel } from '@/util/swrvGet'
import useSWRV, { IConfig } from 'swrv'

export function useSWRVModel<T>(model: SWRVModel<T>, config?: IConfig) {
  return useSWRV(model.key, model.fetcher, config)
}
