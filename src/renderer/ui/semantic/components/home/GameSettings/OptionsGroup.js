import vuex from 'vuex'
import OptionButton from './OptionButton'

export default {
    render(createElement) {
        let currentFields = [];
        const fields = [];
        const mcoptions = this.$store.getters[`profiles/${this.id}/mcoptions`]
        for (const key in this.options) {
            if (this.options.hasOwnProperty(key)) {
                const option = this.options[key];
                if (!option) throw new Error(`Cannot find option ${key}`)
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
            console.log(`Eevent ${event}`);
            // this.$store.commit(`profiles/${this.id}/mcoption`, event)
        },
    },
    computed: {

    },
    components: { OptionButton },
    props: ['id', 'options'],
}
