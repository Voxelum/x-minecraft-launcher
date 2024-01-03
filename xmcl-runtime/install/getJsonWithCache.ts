import { request } from 'undici'
import { isWithCache, kCacheKey } from '~/network/dispatchers/cacheDispatcher'
import { AnyError } from '~/util/error'

export async function getJson<T>(url: string, error: string) {
  try {
    const response = await request(url)

    const contentType = response.headers['content-type']
    if (typeof contentType !== 'string' || !contentType.startsWith('application/json')) {
      throw new AnyError(error, await response.body.text())
    }

    if (response.statusCode >= 400) {
      throw new AnyError(error, `Response with ${response.statusCode}`, undefined, await response.body.json())
    }

    return await response.body.json() as T
  } catch (e) {
    if (isWithCache(e)) {
      return e[kCacheKey].getBodyJson() as T
    }

    if (e instanceof AnyError) {
      throw e
    }
    throw new AnyError(error, 'Fail to fetch ' + url, { cause: e })
  }
}
