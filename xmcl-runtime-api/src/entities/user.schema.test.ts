import { describe, test, expect } from 'vitest'
import { Users, UserProfileCompatible, GameProfileAndTextureSchema } from './user.schema'

describe('Users', () => {
  const createValidUserProfile = (id: string) => ({
    id,
    username: `user-${id}@example.com`,
    invalidated: false,
    authority: 'https://auth.example.com',
    expiredAt: Date.now() + 3600000,
    profiles: {
      'profile-1': {
        id: 'profile-1',
        name: 'TestPlayer',
        textures: {
          SKIN: {
            url: 'https://example.com/skin.png',
          },
        },
      },
    },
    selectedProfile: 'profile-1',
  })

  test('should parse valid user schema', () => {
    const data = {
      users: {
        'user-1': createValidUserProfile('user-1'),
        'user-2': createValidUserProfile('user-2'),
      },
    }

    const result = Users.parse(data)

    expect(result.users['user-1']).toBeDefined()
    expect(result.users['user-1'].id).toBe('user-1')
    expect(result.users['user-2']).toBeDefined()
    expect(result.users['user-2'].id).toBe('user-2')
  })

  test('should salvage user profile with missing fields using defaults', () => {
    const data = {
      users: {
        'user-1': createValidUserProfile('user-1'),
        'user-2': {
          // Partial: missing some fields - should use defaults
          id: 'user-2',
          username: 'partial@example.com',
          // missing: invalidated, expiredAt, profiles, selectedProfile
        },
        'user-3': createValidUserProfile('user-3'),
      },
    }

    const result = Users.parse(data)

    // Valid users should be preserved
    expect(result.users['user-1']).toBeDefined()
    expect(result.users['user-1'].id).toBe('user-1')
    expect(result.users['user-3']).toBeDefined()
    expect(result.users['user-3'].id).toBe('user-3')

    // Partial user should be salvaged with defaults
    expect(result.users['user-2']).toBeDefined()
    expect(result.users['user-2'].id).toBe('user-2')
    expect(result.users['user-2'].username).toBe('partial@example.com')
    expect(result.users['user-2'].invalidated).toBe(false) // default
    expect(result.users['user-2'].expiredAt).toBe(-1) // default
    expect(result.users['user-2'].profiles).toEqual({}) // default
    expect(result.users['user-2'].selectedProfile).toBe('') // default
  })

  test('should use defaults for invalid field types while preserving valid fields', () => {
    const data = {
      users: {
        'user-1': createValidUserProfile('user-1'),
        'user-2': {
          ...createValidUserProfile('user-2'),
          invalidated: 'not-a-boolean', // invalid - should use default
          expiredAt: 'not-a-number', // invalid - should use default
        },
        'user-3': createValidUserProfile('user-3'),
      },
    }

    const result = Users.parse(data)

    expect(result.users['user-1']).toBeDefined()
    expect(result.users['user-3']).toBeDefined()
    
    // user-2 should be salvaged with defaults for invalid fields
    expect(result.users['user-2']).toBeDefined()
    expect(result.users['user-2'].id).toBe('user-2')
    expect(result.users['user-2'].invalidated).toBe(false) // default
    expect(result.users['user-2'].expiredAt).toBe(-1) // default
    // Valid fields should be preserved
    expect(result.users['user-2'].authority).toBe('https://auth.example.com')
  })

  test('should return empty object when users is completely invalid', () => {
    const data = {
      users: 'not-an-object',
    }

    const result = Users.parse(data)

    expect(result.users).toEqual({})
  })

  test('should return empty object when input is null or undefined', () => {
    const resultNull = Users.parse({ users: null })
    const resultUndefined = Users.parse({})

    expect(resultNull.users).toEqual({})
    expect(resultUndefined.users).toEqual({})
  })

  test('should skip malformed profiles but keep valid ones within a user', () => {
    const data = {
      users: {
        'user-1': {
          ...createValidUserProfile('user-1'),
          profiles: {
            'profile-1': {
              // Malformed profile: missing required fields
              id: 'profile-1',
              // missing: name, textures
            },
            'profile-2': {
              id: 'profile-2',
              name: 'ValidPlayer',
              textures: {
                SKIN: {
                  url: 'https://example.com/skin2.png',
                },
              },
            },
          },
        },
        'user-2': createValidUserProfile('user-2'),
      },
    }

    const result = Users.parse(data)

    // User should be preserved
    expect(result.users['user-1']).toBeDefined()
    // Malformed profile should be skipped, valid profile should be preserved
    expect(result.users['user-1'].profiles['profile-1']).toBeUndefined()
    expect(result.users['user-1'].profiles['profile-2']).toBeDefined()
    expect(result.users['user-1'].profiles['profile-2'].name).toBe('ValidPlayer')
    // Valid user should be preserved
    expect(result.users['user-2']).toBeDefined()
  })

  test('should skip user without required id field', () => {
    const data = {
      users: {
        'user-1': createValidUserProfile('user-1'),
        'user-2': {
          // Missing id - should be skipped
          username: 'no-id@example.com',
          invalidated: false,
          expiredAt: 123456,
          profiles: {},
          selectedProfile: '',
        },
        'user-3': createValidUserProfile('user-3'),
      },
    }

    const result = Users.parse(data)

    expect(result.users['user-1']).toBeDefined()
    expect(result.users['user-3']).toBeDefined()
    expect(result.users['user-2']).toBeUndefined()
  })

  test('should skip user without required username field', () => {
    const data = {
      users: {
        'user-1': createValidUserProfile('user-1'),
        'user-2': {
          // Missing username - should be skipped
          id: 'user-2',
          invalidated: false,
          expiredAt: 123456,
          profiles: {},
          selectedProfile: '',
        },
        'user-3': createValidUserProfile('user-3'),
      },
    }

    const result = Users.parse(data)

    expect(result.users['user-1']).toBeDefined()
    expect(result.users['user-3']).toBeDefined()
    expect(result.users['user-2']).toBeUndefined()
  })

  test('should preserve all valid user data', () => {
    const validUser = {
      ...createValidUserProfile('user-1'),
      avatar: 'https://example.com/avatar.png',
    }

    const data = {
      users: {
        'user-1': validUser,
      },
    }

    const result = Users.parse(data)

    expect(result.users['user-1']).toEqual(validUser)
  })
})

