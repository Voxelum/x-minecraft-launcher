    <template>
    <div class="">
        <h5 class="ui horizontal divider header">Critical graphic</h5>
        <options-group :options="criticalGraphics" :id="id"></options-group>
        <hot-key-button :initkey="hotKeys.moveForward" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.moveBackward" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.moveLeft" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.moveRight" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Jump" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.DropItem" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Talk" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.OpenOrCloseBag" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Steath" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Viewplayer" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut1" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut2" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut3" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut4" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut5" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut6" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut7" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut8" @keychange="onkeychange"></hot-key-button>
        <hot-key-button :initkey="hotKeys.Shortcut9" @keychange="onkeychange"></hot-key-button>
        /div>
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
            console.log(`Get new key ${newKeyValue}`)
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

        },
        hotKeys: {
            moveForward: 'w',
            moveBackward:'s',
            moveLeft: 'a',
            moveRight: 'd',
            Jump: 'Space',
            DropItem: 'q',
            Talk: 't',
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
