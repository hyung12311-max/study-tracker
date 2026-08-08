# Study Plus 학습 콘텐츠 작성 가이드

초등 수학 콘텐츠는 학년별 course를 만들지 않고 기존 `math-core`
(`51000000-0000-4000-8000-000000000001`, `수학 기초 과정`, subject `수학`)를 재사용합니다.
학년·수준별 추천은 curriculum map의 단원별 recommendation metadata로만 구분하며,
CSV 작성자는 course 식별자를 입력하지 않습니다.

## 1. 공식 교육과정과 운영 지도의 구분

근거는 교육부 고시 제2022-33호 별책 8 수학과 교육과정입니다. 공식 성취기준은 초등학교 1~2학년군 단위입니다. `content/learning/curriculum/math/grade-2-2022.json`은 이를 참고해 만든 **Study Plus 초등 2 콘텐츠 운영 지도**이며 국가 교육과정이 정한 공식 2학년 단원 순서가 아닙니다. 교과서의 문제·해설·목차를 복사하지 않습니다.

## 2. 운영 단원 12개

1학기: 세 자리 수, 여러 가지 모양, 덧셈과 뺄셈, 길이 측정, 분류, 곱셈의 뜻.

2학기: 네 자리 수, 곱셈구구, 길이 계산, 시각과 시간, 표와 그래프, 규칙.

각 단원은 입문(`seed`) → 기초(`leaf`) → 심화(`tree`) → 최상위 도전!(`crown`) 순서이며 단계당 10문항, 문항당 선택지 4개와 정답 1개를 사용합니다. 통과 기준과 보상 1/2/3/5는 DB 계약이며 CSV에 보상액을 기록하지 않습니다.

## 3. 성취기준 매핑

지도 파일의 `achievementCodes`는 단원 설계 때 참고하는 1~2학년군 학습 요소입니다. 코드가 특정 2학년 교과서 단원이나 출판사 순서를 공식화하지 않습니다. 알려진 코드 allowlist 밖 값은 validator가 거부합니다.

## 4. units CSV

`grade2-math-units.csv`에는 교육과정 ID, 학년, 학기, 영역, 단원 순서, catalog 순서, slug, 표시명, 추천 수준, `|`로 구분한 성취기준과 선수 단원, version, 상태가 들어갑니다. 이 메타데이터는 curriculum JSON과 정확히 일치해야 합니다.

## 5. questions CSV

`grade2-math-questions.csv`에는 단원, version, 단계, 단계 내 문항 순서, 문항, 선택지 4개, 정답 번호, 해설, 가중치, 내부 skill code, 검토 상태와 메모가 들어갑니다. 문항·선택지·해설은 독창적으로 작성합니다. 실제 배포 JSON은 4단계/40문항/160선택지, 가중치 1, `reviewed`인 완성 행만 생성되며 각 문항의 `skill_code`를 canonical `skillCode`로 보존합니다.

## 6. Excel 저장 형식

템플릿은 UTF-8 BOM과 LF를 사용합니다. Excel에서는 “CSV UTF-8(쉼표로 분리)”로 저장하고 header 순서를 유지합니다. 쉼표·큰따옴표·여러 줄 문구는 quoted field로 보존됩니다. 빈 템플릿 자체는 import할 수 없습니다.

## 7. 작성과 검토

문항, 네 선택지, 정답, 해설, skill code를 작성하고 별도 검토 후 `review_status=reviewed`로 바꿉니다. 선택지는 중복될 수 없고 정답 번호는 1~4입니다. 아동 화면 문구에는 학년·교육과정·version·UUID 같은 내부 metadata를 노출하지 않습니다. 검토 메모는 근거와 검토 내용을 기록하되 비밀정보나 출판물 식별자를 넣지 않습니다.

## 8. Importer

```text
node scripts/import-learning-content-csv.js --curriculum content/learning/curriculum/math/grade-2-2022.json --units content/learning/templates/grade2-math-units.csv --questions <작성완료.csv> --unit grade2-three-digit-numbers --output content/learning/math/grade2-three-digit-numbers-v1.json
```

지정한 단원 하나만 생성합니다. 다른 단원은 빈 draft 행이어야 하며, 일부 행만 작성됐거나 검토가 끝나지 않았거나 metadata가 다르면 실패합니다. 출력은 `content/learning/math/<unit>-<version>.json`으로 제한되고 기존 파일은 덮어쓰지 않습니다.

