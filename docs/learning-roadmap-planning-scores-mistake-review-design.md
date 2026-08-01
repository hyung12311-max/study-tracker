# Study Plus 교육 단원 맵·학습계획·점수·오답노트 상세 설계

## 1. 문서 목적과 범위

이 문서는 부모가 교육 단원 맵을 보고 자녀에게 단원을 배정하고, 목표일과 실제 진도를 비교하며, 점수·취약 개념·오답 이력을 확인하고 복습할 수 있도록 하는 후속 구현 계약을 정의한다.

사용자 가치는 부모에게는 `무엇을 언제 공부하고 어디를 보완할지`를 한 화면에서 판단할 근거를 주고, 자녀에게는 복잡한 분석이나 낙인 없이 오늘 할 학습과 다음 행동을 명확히 보여주는 데 있다.

이번 설계의 핵심 원칙은 다음과 같다.

- 기존 `learning_assignments`, 응시 snapshot, 최초 통과, 단계 해금, 스티커 원장을 그대로 보존한다.
- 부모의 계획 정보는 공식 배정과 분리된 부가 모델로 둔다.
- 점수와 실제 완료일은 기존 원본 데이터에서 결정적으로 계산한다.
- 오답 복습은 공식 응시·단계 통과·보상과 완전히 분리한다.
- 브라우저는 `/api/learning/*` 서버 API만 사용하고 foundation table 또는 DB RPC를 직접 호출하지 않는다.
- 모든 신규 식별자는 UUID를 사용한다. 기존 bigint 식별자를 노출하는 경로는 canonical decimal string 계약을 유지한다.

### 포함 범위

- 초등 2학년 수학 12단원 교육과정 맵
- 단원 배정과 계획 시작일·목표 완료일·단계별 목표일
- 계획 대비 실제 상태
- 공식 응시의 첫·최근·최고 점수와 변화
- `skill_code` 기반 취약 개념 분석
- 부모 전용 오답 조회·해설 확인·오답만 다시 풀기
- 오답 미복습·재오답·해결·반복 오답 상태
- DB, API, UI, 보안, 테스트, Production 적용 단계

### 제외 범위

- 자동 배정과 자동 학년·수준 추측
- 공식 응시 점수의 수정 또는 재채점
- 복습 결과에 따른 단계 해금·최초 통과·보상
- Push·Realtime
- 실제 migration, API, UI 또는 콘텐츠 변경

### 사용자 흐름

1. 부모가 초등 2학년 수학 12단원 맵과 준비 상태를 확인한다.
2. published 단원을 선택해 자녀, 시작일, 단원 목표일, 단계 목표일을 확인하고 배정한다.
3. 자녀는 목표일 전후와 관계없이 기존 해금 규칙에 따라 공식 10문항을 푼다.
4. 부모는 계획 대비 실제 완료일과 최초·최근·최고 점수, skill별 근거를 본다.
5. 부모 또는 해당 자녀가 오답 복습 session에서 틀린 문제만 다시 푼다.
6. 복습 결과는 해결 상태에만 반영되고 공식 점수·해금·보상은 변하지 않는다.

준비 중 단원은 맵에 보이지만 배정 버튼이 비활성화된다. 목표일은 계획 정보일 뿐 stage 해금을 제한하지 않는다.

## 2. 현재 저장소 기준 상태

설계 기준 commit은 `500e64e77e2026e4cf7e9142f743ef83f9da9d94`이다. 현재 Production migration 계약은 `202607110001`부터 `202607310005`까지이며, 이 문서는 Production 상태를 조회하지 않고 저장소의 migration과 소스만 기준으로 작성했다.

| 영역 | 현재 구현 | 설계에 미치는 영향 |
|---|---|---|
| 교육과정 | `content/learning/curriculum/math/grade-2-2022.json`에 12단원, 순서, prerequisite, 추천 수준이 정의됨 | 단원 맵의 정적 기준 데이터로 사용 |
| 콘텐츠 | course → unit → immutable published version → stage → question → option | 맵은 unit을 기준으로 하고 배정은 정확한 published version을 고정 |
| 배정 | `learning_assignments`, `learning_stage_progress` | 계획은 기존 상태를 변경하지 않는 1:1 확장 모델로 추가 |
| 응시 | `learning_attempts`, snapshot question, immutable answer | 점수와 오답 분석의 원본 |
| 통과·보상 | `learning_stage_first_passes`, `sticker_transactions`, 원자적 finalize | 실제 완료일의 권위 원본이며 복습과 분리 |
| 추천 | 부모가 설정한 subject profile과 unit recommendation metadata | 추천은 배지·정렬에만 사용하며 자동 배정하지 않음 |
| API | `/api/learning/*`, 서버 session 재검증, CSRF·Origin 검증 | 신규 기능도 동일 경계를 재사용 |
| UI | `js/learning.js`가 부모 catalog/배정과 자녀 응시를 담당 | 부모 roadmap/분석 모듈을 분리해 복잡도 제한 |

### 현재 구조가 이미 보장하는 계약

- 동일 family/member/unit의 active assignment는 version과 관계없이 하나뿐이다.
- 배정은 published content version만 참조한다.
- stage progress는 첫 단계만 `unlocked`, 나머지는 `locked`로 생성된다.
- 공식 answer는 한 문항당 하나이며 수정되지 않는다.
- terminal attempt는 `correct_answers`, `total_questions`, `required_correct_answers`, `finalized_at`을 가진다.
- 첫 통과와 보상은 assignment/stage당 한 번이고 finalize transaction에서 처리된다.
- 실패와 재통과는 추가 해금이나 보상을 만들지 않는다.
- anon/authenticated는 learning table CRUD와 mutation 함수 실행 권한이 없다.

현재 canonical mutation 함수는 `publish_learning_content_version(uuid)`, `retire_learning_content_version(uuid)`, `create_learning_assignment(uuid, uuid, uuid, uuid)`, `cancel_learning_assignment(uuid, uuid, uuid, uuid)`, `start_or_resume_learning_attempt(...)`, `submit_learning_attempt_answer(...)`, `finalize_learning_stage_attempt(uuid, uuid, uuid)`, `abandon_learning_attempt(...)`, `upsert_learning_member_subject_profile(...)`이다. 구현 시 정확한 전체 signature는 해당 migration 원본에서 추출하며 추정하지 않는다.

현재 서버 경로는 catalog, assignment 생성·취소, attempt 시작·조회·답안·finalize·abandon, profile 조회·수정이며 `api/[...path].js`가 router다. `server/api/learning/_utils.js`가 session, active member, parent/child scope, UUID, JSON, CSRF, Origin 검증을 담당한다. UI는 `index.html`, `js/learning.js`, `css/styles.css`에 있고 stage difficulty의 한국어 label과 content의 display title이 함께 보여 중복될 수 있다.

현재 정적·API·UI 테스트와 `test/fixtures/phase2b_*` isolated PostgreSQL fixture는 RLS/ACL, 동시성, 멱등성, rollback guard를 검증한다. 이 구조를 신규 planning/skill/review 테스트에도 재사용한다.

## 3. 초등 2학년 수학 12단원 맵

### 3.1 기준 데이터와 병합 방식

교육 단원 맵의 구조와 교육적 순서는 저장소의 curriculum JSON을 기준으로 한다. 실제 이용 가능 여부는 DB의 최신 published content version 존재 여부로 판단한다. API는 두 소스를 서버에서 병합한다.

