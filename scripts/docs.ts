import { existsSync } from 'fs'
import { link, mkdir, readFile, readdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { Application, Comment, ContainerReflection, DeclarationReflection, ParameterReflection, Reflection, ReflectionFlag, ReflectionFlags, ReflectionKind, SourceReference, TSConfigReader, TypeDocReader } from 'typedoc'

const renderLink = (fileName: string, line: number) => `<a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/${fileName}#L${line}" target="_blank" rel="noreferrer">${fileName}:${line}</a>`
const renderSourceReferences = (locations: SourceReference[]) =>
  `<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> ${locations.map((l) => renderLink(l.fileName, l.line)).join(', ')}
</p>`

function getAlias(r: Reflection) {
  const fName = r.getFriendlyFullName()
  const result = fName.substring(fName.indexOf('.') + 1)
  return result
}

async function generateDocs() {
  const projectRoot = join(__dirname, '..')
  const packagesRoot = join(projectRoot, 'packages')
  const docsDir = join(projectRoot, 'docs')

  const modules = await readdir(packagesRoot)
  // read all package.json and filter out all private packages
  const packages = await Promise.all(
    modules.map(async (f) => JSON.parse(
      await readFile(join(packagesRoot, f, 'package.json'), 'utf-8'),
    )),
  )
  const publicModules = modules.filter((f, i) => !packages[i].private)

  const app = await Application.bootstrap({
    entryPoints: publicModules.map((m) => join(packagesRoot, m).replaceAll('\\', '/')),
    plugin: [],
    entryPointStrategy: 'resolve',
    exclude: ['**/*.test.ts', '**/test.ts', '**/node_modules/**'],
    hideGenerator: 'true',
    name: 'minecraft-launcher-core-node',
    includeVersion: 'true',
    // includes: '.',
    excludeInternal: 'true',
    excludeExternals: 'true',
    githubPages: 'true',
    skipErrorChecking: 'true',
  }, [
    new TSConfigReader(),
    new TypeDocReader()
  ])

  const readmes = await Promise.all(
    modules.map(async (f) => {
      const filePath = join('packages', f, 'README.md')
      return {
        content: await readFile(filePath, 'utf-8').catch(() => ''),
        existed: existsSync(join(projectRoot, filePath)),
        module: `@xmcl/${f}`,
      }
    }),
  )

  // app.once('error', (error: any) => {
  //   console.log(error)
  // })
  const project = await app.convert()

  if (!project) throw new Error('Cannot convert project!')

  interface SidebarItem { text: string; link: string }

  /**
   * File path to readme text dict
   */
  const outputs: Record<string, string> = {}

  const sidebar: SidebarItem[] = []

  const renderComment = (c: Comment) => {
    let markdown = ''

    for (const s of c.summary) {
      if (s.kind === 'text') {
        markdown += s.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      } else if (s.kind === 'code') {
        markdown += `\`${s.text}\``
      } else if (s.kind === 'inline-tag') {
        markdown += `[${s.text}]`

        if (typeof s.target === 'string') {
          markdown += `(${s.target})`
        } else if (s.target && 'kindOf' in s.target) {
          if (s.target.kindOf([ReflectionKind.ClassOrInterface, ReflectionKind.Namespace, ReflectionKind.Enum])) {
            markdown += `(${getAlias(s.target)})`
          } else {
            markdown += `(#${getAlias(s.target)})`
          }
        }
      }
    }

    return markdown
  }

  const renderParamInline = (p: ParameterReflection) => {
    let markdown = `${p.name}`

    if (p.type) {
      markdown += `: ${p.type.toString()}`
    }

    if (p.defaultValue) {
      markdown += `= ${p.defaultValue}`
    }

    return markdown
  }

  const renderDeclarationReflection = (f: DeclarationReflection, depth: number) => {
    let markdown = depth === 1 ? `# ${ReflectionKind[f.kind]} ${f.name}` : `${'#'.repeat(depth)} ${f.name}`

    if (f.flags.isStatic) {
      markdown += ' <Badge type="warning" text="static" />'
    }
    if (f.flags.isPrivate) {
      markdown += ' <Badge type="danger" text="private" />'
    }
    if (f.flags.isProtected) {
      markdown += ' <Badge type="warning" text="protected" />'
    }
    if (f.flags.isOptional) {
      markdown += ' <Badge type="info" text="optional" />'
    }
    if (f.flags.isReadonly) {
      markdown += ' <Badge type="tip" text="readonly" />'
    }
    if (f.flags.isConst) {
      markdown += ' <Badge type="tip" text="const" />'
    }
    if (f.flags.hasFlag(ReflectionFlag.External)) {
      markdown += ' <Badge type="tip" text="export" />'
    }
    if (f.flags.isPublic) {
      markdown += ' <Badge type="tip" text="public" />'
    }
    if (f.flags.isAbstract) {
      markdown += ' <Badge type="warning" text="abstract" />'
    }

    markdown += '\n\n'

    if (f.signatures) {
      if (f.comment) {
        markdown += renderComment(f.comment)
        markdown += '\n'
      }

      for (const sig of f.signatures) {
        if (sig.parameters) {
          markdown += '```ts\n'
          markdown += `${sig.name}(${sig.parameters.map(renderParamInline).join(', ')})`
          if (sig.type) {
            markdown += `: ${sig.type.toString()}`
          }
          markdown += '\n```\n'
        }
        if (sig.comment) {
          markdown += renderComment(sig.comment)
          markdown += '\n'
        }
        if (sig.parameters && sig.parameters.length > 0) {
          markdown += '#### Parameters\n\n'
          for (const p of sig.parameters) {
            markdown += `- **${p.name}**: \`${p.type?.toString() || ''}\`\n`
            if (p.comment) {
              markdown += renderComment(p.comment)
              markdown += '\n'
            }
          }
        }
        if (sig.type) {
          markdown += '#### Return Type\n\n'
          markdown += `- \`${sig.type.toString()}\`\n`
        }
        markdown += '\n'
      }
    } else if (f.type) {
      markdown += '```ts\n'
      markdown += `${f.name}: ${f.type.toString()}`
      if (f.defaultValue) {
        markdown += ` = ${f.defaultValue}`
      }
      markdown += '\n```\n'
      if (f.comment) {
        markdown += renderComment(f.comment)
        markdown += '\n'
      }
    }

    if (f.inheritedFrom) {
      markdown += `*Inherited from: \`${f.inheritedFrom.qualifiedName}\`*\n\n`
    }

    if (f.sources) {
      markdown += renderSourceReferences(f.sources) + '\n\n'
    }

    markdown += '\n'

    return markdown
  }

  const renderNamespaceReflection = (f: DeclarationReflection, namepsace: string) => {
    let markdown = `# ${ReflectionKind[f.kind]} ${f.name}\n\n`

    if (f.comment) {
      markdown += renderComment(f.comment)
      markdown += '\n'
    }

    const classes = f.getChildrenByKind(ReflectionKind.Class)
    const interfaces = f.getChildrenByKind(ReflectionKind.Interface)
    const namespaces = f.getChildrenByKind(ReflectionKind.Namespace)
    const functions = f.getChildrenByKind(ReflectionKind.Function)
    const enums = f.getChildrenByKind(ReflectionKind.Enum)
    const typeAliases = f.getChildrenByKind(ReflectionKind.TypeAlias)
    const variables = f.getChildrenByKind(ReflectionKind.Variable)
    const constructors = f.getChildrenByKind(ReflectionKind.Constructor)
    const properties = f.getChildrenByKind(ReflectionKind.Property)
    const accessors = f.getChildrenByKind(ReflectionKind.Accessor)
    const methods = f.getChildrenByKind(ReflectionKind.Method)
    const enumMembers = f.getChildrenByKind(ReflectionKind.EnumMember)

    if (classes.length > 0) {
      markdown += '## 🧾 Classes\n\n'
      for (const c of classes) {
        outputs[`${namepsace + '/' + getAlias(c)}.md`] = renderNamespaceReflection(c, namepsace + '/' + getAlias(c))
      }
      markdown += generateDefinitionTable(classes, namepsace, 'class')
    }

    if (interfaces.length > 0) {
      markdown += '## 🤝 Interfaces\n\n'
      for (const i of interfaces) {
        outputs[`${namepsace + '/' + getAlias(i)}.md`] = renderNamespaceReflection(i, namepsace + '/' + getAlias(i))
      }
      markdown += generateDefinitionTable(interfaces, namepsace, 'interface')
    }

    if (namespaces.length > 0) {
      markdown += '## 🗃️ Namespaces\n\n'
      for (const n of namespaces) {
        outputs[`${namepsace + '/' + getAlias(n)}.md`] = renderNamespaceReflection(n, namepsace + '/' + getAlias(n))
      }
      markdown += generateDefinitionTable(namespaces, namepsace, 'namespace')
    }

    if (enums.length > 0) {
      markdown += '## 🏳️ Enums\n\n'
      for (const e of enums) {
        outputs[`${namepsace + '/' + getAlias(e)}.md`] = renderNamespaceReflection(e, namepsace + '/' + getAlias(e))
      }
      markdown += generateDefinitionTable(enums, namepsace, 'enum')
    }

    if (constructors.length > 0) {
      markdown += '## 🏭 Constructors\n\n'
      for (const c of constructors) {
        markdown += renderDeclarationReflection(c, 3)
      }
    }

    if (properties.length > 0) {
      markdown += '## 🏷️ Properties\n\n'
      for (const p of properties) {
        markdown += renderDeclarationReflection(p, 3)
      }
    }

    if (accessors.length > 0) {
      markdown += '## 🔑 Accessors\n\n'
      for (const a of accessors) {
        markdown += renderDeclarationReflection(a, 3)
      }
    }

    if (methods.length > 0) {
      markdown += '## 🔧 Methods\n\n'
      for (const m of methods) {
        markdown += renderDeclarationReflection(m, 3)
      }
    }

    if (functions.length > 0) {
      markdown += '## 🏭 Functions\n\n'
      for (const f of functions) {
        markdown += renderDeclarationReflection(f, 3)
      }
    }

    if (typeAliases.length > 0) {
      markdown += '## ⏩ Type Aliases\n\n'
      for (const t of typeAliases) {
        markdown += renderDeclarationReflection(t, 3)
      }
    }

    if (variables.length > 0) {
      markdown += '## 🏷️ Variables\n\n'
      for (const v of variables) {
        markdown += renderDeclarationReflection(v, 3)
      }
    }

    if (enumMembers.length > 0) {
      markdown += '## 🏷️ Enum Members\n\n'
      for (const e of enumMembers) {
        markdown += renderDeclarationReflection(e, 3)
      }
    }

    return markdown
  }

  project.traverse((refl) => {
    if (refl.kindOf(ReflectionKind.Module) && refl instanceof ContainerReflection) {
      // module

      const simpleName = refl.name.startsWith('@xmcl') ? refl.name.substring(6) : refl.name

      const sidebarItem = {
        text: '📦 ' + refl.name,
        link: simpleName,
        items: [] as SidebarItem[],
        collapsed: true as boolean | undefined,
      }

      sidebar.push(sidebarItem)

      // final markdown output
      // should render markdown list with links to redirects of namespace, classes, interfaces.
      // The functions, enums, type alias, variables should directly render in this page
      // let markdown = `# Module ${refl.name}\n\n`
      let markdown = ''

      const readme = readmes.find((f) => f.module === refl.name)
      if (readme?.content) {
        markdown += readme.content + '\n'
      }

      const classes = refl.getChildrenByKind(ReflectionKind.Class)
      const interfaces = refl.getChildrenByKind(ReflectionKind.Interface)
      const namespaces = refl.getChildrenByKind(ReflectionKind.Namespace)
      const functions = refl.getChildrenByKind(ReflectionKind.Function)
      const enums = refl.getChildrenByKind(ReflectionKind.Enum)
      const typeAliases = refl.getChildrenByKind(ReflectionKind.TypeAlias)
      const variables = refl.getChildrenByKind(ReflectionKind.Variable)

      if (classes.length > 0) {
        markdown += '## 🧾 Classes\n\n'
        for (const c of classes) {
          const name = `${simpleName}/${getAlias(c)}`

          sidebarItem.items!.push({
            text: c.name,
            link: `${name}`,
          })

          outputs[`${name}.md`] = renderNamespaceReflection(c, name)
        }

        markdown += generateDefinitionTable(classes, simpleName, 'class')
      }

      if (interfaces.length > 0) {
        markdown += '## 🤝 Interfaces\n\n'
        for (const c of interfaces) {
          const name = `${simpleName}/${getAlias(c)}`

          outputs[`${name}.md`] = renderNamespaceReflection(c, name)
        }

        markdown += generateDefinitionTable(interfaces, simpleName, 'interface')
      }

      if (namespaces.length > 0) {
        markdown += '## 🗃️ Namespaces\n\n'
        for (const c of namespaces) {
          const name = `${simpleName}/${getAlias(c)}`

          sidebarItem.items!.push({
            text: c.name,
            link: `${name}`,
          })

          outputs[`${name}.md`] = renderNamespaceReflection(c, name)
        }

        markdown += generateDefinitionTable(namespaces, simpleName, 'namespace')
      }

      if (enums.length > 0) {
        markdown += '## 🏳️ Enums\n\n'
        for (const c of enums) {
          const name = `${simpleName}/${getAlias(c)}`

          outputs[`${name}.md`] = renderNamespaceReflection(c, name)
        }

        markdown += generateDefinitionTable(enums, simpleName, 'enum')
      }

      // The functions, enums, type alias, variables should directly render in this page
      if (functions.length > 0) {
        markdown += '## 🏭 Functions\n\n'
        for (const f of functions) {
          markdown += renderDeclarationReflection(f, 3)
        }
        markdown += '\n'
      }

      if (variables.length > 0) {
        markdown += '## 🏷️ Variables\n\n'
        for (const f of variables) {
          markdown += renderDeclarationReflection(f, 3)
        }
        markdown += '\n'
      }

      if (typeAliases.length > 0) {
        markdown += '## ⏩ Type Aliases\n\n'
        for (const f of typeAliases) {
          markdown += renderDeclarationReflection(f, 3)
        }
        markdown += '\n'
      }

      if (sidebarItem.items?.length === 0) {
        sidebarItem.collapsed = undefined
      }
      outputs[simpleName + '.md'] = markdown
    }
  })

  function generateDefinitionTable(namespaces: DeclarationReflection[], namespace: string, type: string) {
    return `<div class="definition-grid ${type}">` +
      namespaces.map(c => `<a href="${namespace}/${getAlias(c)}">${c.name}</a>`).join('') +
      '</div>\n\n'
  }

  const ensureDir = async (f: string) => {
    await mkdir(dirname(f), { recursive: true })
  }

  for (const [path, content] of Object.entries(outputs)) {
    const outPath = join(docsDir, path)
    // ensure the dir exist
    await ensureDir(outPath)
    await writeFile(outPath, content)
  }

  await link(join(projectRoot, 'README.md'), join(docsDir, 'index.md')).catch(() => undefined)
  await link(join(projectRoot, 'CONTRIBUTE.md'), join(docsDir, 'CONTRIBUTE.md')).catch(() => undefined)

  await ensureDir(join(docsDir, 'sidebar.json'))
  await writeFile(join(docsDir, 'sidebar.json'), JSON.stringify(sidebar, null, 2))
}

generateDocs().catch(console.error)
