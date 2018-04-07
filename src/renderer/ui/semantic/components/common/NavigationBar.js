import vuex from 'vuex'

export default {
    render(createElement) {
        const rendered = []
        for (const p of this.paths) {
            let icon = '';
            switch (name) {
                case 'home':
                    icon = 'home icon'
                    break;
                case 'market':
                    icon = 'shop icon'
                    break;
                case 'curseforge':
                    icon = 'fire icon'
                    break;
                default:
                    break;
            }
            rendered.push(this.renderLink(createElement, p.path, this.$t(p.name), icon),
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
        paths() {
            const path = this.$route.fullPath;
            const splited = path.split('/').slice(1);
            switch (splited[1]) {
                case 'cards':
                    return [{ path, name: 'home' }];
                // case 'modpack':
                // case 'server':
                case 'profile':
                    if (splited.length < 3) throw new Error(`Unexpected path ${splited}`)
                    return [{ path: `/${splited[0]}/cards`, name: 'home' },
                    { path, name: this.$store.state.profiles[splited[2]].name }];
                case 'market':
                    return [{ path, name: 'market' }];
                case 'curseforge':
                    if (splited.length > 2) {
                        return [{ path: `/${splited[0]}/market`, name: 'market' },
                        { path: `/${splited[0]}/curseforge`, name: 'curseforge' },
                        { path, name: splited[2] }]
                    }
                    return [{ path: `/${splited[0]}/market`, name: 'market' },
                    { path: `/${splited[0]}/curseforge`, name: 'curseforge' }]
                case 'mcmodcn':
                    if (splited.length > 2) {
                        return [{ path: `/${splited[0]}/market`, name: 'market' },
                        { path: `/${splited[0]}/mcmodcn`, name: 'mcmod' },
                        { path, name: splited[2] }]
                    }
                    return [{ path: `/${splited[0]}/market`, name: 'market' },
                    { path, name: 'mcmod' }];
                default: return [];
            }
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
            const self = this;
            return createElement('div', {
                attrs: { class: 'section' },
            }, [createElement('a', {
                attrs: {
                    class: 'ui inverted circular right floated button non-moveable',
                },
                on: {
                    click() { self.$router.replace(path) },
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
            const self = this;
            return createElement('div', {
                attrs: { class: 'section' },
            }, [createElement('a', {
                attrs: {
                    // to: path,
                    // href: `#${path}`,
                    class: 'ui inverted circular button non-moveable',
                },
                on: {
                    click() { self.$router.replace(path) },
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
