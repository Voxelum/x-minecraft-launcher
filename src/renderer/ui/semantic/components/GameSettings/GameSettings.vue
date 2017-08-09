<template>
    <div>
        <div id="templatesDropdown" class="ui search selection dropdown">
            <i class="dropdown icon"></i>
            <div class="menu">
                <div class="item" v-for="(key, index) in templates" :key="key">
                    {{index}}
                </div>
            </div>
        </div>
        <div class="ui segment" :class="{disabled : !enableAdvanced}">
            <option-button v-for="(option, index) in options" :key="index" :id="index" :options="option"></option-button>
        </div>
    </div>
</template>

<script>
import OptionButton from './OptionButton'
import vuex from 'vuex'
import { GameSetting } from 'ts-minecraft'

const boolOptions = [true, false]
const numOptions = [0, 1, 2]
export default {
    data() {
        return {
            options: {
                useVBO: boolOptions,
                fboEnable: boolOptions,
                enableVsync: boolOptions,
                fancyGraphics: boolOptions,
                renderClouds: ['true', 'fast', 'false'],
                // forceUnicodeFont: boolOptions,
                // autoJump: boolOptions,
                entityShadows: boolOptions,
                ao: numOptions,
                mipmapLevels: [0, 1, 2, 3, 4],
                particles: numOptions,
            },
            enableAdvanced: true,
        }
    },
    computed: {
        ...vuex.mapGetters('settings', {
            templates: 'options'
        }),
    },
    mounted() {
        $('#templatesDropdown').dropdown();
    },
    components: { OptionButton },
    // props: ['source', 'id'],
}
</script>

<style>

</style>
