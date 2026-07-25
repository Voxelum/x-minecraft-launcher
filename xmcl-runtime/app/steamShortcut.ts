const VDF_OBJECT = 0x00
const VDF_STRING = 0x01
const VDF_INT32 = 0x02
const VDF_FLOAT = 0x03
const VDF_POINTER = 0x04
const VDF_WSTRING = 0x05
const VDF_COLOR = 0x06
const VDF_UINT64 = 0x07
const VDF_END = 0x08
const VDF_COMPILED_INT_BYTE = 0x09
const VDF_COMPILED_INT_0 = 0x0a
const VDF_COMPILED_INT_1 = 0x0b

export interface SteamShortcut {
  executable: string
  startDir: string
  icon: string
}

interface ParsedShortcuts {
  endOffset: number
  entries: Array<{
    name: string
    appName?: string
  }>
}

interface Cursor {
  buffer: Buffer
  offset: number
}

function readByte(cursor: Cursor): number {
  if (cursor.offset >= cursor.buffer.length) {
    throw new Error('Unexpected end of Steam shortcuts.vdf')
  }
  return cursor.buffer[cursor.offset++]
}

function readCString(cursor: Cursor): string {
  const end = cursor.buffer.indexOf(0, cursor.offset)
  if (end === -1) {
    throw new Error('Unterminated string in Steam shortcuts.vdf')
  }
  const value = cursor.buffer.toString('utf8', cursor.offset, end)
  cursor.offset = end + 1
  return value
}

function skipBytes(cursor: Cursor, length: number) {
  if (cursor.offset + length > cursor.buffer.length) {
    throw new Error('Unexpected end of Steam shortcuts.vdf')
  }
  cursor.offset += length
}

function skipWideString(cursor: Cursor) {
  while (cursor.offset + 1 < cursor.buffer.length) {
    if (cursor.buffer.readUInt16LE(cursor.offset) === 0) {
      cursor.offset += 2
      return
    }
    cursor.offset += 2
  }
  throw new Error('Unterminated wide string in Steam shortcuts.vdf')
}

function skipMap(
  cursor: Cursor,
  onEntry?: (type: number, key: string, valueOffset: number) => void,
) {
  while (true) {
    const type = readByte(cursor)
    if (type === VDF_END) return

    const key = readCString(cursor)
    const valueOffset = cursor.offset
    onEntry?.(type, key, valueOffset)
    skipValue(cursor, type)
  }
}

function skipValue(cursor: Cursor, type: number) {
  switch (type) {
    case VDF_OBJECT:
      skipMap(cursor)
      return
    case VDF_STRING:
      readCString(cursor)
      return
    case VDF_INT32:
    case VDF_FLOAT:
    case VDF_POINTER:
    case VDF_COLOR:
      skipBytes(cursor, 4)
      return
    case VDF_WSTRING:
      skipWideString(cursor)
      return
    case VDF_UINT64:
      skipBytes(cursor, 8)
      return
    case VDF_COMPILED_INT_BYTE:
      skipBytes(cursor, 1)
      return
    case VDF_COMPILED_INT_0:
    case VDF_COMPILED_INT_1:
      return
    default:
      throw new Error(`Unsupported VDF value type ${type} in Steam shortcuts.vdf`)
  }
}

function parseShortcuts(buffer: Buffer): ParsedShortcuts {
  const cursor: Cursor = { buffer, offset: 0 }
  if (readByte(cursor) !== VDF_OBJECT || readCString(cursor) !== 'shortcuts') {
    throw new Error('Steam shortcuts.vdf does not contain a shortcuts root map')
  }

  const entries: ParsedShortcuts['entries'] = []
  while (true) {
    const type = readByte(cursor)
    if (type === VDF_END) {
      return { endOffset: cursor.offset, entries }
    }

    const name = readCString(cursor)
    if (type !== VDF_OBJECT) {
      skipValue(cursor, type)
      continue
    }

    let appName: string | undefined
    skipMap(cursor, (entryType, key, valueOffset) => {
      if (entryType === VDF_STRING && key.toLowerCase() === 'appname') {
        const valueCursor: Cursor = { buffer, offset: valueOffset }
        appName = readCString(valueCursor)
      }
    })
    entries.push({ name, appName })
  }
}

function writeCString(chunks: Buffer[], value: string) {
  chunks.push(Buffer.from(value, 'utf8'))
  chunks.push(Buffer.from([0]))
}

function writeString(chunks: Buffer[], key: string, value: string) {
  chunks.push(Buffer.from([VDF_STRING]))
  writeCString(chunks, key)
  writeCString(chunks, value)
}

function writeInt32(chunks: Buffer[], key: string, value: number) {
  chunks.push(Buffer.from([VDF_INT32]))
  writeCString(chunks, key)
  const integer = Buffer.alloc(4)
  integer.writeInt32LE(value)
  chunks.push(integer)
}

function writeObject(chunks: Buffer[], key: string, write: () => void) {
  chunks.push(Buffer.from([VDF_OBJECT]))
  writeCString(chunks, key)
  write()
  chunks.push(Buffer.from([VDF_END]))
}

function serializeShortcut(index: number, shortcut: SteamShortcut): Buffer {
  const chunks: Buffer[] = []
  writeObject(chunks, index.toString(), () => {
    writeString(chunks, 'AppName', 'X Minecraft Launcher')
    writeString(chunks, 'Exe', shortcut.executable)
    writeString(chunks, 'StartDir', shortcut.startDir)
    writeString(chunks, 'icon', shortcut.icon)
    writeString(chunks, 'ShortcutPath', '')
    writeString(chunks, 'LaunchOptions', '')
    writeInt32(chunks, 'IsHidden', 0)
    writeInt32(chunks, 'AllowDesktopConfig', 1)
    writeInt32(chunks, 'AllowOverlay', 1)
    writeInt32(chunks, 'OpenVR', 0)
    writeInt32(chunks, 'Devkit', 0)
    writeString(chunks, 'DevkitGameID', '')
    writeInt32(chunks, 'DevkitOverrideAppID', 0)
    writeInt32(chunks, 'LastPlayTime', 0)
    writeString(chunks, 'FlatpakAppID', '')
    writeObject(chunks, 'tags', () => {
      writeString(chunks, '0', 'Launcher')
    })
  })
  return Buffer.concat(chunks)
}

export function addSteamShortcutToVdf(buffer: Buffer, shortcut: SteamShortcut): Buffer | undefined {
  const parsed = buffer.length === 0 ? { endOffset: 0, entries: [] } : parseShortcuts(buffer)

  if (
    parsed.entries.some(({ appName }) => appName === 'X Minecraft Launcher' || appName === 'XMCL')
  ) {
    return undefined
  }

  const entryNames = new Set(parsed.entries.map(({ name }) => name))
  let index = 0
  while (entryNames.has(index.toString())) {
    index += 1
  }

  const entry = serializeShortcut(index, shortcut)
  if (buffer.length === 0) {
    const root: Buffer[] = [Buffer.from([VDF_OBJECT])]
    writeCString(root, 'shortcuts')
    root.push(entry, Buffer.from([VDF_END]))
    return Buffer.concat(root)
  }

  const rootEndOffset = parsed.endOffset - 1
  return Buffer.concat([buffer.subarray(0, rootEndOffset), entry, buffer.subarray(rootEndOffset)])
}
