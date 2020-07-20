import VueCompositionApi, { h } from '@vue/composition-api';

import colors from 'vuetify/es5/util/colors';
// import 'vuetify/dist/vuetify.css';
import '@/assets/google.font.css';

import Vue from 'vue';

import 'vuetify/dist/vuetify.min.css';
import Vuetify from 'vuetify/es5/components/Vuetify';
import VCard from 'vuetify/es5/components/VCard';
import VList from 'vuetify/es5/components/VList';
import VChip from 'vuetify/es5/components/VChip';
import VApp from 'vuetify/es5/components/VApp';
import VBtn from 'vuetify/es5/components/VBtn';
import VIcon from 'vuetify/es5/components/VIcon';
import VGrid from 'vuetify/es5/components/VGrid';
import VToolbar from 'vuetify/es5/components/VToolbar';

import provideElectron from '@/providers/provideElectron';
import Logger from './Logger.vue';

Vue.config.productionTip = false;

Vue.use(VueCompositionApi);
Vue.use(Vuetify, {
    theme: {
        primary: colors.green,
        // secondary: colors.green,
        accent: colors.green.accent3,
    },
    components: {
        ...VCard.$_vuetify_subcomponents,
        ...VList.$_vuetify_subcomponents,
        ...VGrid.$_vuetify_subcomponents,
        VChip,
        VApp,
        VBtn,
        VIcon,
        ...VToolbar.$_vuetify_subcomponents,
    },
});

const vue = new Vue({
    setup() {
        provideElectron();
        return () => h(Logger);
    },
});

vue.$mount('#app');
