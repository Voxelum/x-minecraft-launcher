import vuex from 'vuex';
import OptionButton from './OptionButton';

export default {
    render(createElement) {
        let currentFields = [];
        const fields = [];
        const get = this.$store.getters[`profiles/${this.id}/settings/get`];
        for (const key in this.options) {
            if (this.options.hasOwnProperty(key)) {
                const option = this.options[key];
                if (!option) throw new Error(`Cannot find option ${key}`);
                currentFields.push(createElement('option-button', {
                    props: {
                        id: key,
                        options: option,
                        value: get(key),
                    },
                    on: { change: this.onchange },
                }));
                if (currentFields.length === 2) {
                    fields.push(createElement('div', { attrs: { class: 'ui two basic buttons' } }, currentFields));
                    currentFields = [];
                }
            }
        }
        return createElement('div', {}, fields);
    },
    methods: {
        onchange(event) {
            this.$store.commit(`profiles/${this.id}/settings/edit`, event);
        },
    },
    computed: {

    },
    components: { OptionButton },
    props: ['id', 'options'],
};
