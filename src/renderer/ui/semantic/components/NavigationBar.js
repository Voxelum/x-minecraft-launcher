import vuex from 'vuex'

export default {
    render(createElement) {
        const rendered = []
        for (const p of this.paths) {
            let icon = '';
            let name = p.name;
            switch (name) {
                case 'home':
                    name = this.$t(name)
                    icon = 'home icon'
                    break;
                case 'market':
                    name = this.$t(name)
                    icon = 'shop icon'
                    break;
                case 'curseforge':
                    name = this.$t(name)
                    icon = 'fire icon'
                    break;
                default:
                    break;
            }
            rendered.push(this.renderLink(createElement, p.path, name, icon),
                this.renderArrow(createElement))
        }
        rendered.pop()
        const right = [];
        if (this.paths[0]) {
            if (this.paths[0].name === 'home') {
                right.push(this.renderLinkRight(createElement, '/semantic/market', this.$t('market'), 'shop icon'))
            } else {
                right.push(this.renderLinkRight(createElement, '/semantic/cards', this.$t('home'), 'home icon'))
            }
        }
        return createElement('div', {
            attrs: { class: 'eleven wide column' },
        }, [...right, createElement('div', { attrs: { class: 'ui breadcrumb' } }, rendered)])
    },
    computed: {
        ...vuex.mapState({ path: 'url' }),
        paths() {
            const splited = this.path.split('/').slice(1);
            const paths = []
            switch (splited[1]) {
                case 'cards':
                    paths.push({ path: this.path, name: 'home' });
                    break;
                case 'modpack':
                case 'server':
                    paths.push({ path: `/${splited[0]}/cards`, name: 'home' }, {
                        path: this.path,
                        name: this.$store.state.profiles[splited[2]].name,
                    });
                    break;
                case 'market':
                    paths.push({ path: this.path, name: 'market' });
                    break;
                case 'curseforge':
                    paths.push({ path: `/${splited[0]}/market`, name: 'market' }, {
                        path: `/${splited[0]}/curseforge`,
                        name: 'curseforge',
                    });
                    if (splited.length > 2) {
                        paths.push({
                            path: this.path,
                            name: splited[2],
                        })
                    }
                    break;
                case 'mcmodcn':
                    paths.push({ path: `/${splited[0]}/market`, name: 'market' }, {
                        path: this.path,
                        name: 'mcmod',
                    });
                    break;
                case 'mcmodproject':
                    break;
                default: break;
            }
            return paths;
        },
    },
    methods: {
        renderArrow(createElement) {
            return createElement('i', {
                attrs: {
                    class: 'right chevron inverted icon divider',
                    style: 'color:white',
                },
            })
        },
        renderLinkRight(createElement, path, name, icon) {
            return createElement('div', {
                attrs: { class: 'section' },
            }, [createElement('a', {
                attrs: {
                    href: `#${path}`,
                    class: 'ui inverted circular right floated button non-moveable',
                },
            },
                [createElement('i', {
                    attrs: {
                        class: icon,
                    },
                }), name,
                ])])
        },
        renderLink(createElement, path, name, icon = '') {
            return createElement('div', {
                attrs: { class: 'section' },
            }, [createElement('a', {
                attrs: {
                    href: `#${path}`,
                    class: 'ui inverted circular button non-moveable',
                },
            },
                [createElement('i', {
                    attrs: {
                        class: icon,
                    },
                }), this.$t(name),
                ])])
        },
    },
}
