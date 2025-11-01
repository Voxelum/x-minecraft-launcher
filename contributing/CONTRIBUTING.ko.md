### 기술 스택 및 간단한 배경

이 문서에서는 이 프로젝트에서 쓰는 툴체인과 런타임 개요를 설명해요.

프로젝트 전반적으로 사용하는 것들:

- [Node.js >=18.17.0](https://nodejs.org/) — 코어 라이브러리와 기본 실행 환경이에요.
- [Electron 27](https://electron.atom.io) — 런처의 실제 실행 환경이에요.
- [pnpm](https://pnpm.io/) — 모노레포 패키지 관리를 위해 사용돼요.
- [TypeScript](https://www.typescriptlang.org/) — 프로젝트 전체에서 가능한 한 TypeScript로 작성돼요.

메인 프로세스(Electron) 관련:

- [esbuild](https://esbuild.github.io/) — 메인 프로세스 TypeScript 빌드에 사용돼요.

렌더러(프론트엔드) 관련:

- [Vue](https://vuejs.org) — UI 빌드에 사용돼요.
- [Vite](https://vitejs.dev/) — 빌드 시스템이에요.
- [Vuetify](https://vuetifyjs.com/) — 컴포넌트 라이브러리로 사용돼요.
- [Windi CSS](https://windicss.org/) — CSS 도구로 사용돼요.
- [Vue Composition API](https://github.com/vuejs/composition-api) — Vue 2에서 컴포지션 API를 사용하게 해 주는 브리지예요. Vuetify가 Vue 3로 업그레이드되면 이 브리지는 제거될 예정이에요.

### 프로젝트 구조

![diagram](/assets/diagram.svg)

- xmcl
  - 이 저장소에 서브모듈로 연결된 [launcher-core](https://github.com/voxelum/minecraft-launcher-core-node) 리포지토리가 있어요.
  - 마인크래프트 설치 및 실행 로직의 핵심을 구현하고, 라이브러리로 노출해요.
- xmcl-electron-app
  - Electron을 사용해 런타임을 구현해요.
  - 직접적으로 `xmcl-runtime`에 의존해요.
  - `xmcl-keystone-ui`에 암묵적으로 의존하고 있어요(임시적이며 나중에 제거될 수 있어요).
- xmcl-keystone-ui
  - 런처의 주요 기본 UI에요.
  - 100% 브라우저 호환이며 Electron API를 포함하지 않아요.
- xmcl-runtime
  - 런처 아키텍처의 핵심 구현이에요. Node.js만 필요하고 Electron 런타임은 필요하지 않아요.
- xmcl-runtime-api
  - XMCL 런타임을 위한 공유 코드와 API예요. 렌더러(브라우저 측) 앱에서 사용할 수 있어요.


### 개념 / 구조

런처는 "서버/클라이언트" 또는 "메인/렌더러"로 구성돼요. 이 둘은 Electron의 [ipcMain](https://electronjs.org/docs/api/ipc-main)과 [ipcRenderer](https://electronjs.org/docs/api/ipc-renderer)로 통신해요.

메인은 런처의 백엔드 역할을 해요. 윈도우와 앱의 영속 데이터/상태를 관리해요. 상태 관리는 [Vuex](https://vuex.vuejs.org/)로 처리돼요. Vuex의 커밋이 발생하면 변경된 [mutation 정보]를 포함한 ipc 메시지를 모든 렌더러로 방송해요. 동시에 수정된 모듈의 저장 동작을 트리거해 디스크에 변경 사항을 기록해요.

렌더러는 단순히 메인과 통신하는 브라우저들이에요. 렌더러는 스토어의 복사본을 유지해요(전체 복사 혹은 부분 복사일 수 있어요). 사용자의 입력은 [action]이나 [commit]을 트리거하고, 그 변경은 메인으로 동기화돼요. 개발자는 렌더러를 일반적인 Vue 앱처럼 취급하면 돼요—로컬 커밋과 액션은 자동으로 메인에 전송돼요.

### 코드 읽기 권장 경로

특정 페이지 로직에 관심이 있다면 `xmcl-keystone-ui/src/windows/main/views`를 보세요. 이 폴더 아래의 `.vue` 파일들이 런처에서 주로 사용되는 컴포넌트들이에요. 파일 이름의 접두사는 UI의 도메인을 나타내요.

예시:

1. `AppSideBar.vue`는 사이드바 컴포넌트고, `AppSideBarInstanceItem.vue`는 인스턴스를 표시하는 `AppSideBar.vue` 내에서 사용하는 컴포넌트예요.
2. `Curseforge.vue`는 CurseForge 페이지 컴포넌트이고, `CurseforgeCategories.vue`는 `Curseforge.vue`에서 사용하는 카테고리 카드예요.

코어 로직에 관심이 있다면 `xmcl-runtime/services/`를 보세요. 이 폴더 아래의 각 파일은 런처 로직의 특정 도메인/서비스를 나타내요. 이 과정에서 `xmcl-runtime-api/services/` 아래의 대응하는 파일들도 함께 확인하세요—실제 서비스의 인터페이스를 선언하고 있어요.

예시:

1. `xmcl-runtime/services/InstanceService.ts`에는 인스턴스 추가/제거/갱신의 API 구현이 들어 있어요. `xmcl-runtime-api/services/InstanceService.ts`에는 `InstanceService`의 인터페이스가 선언돼 있어요.
2. `xmcl-runtime/services/InstanceVersionService.ts`에는 인스턴스 버전 상태를 검사하는 구현이 있어요. 어떤 버전을 인스턴스가 사용할지, 해당 버전을 설치해야 하는지 등을 결정해요.
3. `xmcl-runtime/services/InstallService.ts`에는 Minecraft/Forge/Fabric 등 설치 관련 API 구현이 있어요.
4. `xmcl-runtime/services/LaunchService.ts`에는 인스턴스를 실행하는 API 구현이 있어요.

## 기여하기

VSCode로 프로젝트를 여는 것을 권장해요.

### 시작하기

#### 클론

서브모듈 플래그 `--recurse-submodules`를 사용해 프로젝트를 클론하세요.

```bash
git clone --recurse-submodules https://github.com/Voxelum/x-minecraft-launcher
```

만약 `--recurse-submodules`를 빼먹었다면, 서브모듈을 수동으로 초기화 및 업데이트해야 해요.

```bash
git submodule init
git submodule update
```

#### 설치

[pnpm](https://pnpm.io)를 사용해 의존성을 설치하세요:

```
pnpm install
```

<details>
  <summary>중국에서 의존성(예: Electron) 설치가 느릴 때 해결 방법</summary>

  Git Bash를 열고 `pnpm i`를 실행하기 전에 `registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/"`를 붙여서 실행하세요. 이렇게 하면 국내(알리바바 제공) npm과 Electron 미러를 사용해요.

  최종 명령은 아래와 같아요:

  ```bash
  registry=https://registry.npm.taobao.org electron_mirror="https://npm.taobao.org/mirrors/electron/" pnpm i
  ```

</details>

#### 환경 변수 설정

`xmcl-electron-app` 아래에 `.env` 파일을 만들어 `CURSEFORGE_API_KEY`를 설정해야 해요. 이 `.env` 파일은 `.gitignore`에 추가돼 있어요.

**CURSEFORGE API 키를 절대 유출하면 안 돼요.**

#### 런처 시작하기

런처를 실행하려면 아래 단계를 따라 하세요.

##### VSCode에서

`Run and Debug` 섹션에서 `Electron: Main (launch)` 프로필을 사용하면 Electron을 시작할 수 있어요(F5 단축키로 시작 가능해요).

##### VSCode 외부에서

터미널 하나를 열어 UI용 개발 서버를 시작하세요:

```bash
# UI용 개발 서버 시작
npm run dev:renderer
```

다른 터미널 하나를 열어 메인 프로세스 코드를 워치 모드로 시작하세요:

```bash
# 메인 프로세스 감시 시작
npm run dev:main
```

#### 코드 '핫' 변경

코드를 수정하고 실행 중인 런처에 변경을 반영하려면 아래 설명을 보세요.

##### 브라우저 프로세스

Vite가 핫 리로드를 제공하므로 대부분 자동으로 업데이트돼요. 문제가 있으면 `Ctrl+R`로 브라우저를 새로 고침하면 돼요.

##### 메인 프로세스

VSCode로 런처를 실행 중이면, 코드를 변경한 뒤 VSCode 디버거의 리로드 버튼을 누르면 돼요. VSCode를 사용하지 않는다면 Electron이 자동으로 종료되었다가 다시 로드돼요.

### 런처 코어에서 문제가 발견되면

런처 코어는 별도의 [리포지토리](https://github.com/voxelum/minecraft-launcher-core-node)에 TypeScript로 작성돼 있어요. 코어 관련 이슈를 발견하면 해당 리포에 이슈를 열어 주세요.

#### Vuex와 상호작용하는 권장 방식

- `src/renderer/composables` 폴더에 훅 파일을 새로 만들고, `src/renderer/composables/index.ts`를 통해 훅을 내보내세요.
  - 훅 안에서 Vuex 연산을 래핑하세요.
- Vue 파일에서 `import { yourHook } from '/@/composables'`처럼 훅을 불러오세요.
- Vue 파일에서는 Vuex에 직접 접근하지 않고 훅을 사용하세요.

### VSCode 디버거

프로젝트에는 VSCode 디버거 설정이 포함돼 있어요. 브레이크포인트를 걸고 디버깅할 수 있어요. 현재 VSCode 디버거 설정은 메인 프로세스 디버깅만 지원해요.

(렌더러 프로세스는 Chrome DevTools를 사용해 디버그할 수 있어요.)

현재 사용 가능한 옵션은 두 가지예요:

1. Electron: Main (launch)
2. Electron: Main (attach)

첫 번째 옵션으로 실행하면 디버거가 자동으로 인스턴스에 붙어요.


### 커밋 규칙

이 프로젝트는 [conventional commits](https://www.conventionalcommits.org/en/v1.0.0-beta.3/) 규칙을 따르고 있어요. 간단히 말하면 커밋 메시지의 첫 줄은 아래 형식을 따라야 해요:

```
commit type: commit description
```

사용 가능한 커밋 타입 예시는 `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test` 등이 있어요.

예를 들어:

> feat: 사용자 프로필 페이지 추가

간단한 설명(참고):

> feat: 사용자에게 새로운 기능을 추가하는 변경
>
> fix: 사용자에게 영향을 주는 버그 수정
>
> docs: 문서 변경
>
> style: 형식 관련 변경(코드 동작 변화 없음)
>
> refactor: 리팩터링(동작 변경 없음)
>
> test: 테스트 추가 또는 수정
>
> chore: 빌드 시스템 등 기타 변경(프로덕션 코드 변경 없음)

**이 규칙을 따르지 않으면 커밋이 거부될 수 있어요.**

### 빌드 방법

현재 런처를 빌드하려면 두 가지 명령을 순서대로 실행해야 해요.

먼저, 프론트엔드 코드를 빌드하세요:

```bash
pnpm build:renderer
```

`xmcl-keystone-ui` 아래 코드가 변경되지 않았다면 이 과정을 다시 할 필요는 없어요.

그다음, 프론트엔드 결과물을 포함해 Electron 번들링을 빌드하세요:

```bash
pnpm build:all
```

디버그용 빌드를 원하면 `pnpm build:dir`를 사용하세요—이 명령은 디렉터리 결과물만 만들고 여러 릴리스 포맷으로 패키징하지 않아요.
