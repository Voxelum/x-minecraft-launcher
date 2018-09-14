import vuex from 'vuex';
import draggable from 'vuedraggable';

export default {
    name: 'CardView',
    components: {
        draggable,
        'modpack-card': () => import('./ModpackCard'),
        'server-card': () => import('./ServerCard'),
    },
    computed: {
        ...vuex.mapGetters('profiles', ['ids', 'get']),
    },
    created() {
        this.refresh(false);
        this.$ipc.on('refresh', this.refresh);
    },
    methods: {
        refresh(force = true) { this.ids.forEach(id => this.$store.dispatch(`profiles/${id}/refresh`, force)); },
    },
    render(createElement) {
        const getByKey = this.get;
        const self = this;
        let idx = 0;
        return createElement('draggable', {
            staticClass: 'ui link cards',
            attrs: {
                style: 'height: 105%; overflow: auto;',
            },
            props: {
                value: self.$store.state.profiles.all,
            },
            on: {
                input(event) {
                    self.$store.commit('profiles/all', event);
                },
            },
        }, this.ids.map((id) => {
            const source = getByKey(id);
            if (source === null || source === undefined) {
                return createElement('div');
            }
            const option = {
                props: { source, id },
                attrs: {
                    style: 'max-height:45%;',
                },
                on: {
                    select(eid, esource) {
                        console.log(`select ${`${esource.type}/${eid}`}`);
                        self.$router.push(`profile/${eid}`);
                    },
                    delete(eid, esource) {
                        self.$ipc.emit('modal', 'generic', {
                            icon: 'archive',
                            header: self.$t(`${esource.type}.delete.name`),
                            content: self.$t(`${esource.type}.delete.description`),
                            acceptColor: 'red',
                            acceptIcon: 'trash',
                            accept: self.$t('delete.yes'),
                            denyIcon: 'close',
                            deny: self.$t('delete.no'),
                            onAccept() {
                                self.$store.dispatch('profiles/delete', eid);
                            },
                        });
                    },
                },
            };
            if (idx <= 2) {
                option.props.bound = true;
            }
            idx += 1;
            return createElement(`${source.type}-card`, option);
        }));
    },
};
