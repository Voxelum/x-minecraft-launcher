import { Frame as GameSetting } from '@xmcl/gamesetting'
import { ModuleOption } from '../root'
import { set } from '/@shared/util/middleware'

interface State extends GameSetting {
  resourcePacks: Array<string>
}

interface Getters {
}

interface Mutations {
  /**
   * Update the game settings in options.txt
   * @param payload The new game settings.
   */
  instanceGameSettings: GameSetting
  instanceGameSettingsLoad: GameSetting
}

export type InstanceGameSettingModule = ModuleOption<State, Getters, Mutations, {}>

const mod: InstanceGameSettingModule = {
  state: {
    resourcePacks: [],
  },
  getters: {
  },
  mutations: {
    instanceGameSettingsLoad(state, settings) {
      const resourcePacks = settings.resourcePacks || []
      state.resourcePacks = [...resourcePacks]

      state.anaglyph3d = settings.anaglyph3d
      state.ao = settings.ao
      state.useVbo = settings.useVbo
      state.enableVsync = settings.enableVsync
      state.difficulty = settings.difficulty
      state.entityShadows = settings.entityShadows
      state.fboEnable = settings.fboEnable
      state.fullscreen = settings.fullscreen
      state.renderDistance = settings.renderDistance
      state.fancyGraphics = settings.fancyGraphics
      state.renderClouds = settings.renderClouds
    },
    instanceGameSettings(state, settings) {
      const container = state as Record<string, any>
      if (settings.resourcePacks && settings.resourcePacks instanceof Array) {
        container.resourcePacks = [...settings.resourcePacks]
      }
      for (const [key, value] of Object.entries(settings)) {
        if (key in container) {
          container[key] = value
        } else {
          container[key] = value
          // TODO: remove in vue3
          set(container, key)
        }
      }
    },
  },
}

export default mod
