# Pumice

> 웹 + 데스크탑(Windows/macOS/Linux) 코드 에디터  
> **React + Monaco Editor + Electron + Firebase**

---

## 지원 기능

| 기능 | 비고 |
|---|---|
| 구문 강조 | JS, TS, HTML, CSS, Java, 일반 텍스트 |
| **열(Column) 블록 선택** | 보기 메뉴에서 ON/OFF 토글 후 드래그 |
| **열 블록 확장 (키보드)** | `Shift + Alt + ↑↓←→` |
| 다중 커서 | `Ctrl` + 클릭 |
| 탭으로 여러 파일 열기 | 탭 더블클릭으로 이름 변경, 드래그로 순서 변경 |
| 탭 자동 번호 | 새 탭은 `untitled-1.txt`, `untitled-2.txt` 순서로 생성 |
| 탭 가로 스크롤 | 탭이 많아지면 탭바 가로 스크롤 |
| 파일 탐색기 사이드바 | 폴더 열기 후 파일 트리 탐색, 마지막 경로 자동 복원 (데스크탑) |
| 최근 파일 목록 | 파일 메뉴에서 최근 파일 5개 표시 |
| 줄 번호, 미니맵, 코드 접기 | 기본 활성화 |
| 찾기 / 바꾸기 | `Ctrl+F` / `Ctrl+H`, 상태바에 단축키 안내 표시 |
| 자동완성 ON/OFF | 보기 메뉴에서 토글, 설정 자동 저장 |
| 라이트 / 다크 테마 | 보기 메뉴에서 토글, 설정 자동 저장 |
| **폰트 크기 조절** | 보기 메뉴 또는 `Ctrl+=` / `Ctrl+-` / `Ctrl+0`, 설정 자동 저장 |
| **인코딩 선택** | 상태바 우측 인코딩 클릭 → UTF-8 / EUC-KR / UTF-16 등 선택 |
| 상태바 커서 위치 표시 | N줄 N열 실시간 표시 |
| 상태바 글자 수 표시 | 전체 글자 수 / 선택 글자 수 |
| 상태바 동기화 상태 표시 | 동기화 중 / 동기화됨 / 오프라인 |
| 에러/알림 토스트 | 오프라인 전환, 온라인 복구, 오류 시 알림 |
| 데스크탑 메뉴 토글 상태 표시 | 보기 메뉴에서 현재 ON/OFF 상태 ✓로 표시 |
| 창 크기/위치 저장 | 데스크탑 앱 재시작 시 마지막 창 크기/위치 복원 |
| **Google 로그인** | Firebase 인증 (웹: 팝업 / 데스크탑: 팝업) |
| **실시간 동기화** | Firebase Realtime Database, 300ms 자동 저장 |
| **세션 복원** | 앱 재시작 시 탭 목록 + 내용 자동 복원 |
| **설정 동기화** | 테마/자동완성/폰트 크기 등 설정값 기기 간 동기화 |
| **오프라인 지원** | 오프라인 작성 → 온라인 복구 시 자동 동기화 |
| **오프라인 백업** | Firebase 실패 시 로컬 백업에서 복원 |
| **PWA** | 모바일/데스크탑 홈 화면에 앱처럼 설치 가능 |
| 웹 브라우저 실행 | Chrome/Edge 권장 |
| Windows 설치 파일 (.exe) | `npm run build:electron` |
| macOS 설치 파일 (.dmg) | `npm run build:electron` |
| Linux 설치 파일 (.deb / .AppImage) | `npm run build:electron` |

---

## 단축키

| 동작 | 단축키 |
|---|---|
| 새 파일 | `Ctrl/Cmd + N` (데스크탑) / 메뉴 버튼 (웹) |
| 파일 열기 | `Ctrl/Cmd + O` |
| 로컬 파일로 내보내기 (데스크탑 전용) | `Ctrl/Cmd + Shift + S` |
| 파일로 내려받기 (웹 전용) | 파일 메뉴 → 파일로 내려받기 |
| 찾기 | `Ctrl/Cmd + F` |
| 찾아 바꾸기 | `Ctrl/Cmd + H` |
| 실행 취소 | `Ctrl/Cmd + Z` |
| 다시 실행 | `Ctrl/Cmd + Y` |
| 폰트 크기 확대 | `Ctrl/Cmd + =` |
| 폰트 크기 축소 | `Ctrl/Cmd + -` |
| 폰트 크기 기본값 | `Ctrl/Cmd + 0` |
| 줄 바꿈 토글 | `Alt + Z` |
| 열 블록 확장 (키보드) | `Shift + Alt + ↑↓←→` |
| 위/아래 커서 추가 | `Ctrl + Alt + ↑↓` |
| 탭 이름 변경 | 탭 더블클릭 |
| 탭 순서 변경 | 탭 드래그 |

