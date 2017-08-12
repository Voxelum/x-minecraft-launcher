<template>
    <div class="">
        <h5 class="ui horizontal divider header">Critical graphic</h5>
        <option-group :options="criticalGraphics" :source="source" :id="id"></option-group>
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
                // enableVsync: boolOptions,
                fancyGraphics: boolOptions,
                renderClouds: ['true', 'fast', 'false'],
                ao: numOptions,
                entityShadows: boolOptions,
                particles: numOptions,
                mipmapLevels: [0, 1, 2, 3, 4],
                useVBO: boolOptions,
                fboEnable: boolOptions,
            },
        }
    },
    props: ['source', 'id'],
}
</script>

<style>

</style>