1. curriculum JSON을 검증하고 12개 단원을 `catalogOrder` 순으로 읽는다.
2. `math-core` course의 unit을 `unit_code`로 대응시킨다.
3. unit별 최신 published version을 결정적으로 선택한다.
4. 선택 자녀의 assignment, plan, stage progress, first-pass 요약을 합친다.
5. curriculum에만 있고 published version이 없으면 `준비 중`으로 표시한다.

`make-ten`은 초등 2학년 정규 12단원에 포함하지 않고 단원 번호가 없는 `기초 준비` 영역으로 정규 단원 앞에 별도 표시한다. 현재 DB의 `make-ten` sort order 1과 2학년 첫 단원의 sort order 2, prerequisite, published v1/v2 계약, 기존 배정·진행·보상 데이터는 모두 유지한다. curriculum의 `catalogOrder`와 DB `sort_order`, recommendation의 `parent_sort_order`는 서로 다른 의미이므로 동일 값이라고 가정하지 않는다.

### 3.2 12단원 표시 계약

아래 unit code와 순서는 `grade-2-2022.json`을 그대로 따른다. 화면에서는 curriculum의 한국어 표시명을 사용한다.

| 맵 순서 | unit code | 선행 단원 | 준비 중 표시 조건 |
|---:|---|---|---|
| 1 | `grade2-three-digit-numbers` | 없음 | published version 없음 |
| 2 | `grade2-shapes` | 없음 | 동일 |
| 3 | `grade2-addition-subtraction` | `grade2-three-digit-numbers` | 동일 |
| 4 | `grade2-measuring-length` | 없음 | 동일 |
| 5 | `grade2-classification` | 없음 | 동일 |
| 6 | `grade2-multiplication-meaning` | 없음 | 동일 |
| 7 | `grade2-four-digit-numbers` | `grade2-three-digit-numbers` | 동일 |
| 8 | `grade2-multiplication-tables` | `grade2-multiplication-meaning` | 동일 |
| 9 | `grade2-length-calculation` | `grade2-measuring-length` | 동일 |
| 10 | `grade2-time` | 없음 | 동일 |
| 11 | `grade2-tables-graphs` | `grade2-classification` | 동일 |
| 12 | `grade2-patterns` | 없음 | 동일 |

구현 전에는 JSON의 실제 표시명과 위 code의 일치를 테스트로 고정해야 한다. 문서가 표시명을 별도로 복제하여 두 번째 원본이 되지 않도록 한다.

### 3.3 카드 상태

상태 우선순위는 다음과 같다.

1. `paused`: active assignment와 paused plan 존재
2. `completed`: assignment completed
3. `in_progress`: active assignment 존재
4. `available`: published version 존재
5. `preparing`: published version 없음

취소된 과거 assignment만 있으면 현재 카드는 `available`이며 과거 이력은 별도 history로 남긴다. 구 version을 완료한 뒤 새 version이 게시된 경우 `completed`와 `새 버전 이용 가능`을 함께 표시할 수 있으나 자동 재배정하지 않는다.

### 3.4 선행 단원 표현

- 선행 단원은 잠금 강제가 아니라 부모 판단을 돕는 정보로 시작한다.
- 완료된 prerequisite는 체크, 미완료 prerequisite는 안내 배지로 표시한다.
- recommendation과 prerequisite는 배정 API의 강제 조건으로 사용하지 않는다.
- 향후 강제 잠금이 필요하면 별도 정책·migration 승인을 받는다.

`기초 준비` 영역의 Make Ten은 정규 단원 번호와 12단원 완료율 계산에서 제외한다. 다만 기존 prerequisite 관계와 독립적인 배정·진행 상태는 그대로 보여준다. 새 course나 unit을 생성하지 않는다.

### 3.5 상태 전이 요약

- roadmap: `preparing → available → in_progress ↔ paused → completed`
- assignment: 기존 `active → completed|cancelled`만 유지
- plan: `active ↔ paused`; assignment 완료 시 표시 상태만 completed로 파생
- stage: 기존 `locked → unlocked → passed`
- review: `in_progress → completed|abandoned`

계획 상태를 assignment 상태에 추가하지 않는 이유는 기존 active unique index, 배정 함수, 취소·attempt abandon 계약에 영향을 주지 않기 위해서다.

pause는 plan 상태만 바꾸며 기존 attempt 또는 review session을 삭제하거나 abandon하지 않는다. `paused → completed`는 pause 전에 시작한 official attempt가 마지막 stage를 통과해 assignment가 완료되는 경우 허용한다.

## 4. 학습계획 DB 모델

기존 assignment를 변경하지 않고 다음 세 테이블을 추가하는 방안을 권장한다.

### 4.1 `learning_assignment_plans`

현재 계획 상태를 빠르게 읽기 위한 assignment당 1개 행이다.

| 컬럼 | 타입 | 계약 |
|---|---|---|
| `id` | uuid PK | 서버 생성 |
| `assignment_id` | uuid unique not null | `learning_assignments(id)` 참조 |
| `family_id` | uuid not null | assignment scope와 일치 |
| `assigned_member_id` | uuid not null | assignment scope와 일치 |
| `content_version_id` | uuid not null | assignment의 고정 version과 일치 |
| `planned_start_date` | date not null | 부모가 선택한 시작일 |
| `target_completion_date` | date not null | 시작일 이상 |
| `timezone_name` | text not null | 초기값 `Asia/Seoul`, IANA 이름 검증 |
| `plan_state` | text not null | `active`, `paused` |
| `paused_at` | timestamptz nullable | paused일 때만 값 존재 |
| `configured_by_member_id` | uuid not null | 동일 family active parent |
| `create_request_id` | uuid not null | 생성 멱등키 |
| `revision` | integer not null | 1부터 증가, optimistic concurrency |
| `created_at`, `updated_at` | timestamptz | 서버 시각 |

필수 제약:

- `planned_start_date <= target_completion_date`
- assignment의 family/member/version과 중복 컬럼이 정확히 일치하는 composite FK
- `(family_id, assigned_member_id, create_request_id)` unique
- paused/state와 `paused_at`의 CHECK
- RLS 및 FORCE RLS, direct mutation revoke

### 4.2 `learning_assignment_stage_targets`

현재 단계별 목표일이다.

| 컬럼 | 타입 | 계약 |
|---|---|---|
| `plan_id` | uuid not null | plan cascade delete는 rollback 전용 함수에서만 가능 |
| `assignment_id` | uuid not null | scope 검증용 |
| `stage_id` | uuid not null | assignment version 소속 stage |
| `display_order` | integer not null | published stage order snapshot |
| `target_date` | date not null | 계획 timezone의 달력 날짜 |
| `created_at`, `updated_at` | timestamptz | 서버 시각 |

PK는 `(plan_id, stage_id)`, unique는 `(assignment_id, display_order)`로 한다. 목표일은 시작일 이상, 단원 목표일 이하이며 display order에 따라 감소하지 않아야 한다. deferred constraint trigger 또는 승인 wrapper의 잠금 검증으로 transaction 마지막 상태를 검사한다.

### 4.3 `learning_assignment_plan_revisions`

목표일을 뒤로 미뤄 지연 이력을 지우는 문제를 방지하기 위한 immutable audit 행이다.

