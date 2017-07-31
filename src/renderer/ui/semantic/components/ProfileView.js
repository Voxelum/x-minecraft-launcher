import vuex from 'vuex'
import ModpackView from './profiles/ModpackView.vue'
import ServerView from './profiles/ServerView.vue'

export default {
    components: { modpack: ModpackView, server: ServerView },
    computed: {
        ...vuex.mapGetters('profiles', ['selected', 'selectedKey']),
    },
    methods: {
    },
    render(createElement) {
        console.log('on render profiles-view');
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
