import { errors } from 'undici'

export function filterSensitiveData(object: any) {
  const filterOptions = (o: object) => {
    if ('headers' in o && o && typeof o.headers === 'object' && o.headers && 'Authorization' in o.headers) {
      o.headers.Authorization = '***'
    }
    if ('body' in o && typeof o.body === 'string') {
      if (o.body.indexOf('accessToken') !== -1) {
        o.body = JSON.stringify(JSON.parse(o.body), (k, v) => {
          if (v === 'accessToken') return '***'
          return v
        })
      }
    }
  }
  if (object instanceof errors.UndiciError) {
    filterOptions(object)
    if ('options' in object && object.options) {
      filterOptions(object.options)
    }
  }
  return object
}
