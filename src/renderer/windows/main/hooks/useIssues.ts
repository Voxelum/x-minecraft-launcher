import { Issue, IssueType } from '@universal/store/modules/diagnose';
import { useService, useRouter } from '@/hooks';
import { useDialog } from '.';

export function useIssueHandler() {
    const { fix: fixIssue } = useService('DiagnoseService');
    const { replace } = useRouter();
    const { show: showJavaDialog } = useDialog('java-wizard');
    const { show: showModDialog } = useDialog('download-missing-mods');

    const handlerRegistry: Record<string, () => void> = {};

    function register(issue: IssueType, f: () => void) {
        handlerRegistry[issue] = f;
    }

    register('missingModsOnServer', showModDialog);
    register('unkownMod', () => replace('/mod-setting'));
    register('incompatibleMod', () => replace('/mod-setting'));
    register('incompatibleResourcePack', () => replace('/resource-pack-setting'));
    register('incompatibleJava', showJavaDialog);
    register('requireForge', () => replace('/version-setting'));
    register('requireFabric', () => replace('/version-setting'));

    function fix(issue: Issue, issues: readonly Issue[]) {
        if (issue.autofix) {
            fixIssue(issues);
        } else {
            let handler = handlerRegistry[issue.id];
            if (handler) {
                handler();
            } else {
                console.error(`Cannot fix the issue ${issue.id} as it's not implemented`);
            }
        }
    }
    return { fix };
}