| 컬럼 | 타입 | 계약 |
|---|---|---|
| `id` | uuid PK | 서버 생성 |
| `plan_id` | uuid not null | 대상 plan |
| `revision` | integer not null | plan revision과 동일 |
| `changed_by_member_id` | uuid not null | 동일 family active parent |
| `planned_start_date`, `target_completion_date` | date | 해당 revision 값 |
| `timezone_name`, `plan_state` | text | 해당 revision 값 |
| `stage_targets_snapshot` | jsonb | stage id/order/date 전체, schema CHECK |
| `request_id` | uuid not null | 수정 멱등키 |
| `changed_at` | timestamptz | 서버 시각 |

`(plan_id, revision)`과 `(plan_id, request_id)`를 unique로 한다. UPDATE/DELETE를 immutable trigger로 차단한다.

### 4.3.1 계획 테이블 물리 계약 요약

| 테이블 | 주요 index | 삭제 정책 | immutable 범위 | ownership 경로 | 허용 mutation |
|---|---|---|---|---|---|
| plans | family/member/state, assignment unique | 업무 delete 없음; data-present rollback 차단 | identity/scope 컬럼 | plan → assignment → family/member | create-with-plan, update/pause/resume wrapper |
| stage targets | assignment/display order unique, target date | 업무 delete 없음 | scope/stage 컬럼; 날짜는 wrapper만 변경 | target → plan → assignment | plan update wrapper |
| revisions | plan/revision unique, plan/request unique | 삭제 금지 | 전체 행 | revision → plan → assignment | plan wrapper의 INSERT만 |

세 테이블 모두 FORCE RLS이며 service_role direct mutation은 허용하지 않는다.

### 4.4 계획 생성과 수정의 원자성

신규 `create_learning_assignment_with_plan(...)` wrapper는 한 transaction에서 다음을 수행한다.

1. actor를 active parent로 잠금·검증한다.
2. child family/role/active와 published version을 검증한다.
3. 기존 `create_learning_assignment`와 같은 중복 직렬화 경계를 사용해 assignment를 만든다.
4. plan과 모든 stage target을 만든다.
5. revision 1 snapshot을 기록한다.
6. assignment와 plan DTO를 반환한다.

계획 수정 wrapper는 plan을 `FOR UPDATE`로 잠그고 `expected_revision`을 비교한다. 동일 `request_id`와 동일 payload는 기존 결과를 반환한다. 같은 request id에 다른 payload는 `409 IDEMPOTENCY_CONFLICT`, revision 불일치는 `409 PLAN_REVISION_CONFLICT`이다.

계획 수정 전에 연결된 assignment를 함께 잠그고 `status = 'active'`인지 확인한다. assignment가 `completed`이면 날짜·timezone·stage target·pause 상태를 포함한 모든 계획 수정과 resume을 `409 PLAN_LOCKED_AFTER_COMPLETION`으로 거부한다. actual completion은 파생값이므로 어떤 wrapper에도 입력 컬럼으로 받지 않는다. 관리자 우회 함수는 만들지 않는다.

### 4.5 자동 단계 목표일

stage가 N개이고 시작일 S, 완료 목표일 E일 때 stage i의 기본 목표일은 다음과 같다.

`S + floor(i × (E - S) / N)`, i = 1..N

마지막 stage는 반드시 E와 같다. 기간이 stage 수보다 짧으면 같은 날짜가 반복될 수 있으며 이는 허용한다. 부모가 개별 날짜를 수정하면 비감소 순서와 범위를 다시 검증한다.

### 4.6 일시중지 정책

확정 정책은 plan만 `paused`로 바꾸고 assignment는 `active`로 유지하는 것이다. 이로써 active 중복 방지와 기존 이력이 보존된다.

- pause 후 신규 official attempt 시작은 차단한다.
- pause 후 신규 mistake review session 시작은 차단한다.
- 이미 `in_progress`인 attempt는 삭제·abandon하지 않고 완료를 허용한다.
- 이미 `in_progress`인 review session은 계속 답하고 완료할 수 있다.
- resume 시 계획 날짜를 자동 이동하지 않는다. 부모가 명시적으로 조정한다.
- resume 후 신규 official attempt와 review session 시작을 다시 허용한다.
- pause/resume도 revision snapshot으로 남긴다.

| operation | active | paused | completed assignment |
|---|---:|---:|---:|
| 기존 in-progress official attempt 조회·답안·finalize | 허용 | 허용 | 기존 공식 응시 계약 유지 |
| 신규 official attempt 시작 | 허용 | 차단 | 기존 공식 재응시 계약 유지 |
| 기존 in-progress review 조회·답안·완료 | 허용 | 허용 | 허용 |
| 신규 review session 시작 | 허용 | 차단 | official 오답이 있으면 허용 |
| 계획 날짜·stage target 수정 | 허용 | 허용 | 차단 |
| pause | 허용 | 멱등 결과 | 차단 |
| resume | 이미 active인 멱등 결과 | 허용 | 차단 |

start wrapper는 assignment와 plan을 잠그고 paused 여부를 확인하지만, answer/finalize와 기존 review 진행 wrapper는 session 생성 당시 권한·scope만 재검증하고 pause를 차단 조건으로 사용하지 않는다.

## 5. 계획 대비 실제 진도 계산

실제 완료일을 별도 쓰기 가능한 컬럼으로 복제하지 않는다.

| 실제 값 | 권위 원본 | 계산 |
|---|---|---|
| stage 최초 완료 시각 | `learning_stage_first_passes.passed_at` | plan timezone의 date로 변환 |
| legacy stage 완료 | `learning_stage_progress.passed_at` | first-pass가 없는 구 데이터에만 fallback |
| unit 완료 시각 | `learning_assignments.completed_at` | plan timezone의 date로 변환 |
| 최근 학습 시각 | terminal `learning_attempts.finalized_at` | max |

### 5.1 상태 계산

기준일 `today`는 plan의 `timezone_name`으로 계산한다.

- `scheduled`: today < planned start, 완료 아님
- `paused`: plan_state paused
- `on_track`: 다음 미완료 stage 목표일과 unit 목표일을 지나지 않음
- `delayed`: 미완료 stage 목표일 또는 unit 목표일을 지남
- `completed_early`: unit actual date < target completion date
- `completed`: unit actual date >= target completion date

완료된 stage는 이후 target을 수정해도 actual date가 바뀌지 않는다. UI는 현재 계획과 최초 계획 revision을 함께 조회할 수 있어 계획 변경으로 지연 사실이 숨겨지지 않게 한다.

단원 완료 전에는 부모가 계획을 수정할 수 있고 매번 immutable revision을 남긴다. 전체 단원 완료 뒤에는 현재·과거 target을 모두 잠그므로 소급 수정으로 완료 상태를 `on_track`으로 바꿀 수 없다. legacy assignment는 plan이 없어도 기존 진행·완료 계산을 그대로 사용하며 계획 관련 필드는 `null`, 상태는 assignment/progress에서 파생한다.

## 6. 점수·응시 이력 계산 계약

점수 원본은 `learning_attempts.status IN ('passed', 'failed')`인 terminal official attempt만 사용한다. `in_progress`와 `abandoned`, 오답 복습은 제외한다.

### 6.1 대표 점수

