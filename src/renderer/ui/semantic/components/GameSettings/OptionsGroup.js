import vuex from 'vuex'
import OptionButton from './OptionButton.vue'

export default {
    render(createElement) {
        let currentFields = [];
        const fields = [];
        const mcoptions = this.$store.getters[`profiles/${this.id}/minecraft/options`]
        for (const key in this.options) {
            if (this.options.hasOwnProperty(key)) {
                const option = this.options[key];
                currentFields.push(createElement('option-button', {
                    props: {
                        id: key,
                        options: option,
                        value: mcoptions[key],
                    },
                    on: { change: this.onchange },
                }))
                if (currentFields.length === 2) {
                    fields.push(createElement('div', { attrs: { class: 'ui two basic buttons' } }, currentFields))
                    currentFields = []
                }
            }
        }
        return createElement('div', {}, fields)
    },
    methods: {
        onchange(event) {
            this.$store.commit(`profiles/${this.id}/minecraft/update`, event)
        },
    },
    computed: {

    },
    components: { OptionButton },
    props: ['id', 'options'],
}
