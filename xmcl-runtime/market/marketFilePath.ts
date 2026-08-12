import filenamify from 'filenamify'

export function getMarketFilePath(domain: string, filename: string) {
  const sanitizedFilename = filenamify(filename, { replacement: '_' })
  return [domain, sanitizedFilename].filter(Boolean).join('/')
}