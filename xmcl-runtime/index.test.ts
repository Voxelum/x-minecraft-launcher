
import { TextNode, parse, HTMLElement, Node } from 'node-html-parser'
import { translate } from 'bing-translate-api'
import { setTimeout } from 'timers/promises'
import { HTTPError } from 'got'
const { writeFileSync, readFileSync } = require('fs')
const a = readFileSync('./a.html', 'utf-8')

async function process(content: string) {
  content = content.replace(/\r\n/g, '')
  content = content.replace(/\n/g, '')

  const x = parse(content)

  type Content = Array<Content | string>
  const result: string[] = []
  let id = 0

  function visit(node: Node) {
    if (node instanceof HTMLElement) {
      for (const c of node.childNodes) {
        visit(c)
      }
    } else if (node instanceof TextNode) {
      const text = node.text
      if (text.trim().length > 0) {
        Reflect.set(node, '_translation_id_', id++)
        result.push(node.text)
      }
    }
  }

  visit(x)

  const splitter = '�'

  const encode = result.join(splitter)
  const chunks: string[] = []

  let remaining = encode
  while (remaining.length >= 1000) {
    const current = remaining.slice(0, 1000)
    const lastBrac = current.lastIndexOf('.')
    const lastComma = current.lastIndexOf(',')
    const splitPoint = Math.max(lastBrac, lastComma)
    chunks.push(remaining.slice(0, splitPoint))
    remaining = remaining.slice(splitPoint)
  }
  chunks.push(remaining)

  console.log(`to trans ${result.length}`)

  function countSplit(content: string) {
    let c = 0
    for (let i = 0; i < content.length; ++i) {
      if (content[i] === splitter) c++
    }
    return c
  }
  let translated = ''
  const transMap: Record<string, string> = {}
  for (const chunk of chunks) {
    let sleepTime = 5000
    let tried = 0
    while (true) {
      try {
        const response = await translate(chunk, 'en', 'zh-Hans', false, false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36')
        const beforeCount = countSplit(chunk)
        const afterCount = countSplit(response.translation)
        console.log(`Before count: ${beforeCount}. After: ${afterCount}`)
        await setTimeout(5000)
        if (sleepTime >= 10000) {
          sleepTime /= 2
        }
        transMap[chunk] = response.translation
        translated += response.translation
        console.log(response.translation)
        break
      } catch (e) {
        console.log(e.response.statusCode)
        console.log(e.code)
        if (e.response.statusCode === 429) {
          console.log(`Rate Limit: ${++tried} tried. Wait ${sleepTime}`)
          await setTimeout(sleepTime)
          sleepTime *= 2
        } else {
          throw e
        }
      }
    }
  }

  writeFileSync('trans-map', JSON.stringify(transMap, null, 4))
  writeFileSync('translated', translated)

  // const translated = readFileSync('translated', 'utf-8')

  const decoded = translated.split(splitter)
  console.log(`translated ${decoded.length}`)
  // console.log(decoded)

  function render(node: Node) {
    if (node instanceof HTMLElement) {
      let content = node.tagName ? `<${node.tagName.toLocaleLowerCase()} ${node.rawAttrs}>` : ''
      for (const child of node.childNodes) {
        content += render(child)
      }
      if (node.tagName) {
        content += `</${node.tagName}>`
      }
      return content
    } else if (node instanceof TextNode) {
      const text = node.text
      const id = Reflect.get(node, '_translation_id_')
      if (id) {
        console.log(`Get translation: ${id}: ${!!decoded[id as number]}`)
        return decoded[id as number]
      }
      return text
    }
    return ''
  }

  const rendered = render(x)
  writeFileSync('r.html', rendered)
}

process(a)