| 지표 | 결정 규칙 |
|---|---|
| 최초 점수 | `(finalized_at ASC, attempt_no ASC, id ASC)` 첫 행 |
| 최근 점수 | `(finalized_at DESC, attempt_no DESC, id DESC)` 첫 행 |
| 최고 점수 | `correct_answers / total_questions` 최대; 동률이면 correct 수 최대, 이후 가장 이른 finalized/id |
| 응시 횟수 | terminal official attempt 수 |
| 점수 변화 | 최근 백분율 - 최초 백분율, 같은 총 문항이면 정답 수 차이도 표시 |

백분율 비교는 부동소수점이 아니라 교차 곱셈으로 한다. API 표시값만 정수 또는 소수 한 자리로 반올림한다. 원본 `correct/total`도 함께 반환한다.

### 6.2 단계·단원 집계

- 단계 점수는 assignment/stage 단위로 계산한다.
- 단원 점수는 stage별 최고 점수의 단순 평균과 최근 공식 attempt 묶음 평균을 구분해 명명한다.
- 최초·최근·최고 점수와 skill 분석은 assignment에 고정된 content version별로 계산한다.
- 서로 다른 content version의 점수를 하나의 대표 점수나 skill 결과로 자동 혼합하지 않는다.
- 부모가 `전체 버전 이력 보기`를 선택하면 version label과 함께 version별 그룹을 병렬 표시한다.
- skill code가 같아도 문항 구성이 다르면 version별 결과를 우선한다. version 간 명시적 통합 분석은 후속 별도 기능이다.

### 6.3 API DTO 예시

```json
{
  "stageId": "uuid",
  "attemptCount": 3,
  "first": { "correct": 6, "total": 10, "percent": 60, "finalizedAt": "..." },
  "latest": { "correct": 9, "total": 10, "percent": 90, "finalizedAt": "..." },
  "best": { "correct": 10, "total": 10, "percent": 100, "finalizedAt": "..." },
  "changePercentagePoints": 30
}
```

attempt 또는 answer의 내부 scope를 추론할 수 있는 family id, 정답 option id, first-pass id, ledger id는 목록 DTO에 노출하지 않는다.

부모 화면의 10문항 기준 설명 문구는 `10/10 완벽하게 이해`, `8~9/10 단계 통과`, `6~7/10 보완 학습 필요`, `0~5/10 기초 개념 다시 확인`을 사용한다. 문항 수가 다른 콘텐츠에는 고정 구간을 재사용하지 않고 pass threshold와 비율에 맞춘 중립 문구를 사용한다. 자녀 결과 화면은 `실패`나 비난 표현 대신 다음 학습 행동을 안내한다.

## 7. skill code와 취약 개념 모델

### 7.1 현재 결함

작성 CSV의 `skill_code`는 검증되지만 importer가 canonical JSON에 보존하지 않고, `learning_questions`에도 skill 컬럼이나 mapping이 없다. 따라서 현재 DB만으로는 안정적인 취약 개념 분석이 불가능하다.

### 7.2 권장 신규 테이블

#### `learning_skill_definitions`

- `skill_code text primary key`
- `subject_code text` (`math`)
- `display_name text`
- `description text nullable`
- `curriculum_code text nullable`
- `created_at timestamptz`

이 테이블은 중앙 skill 사전이다. 안정적인 `skill_code`는 개발·집계 identity이고 `display_name`은 부모 UI용 한국어 표시명이다. 신규 콘텐츠 작성자는 code 연결과 초기 표시명을 제안하며, 사용자 콘텐츠 검토에서 표시명을 최종 승인한다. 표시명 수정은 동일 code의 집계 identity나 과거 결과를 바꾸지 않으며 승인된 metadata migration으로만 수행한다.

#### `learning_question_skills`

- `question_id uuid` FK to `learning_questions`
- `skill_code text` FK to definitions
- `is_primary boolean not null`
- PK `(question_id, skill_code)`
- question당 primary 하나 unique partial index

published version의 question mapping은 trigger로 UPDATE/DELETE를 차단한다. content JSON schema와 generator가 `skillCode`를 보존하고 deterministic content migration이 definition/mapping을 생성해야 한다.

### 7.3 snapshot 안정성

새 attempt에는 `learning_attempt_questions.skill_codes_snapshot text[]`를 추가하는 방안을 권장한다. 과거 attempt는 immutable `source_question_id` mapping으로 fallback한다. 이 배열은 채점에 사용하지 않고 분석 재현에만 사용한다.

기존 Make Ten과 이미 생성된 콘텐츠는 별도 additive metadata migration으로 backfill한다. mapping이 없는 과거 문항은 `미분류`로 표시하고 임의 추측하지 않는다.

### 7.4 취약 개념 판정

공식 terminal attempt만 기본 표본으로 사용한다.

- 관찰 수: skill이 연결된 answer 수
- 독립 응시 수: distinct official attempt 수
- 정확도: correct / observations
- 최근 상태: 가장 최근 official answer

확정된 상태 판정은 다음과 같다.

- `보완 필요`: 관찰 문항 3개 이상, 독립 official terminal attempt 2회 이상, 누적 오답 2개 이상, 정확도 60% 이하, 가장 최근 official attempt에도 해당 skill 오답 존재를 모두 충족
- `데이터 부족`: 관찰 3개 미만 또는 독립 terminal attempt 2회 미만
- `관찰 중`: 최소 표본은 충족했으나 `보완 필요`의 정확도·오답·최근 오답 조건 일부를 충족하지 않음
- `안정적`: 최소 표본을 충족하고 정확도 80% 이상이며 가장 최근 official attempt에 해당 skill 오답이 없음

`관찰 중`과 `안정적`의 경계가 겹치지 않도록 서버 정책은 안정적 조건을 먼저 평가하고, 보완 필요, 데이터 부족, 관찰 중 순으로 결정한다. 응답에는 `policyVersion`, 관찰 수, 독립 응시 수, 오답 수, 정확도, 최근 오답 여부를 포함한다. 오답 review 결과는 공식 취약도 계산에서 제외하고 별도의 해결 상태로만 표시한다.

무작위 가능 오답은 단일 official 오답 뒤 최근 공식 응시에서 정답이고 반복 오답이 없는 경우로 보조 설명한다. 반복 개념 오답은 같은 version과 skill에서 둘 이상의 독립 official attempt에 오답이 있고 최근에도 오답인 경우다. 두 설명 모두 4개 공식 상태를 대체하지 않는다.

## 8. 오답노트·다시 풀기 DB 모델

공식 answer는 수정하지 않는다. 오답 복습은 session, item, answer, audit event의 네 개 테이블에 기록한다.

### 8.1 `learning_mistake_review_sessions`

| 컬럼 | 계약 |
|---|---|
| `id` | uuid PK |
| `family_id`, `assigned_member_id` | scope 고정 |
| `assignment_id`, `content_version_id` | 공식 이력과 version 고정 |
| `started_by_member_id` | 동일 family active parent 또는 assigned self child |
| `status` | `in_progress`, `completed`, `abandoned` |
| `request_id` | family/member 기준 unique 멱등키 |
| `started_at`, `completed_at`, `abandoned_at` | 상태 CHECK |

한 assignment에 여러 review round를 허용하되 한 child/assignment당 in-progress session은 하나만 허용한다.

### 8.2 `learning_mistake_review_items`

