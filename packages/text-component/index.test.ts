import {
  TextComponent,
  toFormattedString,
  fromFormattedString,
  render,
  getSuggestedStyle,
  flat,
} from './index'
import { describe, test, expect } from 'vitest'

describe('TextComponent', () => {
  describe('#fromFormattedString', () => {
    test('should convert normal string', () => {
      const raw = 'testCommon tesxt'
      const comp = fromFormattedString(raw)
      expect(comp).toEqual({
        text: 'testCommon tesxt',
      })
    })
    test('should convert colored string', () => {
      const raw = '§1colored§r'
      const root = fromFormattedString(raw)
      expect(root).toEqual({
        text: '',
        extra: [
          {
            text: 'colored',
            bold: false,
            obfuscated: false,
            strikethrough: false,
            underlined: false,
            italic: false,
            color: 'dark_blue',
          },
        ],
      })
    })
    test('should convert styled string', () => {
      const raw = '§ostyled'
      const comp = fromFormattedString(raw)
      expect(comp).toEqual({
        text: '',
        extra: [
          {
            text: 'styled',
            color: undefined,
            bold: false,
            italic: true,
            obfuscated: false,
            strikethrough: false,
            underlined: false,
          },
        ],
      })
    })
  })
  test('#getSuggestedCss', () => {
    const style = {
      bold: true,
      underlined: true,
      strikethrough: true,
      italic: true,
      color: 'red',
      obfuscated: true,
    }
    const css = getSuggestedStyle(style)
    expect(css).toEqual({
      color: '#FF5555',
      'font-weight': 'bold',
      // "text-decoration": "line-through",
      'text-decoration': 'underline',
      'font-style': 'italic',
    })
  })
  describe('#render', () => {
    test('should render string correctly', () => {
      const node = render({
        text: 'hello',
        extra: [
          {
            text: 'world',
          },
        ],
        bold: true,
        underlined: true,
        strikethrough: true,
        italic: true,
        color: 'red',
        obfuscated: true,
      })
      expect(node.component.text).toEqual('hello')
      expect(node.style).toEqual({
        color: '#FF5555',
        'font-style': 'italic',
        'font-weight': 'bold',
        'text-decoration': 'underline',
      })
      expect(node.children).toHaveLength(1)
      expect(node.children[0].component.text).toEqual('world')
      expect(node.children[0].style).toEqual({})
    })
  })
  describe('#flat', () => {
    test('should be able to flat no children component', () => {
      expect(flat({ text: 'hello' })).toEqual([{ text: 'hello' }])
    })
  })
  test('#toFormattedString', () => {
    const comp: TextComponent = {
      text: 'hello',
      extra: [
        {
          text: 'world',
          extra: [],
        },
      ],
      bold: true,
      underlined: true,
      strikethrough: true,
      italic: true,
      color: 'red',
      obfuscated: true,
    }
    const str = toFormattedString(comp)
    expect(str).toEqual('§c§k§l§m§n§ohello§rworld§r')
  })
})
