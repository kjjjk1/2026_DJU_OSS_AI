# DataClinic 소스 코드

이 폴더에는 HTML 프로토타입과 Render용 Node.js API 중계 서버가 있습니다.

## 파일

- DataClinic-보완.html: CSV 진단·비교 화면과 AI 안내 기능
- server.mjs: 정적 HTML 제공, /api/ai 프록시, /healthz 상태 확인
- package.json: npm start 실행 설정

## 실행 환경

- Node.js 20 이상
- 외부 npm 패키지 없음
- 실행 명령: npm start
- 기본 주소: http://localhost:3000

## 환경 변수

- OPENAI_API_KEY: 필수. API 키를 서버 환경 변수로만 등록합니다.
- AI_MODEL: 선택. 기본값 gpt-4o-mini
- AI_API_URL: 선택. 기본값 https://api.openai.com/v1/chat/completions
- AI_MAX_REQUESTS_PER_MINUTE: 선택. IP별 분당 요청 제한, 기본값 12

Render에서는 Root Directory를 src/로 지정한 뒤 Build Command npm install, Start Command npm start로 배포합니다. 실제 서비스 주소와 시연 내용은 docs/demo.md에 추가하세요.

API 키를 HTML, 브라우저, GitHub 저장소에 넣지 마세요. AI 요청에는 원본 파일 전체가 아니라 컬럼명, 문제 설명·근거 문구, 진단 결과와 집계 통계가 전송됩니다.
