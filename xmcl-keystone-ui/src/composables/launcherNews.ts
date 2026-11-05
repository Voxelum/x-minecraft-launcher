import { injection } from '@/util/inject'
import {
  parseVardrynnNews,
  VARDRYNN_API_ORIGIN_FLIGHT,
  VARDRYNN_API_VERSION,
  type VardrynnNewsItem,
} from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { kEnvironment } from './environment'
import { kFlights } from './flights'
import { kSettingsState } from './setting'
import { useSWRVConfig } from './swrvConfig'

export type LauncherNews = VardrynnNewsItem

export function useLauncherNews() {
  const env = injection(kEnvironment)
  const { state } = injection(kSettingsState)
  const flights = inject(kFlights, {})
  const { data, error, isValidating, mutate } = useSWRV('/launcher-news', async () => {
    const origin = flights[VARDRYNN_API_ORIGIN_FLIGHT]
    if (!origin) return []
    const url = new URL(`/${VARDRYNN_API_VERSION}/news`, origin as string)
    if (env.value) {
      url.searchParams.append('version', env.value.version)
      url.searchParams.append('osRelease', env.value.osRelease)
      url.searchParams.append('os', env.value.os)
      url.searchParams.append('arch', env.value.arch)
      url.searchParams.append('env', env.value.env)
      url.searchParams.append('build', env.value.build.toString())
    }
    if (state.value) {
      url.searchParams.append('locale', state.value.locale)
    }
    const resp = await fetch(url)
    if (resp.ok) {
      return parseVardrynnNews(await resp.json())
    }
    return []
  }, useSWRVConfig())
  const news = computed(() => data.value || [] as LauncherNews[])
  return {
    news,
    isValidating,
    mutate,
    error,
  }
}
