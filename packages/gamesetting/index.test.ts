import * as GameSetting from './index'
import { describe, test, expect } from 'vitest'

describe('GameSetting', () => {
  test('should parse all options', () => {
    const s = `
version:512
invertYMouse:false
mouseSensitivity:0.47887325
fov:0.0
gamma:1.0
saturation:0.0
renderDistance:12
guiScale:0
particles:1
bobView:true
anaglyph3d:false
maxFps:120
fboEnable:true
difficulty:1
fancyGraphics:false
ao:1
renderClouds:false
resourcePacks:["Xray Ultimate 1.12 v2.2.1.zip","fabric:abc"]
incompatibleResourcePacks:[]
lastServer:play.mcndsj.com
lang:en_US
chatVisibility:0
chatColors:true
chatLinks:true
chatLinksPrompt:true
chatOpacity:1.0
snooperEnabled:true
fullscreen:false
enableVsync:true
useVbo:true
hideServerAddress:false
advancedItemTooltips:false
pauseOnLostFocus:true
touchscreen:false
overrideWidth:0
overrideHeight:0
heldItemTooltips:true
chatHeightFocused:1.0
chatHeightUnfocused:0.44366196
chatScale:1.0
chatWidth:1.0
showInventoryAchievementHint:false
mipmapLevels:4
forceUnicodeFont:false
reducedDebugInfo:false
useNativeTransport:true
entityShadows:true
mainHand:right
attackIndicator:1
showSubtitles:false
realmsNotifications:true
enableWeakAttacks:false
autoJump:true
key_key.attack:-100
key_key.use:-99
key_key.forward:17
key_key.left:30
key_key.back:31
key_key.right:32
key_key.jump:57
key_key.sneak:42
key_key.sprint:29
key_key.drop:16
key_key.inventory:18
key_key.chat:28
key_key.playerlist:15
key_key.pickItem:-98
key_key.command:53
key_key.screenshot:60
key_key.togglePerspective:63
key_key.smoothCamera:0
key_key.fullscreen:87
key_key.spectatorOutlines:0
key_key.swapHands:33
key_key.hotbar.1:2
key_key.hotbar.2:3
key_key.hotbar.3:4
key_key.hotbar.4:5
key_key.hotbar.5:6
key_key.hotbar.6:7
key_key.hotbar.7:8
key_key.hotbar.8:9
key_key.hotbar.9:10
soundCategory_master:1.0
soundCategory_music:1.0
soundCategory_record:1.0
soundCategory_weather:1.0
soundCategory_block:1.0
soundCategory_hostile:1.0
soundCategory_neutral:1.0
soundCategory_player:1.0
soundCategory_ambient:1.0
soundCategory_voice:1.0
modelPart_cape:true
modelPart_jacket:true
modelPart_left_sleeve:true
modelPart_right_sleeve:true
modelPart_left_pants_leg:true
modelPart_right_pants_leg:true
modelPart_hat:true
`
    const set = GameSetting.parse(s)
    expect(set).toBeTruthy()
    expect(set.ao).toEqual(GameSetting.AmbientOcclusion.Minimum)
    expect(set.fov).toEqual(0)
    expect(set.mipmapLevels).toEqual(4)
    expect(set.difficulty).toEqual(GameSetting.Difficulty.Easy)
    expect(set.renderClouds).toEqual(GameSetting.RenderClouds.Off)
    expect(set.fancyGraphics).toEqual(GameSetting.Graphics.Fast)
    expect(set.lastServer).toEqual('play.mcndsj.com')
    expect(set.particles).toEqual(GameSetting.Particles.Decreased)
    expect(set.resourcePacks).toStrictEqual(['Xray Ultimate 1.12 v2.2.1.zip', 'fabric:abc'])
    expect(set.lang).toEqual('en_US')
    expect(set.modelPart_hat).toEqual(true)
  })
  test('should not parse illegal option', () => {
    const set = GameSetting.parse('undefined:undefined\n', true)
    expect(set).toBeTruthy()
    expect((set as any).undefined).toEqual(undefined)
  })
  test('should parse output even if input string is empty', () => {
    const set = GameSetting.parse('', true)
    expect(set).toBeTruthy()
    expect(set.ao).toEqual(2)
    expect(set.fov).toEqual(0)
    expect(set.mipmapLevels).toEqual(4)
    expect(set.resourcePacks).toStrictEqual([])
    expect(set.lang).toEqual('en_us')
  })
  test('should write all options from frame', () => {
    const setting: GameSetting.Frame = {
      useVbo: false,
      fboEnable: false,
      enableVsync: false,
      fancyGraphics: false,
      renderClouds: false,
      forceUnicodeFont: false,
      autoJump: false,
      entityShadows: false,
      ao: 0,
      fov: 0,
      mipmapLevels: 0,
      maxFps: 0,
      particles: 0,
      renderDistance: 2,
      resourcePacks: ['asb'],
    }
    const str = GameSetting.stringify(setting)
    expect(str.indexOf('maxFps:0')).not.toEqual(-1)
    expect(str.indexOf('fboEnable:false')).not.toEqual(-1)
    expect(str.indexOf('enableVsync:false')).not.toEqual(-1)
    expect(str.indexOf('fancyGraphics:false')).not.toEqual(-1)
    expect(str.indexOf('resourcePacks:["asb"]')).not.toEqual(-1)
  })
  test('should write all options from instance', () => {
    const setting: GameSetting.Frame = {
      useVbo: false,
      fboEnable: false,
      enableVsync: false,
      fancyGraphics: false,
      renderClouds: false,
      forceUnicodeFont: false,
      autoJump: false,
      entityShadows: false,
      ao: 0,
      fov: 0,
      mipmapLevels: 1,
      maxFps: 0,
      particles: 0,
      renderDistance: 2,
      resourcePacks: [],
    }
    const str = GameSetting.stringify(setting)
    expect(str.indexOf('maxFps:0')).not.toEqual(-1)
    expect(str.indexOf('fboEnable:false')).not.toEqual(-1)
    expect(str.indexOf('enableVsync:false')).not.toEqual(-1)
    expect(str.indexOf('fancyGraphics:false')).not.toEqual(-1)
    expect(str.indexOf('resourcePacks:[]')).not.toEqual(-1)
  })
  test('should not write undefined', () => {
    const setting = {
      undefined,
    }
    const str = GameSetting.stringify(setting)
    expect(str.indexOf('undefined:undefined')).toEqual(-1)
  })
})
