export function convertClasspathToMaven(paths: string[]): string[] {
  return paths.map((path) => {
    const trimmedPath = path.replace(/^libraries\//, '')

    const parts = trimmedPath.split('/')

    let jarName = parts.pop()
    const version = parts.pop()
    const artifactId = parts.pop()
    const groupIdParts = parts

    const groupId = groupIdParts.join('.')

    let classifier = ''

    if (jarName) {
      jarName = jarName.replace(/\.jar$/, '')
      const jarParts = jarName?.substring(`${artifactId}-${version}`.length + 1).split('-')
      if (jarParts && jarParts.length > 0) {
        classifier = jarParts[0]
      }
    }

    let mavenCoordinate = `${groupId}:${artifactId}:${version}`
    if (classifier) {
      mavenCoordinate += `:${classifier}`
    }

    return mavenCoordinate
  })
}

export function parseManifest(manifestContent: string): { mainClass: string; classPath: string[] } {
  const lines = manifestContent.split('\r\n')
  let mainClass = ''
  let classPath = [] as string[]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('Main-Class:')) {
      mainClass = line.substring('Main-Class:'.length).trim()
    } else if (line.startsWith('Class-Path:')) {
      let classPathLine = line.substring('Class-Path:'.length).trim()
      while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
        i++
        classPathLine += lines[i].slice(1)
      }
      classPath = classPathLine.split(' ').filter((path) => path.length > 0)
    }
  }

  return {
    mainClass,
    classPath,
  }
}
