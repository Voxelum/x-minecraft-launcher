import vuex from 'vuex'
import ProfileCard from './cards/ProfileCard.vue'
import ServerCard from './cards/ServerCard.vue'

export default {
    components: { 'modpack-card': ProfileCard, 'server-card': ServerCard },
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
        return createElement('div', { staticClass: 'ui link cards' }, this.allKeys.map((id) => {
            const source = getByKey(id)
            const option = {
                props: { source, id },
                on: {
                    select(event) { self.$emit('select', event) },
                    delete(event) { self.$emit('delete', event) },
                },
            }
            return createElement(`${source.type}-card`, option)
        }))
    },
}
