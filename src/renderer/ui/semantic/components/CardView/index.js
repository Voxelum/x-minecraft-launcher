import vuex from 'vuex'
import ModpackCard from './ModpackCard.vue'
import ServerCard from './ServerCard.vue'

export default {
    components: { 'modpack-card': ModpackCard, 'server-card': ServerCard },
    computed: {
        ...vuex.mapGetters('profiles', ['allKeys', 'getByKey']),
    },
    methods: {
        refresh() {
            for (const key of this.allKeys) this.$store.dispatch(`profiles/${key}/refresh`)
        },
    },
    render(createElement) {
        const getByKey = this.getByKey;
        const self = this
        let idx = 0;
        return createElement('div', {
            staticClass: 'ui link cards',
            attrs: {
                style: 'height:105%;overflow: auto',
            },
        }, this.allKeys.map((id) => {
            const source = getByKey(id)
            if (source === null || source === undefined) {
                return createElement('div')
            }
            const option = {
                props: { source, id },
                attrs: {
                    style: 'max-height:45%',
                },
                on: {
                    select(event) { self.$emit('select', event) },
                    delete(event) { self.$emit('delete', event) },
                },
            }
            if (idx < 2) {
                option.props.bound = true;
            }
            idx += 1;
            return createElement(`${source.type}-card`, option)
        }))
    },
}
