<template>
    <div>
        <h5 class="ui horizontal divider header">
            <label>{{$t('criticalGraphics')}}</label>
        </h5>
        <options-group :options="criticalGraphics" :id="id"></options-group>
        <!-- <options-group :options="normalGraphics" :id="id"></options-group>
        <h5 class="ui horizontal divider header">
            <label>{{$t('hotkeyChanges')}}</label>
        </h5>
        <div class="five ui basic buttons">
            <hot-key-button :name="$t('buttonSettings.moveForward')" :initkey="hotKeys.moveForward" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.moveBackward')" :initkey="hotKeys.moveBackward" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.moveLeft')" :initkey="hotKeys.moveLeft" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.moveRight')" :initkey="hotKeys.moveRight" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.jump')" :initkey="hotKeys.Jump" @keychange="onkeychange"></hot-key-button>
        </div>
        <div class="five ui basic buttons">
            <hot-key-button :name="$t('buttonSettings.drop')" :initkey="hotKeys.DropItem" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.talk')" :initkey="hotKeys.Talk" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.open')" :initkey="hotKeys.OpenOrCloseBag" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.stealth')" :initkey="hotKeys.Steath" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.view')" :initkey="hotKeys.Viewplayer" @keychange="onkeychange"></hot-key-button>
        </div>
        <div class="five ui basic buttons">
            <hot-key-button :name="$t('buttonSettings.shortcut1')" :initkey="hotKeys.Shortcut1" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.shortcut2')" :initkey="hotKeys.Shortcut2" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.shortcut3')" :initkey="hotKeys.Shortcut3" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.shortcut4')" :initkey="hotKeys.Shortcut4" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.shortcut5')" :initkey="hotKeys.Shortcut5" @keychange="onkeychange"></hot-key-button>
        </div>
        <div class="four ui basic buttons">
            <hot-key-button :name="$t('buttonSettings.shortcut6')" :initkey="hotKeys.Shortcut6" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.shortcut7')" :initkey="hotKeys.Shortcut7" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.shortcut8')" :initkey="hotKeys.Shortcut8" @keychange="onkeychange"></hot-key-button>
            <hot-key-button :name="$t('buttonSettings.shortcut9')" :initkey="hotKeys.Shortcut9" @keychange="onkeychange"></hot-key-button>
        </div> -->
    </div>
</template>

<script>
import vuex from 'vuex'
import OptionMenu from './OptionMenu.vue'
import OptionsGroup from './OptionsGroup'
import HotKeyButton from './HotKeyButton'

const boolOptions = [true, false]
const numOptions = [0, 1, 2]

export default {
    components: { OptionsGroup, HotKeyButton },
    computed: {
        ...vuex.mapGetters({
            templates: 'options',
        }),
        id() { return this.$route.params.id; }
    },
    methods: {
        onkeychange(newKeyValue) {
            this.hotKeys.moveForward = newKeyValue;
            // console.log(`Get new key ${newKeyValue}`)
        }
    },
    data: () => ({
        criticalGraphics: {
            fancyGraphics: boolOptions,
            renderClouds: [true, 'fast', false],
            ao: numOptions,
            entityShadows: boolOptions,
            particles: numOptions,
            mipmapLevels: [0, 1, 2, 3, 4],
            useVbo: boolOptions,
            fboEnable: boolOptions,
            enableVsync: boolOptions,
            anaglyph3d: boolOptions,
        },
        normalGraphics: {
            // fov: 0,
            // gamma: 0,
            // saturation: 0,
            // guiScale: 0,
            // bobView: boolOptions,
            // maxFps: 120,
        },
        hotKeys: {
            moveForward: 'W',
            moveBackward: 'S',
            moveLeft: 'A',
            moveRight: 'D',
            Jump: 'Space',
            DropItem: 'Q',
            Talk: 'T',
            OpenOrCloseBag: 'E',
            Viewplayer: 'Tab',
            Steath: 'LeftShift',
            Shortcut1: '1',
            Shortcut2: '2',
            Shortcut3: '3',
            Shortcut4: '4',
            Shortcut5: '5',
            Shortcut6: '6',
            Shortcut7: '7',
            Shortcut8: '8',
            Shortcut9: '9',
        },
    }),
}
</script>

<style>

</style>
