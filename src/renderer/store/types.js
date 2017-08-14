export default {
    getters: {
        profiles: {
            selected: 'profiles/selected',
            allStates: 'profiles/allStates',
        },
    },
    actions: {
        profiles: {
            /**
             *  {type}: modpack or server,  
             *  {option}: the create option of profile
             * , including the infomation like name, host(for server), author(for modpack)
             * 
             */
            create: 'profiles/create',
            /**
             * id: the delete profile id.
             */
            delete: 'profiles/delete',
            /**
             * profileId: the id of the profile will be selected 
             */
            select: 'profiles/select',
            /**
             * {type}: modpack or server.     
             * {option}: the create option of profile
             * , including the infomation like name, host(for server), author(for modpack)
             */
            createAndSelect: 'profiles/createAndSelect',
        },
        server: {
            /**
             * no parameter, refresh the server status
             */
            refresh: profileId => `profiles/${profileId}/refresh`,
        },
        resourcepacks: {
              /**
             * { resource }: the resourceId or resource object will be exported.  
             * { targetDirectory }: the target folder will the resource file be placed.   
             * { option? }: { mode?: the mode to export, can be 'link', 'copy', 'move'. Default is 'link' ,  
             *      fileName?: the fileName of the exported file will be. }
             */
            export: 'resourcepacks/export',
            /**
             * path(s): string file path or array of file paths will be imported 
             */
            import: 'resourcepacks/import',
            /**
             * resource: the string hash of resource object or resource object itself 
             * which will be deleted  
             */
            delete: 'resourcepacks/delete',
            /**
             * {resource}: the string hash of resource object or resource object itself 
             * which will be renamed    
             * {name}: the new resource name  
             */
            rename: 'resourcepacks/rename',
        },
        mods: {
            /**
             * { resource }: the resourceId or resource object will be exported.  
             * { targetDirectory }: the target folder will the resource file be placed.   
             * { option? }: { mode?: the mode to export, can be 'link', 'copy', 'move'. Default is 'link' ,  
             *      fileName?: the fileName of the exported file will be. }
             */
            export: 'mods/export',
            /**
             * path(s): string file path or array of file paths will be imported 
             */
            import: 'mods/import',
            /**
             * resource: the string hash of resource object or resource object itself 
             * which will be deleted  
             */
            delete: 'mods/delete',
            /**
            * {resource}: the string hash of resource object or resource object itself 
            * which will be renamed    
            * {name}: the new resource name  
            */
            rename: 'mods/rename',
        },
        versions: {
            /**
             * versionMeta: the version metadata object, which provided by remote version list
             */
            download: 'versions/download',
            /**
             * No parameter: it will refresh the remote version list 
             */
            refresh: 'versions/refresh',
        },
    },
    mutations: {
        profiles: {
            unselect: 'profiles/unselect',
            select: 'profiles/select',
            add: 'profiles/add',
            remove: 'profile/remove',
        },
        profile: {
            putAll: profileId => `profiles/${profileId}/putAll`,
        },
        auth: {
            select: 'auth/select',
            record: 'auth/record',
        },
        version: {
            /**
             * (list: the remote version list object)
             */
            update: 'versions/update',
            /**
             * (version: string id of version, status: server status)
             */
            updateStatus: 'versions/updateStatus',
        },
    },

}