## 9. Validator

Curriculum 지도는 `node scripts/validate-learning-curriculum.js <file>`로, 생성된 콘텐츠는 `node scripts/validate-learning-content.js <file>`로 검증합니다. CSV parser는 열 순서, row 위치, formula prefix, 제어문자, credential 형태를 함께 검사합니다.

## 10. Migration generator

검증된 JSON만 기존 `scripts/generate-learning-content-migration.js`에 전달합니다. 이 단계는 별도 검토와 승인 뒤에 수행합니다. CSV importer는 migration·assignment·attempt·reward·ACL·RLS·Realtime 변경을 만들지 않습니다.

`skillCode`가 있는 콘텐츠 migration은 중앙 `learning_skill_definitions`에 이미 승인된 code가 있을 때만 문항 mapping을 생성합니다. 알 수 없는 code의 표시명을 추측하거나 자동 등록하지 않습니다. 게시 전 mapping은 콘텐츠와 함께 추가되고, 게시된 version의 mapping은 UPDATE/DELETE할 수 없습니다. 기존 JSON과 기존 생성 SQL에는 skill metadata를 소급 삽입하지 않으며, 검토된 backfill은 별도 additive migration으로 관리합니다.

콘텐츠 JSON의 `recommendation`은 선택 계약입니다. 초등 2학년 CSV importer는 작성자가 추천값을 입력하게 하지 않고 curriculum map의 단원 metadata를 그대로 주입합니다. 네 필드 `subject`, `recommendedStartLevelCode`, `recommendedEndLevelCode`, `parentSortOrder`가 모두 있어야 하며 사용자·가족·자녀 식별자는 허용하지 않습니다. generator는 이 객체가 있을 때만 같은 content transaction에서 단원 단위 recommendation row를 추가하고, 기존 값이 다르면 덮어쓰지 않고 중단합니다. verification은 exact metadata와 최신 published version 추천 판정을 확인하며 rollback은 미사용 콘텐츠에서 exact metadata만 먼저 제거합니다. recommendation이 없는 기존 JSON의 세 SQL 산출물은 변경되지 않습니다.

## 11. 결정적 UUID

작성자는 UUID를 입력하지 않습니다. importer는 고정 namespace와 course, unit slug, content version, stage, question order, option order의 canonical key를 SHA-256으로 해시하고 RFC 4122 variant와 version 4 bit를 고정합니다. 같은 입력은 시간·OS·경로와 무관하게 같은 UUID와 byte-identical JSON을 만듭니다. namespace 또는 canonical key 변경은 기존 식별자를 바꾸는 breaking change이므로 새 버전 정책과 migration 검토가 필요합니다. 기존 `10을 만들어요` v1/v2 UUID에는 이 규칙을 소급 적용하지 않습니다.

## 12. 새 단원 추가

공식 학년군 성취기준과 Study Plus 운영 목적을 분리해 지도에 먼저 추가하고 validator와 template generator를 통과시킵니다. slug는 확정 후 영구 식별자로 취급합니다. 작성 완료 CSV를 한 단원씩 import하고 JSON 검토 후에만 migration 생성 단계로 이동합니다.

## 13. Version 승격

게시된 문제를 직접 고치지 않습니다. 내용 변경은 `v2`, `v3`처럼 새 version CSV/JSON과 새 결정적 UUID로 만듭니다. 기존 배정·응시는 기존 version을 계속 참조하며 새 version 배정은 별도 승인합니다.

## 14. 게시 후 수정 원칙

published version의 제목, 문항, 선택지, 정답, 해설을 덮어쓰지 않습니다. 오탈자도 새 version으로 수정하고 원본 JSON·migration·verification·rollback SHA를 보존합니다.

## 15. 저작권 정책

국가 성취기준 코드는 학습 요소를 참고하기 위한 근거로만 사용합니다. 교과서·문제집·웹사이트의 문제, 선택지, 해설을 그대로 복사하거나 무단 수집하지 않습니다. 모든 문항은 독창적으로 작성하고 특정 출판사, 페이지, 문항 번호를 저장하지 않습니다. `sourceNote`와 검토 메모에는 작성 근거만 기록합니다.
