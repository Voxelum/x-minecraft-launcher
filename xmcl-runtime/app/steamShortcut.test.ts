import { describe, expect, test } from 'vitest'
import { addSteamShortcutToVdf } from './steamShortcut'

function string(key: string, value: string) {
  return Buffer.from([0x01, ...Buffer.from(`${key}\0${value}\0`)])
}

function object(key: string, value: Buffer) {
  return Buffer.concat([Buffer.from([0x00]), Buffer.from(`${key}\0`), value, Buffer.from([0x08])])
}

function existingShortcuts() {
  const shortcut = Buffer.concat([
    string('AppName', 'Existing non-Steam game'),
    Buffer.from([0x09, ...Buffer.from('ByteFlag\0'), 0x7f]),
    Buffer.from([0x0a, ...Buffer.from('AllowOverlay\0')]),
  ])
  return Buffer.concat([
    Buffer.from([0x00, ...Buffer.from('shortcuts\0')]),
    object('0', shortcut),
    Buffer.from([0x08]),
  ])
}

describe('addSteamShortcutToVdf', () => {
  const shortcut = {
    executable: '"/home/deck/X Minecraft Launcher"',
    startDir: '"/home/deck"',
    icon: '/home/deck/X Minecraft Launcher',
  }

  test('appends a shortcut without rewriting existing binary-VDF entries', () => {
    const existing = existingShortcuts()

    const updated = addSteamShortcutToVdf(existing, shortcut)

    expect(updated).toBeDefined()
    expect(updated!.subarray(0, existing.length - 1)).toEqual(
      existing.subarray(0, existing.length - 1),
    )
    expect(updated![updated!.length - 1]).toBe(0x08)
    expect(updated!.toString('utf8')).toContain('X Minecraft Launcher')
  })

  test('does not add a second launcher shortcut', () => {
    const launcher = object('0', string('AppName', 'X Minecraft Launcher'))
    const existing = Buffer.concat([
      Buffer.from([0x00, ...Buffer.from('shortcuts\0')]),
      launcher,
      Buffer.from([0x08]),
    ])

    expect(addSteamShortcutToVdf(existing, shortcut)).toBeUndefined()
  })

  test('rejects malformed VDF instead of replacing it', () => {
    expect(() =>
      addSteamShortcutToVdf(
        Buffer.from([0x00, ...Buffer.from('shortcuts\0'), 0x02, ...Buffer.from('appid\0')]),
        shortcut,
      ),
    ).toThrow('Unexpected end')
  })
})
