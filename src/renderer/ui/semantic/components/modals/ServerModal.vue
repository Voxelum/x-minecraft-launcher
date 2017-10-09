<template>
    <div class="ui basic modal" :class="{error: hasError}" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="server icon"></i>
            {{ isEdit ? $t('server.edit') :$t('server.create')}}
        </div>
        <form class="ui inverted form">
            <div class="field">
                <label>{{$t('name')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="Name Of server" v-model="name" @keypress="enter">
            </div>
            <div class="field">
                <label>{{$t('server.host')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="IP address" v-model="ip" @keypress="enter">
            </div>
            <div class="field">
                <label>{{$t('server.port')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="25565" v-model="port" @keypress="enter">
            </div>
            <div class="ui error message">
                <div class="header">Action Forbidden</div>
                <p>IP address is required! Please enter it!</p>
            </div>
        </form>
        <div class="actions">
            <div class="ui basic cancel inverted button">
                <i class="close icon"></i>{{$t('no')}}</div>
            <div class="ui green basic inverted button" @click="accept">
                <i class="check icon"></i>
                {{ isEdit ? $t('save') : $t('create')}}
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            profileId: '',
            isEdit: false,

            name: '',
            ip: '',
            port: 25565,
            hasError: false,
        }
    },
    mounted() {
        const self = this
        $(this.$el).modal({ blurring: true, })
    },
    computed: {
        profile() {
            return this.$store.getters[`profiles/getByKey`](this.profileId)
        }
    },
    methods: {
        show(args = {}) {
            const { isEdit } = args;
            this.isEdit = isEdit || false;
            if (this.isEdit) {
                this.profileId = this.$store.getters['profiles/selectedKey']
                this.ip = this.profile.host;
                this.port = this.profile.port;
                this.name = this.profile.name;
            } else {
                this.ip = ''
                this.name = ''
                this.port = 25565
            }
            $(this.$el).modal('show')
        },
        accept() {
            if (!this.ip || this.ip === '') {
                this.hasError = true
                return;
            }
            if (!this.port || this.port === '') this.port = '25565'

            $(this.$el).modal('hide')
            if (this.isEdit) {
                this.$store.commit(`profiles/${this.profileId}/putAll`, {
                    name: this.name,
                    host: this.ip,
                    port: this.port,
                })
            } else {
                this.$store.commit(`profiles/create`, {
                    type: 'server',
                    name: this.name,
                    host: this.ip,
                    port: this.port,
                })
            }
        },
        enter(event) {
            if (event.keyCode != 13) return
            this.accept()
        }
    }
}
</script>

<style>

</style>
