# DataClinic 실행 파일

현재 동작하는 브라우저 프로토타입은 [DataClinic.html](DataClinic.html)입니다. 별도 프레임워크나 패키지 설치 없이 HTML·CSS·JavaScript로 실행됩니다.

## 실행

저장소 루트에서 다음 명령을 실행합니다.

~~~~powershell
cd src
py -m http.server 8000
~~~~

브라우저에서 http://localhost:8000/DataClinic.html 을 여세요. Python이 없다면 src 폴더를 제공하는 다른 정적 파일 서버를 사용하면 됩니다.

## 기능

- CSV 업로드와 진단 후보 표시
- 결측, 이상값 후보, 중복, 일관성, 형식·범위, 기준일 관련 문제 검토
- 여러 CSV의 연결 기준 열을 이용한 참조 자료 확인
- 처리 방법별 What-if 결과와 통계·분포 변화 비교
- 승인 이력, 최근 승인 취소, 버전 복원
- CSV, JSON 변경 기록, Node.js 재실행 코드 내보내기
- 선택형 AI 설명: 기기 내 AI 또는 OpenAI 호환 Chat Completions API

합성 천식·거래 샘플로 바로 시연할 수 있습니다. 실제 업로드 한도는 앱 화면의 안내를 확인하세요.

## API 설정 및 보안

앱의 **고급 기능 → AI API 설정**에서 API 주소, 모델 이름, 키를 입력합니다. OpenAI 호환 API는 Chat Completions 요청을 지원해야 합니다. API를 연결하면 브라우저가 해당 주소에 직접 요청하므로, 공개 배포에 실제 API 키를 넣지 마세요. 키는 저장소나 발표 자료에 올리지 말고, 공개 서비스에서는 서버 프록시를 사용해야 합니다.

AI 요청에는 원본 셀 대신 열 이름, 진단 결과와 집계 통계가 포함됩니다. 프로젝트를 실행할 때 실제 개인정보가 담긴 CSV를 공개 시연에 사용하지 마세요.
