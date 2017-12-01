<template>
    <div>
        <div class="ui items">
            <div class="item">
                <div class="large   ">
                    <img class="ui large image" :src="data.image">
                </div>
                <div class="content">
                    <a class="header">
                        <font size="6">{{data.title}}</font>
                    </a>
                    <span class="subheader"> {{data.subTitle}} </span>
                    <br>
                    <br>
                    <div class="ui grid">
                        <div class="two column row">
                            <div class="column">
                                <div class="ui large label">
                                    模组类型： {{data.modType}}
                                </div>
                            </div>
                            <div class="column">
                                <div class="ui large label">
                                    {{data.recordTime}}
                                </div>
                            </div>
                        </div>
                        <div class="two column row">
                            <div class="column">
                                <div class="ui large label">
                                    {{data.author}}
                                </div>
                            </div>
                            <div class="column">
                                <div class="ui large label">
                                    {{data.lastModifiedTime}}
                                </div>
                            </div>
                        </div>
                        <div class="two column row">
                            <div class="column">
                                <div class="ui large label">
                                    {{data.mod}}
                                </div>
                            </div>
                            <div class="column">
                                <div class="ui large label">
                                    {{data.lastRecommendTime}}
                                </div>
                            </div>
                        </div>
                        <div class="two column row">
                            <div class="column">
                                <div class="ui large label">
                                    {{data.modifyCount}}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>

    </div>

</template>

<script>
import vuex from 'vuex'

export default {
    data: () => ({
        loading: true,
        /**
         * @type {McModCN.Mod}
         */
        data: {},
    }),
    props: ['id'],
    methods: {
        ...vuex.mapActions('mcmod.cn', ['detail'])
    },
    mounted() {
        if (Object.keys(this.data).length === 0) {
            if (!this.id) throw new Error('Unexpected missing page id!')
            this.loading = true;
            this.detail(this.id).then(data => { this.data = data; console.log(data); this.loading = false });
        }
    },
}
</script>

<style>

</style>