- `id uuid primary key`
- `session_id uuid`
- `source_attempt_id uuid`
- `source_attempt_question_id uuid`
- `source_answer_id uuid`
- `display_order integer`
- unique `(session_id, source_answer_id)`

원본 attempt snapshot을 참조하므로 prompt, option, correct option, explanation을 다시 복제하지 않는다. 모든 source 행이 session의 family/member/assignment/version에 속하는지 composite FK와 wrapper로 검증한다.

### 8.3 `learning_mistake_review_answers`

- `id uuid primary key`
- `session_id`, `review_item_id`
- `selected_option_id uuid`
- `is_correct boolean` — 서버가 snapshot으로 계산
- `client_request_id uuid`
- `submitted_at timestamptz`
- unique `(review_item_id)` 및 `(session_id, client_request_id)`

같은 round에서는 item당 한 번만 답한다. 다시 복습하려면 새 session을 만들어 round 이력을 보존한다.

### 8.3.1 복습 테이블 물리 계약 요약

| 테이블 | 주요 index/unique | CHECK | 삭제 정책 | immutable | 허용 mutation |
|---|---|---|---|---|---|
| sessions | child/assignment in-progress partial unique, scope/request unique | terminal timestamp와 status 일치 | 업무 delete 없음 | scope/source 불변, status만 전이 | start, complete, abandon |
| items | session/source answer unique, session/display order unique | display order > 0 | 업무 delete 없음 | 전체 행 | session start wrapper INSERT |
| answers | item unique, session/request unique | option membership은 wrapper 검증 | 업무 delete 없음 | 전체 행 | submit review answer INSERT |
| events | session/request unique | 허용 event type | 업무 delete 없음 | 전체 행 | parent reveal-solution wrapper INSERT |

### 8.3.2 `learning_mistake_review_events`

부모의 명시적 정답·해설 보기를 포함한 review audit 행이다.

- `id uuid primary key`
- `session_id uuid not null`
- `review_item_id uuid nullable`
- `actor_member_id uuid not null`
- `event_type text not null` — 초기 허용값 `solution_revealed`
- `request_id uuid not null`
- `created_at timestamptz not null`
- unique `(session_id, request_id)`

event는 immutable이며 해결 상태나 review 정답으로 계산하지 않는다. actor가 같은 family의 active parent이고 item이 해당 session에 속하는지 wrapper에서 검증한다. 자녀에게는 이 명시적 reveal mutation을 허용하지 않으며, 자녀는 자기 답 제출 후 응답에서만 정답·해설을 받는다.

조회 index는 `(family_id, assigned_member_id, assignment_id, status)`, `(session_id, display_order)`, `(session_id, submitted_at)`, event의 `(session_id, created_at)`를 둔다. 네 테이블 모두 FORCE RLS, service_role SELECT-only, 승인 wrapper execute-only다.

### 8.4 오답 상태

상태는 저장된 mutable flag가 아니라 official answer와 review answer에서 계산한다.

- `unreviewed`: 복습 answer 없음
- `retried_wrong`: 최신 review answer 오답
- `resolved`: 최신 review answer 정답
- `repeated_wrong`: 같은 source question 또는 skill에서 두 개 이상의 독립 official attempt/review round 오답이며 최신도 오답

`resolved`는 공식 점수를 바꾸지 않는다. 이후 official attempt에서 다시 틀리면 새 오답 사건으로 표시할 수 있다.

### 8.5 해설 확인

부모 전용 `POST .../mistake-reviews/:sessionId/items/:itemId/reveal-solution`은 기존 snapshot의 정답과 해설을 반환하면서 `solution_revealed` audit event를 같은 transaction에 기록한다. `requestId`로 멱등 처리하고, 정답 보기만으로 review answer나 해결 상태를 만들지 않는다. 자녀의 미래 문항이나 아직 답하지 않은 official attempt의 정답을 노출하지 않는다.

### 8.6 복습 권한과 공개 조건

| operation | active parent | assigned self child | 다른 가족·다른 자녀 |
|---|---:|---:|---:|
| 자기 scope 오답 목록 | 같은 family active child만 | 자기 assignment만 | 차단 |
| 신규 review 시작 | 같은 family active child만 | 자기 assignment만 | 차단 |
| 기존 review 진행·완료 | 같은 family active child만 | 자기 session만 | 차단 |
| 미제출 정답·해설 조회 | 명시적 reveal + audit | 차단 | 차단 |
| 답 제출 후 해당 문항 정답·해설 | 허용 | 허용 | 차단 |

plan이 paused이면 신규 session 시작만 차단하고 이미 시작된 session의 조회·답안·완료는 허용한다. 모든 목록과 mutation은 assignment → family/member → content version → official terminal attempt ownership chain을 검증한다.

## 9. 서버 API 설계

### 9.1 공통 계약

- session claim 뒤 현재 active member를 DB에서 재검증한다.
- 부모 endpoint는 active parent와 같은 family의 active child를 검증한다.
- 자녀 endpoint는 self scope만 허용한다.
- browser가 family id나 actor id를 지정하지 않는다.
- mutation은 JSON, `X-Study-CSRF: 1`, 허용 Origin을 요구한다.
- UUID는 기존 helper로 검증하고 DB 요청 전에 거부한다.
- 날짜는 strict `YYYY-MM-DD`, whitespace·시각·offset을 허용하지 않는다.
- 신규 official attempt와 review session start는 plan row가 있으면 paused 상태를 잠금 확인한다. 이미 시작된 attempt/review의 answer·finalize·complete는 pause 때문에 거부하지 않는다.
- plan update는 assignment completed 여부를 잠금 확인하고 완료 뒤에는 `PLAN_LOCKED_AFTER_COMPLETION`으로 거부한다.
- bigint가 필요한 기존 DTO는 decimal string을 유지하며 `Number`, `parseInt`, 단항 `+`를 사용하지 않는다.
- 404는 다른 family object 존재 여부를 숨긴다.

### 9.2 endpoint 목록

| Method/Path | 권한 | 입력 | 출력 | mutation·멱등성 |
|---|---|---|---|---|
| `GET /api/learning/roadmap?memberId=` | parent | same-family active child UUID | 12단원, 준비/배정/계획/진도 요약 | read-only |
| `POST /api/learning/planned-assignments` | parent | memberId, contentVersionId, start/target dates, optional stage targets, requestId | assignment+plan DTO | 단일 wrapper, requestId 멱등 |
| `PUT /api/learning/plans/:planId` | parent | expectedRevision, desired dates/state, requestId | 새 revision과 plan | full desired state, optimistic lock |
| `POST /api/learning/plans/:planId/pause` | parent | expectedRevision, requestId | paused plan | 상태 전이 멱등 |
| `POST /api/learning/plans/:planId/resume` | parent | expectedRevision, requestId | active plan | 상태 전이 멱등 |
| `GET /api/learning/plans/:planId` | parent | scoped plan UUID | 계획/actual/score summary | read-only |
| `GET /api/learning/assignments/:id/scores` | parent | scoped assignment UUID, optional stage/version | official first/latest/best/history | read-only |
| `GET /api/learning/assignments/:id/skills` | parent | scoped assignment UUID | skill evidence와 confidence | read-only |
| `GET /api/learning/assignments/:id/mistakes` | parent | status/stage/skill cursor filter | original selection, state, snapshot-safe text | read-only |
| `POST /api/learning/assignments/:id/mistake-reviews` | parent 또는 self child | 부모는 member scope, 자녀는 자기 assignment; filters, requestId | review session+items | 오답만 snapshot, 멱등 |
| `GET /api/learning/mistake-reviews/:id` | parent 또는 self child | scoped session UUID | items와 submitted state; 미제출 정답 비노출 | read-only |
| `POST /api/learning/mistake-reviews/:id/items/:itemId/answers` | parent 또는 self child | selectedOptionId, requestId | 제출 후 correct 여부와 explanation | item/request 멱등, review 전용 |
| `POST /api/learning/mistake-reviews/:id/abandon` | parent 또는 self child | requestId | abandoned session | terminal 멱등 |
| `POST /api/learning/mistake-reviews/:id/items/:itemId/reveal-solution` | parent | requestId, scoped session/item UUID | correct option·explanation, audit event | 멱등 audit mutation; 해결 상태 불변 |

