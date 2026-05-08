# KoEditor

> 웹 + 데스크탑(Windows/macOS) 코드 에디터  
> **React + Monaco Editor + Electron**

---

## 지원 기능

| 기능 | 비고 |
|---|---|
| 구문 강조 | JS, TS, HTML, CSS, Java, 일반 텍스트 |
| **열(Column) 블록 선택** | `Alt` + 드래그 |
| 다중 커서 | `Alt` + 클릭 |
| 탭으로 여러 파일 열기 | 이미 열린 파일은 포커스 이동 |
| 파일 열기 / 저장 / 다른 이름으로 저장 | 단축키 지원 |
| 미저장 경고 | 탭 닫기 시 확인 |
| 줄 번호, 미니맵, 코드 접기 | 기본 활성화 |
| 찾기 / 바꾸기 | `Ctrl+F` / `Ctrl+H` |
| 자동 완성 / 괄호 자동 닫기 | 기본 활성화 |
| 웹 브라우저 실행 | Chrome/Edge 권장 |
| Windows 설치 파일 (.exe) | `npm run build:electron` |
| macOS 설치 파일 (.dmg) | `npm run build:electron` |

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
| **열 블록 선택** | `Alt` + 드래그 |
| 열 블록 확장 (키보드) | `Shift + Alt + ↑↓←→` |
| 다중 커서 추가 | `Alt` + 클릭 |
| 위/아래 커서 추가 | `Ctrl + Alt + ↑↓` |

---

## 설치 및 실행

### 사전 준비

```bash
node --version   # 18 이상 필요
npm install
```

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

### 웹 배포용 빌드

```bash
npm run build:web
# → dist/ 폴더 → Vercel, Netlify, GitHub Pages 등
```

### 데스크탑 설치 파일 빌드

```bash
npm run build:electron
# → release/ 폴더
#   Windows: KoEditor Setup x.x.x.exe
#   macOS:   KoEditor-x.x.x.dmg
```

---

## 프로젝트 구조

```
koeditor/
│
├── electron/                   ← Electron (데스크탑 래퍼)
│   ├── main.js                 ← 메인 프로세스: 창/메뉴/IPC/파일시스템
│   └── preload.js              ← 보안 브릿지: main ↔ React
│
├── src/                        ← React 앱 (웹/데스크탑 공통)
│   ├── main.tsx                ← 진입점
│   ├── App.tsx                 ← 메인 레이아웃 & 에디터
│   ├── hooks/
│   │   └── useEditorStore.ts   ← 탭/상태 관리
│   ├── utils/
│   │   └── platform.ts         ← ★ 플랫폼 분기 (Electron ↔ 웹)
│   └── styles/
│       └── app.css             ← 전체 스타일
│
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 핵심: platform.ts 구조

```
openFile()   → Electron: IPC → dialog.showOpenDialog + fs.readFileSync
             → Web:      showOpenFilePicker (File System Access API)

saveFile()   → Electron: IPC → fs.writeFileSync
             → Web:      Blob 다운로드

saveFileAs() → Electron: IPC → dialog.showSaveDialog + fs.writeFileSync
             → Web:      Blob 다운로드
```

### Electron 렌더링 일관성

Chromium을 직접 내장하기 때문에 Windows/macOS 모두 **동일한 렌더링**이 보장됩니다.  
Monaco Editor도 VS Code(Electron 기반)와 동일한 환경에서 동작합니다.

---

## 기능 추가 / 수정

모든 소스코드를 Claude에게 보여주고 수정 요청하면 됩니다.
```
