    <template>
    <div class="">
        <h5 class="ui horizontal divider header"><label>{{$t('criticalGraphics')}}</label></h5>
        <options-group :options="criticalGraphics" :id="id"></options-group>
        <h5 class="ui horizontal divider header"><label>{{$t('hotkeyChanges')}}</label></h5>
        <hot-key-button :name="$t('criticalGraphics')" :initkey="hotKeys.moveForward" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Move Backward" :initkey="hotKeys.moveBackward" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Move Left" :initkey="hotKeys.moveLeft" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Move Right" :initkey="hotKeys.moveRight" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Jump" :initkey="hotKeys.Jump" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Drop Item" :initkey="hotKeys.DropItem" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Talk" :initkey="hotKeys.Talk" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Open or Close Bag" :initkey="hotKeys.OpenOrCloseBag" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Steath" :initkey="hotKeys.Steath" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="View player" :initkey="hotKeys.Viewplayer" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut1" :initkey="hotKeys.Shortcut1" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut2" :initkey="hotKeys.Shortcut2" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut3" :initkey="hotKeys.Shortcut3" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut4" :initkey="hotKeys.Shortcut4" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut5" :initkey="hotKeys.Shortcut5" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut6" :initkey="hotKeys.Shortcut6" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut7" :initkey="hotKeys.Shortcut7" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut8" :initkey="hotKeys.Shortcut8" @keychange="onkeychange"></hot-key-button>
        <hot-key-button name="Shortcut9" :initkey="hotKeys.Shortcut9" @keychange="onkeychange"></hot-key-button>
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
            moveForward: 'W',
            moveBackward:'S',
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
