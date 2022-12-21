import { ResourceDomain } from '@xmcl/runtime-api'
import { ResourceContext } from './ResourceContext'

export async function parseMetadata(file: string, fileType: string, domain: ResourceDomain, context: ResourceContext) {
  const { metadata, uris, icons, name } = await context.parse({
    path: file,
    fileType,
    domain,
  })

  const iconPaths = await Promise.all(icons.map(icon => context.image.addImage(icon)))

  return {
    metadata, uris, icons: iconPaths, name,
  }
}
