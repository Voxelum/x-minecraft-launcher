<template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="server icon"></i>
            {{ isEdit ? $t('server.edit') :$t('server.create')}}
        </div>
        <form class="ui inverted form" :class="{error: nameError|| hostError}">
            <div class="field" :class="{error: nameError}">
                <label>{{$t('name')}}</label>
                <input class="ui basic inverted input" type="text" :placeholder="$t('server.profile')" v-model="name" @keypress="enter">
            </div>
            <div class="field" :class="{error: hostError}">
                <label>{{$t('server.host')}}</label>
                <input class="ui basic inverted input" type="text" :placeholder="$t('server.ipAddress')" v-model="ip" @keypress="enter">
            </div>
            <div class="field">
                <label>{{$t('server.port')}}</label>
                <input class="ui basic inverted input" type="text" placeholder="25565" v-model="port" @keypress="enter">
            </div>
            <div class="ui error message">
                <div class="header">{{$t('actionforbidden')}}</div>
                <div v-if="hostError">{{$t('server.error.requirehost')}}</div>
                <div v-if="nameError">{{$t('server.error.requirename')}}</div>
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
            isEdit: false,

            name: '',
            ip: '',
            port: 25565,
            nameError: false,
            hostError: false,
        }
    },
    mounted() {
        const self = this
        $(this.$el).modal({
            blurring: true,
            onHidden() {
                self.hostError = self.nameError = false;
            }
        })
    },
    computed: {
        id() { return this.$route.params.id; },
        profile() { return this.$store.getters[`profiles/get`](this.id) }
    },
    methods: {
        show(args = {}) {
            const { isEdit } = args;
            this.isEdit = isEdit || false;
            if (this.isEdit) {
                this.profileId = this.id
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
                this.hostError = true
            }
            if (this.name === '' || !this.name) {
                this.nameError = true
            }
            if (this.hostError || this.nameError) return;
            if (!this.port || this.port === '') this.port = '25565'

            $(this.$el).modal('hide')
            if (this.isEdit) {
                this.$store.dispatch(`profiles/${this.id}/edit`, {
                    name: this.name,
                    host: this.ip,
                    port: this.port,
                })
            } else {
                this.$store.dispatch(`profiles/create`, {
                    type: 'server',
                    option: {
                        name: this.name,
                        host: this.ip,
                        port: this.port,
                    }
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