describe('UserProfileCompatibleSchema', () => {
  test('should parse valid user profile', () => {
    const data = {
      id: 'user-1',
      username: 'test@example.com',
      invalidated: false,
      authority: 'https://auth.example.com',
      expiredAt: 1234567890,
      profiles: {
        'profile-1': {
          id: 'profile-1',
          name: 'TestPlayer',
          textures: {
            SKIN: {
              url: 'https://example.com/skin.png',
            },
          },
        },
      },
      selectedProfile: 'profile-1',
    }

    const result = UserProfileCompatible.parse(data)

    expect(result.id).toBe('user-1')
    expect(result.username).toBe('test@example.com')
    expect(result.invalidated).toBe(false)
  })

  test('should accept optional fields', () => {
    const data = {
      id: 'user-1',
      username: 'test@example.com',
      invalidated: false,
      expiredAt: 1234567890,
      profiles: {},
      selectedProfile: '',
      avatar: 'data:image/png;base64,abc123',
      authService: 'microsoft',
    }

    const result = UserProfileCompatible.parse(data)

    expect(result.avatar).toBe('data:image/png;base64,abc123')
    expect(result.authService).toBe('microsoft')
  })
})

describe('GameProfileAndTextureSchema', () => {
  test('should parse valid game profile with textures', () => {
    const data = {
      id: 'profile-1',
      name: 'TestPlayer',
      textures: {
        SKIN: {
          url: 'https://example.com/skin.png',
          metadata: {
            model: 'slim',
          },
        },
        CAPE: {
          url: 'https://example.com/cape.png',
        },
      },
    }

    const result = GameProfileAndTextureSchema.parse(data)

    expect(result.id).toBe('profile-1')
    expect(result.name).toBe('TestPlayer')
    expect(result.textures.SKIN.url).toBe('https://example.com/skin.png')
    expect(result.textures.SKIN.metadata).toEqual({ model: 'slim' })
    expect(result.textures.CAPE?.url).toBe('https://example.com/cape.png')
  })

  test('should accept skins and capes arrays', () => {
    const data = {
      id: 'profile-1',
      name: 'TestPlayer',
      textures: {
        SKIN: {
          url: 'https://example.com/skin.png',
        },
      },
      skins: [
        {
          id: 'skin-1',
          state: 'ACTIVE',
          url: 'https://example.com/skin.png',
          variant: 'CLASSIC',
        },
      ],
      capes: [
        {
          id: 'cape-1',
          state: 'ACTIVE',
          url: 'https://example.com/cape.png',
          alias: 'MojangCape',
        },
      ],
    }

    const result = GameProfileAndTextureSchema.parse(data)

    expect(result.skins).toHaveLength(1)
    expect(result.skins![0].variant).toBe('CLASSIC')
    expect(result.capes).toHaveLength(1)
    expect(result.capes![0].alias).toBe('MojangCape')
  })
})
