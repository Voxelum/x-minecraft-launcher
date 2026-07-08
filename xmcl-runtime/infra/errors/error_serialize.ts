export { AnyError, isSystemError } from "@xmcl/utils"
export type { SystemError } from "@xmcl/utils"

/**
 * Convert the error to plain object to be transferred to the renderer process
 */
export async function getSerializedError(e: unknown, context: object): Promise<object> {
  if ((e instanceof AggregateError) ||
    // @ts-ignore
    (e.name === 'AggregateError' && e.errors instanceof Array)) {
    e = (e as any).errors
  }
  if (e instanceof Array) {
    if (e.length !== 1) {
      return Promise.all(e.map(v => getSerializedError(v, context)))
    }
    return getSerializedError(e[0], context)
  }

  const error: any = {
  }

  if (e instanceof Error) {
    try {
      Object.assign(error, JSON.parse(JSON.stringify(e, (key, val) => {
        return val
      })))
    } catch (e) { }
    error.message = e.message
    error.stack = e.stack
    error.name = e.name
  } else {
    if (error) {
      error.message = error.toString()
    }
  }
  return error
}

