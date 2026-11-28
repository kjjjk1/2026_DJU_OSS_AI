# DataClinic

**AI 기반 데이터 정제 의사결정 지원 서비스**

[바로 시연하기 · GitHub Pages](https://kjjjk1.github.io/2026_DJU_OSS_AI/)  
[AI 안내가 포함된 시연 · Render](https://two026-dju-oss-ai.onrender.com/)

## 문제와 해결 방법

데이터에서 빈 값이나 이상 후보를 발견해도, 바로 삭제하거나 대체해도 되는지 판단하기 어렵습니다. 예를 들어 전체 의료기관 수를 집계할 때 홈페이지가 없는 병원을 제외하면, 실제로 집계해야 할 기관까지 빠집니다.

DataClinic은 CSV에서 검토할 문제를 찾고, 처리 방법에 따라 행 수·결측률·주요 통계·라벨 분포가 어떻게 달라지는지 적용 전에 보여줍니다. **AI는 선택의 근거를 설명하고, 시스템은 처리 결과를 계산하며, 사용자는 실제로 적용할 방법을 승인합니다.** 승인 기준과 입력한 사유는 이력에 남고, 결과와 재실행 코드를 내보낼 수 있습니다.

## 주요 기능과 활용 기술

| 기능 | 구현 내용 |
| --- | --- |
| CSV 불러오기 | UTF-8 및 Windows CP949 CSV를 브라우저에서 읽습니다. |
| 병원·약국 명부 병합 | 병합 전에 원본별 행 수, 공통 열, 식별자 중복 여부를 확인합니다. 승인하면 기관유형을 붙여 한 목록으로 합칩니다. |
| 데이터 품질 진단 | 결측값, 중복·충돌 행, 형식·범위 위반, 수치형 이상 후보를 표시합니다. |
| 분석 목적 설정 | 빅데이터 분석, 지도학습, 일부 라벨 보유, 비지도학습을 선택할 수 있습니다. 지도학습과 일부 라벨 보유 모드에서는 라벨 열을 지정할 수 있습니다. |
| 처리 전 결과 비교 | 처리안별 행 수, 결측률, 수치 통계와 해당하는 경우 라벨 분포를 비교합니다. |
| AI 안내 | 진단 요약과 처리 방법별 계산 결과를 바탕으로 확인 순서, 추천 근거, 주의사항을 설명합니다. |
| 승인·복원·내보내기 | 승인과 복원 내역을 기록하고, 결과 CSV·검증 기록 JSON·재실행 코드를 내보냅니다. |

화면과 데이터 진단에는 HTML·CSS·JavaScript를 사용합니다. CSV 읽기와 전처리 계산은 브라우저에서 수행합니다. AI 안내를 요청하면 Node.js 서버가 컬럼명, 진단 근거, 집계 통계 등 요약 정보를 OpenAI 호환 Chat Completions API로 전달합니다. API 키는 서버 환경 변수로 관리합니다.

## 실행 방법

### 공개 시연

1. **병원·약국 CSV 선택**을 누르고 병원 CSV와 약국 CSV를 한 개씩 선택합니다.
2. 원본별 행 수와 식별자 중복 여부를 검토하고 **병합 승인 후 분석**을 누릅니다.
3. 검토 목록에서 **병원홈페이지**를 열고, 빈 값이 있는 병원 행을 제외하는 방법과 표시만 추가하는 방법을 비교합니다. 약국은 병원 홈페이지 항목이 **해당 없음**으로 처리됩니다.
4. 기관 수 집계에 맞는 방법을 선택하고 승인 이력과 결과를 확인합니다.

2026년 9월 시연 파일에서는 병원 **79,899행**과 약국 **25,850행**이 합쳐집니다. 홈페이지가 없는 병원 행을 모두 제외하면 **34,681행**이 남고, 표시만 추가하면 **105,749행**을 유지합니다. 자세한 순서는 [시연 안내](docs/demo.md)를 참고하세요.

AI 안내를 사용할 때는 서버를 시작하기 전에 `OPENAI_API_KEY`에 OpenAI 키를 설정합니다. Gemini를 사용하는 경우 `AI_API_KEY`에 Gemini 키를 설정하고, `AI_MODEL`과 `AI_API_URL`에 사용할 Gemini 모델과 호환 API 주소를 지정합니다.

### Render 배포
### Render에서 실행

[DataClinic 시연 앱 열기](https://two026-dju-oss-ai.onrender.com/)

1. **병원·약국 CSV 선택**을 눌러 병원과 약국 원본 CSV를 한 개씩 선택합니다.
2. **병합 기준 검토** 화면에서 행 수와 처리 기준을 확인하고 **병합 승인 후 분석**을 누릅니다.
3. 검토 목록에서 **병원홈페이지**를 열고, 결측 행 제외와 표시 추가의 결과를 비교합니다.
4. **AI 안내**에서 추천 근거와 주의사항을 확인한 뒤, 적용할 방법을 직접 승인합니다.
5. 승인 이력을 확인하고 결과 CSV를 내보냅니다.

| 항목 | 설정 |
| --- | --- |
| 서비스 유형 | Web Service |
| 브랜치 | `main` |
| Root Directory | `src` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |

API 키는 Render의 **Environment Variables**에 등록합니다. 배포 후 앱에서 **AI 안내**를 실행해 실제 응답을 확인합니다.

## 계획서 · 최종 보고서 · 발표 · 시연

| 자료 | 링크 |
| --- | --- |
| 계획서 | [프로젝트 계획서 초안](docs/plan.md) |
| 코드 | [앱과 API 서버](src/) |
| 최종 보고서 | [최종 결과보고서](docs/final-report.md) |
| 발표 자료 | [발표 구성안](docs/presentation.md) |
| 시연 | [시연 안내](docs/demo.md) · [GitHub Pages](https://kjjjk1.github.io/2026_DJU_OSS_AI/) · [Render](https://two026-dju-oss-ai.onrender.com/) |

## 출처와 라이선스

- **병원·약국 시연 데이터** · 2026년 9월 병원정보서비스 및 약국정보서비스 CSV를 사용했습니다. 원본 파일은 사용자가 직접 불러옵니다.
- **수치형 이상 후보 기준** · 사분위 범위(IQR)를 사용해 검토 후보를 표시합니다. [NIST 상자 그림 기준](https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm)
- **AI 연동** · [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) · [Gemini의 OpenAI 호환 API](https://ai.google.dev/gemini-api/docs/openai)
- **실행 환경** · [Node.js 라이선스](https://github.com/nodejs/node/blob/main/LICENSE)
- **프로젝트 자체 라이선스** · 미정입니다.
