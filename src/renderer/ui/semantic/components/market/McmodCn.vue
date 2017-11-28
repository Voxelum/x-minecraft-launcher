<template>
    <div>
        <div v-if="loading" class="ui active inverted dimmer">
            <div class="ui text loader">Loading</div>
        </div>
        <div v-for="cat in categories" :key="cat.url" style="padding: 20px 0 20px 0;">
            <div-header>
                {{cat.title}}
            </div-header>
            <div class="ui link cards">
                <router-link :to="{ path: 'mcmodcn/' + item.id }" class="card" v-for="item in cat.list" :key="item.url">
                    <div class="image">
                        <img :src="item.image">
                    </div>
                    <div class="content">
                        <div class="header">{{item.title}}</div>
                    </div>
                    <div class="like icons">
                        <span>
                            <i class="fire icon"></i>
                            hot : {{item.view}}
                        </span>
                        <span>
                            <i class="thumbs up icon"></i>
                            like : {{item.likes}}
                        </span>
                        <span>
                            <i class="heart icon"></i>
                            favorite : {{item.favor}}
                        </span>
                    </div>
                    <div class="ui divider"></div>
                    <div class="item icons">
                        <span class="image" v-for="i in item" :key="i.id">
                            <img :src="i.image">
                        </span>
                    </div>
                </router-link>
            </div>
        </div>
    </div>
</template>

<script>
import vuex from 'vuex'

export default {
    data: () => ({
        categories: [],
        loading: false,
    }),
    mounted() {
        if (this.categories.length === 0) {
            this.loading = true;
            this.view().then(data => {
                console.log(data);
                this.categories = data.content;
                this.loading = false;
            });
        }
    },
    methods: {
        ...vuex.mapActions('mcmod.cn', ['view', 'viewRandom', 'detail'])
    }
}
</script>

<style>

</style>