> **웹에서 `Ctrl+N`이 안 되는 이유:** 브라우저가 OS 레벨에서 먼저 가로채기 때문에 JavaScript로 차단이 불가능합니다. 웹 버전 VS Code도 동일하게 동작하지 않아요. 웹에서는 `+` 버튼이나 파일 메뉴를 사용하세요.

---

## 메뉴 구성

| 메뉴 | 주요 항목 |
|---|---|
| 파일 | 새 파일, 파일 열기, 폴더 열기, 로컬 파일로 내보내기 (데스크탑 전용), 파일로 내려받기 (웹 전용), 최근 파일 |
| 편집 | 실행 취소/다시 실행, 잘라내기/복사/붙여넣기, 찾기/바꾸기 |
| 보기 | 파일 탐색기 토글, 테마 전환, 열 블록 모드, 자동완성 토글, 폰트 크기 조절, 줄 바꿈 토글 |
| 계정 | 로그인한 사용자 이름 표시, 로그아웃 |

> **저장 메뉴가 없는 이유:** 내용은 타이핑 후 300ms마다 Firebase에 자동 저장됩니다.  
> 별도 저장 버튼이 필요 없습니다. 로컬 파일로 내보내고 싶을 때만 전용 메뉴를 사용하세요.

> **탭을 닫으면 데이터가 삭제됩니다.** 닫기 전에 필요한 내용은 파일로 내보내거나 내려받으세요.

---

## 설치 및 실행

### 사전 준비

```bash
node --version   # 18 이상 필요
npm install
```

### 환경 변수 설정

`.env.example`을 복사해서 `.env`를 만들고 Firebase 설정값을 채워주세요.

```bash
cp .env.example .env
```

