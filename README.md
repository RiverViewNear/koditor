# Koditor

> 웹 + 데스크탑(Windows/macOS/Linux) 코드 에디터
> **React + Monaco Editor + Electron + Firebase**

---

## 지원 기능

| 기능 | 비고 |
|---|---|
| 구문 강조 | JS, TS, HTML, CSS, Java, 일반 텍스트 |
| **열(Column) 블록 선택** | 보기 메뉴에서 ON/OFF 토글 후 드래그 |
| 다중 커서 | `Ctrl` + 클릭 |
| 탭으로 여러 파일 열기 | 이미 열린 파일은 포커스 이동 |
| 파일 탐색기 사이드바 | 폴더 열기 후 파일 트리 탐색 |
| 파일 열기 / 저장 / 다른 이름으로 저장 | 단축키 지원 |
| 최근 파일 목록 | 파일 메뉴에서 최근 파일 5개 표시 |
| 미저장 경고 | 탭 닫기 시 확인 |
| 줄 번호, 미니맵, 코드 접기 | 기본 활성화 |
| 찾기 / 바꾸기 | `Ctrl+F` / `Ctrl+H` |
| 자동완성 ON/OFF | 보기 메뉴에서 토글 |
| 라이트 / 다크 테마 | 보기 메뉴에서 토글 |
| 상태바 커서 위치 표시 | N줄 N열 실시간 표시 |
| 상태바 글자 수 표시 | 전체 글자 수 / 선택 글자 수 |
| **Google 로그인** | Firebase 인증 |
| **실시간 동기화** | Firebase Realtime Database |
| **오프라인 지원** | 오프라인 작성 → 온라인 복구 시 자동 동기화 |
| **PWA** | 모바일 홈 화면에 앱처럼 설치 가능 |
| 웹 브라우저 실행 | Chrome/Edge 권장 |
| Windows 설치 파일 (.exe) | `npm run build:electron` |
| macOS 설치 파일 (.dmg) | `npm run build:electron` |
| Linux 설치 파일 (.deb / .AppImage) | `npm run build:electron` |

---

## 단축키

| 동작 | 단축키 |
|---|---|
| 새 파일 | `Ctrl/Cmd + N` |
| 파일 열기 | `Ctrl/Cmd + O` |
| 저장 | `Ctrl/Cmd + S` |
| 다른 이름으로 저장 | `Ctrl/Cmd + Shift + S` |
| 찾기 | `Ctrl/Cmd + F` |
| 찾아 바꾸기 | `Ctrl/Cmd + H` |
| 실행 취소 | `Ctrl/Cmd + Z` |
| 다시 실행 | `Ctrl/Cmd + Y` |
| 줄 바꿈 토글 | `Alt + Z` |
| **열 블록 확장 (키보드)** | `Shift + Alt + ↑↓←→` |
| 위/아래 커서 추가 | `Ctrl + Alt + ↑↓` |

---

## 메뉴 구성

| 메뉴 | 주요 항목 |
|---|---|
| 파일 | 새 파일, 파일 열기, 폴더 열기, 저장, 다른 이름으로 저장, 최근 파일 |
| 편집 | 실행 취소/다시 실행, 잘라내기/복사/붙여넣기, 찾기/바꾸기 |
| 보기 | 파일 탐색기 토글, 테마 전환, 열 블록 모드, 자동완성 토글, 줄 바꿈 토글 |
| 계정 | 로그인 정보 확인, 로그아웃 |

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

`.env` 파일에 Firebase 콘솔에서 발급받은 값을 입력하세요.
`.env` 파일은 절대 Git에 커밋하지 마세요.

### 웹으로 실행

```bash
npm run dev:web
# → http://localhost:1420
```

### 데스크탑으로 실행 (개발)

```bash
npm run dev:electron
# Vite dev 서버 + Electron 창 동시 실행
```

### 웹 배포 (Firebase Hosting + PWA)

```bash
# firebase-tools 전역 설치 (최초 1회)
npm install -g firebase-tools
firebase login

# 배포
npm run deploy
# → https://your-project.web.app
```

### 데스크탑 설치 파일 빌드

```bash
npm run build:electron
# → release/ 폴더
#   Windows: Koditor Setup x.x.x.exe
#   macOS:   Koditor-x.x.x.dmg
#   Linux:   Koditor.deb / Koditor.AppImage
```

---

## 프로젝트 구조

```
koditor/
│
├── electron/                    ← Electron (데스크탑 래퍼)
│   ├── main.js                  ← 메인 프로세스: 창/메뉴/IPC/파일시스템
│   └── preload.js               ← 보안 브릿지: main ↔ React
│
├── public/                      ← 정적 파일
│   ├── manifest.json            ← PWA 설정
│   ├── sw.js                    ← Service Worker (오프라인 캐시)
│   └── favicon.svg              ← 파비콘
│
├── src/                         ← React 앱 (웹/데스크탑 공통)
│   ├── main.tsx                 ← 진입점 + Monaco Worker 설정
│   ├── App.tsx                  ← 메인 레이아웃 & 에디터
│   ├── firebase.ts              ← Firebase 초기화
│   ├── components/
│   │   ├── Login.tsx            ← Google 로그인 화면
│   │   └── Login.css
│   ├── hooks/
│   │   ├── useAuth.ts           ← Google 로그인/로그아웃 상태
│   │   ├── useSync.ts           ← Firebase 실시간 동기화
│   │   └── useEditorStore.ts    ← 탭/상태 관리
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

## 플랫폼별 동작

```
openFile()    → Electron: 네이티브 다이얼로그 + fs.readFileSync
              → Web:      showOpenFilePicker (File System Access API)

openFolder()  → Electron: 네이티브 다이얼로그 + fs 재귀 읽기
              → Web:      showDirectoryPicker (File System Access API)

saveFile()    → Electron: fs.writeFileSync
              → Web:      Blob 다운로드

saveFileAs()  → Electron: 네이티브 저장 다이얼로그 + fs.writeFileSync
              → Web:      Blob 다운로드
```

## Firebase 동기화 동작

```
온라인 상태
  → 타이핑 후 300ms 뒤 Firebase에 자동 저장
  → 다른 기기에 실시간 반영

오프라인 상태
  → 로컬에서 정상 작동
  → 변경사항 내부 큐에 저장

온라인 복구 시
  → 큐에 쌓인 내용 Firebase에 자동 동기화
```

Electron은 Chromium을 직접 내장하기 때문에 Windows/macOS/Linux 모두 **동일한 렌더링**이 보장됩니다.

---

## 라이선스

MIT License — 자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.
