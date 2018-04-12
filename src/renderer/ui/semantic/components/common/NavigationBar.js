import vuex from 'vuex'

export default {
    render(createElement) {
        const rendered = []
        for (const p of this.paths) {
            let icon = '';
            switch (p.name) {
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
                right.push(this.renderLinkRight(createElement, '/semantic/profile', this.$t('home'), 'home icon'))
            }
        }
        return createElement('div', {
            attrs: { class: 'eleven wide column' },
        }, [...right, createElement('div', { attrs: { class: 'ui breadcrumb' } }, rendered)])
    },
    computed: {
        paths() {
            const splited = this.$route.fullPath.split('/').slice(2);
            const outPath = [];
            for (let i = 0; i < splited.length; i += 1) {
                outPath.push({ name: splited[i], path: ['/semantic', ...splited.slice(0, i + 1)].join('/') });
            }
            if (splited[0] === 'profile') {
                outPath[0].name = 'home';
                if (splited.length === 3) {
                    const current = outPath.pop();
                    outPath.pop();
                    current.name = this.$store.state.profiles[splited[1]].name
                    outPath.push(current);
                }
            }
            return outPath;
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
            }, [createElement('i', {
                attrs: {
                    class: icon,
                },
            }), name])])
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
                    click() {
                        self.$router.replace(path)
                    },
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
