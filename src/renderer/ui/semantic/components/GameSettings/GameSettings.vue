<template>
    <div class="">
        <h5 class="ui horizontal divider header">Critical graphic</h5>
        <options-group :options="criticalGraphics" :id="id"></options-group>
    </div>
</template>

<script>
import vuex from 'vuex'
import OptionMenu from './OptionMenu.vue'
import OptionsGroup from './OptionsGroup'

const boolOptions = [true, false]
const numOptions = [0, 1, 2]

export default {
    components: { OptionsGroup },
    computed: {
        ...vuex.mapGetters('settings', {
            templates: 'options',
        }),
    },
    data() {
        return {
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

            }
        }
    },
    props: ['id'],
}
</script>

<style>

</style>
