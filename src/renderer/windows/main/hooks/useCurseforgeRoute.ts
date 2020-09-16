import { useRouter } from '@/hooks';
import { ProjectType } from '@universal/entities/curseforge';

export function useCurseforgeRoute() {
    const { replace } = useRouter();
    function searchProjectAndRoute(name: string, type: ProjectType) {
        replace(`/curseforge/${type}?search=${name}`);
    }
    function goProjectAndRoute(projectId: number, type: ProjectType) {
        replace(`/curseforge/${type}/${projectId}`);
    }

    return {
        searchProjectAndRoute,
        goProjectAndRoute,
    };
}

export function useMcWikiRoute() {
    const { replace } = useRouter();
    function searchProjectAndRoute(name: string) {
        replace(`mcwiki?path=https://www.mcmod.cn/s?key=${name}`);
    }
    return {
        searchProjectAndRoute,
    };
}