### 9.3 오류 계약

| 상태 | code | 조건 |
|---:|---|---|
| 400 | `INVALID_DATE`, `INVALID_UUID`, `INVALID_STAGE_TARGETS` | 형식/순서 오류 |
| 401 | `AUTH_REQUIRED` | session 없음 |
| 403 | `FORBIDDEN`, `CSRF_REQUIRED`, `ORIGIN_FORBIDDEN` | 역할·mutation 경계 |
| 404 | `PLAN_NOT_FOUND`, `ASSIGNMENT_NOT_FOUND`, `REVIEW_NOT_FOUND` | scope 밖도 동일 |
| 409 | `ACTIVE_ASSIGNMENT_EXISTS`, `PLAN_REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT` | 동시성·중복 |
| 409 | `PLAN_LOCKED_AFTER_COMPLETION` | 완료된 단원 계획 수정 시도 |
| 422 | `CONTENT_NOT_PUBLISHED`, `PLAN_PAUSED`, `NO_REVIEWABLE_MISTAKES` | 현재 상태에서 불가 |

DB 메시지나 constraint 이름, SQL, stack, service role 정보를 클라이언트에 전달하지 않는다.

## 10. 부모 UI 설계

### 10.1 정보 구조

`index.html`의 부모 문제풀이 영역 안에 다음 view를 둔다.

1. `교육 단원 맵`
2. `학습 계획`
3. `점수·취약 개념`
4. `오답노트`

`js/learning.js`가 더 비대해지지 않도록 `js/learning-roadmap.js`와 `js/learning-review.js`로 분리하는 방안을 권장한다. 공통 fetch/auth/generation guard는 기존 learning module에서 명시적으로 export하거나 작은 공통 모듈로 추출한다.

### 10.2 단원 맵 카드

- 단원 순서, prerequisite, 준비 중/가능/진행/완료/일시중지 상태
- 추천 배지는 부모에게만 표시
- published가 없으면 버튼 대신 `준비 중`
- assignment가 없으면 `계획하고 배정`
- active면 계획 진도와 `계획 수정`
- completed면 실제 완료일과 점수 요약
- 새 version은 명시적 선택으로만 재배정

### 10.3 계획 편집

- 시작일, 완료 목표일, 자동 계산된 stage 목표일
- stage 날짜 직접 수정 가능
- 저장 전 strict date, 순서, 범위 검증
- revision conflict는 최신 계획을 다시 불러오고 사용자가 재확인
- pause/resume은 별도 확인 dialog

### 10.4 계획 대비 실제

- 계획 날짜와 실제 최초 통과 날짜를 나란히 표시
- `예정보다 빠름`, `계획대로`, `지연`, `일시중지`
- 오늘 기준 지연 일수는 화면 표시용 계산이며 서버 산출 상태를 우선
- 과거 target revision을 접어서 볼 수 있음

### 10.5 점수·취약 개념

- stage별 최초/최근/최고 `정답/전체`와 백분율
- 변화는 percentage point로 명시
- 응시 이력은 terminal attempt만 시간순 표시
- skill은 표본 수와 confidence를 함께 표시
- `취약` 배지는 규칙을 충족할 때만 사용

### 10.6 오답노트

- stage/skill/status 필터
- 원래 고른 답, 정답 여부, explanation 확인
- `오답만 다시 풀기`는 선택한 오답으로 review session 생성
- official 점수·보상과 무관하다는 문구 표시
- 해결/재오답/반복 오답은 아이콘과 텍스트로 구분
- 부모의 `정답과 해설 보기`는 확인 동작 뒤 audit event를 기록하며 해결 상태를 바꾸지 않음

### 10.7 자녀 화면 비노출

자녀 DTO와 화면에는 다음을 노출하지 않는다.

- 학년·course·content version·recommendation metadata
- 부모 계획 revision과 지연 평가
- 취약 개념 라벨과 부모 분석 메모
- 다른 attempt의 정답·오답 이력
- review session 관리 기능

자녀는 기존 배정 단원·단계·현재 attempt만 본다.

### 10.8 자녀 화면의 허용 기능

- `오늘의 학습`: 시작 가능한 현재 단계와 부모가 정한 목표 완료일만 간단히 표시
- `현재 단원·단계`: course/학년/version 없이 단원 표시명과 단계 표시명만 표시
- `공식 문제풀이`: 기존 전체 10문항 attempt flow 유지
- `결과`: 중립적 피드백과 `다시 전체 도전`, 통과 시 다음 단계 안내
- `틀린 문제 복습`: 자신의 completed official attempt 오답으로 session을 시작하거나 자기 session에만 접근
- review에서는 원래 선택을 표시하고 정답은 제출 전 숨기며, 제출 후 정답·해설을 표시

empty/loading/error는 부모와 자녀 모두 독립 component state로 둔다. 모바일에서는 맵을 한 열 카드, 점수 표는 라벨-값 카드로 전환한다. 모든 dialog는 focus trap, Escape/취소, 명시적 label, keyboard focus-visible을 제공한다. 가족명·내부 ID·다른 자녀 정보는 표시하지 않는다.

## 11. 권한·RLS·SECURITY DEFINER 경계

### 11.1 테이블 권한

모든 신규 테이블은:

- `ENABLE ROW LEVEL SECURITY`
- `FORCE ROW LEVEL SECURITY`
- PUBLIC, anon, authenticated의 table privilege 전부 revoke
- service_role은 SELECT만 grant
- service_role direct INSERT/UPDATE/DELETE revoke

### 11.2 함수 권한

승인 mutation wrapper만 service_role EXECUTE를 가진다.

- owner postgres
- `SECURITY DEFINER`
- `SET search_path = pg_catalog, public`
- 완전한 schema-qualified object
- PUBLIC/anon/authenticated execute revoke
- 초기 service_role revoke 후 승인된 signature만 grant
- 내부 helper는 service_role 직접 execute 없음

### 11.3 ownership 검증

함수는 actor id를 브라우저에서 받지 않거나, 서버가 session에서 추출한 값을 전달한다. 함수 내부에서도 다음을 재검증한다.

- actor active parent
- child active, role child, 같은 family
- assignment/plan/attempt/review의 family/member/version chain 일치
- source answer가 terminal official attempt의 오답인지 확인
- selected option이 해당 snapshot item에 속하는지 확인

## 12. 동시성·멱등성·불변성

