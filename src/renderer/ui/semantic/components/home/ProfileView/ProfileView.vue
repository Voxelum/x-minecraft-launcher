<template>
    <div class="ui vertically grid" style="overflow: hidden;">
        <component v-if="type !== ''" :is="header"></component>
        <div class="row">
            <div-header>
                <label class="cursor: pointer" @mouseenter="openBar">
                    <i :class="selectingIcon"></i>{{selecting}}
                </label>
            </div-header>
        </div>
        <div ref="pushable" class="stretched row pushable" style="min-height:340px;max-height:340px; border-right-width:0;border-right-color:transparent;border-radius:0px;">
            <div ref="sidebar" class="ui vertical sidebar secondary pointing menu grid" style="background-color:white;width:200px;border-right-style:none;" @mouseleave="closeBar">
                <div class="sixteen wide column">
                    <router-link to="version" class="item"> {{$tc('version.name', 0)}}</router-link>
                    <router-link to="setting" class="item" style="border-bottom:0;border-top:0;">{{$tc('setting.name', 0)}}</router-link>
                    <router-link to="map" class="item"> {{$tc('map.name', 0)}} </router-link>
                    <router-link to="resourcepack" class="item" style="border-bottom:0;border-top:0;">{{$tc('resourcepack.name', 0)}}</router-link>
                    <router-link to="mod" class="item">{{$tc('mod.name', 0)}}</router-link>
                    <router-link to="launchsetting" class="item">{{$t('launchsetting.name', 0)}}</router-link>
                </div>
            </div>
            <div class="pusher ui basic segment" style="overflow:auto;min-height: 315px; width:100%">
                <transition name="fade" mode="out-in">
                    <router-view style="padding: 0px 20px 0px 20px; overflow:auto; min-height: inherit;"></router-view>
                </transition>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    components: {
        ['modpack-header']: () => import('./ModpackHeader'),
        ['server-header']: () => import('./ServerHeader'),
    },
    computed: {
        type() {
            return this.$store.getters[`profiles/${this.id}/type`];
        },
        header() {
            return `${this.type}-header`;
        },
        selectingRaw() {
            const last = this.$route.path.lastIndexOf('/');
            return this.$route.path.substring(last + 1, this.$route.path.length);
        },
        selecting() {
            return this.$tc(this.selectingRaw + '.name', 0);
        },
        selectingIcon() {
            let icon;
            switch (this.selectingRaw) {
                case 'map': icon = 'map outline icon'; break;
                case 'setting': icon = 'wrench icon'; break;
                case 'launchsetting': icon = 'rocket icon'; break;
                case 'resourcepack': icon = 'image outline icon'; break;
                case 'mod': icon = 'archive icon'; break;
                case 'launchsetting': icon = 'rocket icon'; break;
                case 'version': icon = 'barcode icon'; break;
            }
            const clz = {
                [icon]: true,
            };
            return clz;
        },
        id() { return this.$route.params.id },
    },
    methods: {
        modify(event) {
            this.$store.dispatch(`profiles/${this.id}/edit`, { description: event.target.value })
        },
        refresh() {
            this.$store.dispatch('$refresh')
        },
        openBar() {
            $(this.$refs.sidebar).sidebar('show')
        },
        closeBar() {
            $(this.$refs.sidebar).sidebar('hide')
        }
    },
    mounted() {
        this.refresh();
        $(this.$refs.sidebar)
            .sidebar({
                context: $(this.$refs.pushable),
                dimPage: false
            })
            .sidebar('setting', 'transition', 'overlay')
    },
}
</script>
