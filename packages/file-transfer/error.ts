
export function decorateError(
  err: Error,
  urls: string[],
  headers: Record<string, any>,
  destination: string,
) {
  Object.assign(err, {
    name: 'DownloadError',
    urls: urls.join(' '),
    headers,
    destination,
  })
}