| 흐름 | 직렬화 대상 | 멱등키 | 불변성 |
|---|---|---|---|
| 계획 포함 배정 | family/member/unit advisory/row lock | create request | active assignment 하나 |
| 계획 수정 | plan `FOR UPDATE` | plan/request + expected revision | revision 단조 증가 |
| pause/resume | plan `FOR UPDATE` | request id | assignment 상태 불변 |
| review 생성 | child/assignment in-progress partial unique | request id | source 오답 집합 고정 |
| review 답안 | review item `FOR UPDATE` | client request | item당 답 하나 |
| review abandon | session `FOR UPDATE` | request id | terminal 멱등 |

공식 attempt snapshot, official answer, first-pass, plan revision, review answer는 UPDATE/DELETE 방지 trigger를 둔다. rollback migration은 데이터가 있으면 `55000`으로 중단하는 기존 안전 계약을 따른다.

## 13. 위협 모델

| 위협 | 차단 지점 | 필수 검증 |
|---|---|---|
| 다른 가족 plan/score/mistake 조회 | parent scope helper + DB chain | 404, SQL role 42501 |
| 다른 자녀 assignment·attempt id 변조 | family/member composite scope | API negative tests |
| review를 official attempt로 위장 | 별도 table/function, official finalizer 미호출 | progress/reward count 불변 |
| review로 단계 해금·보상 획득 | review 함수에 progress/first-pass/ledger DML 없음 | static SQL + integration |
| 완료일 직접 수정 | 실제일 파생, progress/first-pass direct DML revoke | service-role mutation probe |
| unpublished 콘텐츠 노출 | roadmap latest published filter | draft/retired fixture |
| 구·신 version 점수 혼합 | assignment/content_version scope | version fixture |
| bigint 정밀도 손상 | decimal string helper, number 변환 금지 | boundary static/API tests |
| timezone 날짜 역전 | IANA timezone snapshot, DB date 변환 | 자정·DST 테스트 |
| 중복 review session | partial unique + request id | 독립 연결 경쟁 테스트 |
| target 수정으로 지연 은폐 | immutable plan revisions | revision history test |
| 정답 사전 노출 | parent reveal audit, child는 review 제출 후 공개, unanswered official item 제외 | DTO leakage·event test |

## 14. 테스트 전략

### 14.1 정적 테스트

- migration table/constraint/index/trigger/function signature
- RLS/FORCE RLS, ACL, search_path, grant 목록
- review SQL에 progress/first-pass/sticker DML 없음
- content generator가 skillCode를 보존
- browser direct REST/RPC/service role 참조 없음
- child DTO 금지 필드

### 14.2 단위·API 테스트

- curriculum 12단원 merge와 준비 중
- 날짜 strict validation과 자동 분배
- family parent scope와 child self scope
- request id 멱등과 revision conflict
- first/latest/best tie-break
- skill sample/confidence/weak rules
- mistake 상태 전이와 solution leakage
- stale child generation guard

### 14.3 격리 PostgreSQL 통합

- migration parse/verification
- 계획 포함 배정 원자성
- stage target constraint와 revision audit
- 동시 계획 수정·review 생성
- official score 불변
- review 전후 progress/first-pass/ledger count 불변
- anon/authenticated CRUD·function 차단
- service_role SELECT·승인 함수 허용, direct mutation 차단
- pre-data rollback과 data-present `55000`
- Realtime publication 비포함

### 14.4 전체 회귀

- 기존 일반 계획·교재·독서·Academy
- 기존 learning catalog·assignment·attempt·finalize·reward
- Make Ten v1/v2와 세 자리 수 콘텐츠
- bigint plan ID 계약
- build, node check, diff check, secret scan

### 14.5 Production 최소 검증

- linked history와 단일 pending dry-run
- migration별 원본 verification
- anon/authenticated SQL role probe
- aggregate count 또는 승인된 fixture 없는 metadata 검사
- Vercel 자동 배포 source commit/alias
- public asset·비인증 API smoke
- 기존 부모 세션이 있을 때만 read-only UI 회귀
- 실제 plan/review mutation은 별도 명시 승인과 전용 테스트 데이터가 있을 때만 수행

## 15. Migration 전략

`202607310005`와 이전 migration은 수정하지 않는다. 모든 변경은 `202607310006` 이상의 additive migration으로 분리한다.

1. **Expand 1**: planning 3테이블, constraint, immutable revision, 승인 wrapper, verification/rollback.
2. **Expand 2**: skill definition/mapping과 optional attempt skill snapshot. content 도구 계약을 먼저 고정한 뒤 deterministic metadata backfill을 별도 migration으로 생성한다.
3. **Expand 3**: review session/item/answer/event와 승인 wrapper.
4. **Backfill**: 기존 assignment는 plan 행 없이 정상 legacy로 유지한다. skill mapping만 결정적 출처가 있는 문항에 한해 수행하고 추측하지 않는다.
5. **API/RPC 전환**: 구 API를 제거하지 않고 additive endpoint를 배포한다. 신규 UI는 capability가 확인된 경우에만 사용한다.
6. **Contract**: 사용량과 회귀가 확인된 후에만 중복 read path나 feature flag 제거를 별도 승인한다.

각 migration은 원본 verification, data-present rollback guard, RLS/ACL/Realtime 제외 검사를 포함한다. Production 순서는 local isolated PostgreSQL → commit/push → linked history/dry-run → migration 1회 → verification 1회 → history → SQL role probe → API/UI 배포다.

## 16. 단계별 구현 순서

### Phase A — 단계명 중복 제거와 읽기 모델 정리

- 목표: 기존 단계 제목과 난이도 label 중복 제거, roadmap merge contract 고정
- 예상 파일: `js/learning.js`, `test/learning-ui.test.js`, roadmap read helper/test
- migration: 없음
- API: 기존 catalog additive 필드 또는 새 read-only roadmap endpoint
- 완료 기준: child 비노출과 기존 응시 UI 회귀 통과
- Production: 자동 배포 + public/read-only smoke
- rollback: commit revert 가능
- 별도 승인: 코드 수정·commit·배포 각각 기존 절차에 따라 필요

### Phase B — 단원 맵·계획·배정

- 목표: planning 3테이블, 계획 포함 원자적 배정, 부모 roadmap UI
- 예상 migration: 다음 신규 번호의 planning migration/verification/rollback
- API: roadmap, planned assignment, plan GET/PUT
- UI: 12단원 카드, 준비 중, 날짜, pause/resume
- 테스트: scope, 날짜, concurrency, ACL, rollback
- 완료 기준: 기존 배정 계약 불변, plan 없는 legacy assignment 정상
- Production: linked dry-run → migration → verification → role probe → API 배포
- rollback: 데이터 전 `DROP`; 데이터 있으면 `55000`
- 별도 승인: DB 적용과 실제 사용자 plan 생성

### Phase C — 점수·응시 이력·취약 개념

- 목표: official score read model, skill metadata 보존과 분석
- 예상 migration: skill definition/mapping, optional attempt skill snapshot
- 도구: CSV importer, content validator, migration generator 계약 확장
- API: scores, skills read-only
- UI: 최초/최근/최고와 confidence
- 테스트: version 격리, tie-break, 표본 부족, 기존 콘텐츠 byte identity
- 완료 기준: 기존 점수·채점 무변경, 미분류 안전 처리
- Production: metadata backfill 검증 후 API/UI 배포
- rollback: mapping 데이터 존재 시 보호; official answer 불변
- 별도 승인: 콘텐츠 metadata backfill