`.env` 파일에 Firebase 콘솔(https://console.firebase.google.com)에서 발급받은 값을 입력하세요.  
`.env` 파일은 절대 Git에 커밋하지 마세요.

### 웹으로 실행 (개발)

```bash
npm run dev:web
# → http://localhost:1420
```

### 데스크탑으로 실행 (개발)

```bash
npm run dev:electron
# Vite dev 서버 + Electron 창 동시 실행
```

---

## Firebase 설정 (최초 1회)

### 1. Firebase 프로젝트 생성

```
https://console.firebase.google.com
→ 프로젝트 추가
→ Authentication → Google 로그인 활성화
→ Realtime Database 생성 (위치: asia-southeast1 권장)
```

### 2. 승인된 도메인 설정 (필수)

```
Firebase 콘솔 → Authentication → Settings → 승인된 도메인
→ 아래 도메인이 모두 있는지 확인:
  - localhost
  - 127.0.0.1        ← 데스크탑 앱 로그인용 (반드시 추가)
  - your-project.web.app
  - your-project.firebaseapp.com
```

> **127.0.0.1이 없으면 데스크탑 앱에서 로그인이 안 됩니다.**  
> 데스크탑 앱은 내부 localhost 서버(`http://127.0.0.1:9123`)를 통해 Firebase 인증을 처리합니다.

### 3. 보안 규칙 설정

```
Firebase 콘솔 → Realtime Database → 규칙 탭
```

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

## 웹 배포 (Firebase Hosting + PWA)

### 최초 1회 설정

```bash
# firebase-tools 전역 설치
npm install -g firebase-tools

# Firebase 로그인
firebase login
```

### 배포

```bash
npm run deploy
# 내부적으로 npm run build:web && firebase deploy 실행
# → https://your-project.web.app
```

### 재배포 (코드 수정 후)

```bash
npm run deploy
# 동일 명령어로 재배포
```

---

## 데스크탑 설치 파일 빌드

### 아이콘 파일 준비 (최초 1회)

빌드 전에 `assets/` 폴더에 플랫폼별 아이콘이 필요해요.

```
Pumice/
└── assets/
    ├── icon.ico    ← Windows용
    ├── icon.icns   ← macOS용
    └── icon.png    ← Linux용
```

**아이콘 변환 방법:**  
`public/icons/icon-512.png` 파일을 아래 사이트에서 변환하세요.
- PNG → ICO: https://convertio.co/png-ico/
- PNG → ICNS: https://cloudconvert.com/png-to-icns

### Windows 빌드

```bash
npm run build:electron
# → release/Pumice Setup x.x.x.exe
```

> **오류 1 — npm 스크립트 실행 차단 (PSSecurityException)**
>
> PowerShell에서 아래와 같은 오류가 나오면:
> ```
> 이 시스템에서 스크립트를 실행할 수 없으므로 npm.ps1 파일을 로드할 수 없습니다.
> ```
> PowerShell 관리자 모드에서 실행 정책을 변경하세요.
> ```powershell
> Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
> # Y 입력 후 엔터
> npm run build:electron
> ```

> **오류 2 — winCodeSign 심볼릭 링크 오류**
>
> 아래 오류가 나오면:
> ```
> ERROR: Cannot create symbolic link
> ```
> PowerShell 관리자 모드에서 캐시 삭제 후 재시도하세요.
> ```powershell
> Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -ErrorAction SilentlyContinue
> npm run build:electron
>
> # 그래도 안 되면 코드 서명 비활성화
> $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
> npm run build:electron
> ```

### macOS 빌드

```bash
# Mac에서 실행해야 함
npm run build:electron
# → release/Pumice-x.x.x.dmg
```

### Linux 빌드

```bash
# Node 18+ 설치 (없으면)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Electron 빌드 의존성 설치
sudo apt-get install -y rpm fakeroot dpkg

# 빌드
npm run build:electron
# → release/Pumice.deb
# → release/Pumice.AppImage
```

> **Ubuntu 버전 호환성:** 20.04에서 빌드한 파일은 22.04, 24.04에서 실행 가능합니다.  
> `.deb`보다 **AppImage**가 버전 간 호환성이 더 안전합니다. AppImage는 필요한 라이브러리를 자체 포함하고 있어 OS 버전 차이에 덜 민감합니다.

> **플랫폼 교차 빌드 불가:** Windows .exe는 Windows에서만, macOS .dmg는 Mac에서만, Linux .deb는 Linux에서만 빌드 가능합니다.

### 빌드 결과물 위치

```
release/
├── Pumice Setup x.x.x.exe     ← Windows 설치 파일
├── Pumice-x.x.x.dmg           ← macOS 설치 파일
├── Pumice.deb                  ← Linux (Ubuntu/Debian)
└── Pumice.AppImage             ← Linux (범용)
```

---

## 프로젝트 구조

```
Pumice/
│
├── electron/                    ← Electron (데스크탑 래퍼)
│   ├── main.js                  ← 메인 프로세스: 창/메뉴/IPC/파일시스템/로컬서버
│   └── preload.js               ← 보안 브릿지: main ↔ React
│
├── public/                      ← 정적 파일
│   ├── manifest.json            ← PWA 설정
│   ├── sw.js                    ← Service Worker (오프라인 캐시)
│   ├── favicon.svg              ← 파비콘
│   └── icons/
│       ├── icon-192.png         ← PWA 아이콘 (소)
│       └── icon-512.png         ← PWA 아이콘 (대)
│
├── assets/                      ← 데스크탑 빌드용 아이콘
│   ├── icon.ico                 ← Windows
│   ├── icon.icns                ← macOS
│   └── icon.png                 ← Linux
│
├── src/                         ← React 앱 (웹/데스크탑 공통)
│   ├── main.tsx                 ← 진입점 + Monaco Worker 설정
│   ├── App.tsx                  ← 메인 레이아웃 & 에디터
│   ├── firebase.ts              ← Firebase 초기화 (환경변수 사용)
│   ├── components/
│   │   ├── Login.tsx            ← Google 로그인 화면
│   │   ├── Login.css
│   │   ├── Toast.tsx            ← 알림 토스트
│   │   └── Toast.css
│   ├── hooks/
│   │   ├── useAuth.ts           ← Google 로그인/로그아웃
│   │   ├── useSync.ts           ← Firebase 실시간 동기화
│   │   ├── useSessionStore.ts   ← 세션(탭 목록+내용) 저장/복원
│   │   ├── useSettings.ts       ← 사용자 설정 저장/복원
│   │   ├── useEditorStore.ts    ← 탭/상태 관리
│   │   └── useToast.ts          ← 토스트 알림 상태
│   ├── utils/
│   │   └── platform.ts          ← 플랫폼 분기 (Electron ↔ 웹)
│   └── styles/
│       └── app.css              ← 전체 스타일 (라이트/다크 테마)
│
├── .env                         ← Firebase 설정값 (Git 제외)
├── .env.example                 ← 환경 변수 템플릿 (Git 포함)
├── firebase.json                ← Firebase Hosting 설정
├── .firebaserc                  ← Firebase 프로젝트 연결
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .gitignore
├── LICENSE
└── README.md
```

---

## 데스크탑 로그인 동작 방식

데스크탑 앱은 `file://` 프로토콜로 실행되므로 Firebase 팝업 인증이 직접 동작하지 않아요.  
이를 해결하기 위해 내부 로컬 HTTP 서버(`http://127.0.0.1:9123`)를 통해 앱을 서빙하고,  
Firebase 팝업 인증이 `127.0.0.1` 도메인에서 동작하도록 처리해요.

```
데스크탑 앱 실행
  → main.js가 dist/ 폴더를 http://127.0.0.1:9123 으로 서빙
  → 브라우저 창에 http://127.0.0.1:9123 로드

로그인 버튼 클릭
  → Firebase 팝업 창 열림
  → Google 계정 선택 및 인증
  → Firebase Auth 완료 → 에디터 화면 진입

이후 실행 (로그인 이력 있을 때)
  → Firebase Auth 캐시로 자동 로그인
  → 팝업 없이 바로 에디터 화면

오프라인 실행
  → 로컬 서버에서 앱 로드 (인터넷 불필요)
  → Firebase Auth 캐시로 로그인 유지
  → 오프라인 모드로 에디터 사용 가능
```

---

## Firebase 데이터 구조

```
users/{uid}/
  session/
    activeId: "tab-xxx"          ← 마지막 활성 탭 ID
    tabs: [{id, name, language}] ← 탭 목록
    updatedAt: timestamp
  docs/
    {tabId}/
      content: "..."             ← 탭 내용 (300ms 자동 저장)
      updatedAt: timestamp
      updatedBy: uid
  settings/
    autoComplete: true           ← 자동완성 ON/OFF
    darkMode: false              ← 다크모드 ON/OFF
    columnMode: false            ← 열 블록 모드 ON/OFF
    sidebarOpen: true            ← 사이드바 ON/OFF
    fontSize: 14                 ← 폰트 크기
    encoding: "UTF-8"            ← 인코딩
    wordWrap: false              ← 줄 바꿈 ON/OFF
    lastFolderPath: null         ← 마지막 폴더 경로 (데스크탑)
```

## Firebase 동기화 동작

```
온라인 상태
  → 타이핑 후 300ms 뒤 Firebase에 자동 저장
  → 다른 기기에 실시간 반영

오프라인 상태
  → 로컬에서 정상 작동 (localStorage 백업 사용)
  → 토스트로 오프라인 상태 안내

온라인 복구 시
  → Firebase에 자동 동기화
  → 토스트로 복구 안내

Firebase 로드 실패 시
  → localStorage 백업에서 마지막 세션 복원
```

## 플랫폼별 파일 동작

```
openFile()    → Electron: 네이티브 다이얼로그 + fs.readFileSync
              → Web:      showOpenFilePicker (File System Access API)

openFolder()  → Electron: 네이티브 다이얼로그 + fs 재귀 읽기
              → Web:      showDirectoryPicker (File System Access API)

saveFileAs()  → Electron: 네이티브 저장 다이얼로그 + fs.writeFileSync
              → Web:      Blob 다운로드 (파일로 내려받기)
```

Electron은 Chromium을 직접 내장하기 때문에 Windows/macOS/Linux 모두 **동일한 렌더링**이 보장됩니다.

---

## 라이선스

MIT License — 자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.
