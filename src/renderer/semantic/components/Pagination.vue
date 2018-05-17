<template>
    <div class="ui pagination menu" :class="{secondary:secondary}">
        <a class="item" :class="{active: p===page, disabled: p==='...'}" v-for="p of pagesCache" :key="p" @click="page = p">
            {{p}}
        </a>
    </div>
</template>

<script>
export default {
    data() {
        return {
            page: 1,
            pagesCache: [],
        }
    },
    watch: {
        page() {
            this.calculatePages(this.page, this.pages)
            this.$emit('page', this.page)
        },
        pages() {
            this.calculatePages(this.page, this.pages)
        },
    },
    mounted() {
        this.calculatePages(this.page, this.pages)
        console.log(`${this.page}/${this.pages}`)
    },
    methods: {
        calculatePages(page, total) {
            const start = Math.max(page - 2, 1)
            const end = Math.min(page + 3, total);
            const pages = []
            if (start > 1) pages.push(1, '...');
            for (let i = start; i < end; i += 1) pages.push(i);
            if (end < total) pages.push('...', total)
            this.pagesCache = pages;
        }
    },
    props: {
        pages: {
            type: Number,
            default: 1,
        },
        secondary: {
            type: Boolean,
            default: true,
        },
    },
}
</script>

<style>

</style>
