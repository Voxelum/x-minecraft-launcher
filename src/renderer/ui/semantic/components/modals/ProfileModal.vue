   <template>
    <div class="ui basic modal" style="padding:0 20% 0 20%;">
        <div class="ui icon small header">
            <i class="user icon"></i>
            {{$t('user.info')}}
        </div>
        <div class="ui container">
            <table class="ui  very basic collapsing celled inverted table" style="width: 100%">
                <thead>
                    <th>{{$t('user.profile')}}</th>
                    <th></th>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div class="ui inverted header">
                                <i class="address card icon"></i>
                                <div class="content">
                                    {{$t('user.name')}}
                                </div>
                            </div>
                        </td>
                        <td>
                            {{name}}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="ui inverted header">
                                <i class="bug icon"></i>
                                <div class="content">
                                    {{$t('user.id')}}
                                </div>
                            </div>
                        </td>
                        <td>
                            {{id}}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="ui inverted header">
                                <i class="at icon"></i>
                                <div class="content">
                                    {{$t('user.email')}}
                                </div>
                            </div>
                        </td>
                        <td>
                            {{info.email || "None"}}
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <div class="ui inverted header">
                                <i class="calendar icon"></i>
                                <div class="content">
                                    {{$t('user.birth')}}
                                </div>
                            </div>
                        </td>
                        <td>
                            {{info.dateOfBirth ? new Date(info.dateOfBirth).toString(): "None"}}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="actions">
            <div class="ui green ok inverted button">
                <i class="check mark icon"></i> {{$t('ok')}}
            </div>
        </div>
    </div>
</template>
 
<script>
export default {
    methods: {
        show() {
            $(this.$el).modal('show');
        }
    },
    computed: {
        id() {
            return this.info.id || this.$store.getters['user/username']
        },
        name() {
            return this.info.name || this.$store.getters['user/username']
        },
        info() {
            return this.$store.getters['user/info']
        }
    },
}
</script>
