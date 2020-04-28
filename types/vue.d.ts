
/* eslint-disable */
declare module '*.vue' {
    import Vue from 'vue';
    export function $t(s: string): string;

    export default Vue;
}

declare module 'vue/types/vue' {
    interface Vue {
    }
}

declare module '@vue/composition-api/dist/component/component' {
    type ComponentRenderProxy<P = {}, S = {}, PublicProps = P> = {
        $t(s: string): string;
    }
}

declare module '@vue/composition-api/index' {
    type ComponentRenderProxy<P = {}, S = {}, PublicProps = P> = {
        $t(s: string): string;
    }
}
