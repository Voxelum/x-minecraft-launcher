import { request } from 'undici'
import { AnyError } from '~/util/error'

export async function getJson<T>(url: string, error: string) {
  try {
    const response = await request(url, { maxRedirections: 4 })

    const body = await response.body.text()

    if (response.statusCode >= 400) {
      throw new AnyError(error, `Response with ${response.statusCode}`, undefined, {
        headers: response.headers,
        statusCode: response.statusCode,
        body,
      })
    }

    try {
      const parsed = JSON.parse(body) as T
      return parsed
    } catch {
      throw new AnyError(error, `Invalid JSON body: ${response.headers['content-type']}`, {}, {
        headers: response.headers,
        statusCode: response.statusCode,
        body,
      })
    }
  } catch (e) {
    if (e instanceof AnyError) {
      throw e
    }
    throw new AnyError(error, 'Fail to fetch ' + url + ' ' + (e as any).code, { cause: e })
  }
}
