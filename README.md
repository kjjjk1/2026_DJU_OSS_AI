# DataClinic

**AI 기반 데이터 정제 의사결정 지원 서비스**

> CSV 데이터의 품질을 진단하고, 사용자가 근거를 확인한 뒤 전처리 방법을 선택하도록 돕는 프로토타입입니다.

## 프로젝트 소개

데이터 분석 경험이 적으면 결측치나 이상 후보를 발견해도 어떻게 처리할지 판단하기 어렵습니다. DataClinic은 데이터의 문제 후보와 처리 방법별 영향을 보여주고, AI가 추천 근거와 주의사항을 설명합니다. 실제 정제 방법은 사용자가 직접 선택합니다.

## 현재 구현된 기능

| 기능 | 구현 내용 |
| --- | --- |
| 데이터 불러오기 | CSV 업로드와 예시 데이터로 시작 |
| 품질 진단 | 결측값, 중복·충돌 행, 수치형 이상 후보 등을 확인 |
| 처리 방법 비교 | 방법별 예상 행 수와 주요 통계 변화(What-if)를 비교 |
| AI 안내 | 진단 요약과 통계에 기반해 데이터 설명, 확인 순서, 처리 방법의 근거와 위험을 안내 |
| 사용자 결정 | 사용자가 처리 방법을 선택하고 승인한 뒤 결과를 확인·내보내기 |

현재 프로토타입은 CSV를 지원합니다. Excel 파일 업로드와 pandas·Streamlit 기반 구현은 현재 실행 버전에 포함되어 있지 않습니다.

## AI API 연동

AI 안내는 OpenAI 호환 **Chat Completions API**를 사용합니다. 브라우저는 같은 앱의 Node.js 서버인 /api/ai에 요청하고, 서버가 API 제공자에게 요청을 전달합니다. API 키는 서버 환경 변수에만 저장되며 HTML이나 브라우저에 전달되지 않습니다.

AI 요청에는 원본 행 데이터가 아니라 컬럼명, 진단 결과, 집계 통계가 포함됩니다. API 제공자와 모델은 서버 환경 변수로 설정합니다.

| 환경 변수 | 필수 | 기본값 / 설명 |
| --- | --- | --- |
| OPENAI_API_KEY | 예 | 서버에 저장할 API 키 |
| AI_MODEL | 아니요 | gpt-4o-mini |
| AI_API_URL | 아니요 | https://api.openai.com/v1/chat/completions |
| AI_MAX_REQUESTS_PER_MINUTE | 아니요 | IP별 분당 요청 상한, 기본값 12 |

다른 OpenAI 호환 제공자를 이용할 때는 AI_API_URL, AI_MODEL, OPENAI_API_KEY를 해당 제공자 값으로 설정합니다. 실제 사용량과 과금은 API 제공자 계정에 적용됩니다.

## 서비스 이용 흐름

CSV 업로드 또는 예시 선택 → 분석 목적 입력 → 데이터 품질 진단 → AI 안내와 주의사항 확인 → 처리 방법별 영향 비교 → 사용자 선택 및 승인 → 결과 확인·내보내기

## 기술 구성

| 구분 | 현재 구성 |
| --- | --- |
| 화면·진단·전처리 비교 | HTML, CSS, 브라우저 JavaScript |
| API 중계 서버 | Node.js 20 이상, 기본 제공 HTTP·fetch |
| AI | OpenAI 호환 Chat Completions API |
| 입력 데이터 | CSV |
| 배포 대상 | Render Web Service |

## 실행 및 배포

현재 프로토타입 파일은 별도 작업 폴더에 준비되어 있으며, 이 저장소에는 아직 앱 코드가 반영되지 않았습니다. GitHub에 다음 파일을 추가한 뒤 배포할 수 있습니다.

- DataClinic-보완.html
- server.mjs
- package.json

### 로컬 실행

Node.js 20 이상이 필요합니다. 위 세 파일이 있는 폴더에서 PowerShell을 열고 API 키를 환경 변수로 지정한 뒤 npm start를 실행합니다.

- API 키: OPENAI_API_KEY 환경 변수에 지정
- 기본 주소: http://localhost:3000
- 다른 API 제공자는 AI_API_URL 환경 변수에 주소 설정

API 키를 HTML이나 GitHub 저장소에 입력하지 마세요.

### Render 배포

1. 앱 파일을 GitHub 저장소에 추가하고 Render에서 **New → Web Service**로 저장소를 연결합니다.
2. Runtime은 **Node**, Build Command는 npm install, Start Command는 npm start로 설정합니다.
3. Render 서비스의 Environment에 OPENAI_API_KEY를 등록합니다. 필요하면 AI_MODEL, AI_API_URL도 설정합니다.
4. 배포 후 /healthz에서 {"status":"ok"}를 확인하고 앱의 **고급 기능 → AI API 설정**에서 서버 설정 상태를 확인합니다.

## 저장소 진행 상태

| 항목 | 위치 | 상태 |
| --- | --- | --- |
| 계획서 | [docs/plan.md](docs/plan.md) | 초안 |
| 코드 | [src](src/) | 로컬 프로토타입 구현 완료, GitHub 반영 전 |
| 결과보고서 | [docs/final-report.md](docs/final-report.md) | 작성 예정 |
| 발표 자료 | [docs/presentation.md](docs/presentation.md) | 작성 예정 |
| 시연 안내 | [docs/demo.md](docs/demo.md) | 프로토타입 기준으로 갱신 필요 |

## 프로토타입 시연

- 서비스 접속 주소: Render 배포 후 등록
- 시연 영상: 촬영 후 등록
- 시연 시나리오: [docs/demo.md](docs/demo.md)

## 폴더 구성

현재 저장소에는 계획·보고서 문서와 src/README.md가 있습니다. 앱 파일을 저장소에 추가하면 다음 파일을 배포 루트에 둡니다.

    .
    ├── DataClinic-보완.html
    ├── server.mjs
    ├── package.json
    ├── README.md
    ├── docs/
    └── src/

## 팀 구성

| 팀원 | 역할 | 담당 내용 |
| --- | --- | --- |
| 팀원1 (이름 입력 예정) | 데이터 진단 및 전처리 | 진단 기준, 처리 방법, 결과 영향 비교 |
| 팀원2 (이름 입력 예정) | AI 연동 및 의사결정 지원 | API 연동, 추천 근거와 위험 안내 |
| 팀원3 (이름 입력 예정) | 웹 서비스 및 배포 | 사용자 화면, Node.js 서버, 시각화 및 Render 배포 |

## 제출 전 확인

- [ ] 앱 파일을 GitHub 저장소에 반영하고 실행 방법을 확인
- [ ] Render 배포와 시연 링크 등록
- [ ] API 키, 비밀번호, 개인정보가 코드·저장소·화면에 포함되지 않았는지 확인
- [ ] 로그아웃 상태에서 시연 링크 접근 확인
- [ ] 보고서·발표 자료·시연 안내 갱신
- [ ] 자료 출처와 라이선스 기록

## 참고 자료 및 라이선스

사용한 자료의 출처, 데이터 이용 조건, 외부 코드의 라이선스를 기록합니다. 프로젝트 라이선스는 추후 정합니다.
