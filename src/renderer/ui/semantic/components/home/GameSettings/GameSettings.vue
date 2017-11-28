<template>
    <div class="">
        <h5 class="ui horizontal divider header">Critical graphic</h5>
        <options-group :options="criticalGraphics" :id="id"></options-group>
        <hot-key-button :initkey="hotKeys.moveForward" @keychange="onkeychange"></hot-key-button>
        <hot-key-button initkey="O"></hot-key-button>
        <hot-key-button initkey="O"></hot-key-button>
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
            moveForward: 'w'
        },
    }),
}
</script>

<style>

</style>
