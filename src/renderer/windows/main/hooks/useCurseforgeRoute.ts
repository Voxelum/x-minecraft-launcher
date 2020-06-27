import { useRouter } from '@/hooks';
import { ProjectType } from '@universal/store/modules/curseforge';

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