### Phase D — 부모용 오답·해설 조회

- 목표: 기존 official snapshot 기반 read-only 오답노트
- migration: 원칙적으로 없음; 필요한 index만 별도 승인
- API: parent/self mistakes list와 parent audit reveal-solution
- UI: 필터, 원래 선택, 정답·해설, 상태는 우선 미복습
- 테스트: 다른 가족, 미래 정답, version leakage
- 완료 기준: 부모 family scope와 child self scope, 정답 사전 비노출
- Production: read-only smoke
- rollback: API/UI revert
- 별도 승인: Phase D 코드 구현·배포

### Phase E — 오답만 다시 풀기와 해결 상태

- 목표: review 4테이블과 독립 복습 flow
- migration: session/item/answer/event, immutable trigger, wrapper, ACL
- API: review 생성/조회/답안/abandon과 parent reveal audit
- UI: review full-screen, resolved/retried/repeated 상태
- 테스트: official progress/reward zero-delta, concurrency, idempotency
- 완료 기준: review가 official finalize를 호출하지 않음
- Production: migration/verification/role probe 후 실제 mutation은 별도 승인
- rollback: data-present guard
- 별도 승인: 실제 부모 복습 session 생성

### Phase F — 통합 회귀·Production 검증

- 목표: 계획→공식 응시→분석→복습 전체 경계 확인
- migration: 없음이 원칙
- 테스트: 전체 suite/build/secret/diff, Production 최소 회귀
- 완료 기준: 하겸·다율 격리, 기존 일반 기능, reward 중복 방지
- Production: 승인된 테스트 시나리오만 실행
- rollback: 기능 flag 또는 이전 deployment, DB rollback은 emergency 승인만
- 별도 승인: 실제 가족 데이터 mutation

## 17. 예상 변경 파일 범위

| 영역 | 예상 경로 |
|---|---|
| 설계/문서 | `docs/`, `docs/learning-content-authoring.md` |
| curriculum/content tools | `content/learning/curriculum/`, `scripts/import-learning-content-csv.js`, validator/generator |
| migrations | `supabase/migrations/`, `verification/`, `rollbacks/`의 신규 번호만 |
| API router | `api/[...path].js` |
| API helpers | `server/api/learning/_utils.js`, 신규 roadmap/plan/score/review 모듈 |
| UI | `index.html`, `css/styles.css`, `js/learning.js`, 신규 분리 모듈 |
| tests | learning API/UI tests, 신규 static tests, PostgreSQL fixtures |

기존 migration을 수정하지 않고 additive migration만 사용한다. package, lockfile, vendor 변경은 예상하지 않는다.

## 18. 위험·중단 조건

다음이면 구현 또는 배포를 중단하고 범위를 재승인받는다.

- 기존 assignment status나 active unique 계약을 바꿔야 하는 경우
- official answer 또는 score를 수정해야 하는 경우
- review가 progress, first-pass, reward에 영향을 주는 경우
- skill mapping을 결정적으로 복원할 수 없는 콘텐츠가 발견된 경우
- 다른 family/child 정보가 404 대신 구분되어 노출되는 경우
- date/timezone 정책이 합의되지 않은 상태에서 실제 계획 데이터를 만들려는 경우
- migration이 기존 published 콘텐츠나 응시 snapshot을 변경하는 경우
- linked history drift, remote-only, 중복 migration
- role probe가 42501이 아니거나 direct mutation이 성공하는 경우
- 기존 테스트/build 회귀 또는 예상 밖 파일 변경

## 19. 확정 정책

다음 정책은 사용자 검토를 완료했으며 후속 구현의 기준 계약이다.

1. **일시중지**: pause 전 생성된 official attempt와 review session은 계속 진행·완료할 수 있다. pause 후 신규 official attempt와 review session 시작은 차단하고 resume 후 다시 허용한다. 기존 기록을 삭제하거나 abandon하지 않는다.
2. **Make Ten 위치**: 정규 12단원 밖, 번호 없는 `기초 준비` 영역에 표시한다. prerequisite, published v1/v2, 기존 업무 데이터는 유지한다.
3. **목표일 수정 잠금**: 단원 완료 전만 수정할 수 있고 매번 immutable revision을 남긴다. 완료 후 수정과 관리자 우회는 허용하지 않으며 actual date는 항상 불변 파생값이다.
4. **취약 개념**: 3개 관찰, 2개 독립 terminal attempt, 오답 2개, 정확도 60% 이하, 최근 official attempt 오답을 모두 충족할 때만 `보완 필요`다. review는 공식 취약도에 포함하지 않는다.
5. **skill 표시명**: 중앙 사전의 안정적인 code와 부모 UI용 한국어 표시명을 분리한다. 콘텐츠 작성자가 제안하고 사용자 콘텐츠 검토에서 승인한다.
6. **복습 권한·정답 공개**: 부모는 같은 family active child, 자녀는 self assignment만 시작·진행한다. 미제출 정답은 숨기고 제출 후 공개한다. 부모의 명시적 정답 보기는 immutable audit event를 남기며 해결 처리하지 않는다.
7. **version 점수 경계**: assignment의 content version별로 점수와 skill을 분리한다. `전체 버전 이력 보기`에서 version label과 함께 병렬 표시하며 자동 통합하지 않는다.

이 7개 정책과 관련해 Phase A 착수를 막는 신규 미결정사항은 발견되지 않았다. 이후 범위 확장이 필요하면 해당 Phase 승인 요청에서 별도 결정한다.

## 20. 권장안·승인 체크리스트와 다음 요청 범위

다음 요청은 Phase A로 제한하는 것이 가장 안전하다.

> 현재 HEAD와 clean worktree를 확인한 뒤, 기존 단계명 중복 표현을 제거하고 교육과정 12단원 roadmap read model의 서버-side merge contract를 구현한다. DB migration과 mutation API는 만들지 않는다. `math-core`, `make-ten`, 12단원 curriculum, published/preparing 상태를 read-only로 반환하며 child DTO에는 course·학년·추천 metadata를 노출하지 않는다. 관련 API/UI/static 테스트, 전체 테스트, build, secret scan, diff check까지만 수행하고 commit·push·deploy는 하지 않는다.

Phase A 결과를 검토한 뒤 Phase B의 planning migration을 별도로 승인한다. 계획 DB와 실제 사용자 계획 생성은 같은 승인으로 묶지 않는다.

### 승인 체크리스트

- [x] Make Ten을 12단원 밖 번호 없는 기초 준비 카드로 표시
- [x] pause 중 기존 in-progress attempt와 review 완료 허용, 신규 시작 차단
- [x] 완료 전 목표일 수정과 immutable revision, 완료 후 잠금
- [x] 취약 기본 임계값과 policy version 노출
- [x] skill code별 한국어 display name 검수 책임
- [x] 부모와 self child의 review 접근 범위 및 reveal audit
- [x] 구·신 content version 점수 기본 분리
- [ ] Phase A는 DB mutation 없이 read model/UI 중복 제거로 제한
- [ ] planning, skill, review migration을 각각 별도 승인
- [ ] Production 실제 가족 mutation은 schema/API 검증 뒤 별도 승인
