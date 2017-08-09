import vuex from 'vuex'
import { GameSetting } from 'ts-minecraft'
import OptionButton from './OptionButton.vue'
import OptionMenu from './OptionMenu.vue'

const boolOptions = [true, false]
const numOptions = [0, 1, 2]


export default {
    render(createElement) {
        const dropdown = createElement('option-menu')
        let currentFields = [];
        const fields = []
        for (const key in this.options) {
            if (this.options.hasOwnProperty(key)) {
                const option = this.options[key];
                currentFields.push(createElement('option-button', { props: { id: key, options: option } }))
                if (currentFields.length === 2) {
                    fields.push(createElement('div', { attrs: { class: 'ui two basic buttons' } }, currentFields))
                    currentFields = []
                }
            }
        }
        if (currentFields.length !== 0) fields.push(createElement('div', { attrs: { class: 'fields' } }, currentFields))
        return createElement('div', {
            attr: {
                class: 'ui container',
            },
        }, [dropdown, /* createElement('div', { attrs: { class: 'ui divider' } }), */ ...fields])
    },
    data() {
        return {
            options: {

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
            enableAdvanced: true,
        }
    },
    computed: {
        ...vuex.mapGetters('settings', {
            templates: 'options',
        }),
    },
    mounted() {
        $('#templatesDropdown').dropdown();
    },
    components: { OptionButton, OptionMenu },
    // props: ['source', 'id'],
}
