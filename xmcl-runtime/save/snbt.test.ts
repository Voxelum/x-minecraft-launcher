import { describe, expect, test } from 'vitest'
import { parseSnbt } from './snbt'

describe('parseSnbt', () => {
  test('parses simple object with various data types', () => {
    const input = `{
      id: "test_id"
      count: 64b
      scale: 1.5f
      large: 1234567890123L
      active: true
      disabled: false
    }`
    const result = parseSnbt(input)
    expect(result).toEqual({
      id: 'test_id',
      count: 64,
      scale: 1.5,
      large: 1234567890123,
      active: true,
      disabled: false,
    })
  })

  test('parses nested FTB Quests chapter snbt', () => {
    const input = `{
      id: "442436A89B0EE832"
      group: ""
      order_index: 0
      filename: "getting_started"
      title: "Getting Started"
      icon: "minecraft:crafting_table"
      default_quest_shape: ""
      default_hide_dependency_lines: false
      quests: [
        {
          title: "First Steps"
          icon: "minecraft:oak_log"
          x: 0.0d
          y: 0.0d
          id: "12345678"
          tasks: [
            {
              id: "87654321"
              type: "item"
              item: "minecraft:oak_log"
              count: 1L
            }
          ]
        }
        {
          title: "Stone Age"
          icon: "minecraft:cobblestone"
          x: 2.0d
          y: 0.0d
          id: "99887766"
        }
      ]
    }`
    const result = parseSnbt(input)
    expect(result.id).toBe('442436A89B0EE832')
    expect(result.title).toBe('Getting Started')
    expect(result.quests).toHaveLength(2)
    expect(result.quests[0].title).toBe('First Steps')
    expect(result.quests[0].id).toBe('12345678')
    expect(result.quests[1].title).toBe('Stone Age')
  })

  test('parses player progress snbt with completed quests map', () => {
    const input = `{
      version: 1
      uuid: "12345678-1234-1234-1234-123456789abc"
      name: "Player"
      completed: {
        12345678L: 1690000000000L
        "99887766": 1690000001000L
      }
      claimed_rewards: {
        12345678L: 1690000000500L
      }
    }`
    const result = parseSnbt(input)
    expect(result.uuid).toBe('12345678-1234-1234-1234-123456789abc')
    expect(result.name).toBe('Player')
    expect(result.completed['12345678L']).toBe(1690000000000)
    expect(result.completed['99887766']).toBe(1690000001000)
  })

  test('handles comments and arrays with type prefixes', () => {
    const input = `// Header comment
    # Another comment
    {
      /* block comment */
      data: [I; 1, 2, 3]
      tags: ["tag1", "tag2"]
    }`
    const result = parseSnbt(input)
    expect(result.data).toEqual([1, 2, 3])
    expect(result.tags).toEqual(['tag1', 'tag2'])
  })
})
