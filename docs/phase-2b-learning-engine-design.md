# Study Plus Phase 2B 학습 엔진 설계

상태: Phase 2B-0B 설계안

기준 커밋: `6256757baac3be6111f0c3493693b146dcdd79cc`

범위: 논리 설계만 포함하며 SQL, API, UI, 콘텐츠 데이터는 포함하지 않는다.

## 0. 설계 기준과 기존 사실

이 문서에서 **확정 정책**은 사용자 승인 계약, **기존 사실**은 현재 저장소에서 확인한 계약, **제안**은 구현 전에 채택할 설계안을 뜻한다.

확인한 기존 사실은 다음과 같다.

- `families.id`, `family_members.id`는 UUID이고 구성원은 `family_id`, `role`(`parent`/`child`), `is_active`로 검증한다.
- Family API 토큰의 `sub`, `family`, `role`은 서명되지만, 서버 API는 중요한 작업 전에 현재 `family_members` 상태를 다시 조회한다.
- 부모가 지정한 자녀는 같은 가족의 활성 `child`인지 서버가 확인하고, 자녀 요청은 `sub`로 고정한다.
- `sticker_transactions`는 양수/음수 원장이고 잔액은 가족·구성원별 `sum(amount)`이다. `(member_id, source_type, source_id)`가 유일하다.
- 기존 완료 RPC는 구성원과 대상 행을 잠근 뒤 완료·보상·잔액을 한 transaction에서 처리한다.
- Phase 2A의 서버용 wrapper는 `postgres` 소유, `SECURITY DEFINER`, `search_path = pg_catalog, public`, `service_role` 전용 실행 권한을 사용한다.
- Phase 2A Contract는 RLS를 켜고 PUBLIC/anon/authenticated의 직접 테이블 권한과 legacy browser policy를 제거했다.
- 한글 앱은 응시 ID, 문제 순서, 완료 문제, 결과를 저장하여 중단·재개와 정상 재시도를 지원하지만, 일부 진행 상태는 브라우저 저장소 기반이다. Phase 2B는 이를 서버의 권위 있는 상태로 옮긴다.
- 신규 UUID는 JSON에서 문자열로 안전하게 전달된다. 기존 bigint 계획 ID의 문자열 계약은 Phase 2B 신규 UUID 모델과 분리한다.
- API 오류는 인증 실패 `401`, 유효한 역할/상태가 아닌 경우 `403`, 범위가 지정된 대상 미발견 `404`, 상태 경합·중복·stale 작업 `409`를 주로 사용한다.
- 테스트는 Node 내장 test runner를 사용하고, SQL 정적 계약 및 격리 PostgreSQL fixture 검증 패턴이 있다.

주요 근거 파일:

- 인증·membership: `server/api/family/_utils.js`, `server/api/rewards/_utils.js`
- 가족·구성원 구조: `supabase/family_chat.sql`, `supabase/migrations/202607270001_multi_family_data_foundation.sql`
- 부모·자녀 scope: `server/api/study/plans.js`, `server/api/study/book-plans.js`, `server/api/study/academy-schedules.js`
- 완료·원장: `server/api/rewards/study-complete.js`, `supabase/reward_exchange_history.sql`, `supabase/migrations/202607130005_create_study_completion_reward_rpc.sql`
- 한글 응시·멱등 보상: `apps/dayul-hangul/src/learning/dailyLearning.js`, `apps/dayul-hangul/src/integration/completionBridge.js`, `supabase/migrations/202607190001_create_hangul_daily_completion_reward.sql`
- wrapper/Contract 보안: `supabase/migrations/202607280001_expand_study_plans_server_wrappers.sql`, `supabase/migrations/202607280004_contract_study_data_api_only_access.sql`
- 테스트 실행·fixture: `package.json`, `test/*.test.js`, `test/fixtures/phase2a_book_assignee_fixture.sql`, `test/fixtures/phase2a_academy_assertions.sql`

저장소에는 Phase 2B 전용 Docker 구성은 아직 없다. 기존 격리 PostgreSQL 검증은 SQL fixture와 일회성 로컬 컨테이너 실행 절차를 결합한 운영 패턴이므로, 2B 구현에서는 기존 로컬 개발 DB를 재사용하지 않는 고유 container/network/volume harness를 테스트 범위에 명시해야 한다.

## A. 목표와 비목표

### Phase 2B 전체 목표

시스템이 게시한 단일 정답 객관식 콘텐츠를 부모가 같은 가족의 활성 자녀에게 배정하고, 자녀가 단계별로 풀며, 서버가 답안을 채점하고, 단계 최초 통과에만 난이도별 스티커를 원자적으로 지급하는 별도 학습 엔진을 만든다. 기존 `study_plans`와는 데이터·완료 경로를 연결하지 않는다.

### 2B-1A: DB 기반

- 불변 콘텐츠 버전, 과정/단원/단계/문제/선택지 모델
- 배정·단계 진행 모델과 logical unit 기준 active 배정 유일성
- 콘텐츠 게시 검증과 불변성
- 신규 테이블의 default-deny 보안 경계
- service-role 전용 최소 DB 함수, verification, pre-data rollback
- 정적 SQL 및 격리 PostgreSQL 검증용 최소 fixture
- 실제 Production 콘텐츠, API, UI, 응시, 채점, 보상은 포함하지 않음

### 2B-1B: 배정 API와 최소 UI

- 부모의 게시 콘텐츠 catalog 조회와 같은 가족 활성 자녀 배정
- 부모의 자녀별 배정·진행 조회와 필요 시 배정 취소
- 자녀의 자기 배정·단계 잠금 상태 조회
- 부모 최소 배정 UI와 자녀 단원 목록 UI
- family/member/assigned child scope와 자녀 전환 회귀 검증
- 응시·문제 풀이·답안·채점·보상은 포함하지 않음

### 2B-2: 응시와 채점

- 활성 응시 1개, 중단·재개, 부모 초기화
- 응시 시작 시 문제·선택지·정답·해설 스냅샷
- 답안 불변 INSERT, 즉시 정답 여부·정답 표시 문구·해설 반환
- 모든 문항 동일 가중치와 `ceil(total × 0.8)` 서버 채점
- 실패와 새 응시 재도전
- 멱등성, 두 탭 경쟁, stale 응시 차단
- 2B-3 배포 전에는 자녀의 Production 풀이 진입을 기능 노출하지 않는다.

### 2B-3: 최종 판정·보상·해금

- 서버 저장 답안으로 80% 통과 판정
- 단계 최초 통과의 1/2/3/5 보상
- 최초 통과, 원장 거래, 다음 단계 해금, 단원 완료의 단일 transaction
- 재통과·중복 요청·동시 요청의 중복 보상 방지
- 최종 자녀 UI와 부모 진행률 UI 공개

### 초기 버전 비목표

- 부모 문제 작성 UI
- 복수 정답, 주관식, 서술형, 음성형 문제
- 적응형·무작위 문제 추출
- 문제별 가중치와 문제·선택지 순서 랜덤화
- 기존 일반 계획·교재·독서·Academy 또는 `study_plans`와의 연결
- Push, Realtime, 완료 알림 재설계
- CMS 및 외부 콘텐츠 편집기
- 게시된 버전의 제자리 수정

### 이후 안정화 과제

- 콘텐츠 검수 승인 흐름과 CMS
- 문제/선택지 순서의 결정적 랜덤화
- 대규모 콘텐츠 import 성능과 검수 리포트
- outbox 기반 알림, Push 및 안전한 Realtime
- 학습 분석, 오답 노트, 과정 추천
- 장기간 `in_progress` 응시의 운영 관리 정책

초기 과정·단원·단계·문항의 실제 학습 콘텐츠는 엔진 기반 구현에 포함하지 않는다. 2B-1A와 2B-1B에서는 로컬·격리 검증용 최소 fixture만 사용하고, fixture를 Production migration과 분리한다. 실제 콘텐츠는 schema, API, 응시, 채점, 보상 계약을 검증한 뒤 별도 콘텐츠 작성·검증·배포 단계에서 투입한다.

## B. 용어 정의

| 용어 | DB 내부 의미 | 사용자 표시 |
|---|---|---|
| 과정/과목(course) | 시스템 콘텐츠를 묶는 내부 분류. 내부 코드와 관리명을 가진다. | 부모에게만 과정·과목명 표시 가능 |
| 단원(unit) | 자녀에게 배정하는 안정적인 논리 단위 | 자녀 화면의 최상위 표시명 |
| 콘텐츠 버전(content version) | 한 단원의 게시 가능한 불변 릴리스 | 부모에게 버전 표시 가능, 자녀에게 숨김 |
| 단계(stage) | 버전 안에서 순서와 난이도를 가진 통과 단위 | 자녀에게 단계명/난이도 아이콘 표시 |
| 난이도(difficulty) | `seed`, `leaf`, `tree`, `crown`; 최초 통과 보상 1, 2, 3, 5 | 🌱, 🌿, 🌳, 👑 |
| 문제(question) | 단계 안의 단일 정답 객관식 문항 | 문항 |
| 선택지(option) | 문제에 속한 하나의 선택. 게시 시 정확히 하나만 정답 | 선택지 |
| 배정(assignment) | 특정 콘텐츠 버전을 특정 가족의 특정 자녀에게 부여한 기록 | 내 단원 |
| 해금(unlock) | 해당 배정의 단계를 시작할 수 있게 된 상태 | 풀 수 있음 |
| 응시(attempt) | 한 배정·단계에 대한 한 번의 풀이 시도 | 도전/이어하기 |
| 답안(answer) | 응시 스냅샷 문제에 대해 한 번 제출한 선택 | 제출한 답 |
| 통과(pass) | `correct_count >= ceil(total_count × 0.8)`인 최종 응시 | 통과 |
| 최초 통과(first pass) | 배정·단계에서 처음 발생한 통과. 보상·해금의 유일한 원인 | 첫 통과 |
| 부모 초기화(reset) | 진행 중 응시를 삭제하지 않고 `abandoned`로 종료 | 응시 초기화 |
| 보상 원장 거래 | `sticker_transactions`의 `earn` 행 | 스티커 획득 내역 |

답안의 “미제출”은 행이 없는 상태이며 별도 상태 문자열을 저장하지 않는다. “제출 완료”는 불변 답안 행이 존재하는 상태다.

## C. 상태 전이

### 콘텐츠 버전

`draft → published → retired`

- `draft`: 시스템 import 주체만 생성·수정·삭제할 수 있다. 배정 불가.
- `published`: 게시 RPC가 전체 구조를 검증한 뒤 진입한다. 콘텐츠 본문과 자식 행은 이후 수정·삭제 불가.
- `retired`: 전용 retire RPC만 `published`에서 전환한다. 신규 배정만 금지하며 기존 배정·응시는 계속 작동한다.
- 역전이는 없다. 수정은 새 버전 생성이다.

### 배정

`active → completed` 또는 `active → cancelled`

- `active`: 부모의 배정 RPC가 생성한다. 첫 단계 진행을 `unlocked`로 함께 만든다.
- `completed`: 마지막 단계 최초 통과 transaction이 전환한다.
- `cancelled`: 부모 취소 transaction이 전환한다. 진행 중 응시가 있다면 같은 transaction에서 `abandoned`로 만든다.
- `completed`, `cancelled`는 terminal이며 삭제하지 않는다. 초기 버전에는 재활성화가 없다.

### 단계 진행

`locked → unlocked → passed`

- 첫 단계는 배정 생성 시 `unlocked`.
- 이후 단계는 바로 이전 단계 최초 통과 transaction만 `unlocked`.
- `passed`는 최초 통과 transaction만 설정하며 되돌리지 않는다.
- 잠김/해금/통과 기록은 삭제하지 않는다.

### 응시

`in_progress → passed | failed | abandoned`

- `in_progress`: 해금된 단계에서 활성 응시가 없을 때 생성한다. 기존 활성 응시가 있으면 새로 만들지 않고 반환한다.
- `passed`/`failed`: 모든 답안이 제출된 뒤 서버 최종화 transaction이 설정한다.
- `abandoned`: 부모 초기화 또는 active 배정 취소가 설정한다.
- terminal 응시는 수정·재개·삭제하지 않는다. 실패 후 재도전은 새 응시다.
- 자동 만료는 없다.

### 답안

`미제출 → 제출 완료`

- 제출 RPC만 행을 INSERT한다.
- 제출 완료 답안의 선택, 채점 결과, 시각은 UPDATE/DELETE할 수 없다.

### 불가능하거나 잘못된 조합

- `draft`/`retired` 버전으로 신규 active 배정
- 같은 가족·자녀·logical unit에 구/신 version active 배정이 동시에 존재
- `completed`/`cancelled` 배정의 `in_progress` 응시
- `locked` 진행의 응시
- 한 배정·단계에 둘 이상의 `in_progress`
- `passed`/`failed` 응시인데 미제출 문제가 존재
- `failed`/`abandoned` 응시에 최초 통과 또는 보상 거래 존재
- 단계 진행이 `passed`인데 최초 통과가 없음
- 최초 통과가 있는데 진행이 `passed`가 아니거나 다음 단계가 잠김
- 첫 통과 원장 금액과 단계 난이도 금액 불일치
- 배정 버전과 다른 버전의 단계/문제 스냅샷
- 응시 자녀와 배정 자녀 또는 가족 불일치

## D. DB 논리 모델

모든 신규 PK는 UUID를 권장한다. 콘텐츠 정의 테이블은 시스템 전역이고, 사용자 상태 테이블은 `family_id`와 `assigned_member_id`를 중복 저장하여 모든 조회·잠금·mutation에서 명시적으로 범위를 강제한다. `family_members(family_id, id)`의 기존 복합 유일 계약을 FK에 재사용한다.

### 1. `learning_courses`

- 목적: 내부 과정·과목 분류.
- PK: `id uuid`.
- 주요 컬럼: `course_code text`, `internal_name text`, `subject_name text`, `status text`, `created_at timestamptz`.
- 제약: 모두 NOT NULL, `course_code` UNIQUE, status CHECK `draft/published/retired`.
- 인덱스: `(status, course_code)`.
- 삭제/버전: 참조된 과정은 삭제 금지. 이름 수정은 draft에서만 허용; 게시 후 변경은 운영 메타데이터 정책으로 제한.
- 격리/주체: 가족 컬럼 없음. 시스템 import 주체만 관리.

### 2. `learning_units`

- 목적: 버전 간 유지되는 논리 단원.
- PK: `id uuid`.
- 주요 컬럼: `course_id uuid`, `unit_code text`, `display_title text`, `sort_order integer`, `created_at`.
- FK: `course_id → learning_courses(id)` RESTRICT.
- 제약: NOT NULL, `sort_order > 0`, UNIQUE `(course_id, unit_code)`, UNIQUE `(course_id, sort_order)`.
- 인덱스: `(course_id, sort_order)`.
- 삭제/버전: 콘텐츠 버전이 있으면 삭제 금지. 자녀에게는 `display_title`만 노출.
- 주체: 시스템 import.

### 3. `learning_content_versions`

- 목적: 단원의 게시 불변 릴리스.
- PK: `id uuid`.
- 주요 컬럼: `unit_id uuid`, `version_no integer`, `status text`, `content_hash text`, `published_at`, `retired_at`, `created_at`.
- FK: `unit_id → learning_units(id)` RESTRICT.
- 제약: NOT NULL(`unit_id`, `version_no`, `status`, `content_hash`, `created_at`), `version_no > 0`, status CHECK, UNIQUE `(unit_id, version_no)`, UNIQUE `(unit_id, content_hash)`, assignment의 version/unit 일치를 위한 보조 UNIQUE `(id, unit_id)`.
- 인덱스: `(unit_id, status, version_no desc)`.
- 삭제/버전: draft만 삭제 가능. published 이후 본문 변경 금지; retire만 허용.
- 주체: 시스템 import/publish RPC.

### 4. `learning_stages`

- 목적: 버전 내 순차 통과 단위.
- PK: `id uuid`.
- 주요 컬럼: `content_version_id uuid`, `display_order integer`, `display_title text`, `difficulty text`, `created_at`.
- FK: version RESTRICT.
- 제약: NOT NULL, `display_order > 0`, difficulty CHECK `seed/leaf/tree/crown`, UNIQUE `(content_version_id, display_order)`, 보조 UNIQUE `(id, content_version_id)`.
- 인덱스: `(content_version_id, display_order)`.
- 삭제/버전: draft 버전에서만 가능. published 이후 불변.
- 주체: 시스템 import.

### 5. `learning_questions`

- 목적: 단일 정답 객관식 문제.
- PK: `id uuid`.
- 주요 컬럼: `stage_id uuid`, `display_order integer`, `prompt text`, `explanation text`, `created_at`.
- FK: `stage_id → learning_stages(id)` RESTRICT.
- 제약: NOT NULL, `display_order > 0`, 비어 있지 않은 prompt/explanation, UNIQUE `(stage_id, display_order)`.
- 인덱스: `(stage_id, display_order)`.
- 삭제/버전: draft에서만 가능; published 이후 불변.
- 주체: 시스템 import.

### 6. `learning_question_options`

- 목적: 문제 선택지와 정답 표시.
- PK: `id uuid`.
- 주요 컬럼: `question_id uuid`, `display_order integer`, `option_text text`, `is_correct boolean`, `created_at`.
- FK: question RESTRICT.
- 제약: NOT NULL, `display_order > 0`, 비어 있지 않은 text, UNIQUE `(question_id, display_order)`, partial UNIQUE `(question_id) WHERE is_correct`.
- 인덱스: `(question_id, display_order)`.
- 삭제/버전: draft에서만 가능; published 이후 불변.
- 주체: 시스템 import.
- 주의: partial UNIQUE는 정답 “최대 1개”만 보장하므로 “정확히 1개”는 게시 RPC가 검증한다.

### 7. `learning_assignments`

- 목적: 게시 버전의 자녀별 배정.
- PK: `id uuid`.
- 주요 컬럼: `family_id uuid`, `assigned_member_id uuid`, `created_by_member_id uuid`, `unit_id uuid`, `content_version_id uuid`, `status text`, `assigned_at`, `completed_at`, `cancelled_at`, `created_at`, `updated_at`.
- FK: family, `(family_id, assigned_member_id) → family_members(family_id,id)`, creator도 같은 복합 FK, `unit_id → learning_units(id)` RESTRICT, `(content_version_id, unit_id) → learning_content_versions(id, unit_id)` RESTRICT.
- 제약: 주요 소유권/버전/status/timestamps NOT NULL, status CHECK, 상태별 완료·취소 시각 CHECK.
- UNIQUE: 보조 `(id, family_id, assigned_member_id, content_version_id)`와 `(id, family_id, assigned_member_id, unit_id, content_version_id)`.
- partial UNIQUE: `(family_id, assigned_member_id, unit_id) WHERE status='active'`.
- 인덱스: `(family_id, assigned_member_id, status, assigned_at desc)`, `(content_version_id)`, `(family_id, assigned_member_id, unit_id)`.
- 삭제/버전: 삭제 금지. 배정은 생성 당시 version에 영구 고정.
- 주체: 같은 가족 활성 parent만 생성·취소; 완료는 최종화 RPC.

### 8. `learning_stage_progress`

- 목적: 배정별 단계 잠금·통과 상태.
- PK: `id uuid`.
- 주요 컬럼: `family_id`, `assigned_member_id`, `assignment_id`, `content_version_id`, `stage_id`, `status`, `unlocked_at`, `passed_at`, `first_pass_attempt_id nullable`, `created_at`, `updated_at`.
- FK: family/member, assignment의 복합 소유권, stage/version 복합 일치. first pass attempt FK는 2B-2 이후 추가 가능하다.
- 제약: NOT NULL, status CHECK, 상태와 시각의 일관성 CHECK.
- UNIQUE: `(assignment_id, stage_id)`, 보조 `(id, assignment_id, stage_id)`.
- 인덱스: `(family_id, assigned_member_id, assignment_id, status)`.
- 삭제/버전: 삭제·역전 금지.
- 주체: 배정 RPC가 전체 stage progress를 만들고 첫 단계만 해금; 최종화 RPC가 변경.

### 9. `learning_attempts`

- 목적: 단계별 개별 풀이 시도.
- PK: `id uuid`.
- 주요 컬럼: `family_id`, `assigned_member_id`, `assignment_id`, `content_version_id`, `stage_id`, `attempt_no integer`, `status text`, `start_request_id uuid`, `total_count integer`, `correct_count nullable`, `required_correct_count integer`, `started_at`, `finalized_at`, `abandoned_at`, `abandoned_by_member_id nullable`, `created_at`.
- FK: 가족/자녀, assignment/version/stage 복합 소유권, abandon actor family member.
- 제약: NOT NULL, `attempt_no > 0`, counts 양수 및 범위, status CHECK, terminal 상태별 결과/시각 CHECK.
- UNIQUE: `(assignment_id, stage_id, attempt_no)`, `(assigned_member_id, start_request_id)`.
- partial UNIQUE: `(assignment_id, stage_id) WHERE status='in_progress'`.
- 인덱스: `(family_id, assigned_member_id, status, started_at desc)`, `(assignment_id, stage_id, attempt_no desc)`.
- 삭제/버전: 삭제 금지. 모든 terminal 결과 보존.
- 주체: 자녀 start/finalize RPC, 부모 reset RPC.

### 10. `learning_attempt_questions`

- 목적: 응시 시작 시 고정한 문제와 선택지 순서·정답·해설의 권위 있는 스냅샷.
- PK: `id uuid`.
- 주요 컬럼: `attempt_id uuid`, `source_question_id uuid`, `display_order integer`, `prompt_snapshot text`, `explanation_snapshot text`, `options_snapshot jsonb`, `correct_option_id uuid`, `created_at`.
- FK: attempt CASCADE는 논리적으로 사용하지 않으며 물리 삭제도 금지; source question RESTRICT.
- 제약: NOT NULL, order 양수, `jsonb_typeof(options_snapshot)='array'`, UNIQUE `(attempt_id, display_order)`, UNIQUE `(attempt_id, source_question_id)`, 보조 UNIQUE `(id, attempt_id)`.
- 인덱스: `(attempt_id, display_order)`.
- 삭제/버전: 불변·삭제 금지. `options_snapshot`은 `{id, displayOrder, text}`만 저장하고 정답 ID는 별도 비공개 컬럼에 둔다.
- 격리: family/member는 attempt 조인으로 도출하되 모든 RPC는 attempt 소유권을 먼저 잠근다.
- 주체: start RPC만 생성.

### 11. `learning_attempt_answers`

- 목적: 한 응시 문제의 불변 제출·채점 결과.
- PK: `id uuid`.
- 주요 컬럼: `attempt_id uuid`, `attempt_question_id uuid`, `selected_option_id uuid`, `is_correct boolean`, `client_request_id uuid`, `submitted_at`.
- FK: attempt, `(attempt_question_id, attempt_id)` 복합 FK.
- 제약: 전부 NOT NULL.
- UNIQUE: `(attempt_id, attempt_question_id)`, `(attempt_id, client_request_id)`.
- 인덱스: `(attempt_id, submitted_at)`.
- 삭제/버전: UPDATE/DELETE 금지 trigger와 권한으로 불변.
- 주체: 자녀 answer RPC만 INSERT.

### 12. `learning_stage_first_passes`

- 목적: 단계 최초 통과와 원장 거래의 1:1 감사 기록.
- PK: `id uuid`.
- 주요 컬럼: `family_id`, `assigned_member_id`, `assignment_id`, `stage_id`, `attempt_id`, `difficulty text`, `reward_amount integer`, `reward_transaction_id uuid`, `passed_at`.
- FK: 가족/자녀, assignment/stage/attempt 소유권, `reward_transaction_id → sticker_transactions(id)` RESTRICT.
- 제약: 전부 NOT NULL, difficulty CHECK, `(difficulty,reward_amount)` 조합 CHECK로 `seed=1`, `leaf=2`, `tree=3`, `crown=5`.
- UNIQUE: `(assignment_id, stage_id)`, `attempt_id`, `reward_transaction_id`.
- 인덱스: `(family_id, assigned_member_id, passed_at desc)`.
- 삭제/버전: 불변·삭제 금지.
- 주체: 최종화 RPC만 생성.
- 원장 연결: `transaction_type='earn'`, `source_type='learning_stage_first_pass'`, `source_id=first_pass.id::text`; 기존 원장 UNIQUE가 두 번째 방어선이다.

first-pass UNIQUE는 `(assignment_id, stage_id)`이므로 같은 assignment·stage의 재통과 보상은 불가능하다. 새 content version은 구 assignment가 terminal이 된 뒤 새 assignment를 생성하므로 새 version stage의 first pass와 보상은 독립적이다. 원장 `source_id`도 새 first-pass UUID를 사용하여 구 version 보상과 충돌하지 않는다.

### 정규화와 스냅샷의 균형

콘텐츠는 검수·버전 관리를 위해 정규화한다. 응시는 재현성과 과거 감사 때문에 문제마다 하나의 스냅샷 행을 두되, 선택지는 별도 snapshot table 대신 작은 JSONB 배열로 보존한다. 답안과 최초 통과는 유일성·동시성 제약이 중요하므로 별도 테이블을 유지한다. 이 구성은 선택지 snapshot table을 추가하는 것보다 단순하면서도 과거 채점 재현에 필요한 경계를 보존한다.

## E. 핵심 불변조건

### DB constraint·index·불변 trigger로 보장

- 상태 값, 양수 순서, 난이도/보상 매핑, terminal 시각·결과 형식
- 단계 내 문제 순서, 문제 내 선택지 순서 중복 금지
- 문제당 정답 선택지 최대 1개
- 같은 가족·자녀·logical unit의 active 배정 최대 1개. version UUID가 달라도 동시에 active일 수 없음
- 배정·단계별 `in_progress` 최대 1개
- 응시·문제별 답안 최대 1개와 요청 멱등성 키 유일
- 단계 최초 통과, attempt, 원장 거래 1:1 유일
- 콘텐츠/배정/응시의 version 및 가족·자녀 복합 FK 일치
- 제출 답안과 게시 콘텐츠·응시 snapshot의 UPDATE/DELETE 금지
- 신규 모든 테이블 RLS 활성 및 browser 직접 권한 없음

### RPC transaction으로 보장

- 게시 버전에 단계가 있고 각 단계에 문제 1개 이상, 각 문제에 정답 정확히 1개 및 선택지 2개 이상
- 게시 hash와 전체 구조 검증, published 자식의 불변성
- 배정 대상이 같은 가족의 활성 child이고 version이 published인지 검증
- 첫 단계만 최초 해금하고 이전 단계 통과 없이 다음 단계 해금 금지
- 잠긴 단계·inactive/cancelled/completed 배정의 응시 시작 금지
- 스냅샷 선택지와 제출 선택지의 포함 관계
- 모든 문제 답변 완료와 `ceil(total×0.8)` 계산
- 응시 결과, 최초 통과, 진행 상태, 원장 거래, 다음 해금, 배정 완료의 일치
- 실패/abandoned에 거래·해금이 없음을 보장
- 다른 가족·자녀 범위를 모든 잠금과 mutation WHERE에 반복 적용

정적 verification은 양쪽 계약과 orphan/불일치가 0인지 검사한다.

## F. 콘텐츠 버전과 응시 재현성

1. draft import 후 publish RPC가 구조, 순서, 정답 수, hash를 검증한다.
2. published/retired 버전과 그 단계·문제·선택지는 불변 trigger로 UPDATE/DELETE를 막는다. `published → retired` 상태 변경만 전용 RPC가 허용한다.
3. 수정은 같은 `learning_units.id` 아래 `version_no + 1` draft를 만들고 다시 게시한다.
4. 기존 배정은 원래 `content_version_id`를 계속 바라본다. 자동 upgrade·재채점은 없다.
5. retired 버전은 신규 배정에서 숨기지만 기존 배정·진행·응시는 계속 가능하다.
6. 같은 자녀·logical unit에 active 배정이 있으면 version UUID가 달라도 새 배정을 거부한다. 기존 배정이 `completed` 또는 `cancelled`가 된 뒤에만 새 version을 새 assignment로 배정한다.
7. 완료된 구 version과 새 active version은 서로 다른 assignment로 진행률에 함께 표시하되, 구 assignment에는 원래 version과 terminal 상태를 표시한다.
8. 응시 시작 RPC는 version의 모든 문제를 게시된 `display_order` 순서로 복사하고, 문제 문구, 해설, 선택지 ID/문구/순서, 정답 ID를 snapshot에 저장한다.
9. 초기 버전은 문제·선택지 순서를 랜덤화하지 않고 모든 문항을 동일 가중치로 채점한다. 랜덤화와 가중치는 향후 비목표다.
10. 제출 채점은 source content가 아니라 attempt snapshot의 `correct_option_id`를 사용한다.
11. 결과 조회도 snapshot과 저장 답안을 사용하므로 새 version의 정답이 과거 결과를 바꾸지 않는다.

부모에게 콘텐츠 version 생성 권한은 없다. 새 version은 시스템 콘텐츠 단계에서만 만들어지므로 부모가 version을 반복 생성해 보상을 늘릴 수 없다. 새 version은 새 assignment이므로 그 단계의 최초 통과와 보상도 새 assignment 범위에서 독립적이다. 구 assignment의 first pass·원장·응시 이력은 원래 version을 계속 참조하며 충돌하지 않는다.

## G. 콘텐츠 투입 방식

| 방식 | 재현/리뷰 | rollback | 운영/보안 | 정답 오류 위험 | 초기 적합성 |
|---|---|---|---|---|---|
| migration에 직접 포함 | 변경 이력은 강함, 대량 콘텐츠 diff는 읽기 어려움 | migration 이력과 결합되어 수정 부담 큼 | 별도 관리 UI 없음 | 긴 SQL에서 검수 누락 가능 | 소량 시 가능 |
| versioned JSON + 검증/import | 사람이 읽고 리뷰 가능, deterministic hash 가능 | 새 version/retire로 복구 | 도구 권한을 CI/운영자로 제한 가능 | schema·정답 수 validator로 낮춤 | **권장** |
| 관리자 서버 import | 운영 편리 | audit/버전 기능을 별도 구현 | 관리자 인증과 업로드 공격면 증가 | 런타임 실수 가능 | 초기에는 과함 |
| 별도 CMS | 가장 편리할 수 있음 | workflow에 따라 우수 | 새 시스템·권한·비용 필요 | 승인 workflow로 낮출 수 있음 | 초기에는 과함 |

권장안은 **저장소의 versioned JSON을 검증한 뒤 deterministic content-only migration을 생성하는 도구**다. JSON schema, UUID/코드 안정성, 순서 중복, 단계당 문제 수, 문제당 정답 1개, content hash를 CI에서 검증하고 생성물도 리뷰한다. Production에는 일반 관리자 API로 즉석 import하지 않고 migration history를 통해 적용한다. rollback은 게시 행 삭제보다 잘못된 version을 retire하고 수정 version을 추가하는 방식이다.

다만 이 방식의 실제 JSON, validator, import 도구와 Production 콘텐츠는 2B-1A/1B에 포함하지 않는다. 2B-1A의 최소 fixture는 테스트 전용 경로와 일회성 격리 DB에만 존재해야 하며 Production migration에 포함되면 실패다. 실제 콘텐츠는 DB·API·응시·보상 계약 검증 후 별도 콘텐츠 단계에서 작성·검수·배포한다.

## H. API 계약

모든 ID는 UUID 문자열이다. 모든 mutation은 UUID `Idempotency-Key` 헤더를 요구한다. `family_id`는 request/query/body에 받지 않고 서명된 session에서 얻은 뒤 현재 membership으로 다시 검증한다.

공통 오류:

- `401 AUTH_REQUIRED/AUTH_EXPIRED`: 토큰 없음·위조·만료
- `403 ACTIVE_MEMBER_REQUIRED/PARENT_PERMISSION_REQUIRED/CHILD_PERMISSION_REQUIRED`: 현재 membership/role 불가
- `404 ..._NOT_FOUND`: family/member scope를 적용한 뒤 대상 없음. 타 가족 존재 여부를 숨김
- `409 ..._CONFLICT/..._STALE`: terminal 상태, 다른 내용의 멱등성 충돌, 동시 상태 변경
- `400 INVALID_*`: 형식/필수값 오류

### 부모 API

| Method / path | request | response·범위 | 멱등성/주요 오류 |
|---|---|---|---|
| `GET /api/learning/catalog` | optional course/unit filters | published 비retired course 내부명, subject, unit, version, stage 난이도/문항 수. 정답 제외 | 활성 parent; 읽기 재시도 안전 |
| `POST /api/learning/assignments` | `assignedMemberId`, `contentVersionId` | 서버가 version에서 logical unit을 도출한 assignment, 첫 단계 unlocked, 요약 | 활성 parent와 같은 가족 활성 child; parent의 version 생성 권한 없음; 같은 unit의 어떤 version이든 active이면 `409 ASSIGNMENT_EXISTS`; key 재전송은 동일 결과 |
| `GET /api/learning/assignments?assignedMemberId=` | UUID | 해당 자녀 배정, stage 진행률, active attempt 유무 | 같은 가족 활성 child 강제; 정답·snapshot 제외 |
| `POST /api/learning/attempts/:attemptId/abandon` | `assignedMemberId`, optional audit reason | abandoned attempt | parent만; active attempt 아니면 `409 ATTEMPT_NOT_RESETTABLE`; 동일 key는 기존 결과 |
| `POST /api/learning/assignments/:assignmentId/cancel` | `assignedMemberId` | cancelled assignment 및 함께 abandoned된 attempt ID | parent만; completed/cancelled `409`; scoped 404 |

### 자녀 API

| Method / path | request | response·노출 | 멱등성/주요 오류 |
|---|---|---|---|
| `GET /api/learning/assignments` | 없음 | 자기 배정과 단원명, stage title/difficulty/status/progress. 과정·내부명·정답 제외 | session `sub`로 강제 |
| `GET /api/learning/assignments/:id/stages` | 없음 | 자기 배정의 stage 상태와 active attempt ID | 타 자녀/가족은 동일 404 |
| `POST /api/learning/assignments/:assignmentId/stages/:stageId/attempts` | body 없음 | 기존 active attempt 또는 새 attempt, next question 요약 | partial UNIQUE + key; locked `409 STAGE_LOCKED`, inactive assignment `409` |
| `GET /api/learning/attempts/:attemptId/next` | 없음 | 다음 미제출 snapshot question과 선택지; 없으면 `allAnswered=true` | 정답 ID/내부 과정명 제외 |
| `POST /api/learning/attempts/:attemptId/answers` | `attemptQuestionId`, `selectedOptionId` | 저장 답안 ID, `isCorrect`, `correctOptionText`, explanation, submittedAt, allAnswered, 필요 시 final result | 같은 key 동일 결과; 이미 다른 선택 제출 `409 ANSWER_ALREADY_SUBMITTED` |
| `POST /api/learning/attempts/:attemptId/finalize` | body 없음 | status, counts, required count, firstPass, stickerAwarded, nextStageUnlocked, assignmentCompleted | 모든 답 미제출 `409 ATTEMPT_INCOMPLETE`; 재전송은 기존 결과 |
| `GET /api/learning/attempts/:attemptId/result` | 없음 | terminal 결과와 각 snapshot 문항의 제출 선택·정답 여부·해설 | in_progress이면 `409 ATTEMPT_NOT_FINALIZED` |

답안 제출의 마지막 요청은 내부적으로 finalize RPC까지 이어질 수 있다. 네트워크 분리를 견디기 위해 명시적 finalize endpoint도 유지하며, 이미 terminal이면 저장 결과를 반환한다. 답안 제출 직후에는 정답 여부, snapshot에 저장된 정답 선택지의 사용자 표시 문구, 해설을 반환한다. 내부 `correct_option_id`, `is_correct` 판정 컬럼, 콘텐츠 관리 ID, 불필요한 과정·학년 정보, 다른 문제나 미제출 문제의 정답은 반환하지 않는다.

## I. 답안 제출과 즉시 피드백

1. API가 child token을 검증하고 현재 `family_members`가 같은 family의 활성 child인지 확인한다.
2. client는 attempt ID, attempt question ID, selected option ID, idempotency key만 보낸다.
3. answer RPC는 family ID를 입력받지 않는다. actor member ID와 attempt에서 family/assignment scope를 도출한다.
4. assignment → attempt 순으로 잠그고 `in_progress`, active assignment, unlocked progress를 확인한다.
5. attempt question을 잠그고 선택지 ID가 snapshot 배열에 포함되는지 확인한다.
6. `(attempt_id, client_request_id)`가 있으면 payload가 같을 때 기존 결과를 반환하고, 다르면 `409 IDEMPOTENCY_KEY_REUSED`다.
7. 답안이 없으면 `is_correct = selected_option_id = correct_option_id`로 INSERT한다. 이미 같은 선택이면 저장 결과를 반환하고 다른 선택이면 `409 ANSWER_ALREADY_SUBMITTED`다.
8. 응답에 해당 문항의 정답 여부, 정답 선택지의 snapshot 표시 문구와 snapshot 해설을 포함한다. 내부 option UUID는 반환하지 않는다. 제출 전에는 해설과 어떤 형태의 정답도 보내지 않는다.
9. 답안 수가 total과 같으면 같은 서버 작업에서 finalize RPC를 호출한다. 실패/timeout이어도 답안은 저장되어 명시적 finalize 재시도가 가능하다.
10. client 계산 점수·정답 여부·문제 ID/source ID는 최종 판정에 사용하지 않는다.

## J. 원자적 최종 처리 RPC

권장 함수 개념명은 `finalize_learning_stage_attempt(p_actor_member_id uuid, p_attempt_id uuid, p_request_id uuid)`다. `family_id`, 점수, 정답 수, 통과 여부, 난이도, 보상량을 입력받지 않는다.

잠금 순서는 모든 관련 RPC에서 다음으로 고정한다.

1. attempt에서 assignment ID를 읽되 변경하지 않음
2. `family_members` actor
3. `learning_assignments`
4. `learning_stage_progress`
5. `learning_attempts`
6. answer/snapshot 집계 대상
7. 다음 stage progress
8. 필요 시 원장 대상 member

한 transaction의 처리:

1. actor가 attempt와 같은 family/assigned member인 활성 child인지 재검증한다.
2. assignment가 active이고 attempt 소유권·version·stage가 일치하는지 확인한다.
3. attempt가 terminal이면 저장된 최종 결과를 idempotent하게 반환한다. `abandoned`는 `409`.
4. snapshot total과 answer 수가 같고 각각 유일한지 확인한다.
5. 저장된 `is_correct`로 `correct_count`를 계산한다.
6. `required = ceil(total_count * 0.8)`을 정수식 `ceil(total_count * 8 / 10.0)`으로 계산한다. 예: 1→1, 4→4, 5→4, 10→8.
7. 결과를 `passed` 또는 `failed`로 확정하고 counts/timestamp를 기록한다.
8. 실패면 거래·first pass·해금 없이 결과를 반환한다.
9. 통과면 `(assignment_id, stage_id)` first pass 존재 여부를 잠금/UNIQUE로 확인한다.
10. 최초가 아니면 추가 보상 없이 결과만 반환한다.
11. 최초면 stage difficulty에서 보상 1/2/3/5를 서버가 계산하고 미리 생성한 first-pass UUID를 `source_id`로 사용하여 `sticker_transactions`에 `earn`을 INSERT한다.
12. `learning_stage_first_passes`를 원장 ID와 함께 INSERT하고 progress를 `passed`로 바꾼다.
13. 바로 다음 `display_order`의 stage가 있으면 그 progress를 `unlocked`로 전환한다.
14. 다음 단계가 없으면 assignment를 `completed`로 전환한다.
15. 모든 결과를 반환한다. 어느 단계에서든 오류면 attempt 확정까지 전부 rollback한다.

보상 description은 단원명·단계명과 “최초 통과” 정도만 포함하고 정답·PIN·내부 credential은 넣지 않는다. 원장 `source_type`은 기존 자유 text 컬럼과 잔액 합계에 호환된다.

## K. 멱등성과 동시성

| 상황 | 방어 | 결과 / HTTP | 보상·해금 |
|---|---|---|---|
| 답안 더블클릭 | `(attempt_id, client_request_id)` UNIQUE, question lock | 같은 payload `200` 동일 결과 | 한 번만 |
| 같은 요청 재전송 | idempotency row/result lookup | `200` 저장 결과 | 변화 없음 |
| 두 탭에서 같은 문제, 같은 선택 | `(attempt_id, attempt_question_id)` UNIQUE | 승자 `200`, 패자도 기존 동일 결과 `200` | 변화 없음 |
| 두 탭에서 같은 문제, 다른 선택 | question lock + answer UNIQUE | 승자 `200`, 패자 `409 ANSWER_ALREADY_SUBMITTED` | 최초 선택만 유지 |
| 두 탭 최종 제출 | attempt/progress lock, first-pass UNIQUE, ledger UNIQUE | 둘 다 동일 terminal 결과 `200` | 거래·해금 최대 1 |
| 부모 reset과 답안 제출 | assignment→attempt 동일 잠금 순서 | 먼저 잠근 작업이 완료; reset 승리 뒤 제출은 `409 ATTEMPT_ABANDONED` | abandoned에는 없음 |
| 부모 cancel과 응시 시작 | assignment lock, active 상태 재검증 | cancel 승리 시 `409 ASSIGNMENT_INACTIVE`; start 승리 뒤 cancel이 attempt도 abandon | 없음 |
| 동일 단계 재통과 | first-pass UNIQUE | attempt는 passed, `firstPass=false` | 추가 지급/해금 없음 |
| start 더블클릭 | partial UNIQUE active attempt, start key | 기존 active attempt `200` | 영향 없음 |
| timeout 후 재시도 | endpoint idempotency key + terminal 조회 | 동일 저장 결과 `200`; payload 변경은 `409` | 중복 없음 |

unique violation을 일반 `500`으로 노출하지 않고, transaction에서 기존 행을 다시 읽어 위 계약으로 변환한다. deadlock/serialization 오류는 서버가 같은 idempotency key로 제한된 횟수만 재시도할 수 있으나 client에는 중복 결과가 생기지 않아야 한다.

## L. 부모 초기화

- 초기화 대상은 `in_progress` 응시만이다.
- API와 RPC 모두 현재 활성 parent, 같은 family의 active assigned child, assignment/attempt 소유권을 확인한다.
- assignment → attempt 순으로 잠근 뒤 `status='abandoned'`, `abandoned_at`, `abandoned_by_member_id`, 선택적 제한 길이 audit reason을 기록한다.
- snapshot과 이미 제출된 answer는 유지한다.
- transaction commit 직후 active attempt partial UNIQUE에서 빠지므로 자녀가 새 응시를 시작할 수 있다.
- `passed`/`failed`/이미 `abandoned`는 변경하지 않고 `409 ATTEMPT_NOT_RESETTABLE`을 권장한다. 같은 reset idempotency key의 재전송만 기존 결과를 반환한다.
- reset이 먼저 잠그면 answer submit은 `409`; answer가 먼저 완료되더라도 reset은 이후 상태를 다시 보고 terminal이면 `409`.
- 삭제·답안 초기화·보상 취소는 하지 않는다.

## M. 보안 및 권한

### 권한 계약

- 모든 신규 테이블은 생성 즉시 RLS를 활성화하고 PUBLIC, anon, authenticated의 모든 직접 권한을 회수한다.
- broad browser policy를 만들지 않는다. 브라우저는 Family API token으로 같은 origin server API만 호출한다.
- service-role은 서버에서만 사용하고 client bundle/log에 노출하지 않는다.
- mutation RPC는 `postgres` owner, `SECURITY DEFINER`, `search_path = pg_catalog, public`; PUBLIC/anon/authenticated EXECUTE를 회수하고 service_role만 허용한다.
- API와 RPC가 모두 현재 membership/role을 검증한다. RPC 입력에서 family ID를 받지 않고 assignment/attempt와 actor membership으로 도출한다.
- 모든 대상 lookup/mutation은 family와 assigned member를 함께 검사한다. 범위가 다른 UUID는 동일 404로 숨긴다.
- 목록 API는 부모에게 내부 과정 정보를 허용하지만 자녀 응답은 단원 중심이며 정답, content hash, creator, 다른 member ID를 제외한다.
- answer 전에는 정답과 해설을 노출하지 않는다. 제출 후 해당 문항의 결과/해설만 제공한다.
- 로그에는 credential, Family token, PIN, 정답 snapshot, 전체 request body를 남기지 않는다.
- Push/Realtime channel과 publication을 만들지 않는다.

### 위협 모델

| 공격 시나리오 | 방어 |
|---|---|
| anon/authenticated가 PostgREST로 신규 테이블 조회/변경 | RLS + 직접 privilege 0 + runtime ACL probe |
| 브라우저가 service wrapper RPC 직접 호출 | EXECUTE service_role 전용 |
| 부모가 다른 가족 child UUID로 배정 | server session family + active child 검증, RPC 복합 FK/재검증 |
| 부모가 같은 가족의 다른 자녀 attempt를 reset/cancel | assignedMemberId와 scoped assignment/attempt 조건, 불일치 404 |
| 자녀가 assignedMemberId/familyId override | 자녀 API는 session `sub`만 사용, family body 거부 |
| 자녀가 정답/점수/보상량 조작 | 입력으로 받지 않고 snapshot/DB 난이도로 서버 계산 |
| 선택지 ID를 다른 문제에서 제출 | snapshot options 포함 여부를 잠금 transaction에서 검사 |
| 제출 답안을 PATCH/재선택 | INSERT-only RPC, UPDATE/DELETE 권한 없음, UNIQUE |
| 두 탭으로 중복 보상 | locks + first pass UNIQUE + ledger UNIQUE |
| 게시 콘텐츠를 바꿔 과거 점수 변경 | published immutability + attempt snapshot 채점 |
| UUID 열거로 타 가족 존재 확인 | 범위 적용 후 동일 404, 내부 DB 오류 숨김 |
| inactive member의 유효 토큰 사용 | 매 요청 DB membership `is_active=true` 재검증 |
| 악성 `search_path` 객체로 definer 함수 탈취 | `pg_catalog, public` 고정, schema CREATE baseline 검증 |
| 정답이 로그/목록 응답으로 유출 | allow-list response DTO와 민감 필드 로그 금지 테스트 |

## N. 기존 기능과의 경계

| 기존 기능 | Phase 2B 관계 |
|---|---|
| `study_plans` | 연결·FK·자동 생성 없음. 기존 CRUD/완료와 별도 |
| 교재/독서/Academy | 배정, 단계, 응시와 별도. 기존 wrapper와 테이블 변경 없음 |
| 다율 한글 | UX/재개 아이디어만 참고. 한글 세션·보상 RPC와 데이터 공유 없음 |
| `sticker_transactions` | 유일한 통합점. `learning_stage_first_pass` source로 양수 earn 기록 |
| 잔액 계산 | 기존 `sum(amount)`가 새 source를 자동 포함하므로 계산 변경 불필요 |
| 지갑 거래 목록 | generic source/description은 표시 가능. 새 source의 별도 한글 label이 필요하면 후속 UI 개선 |
| 완료 알림 | 초기 Phase 2B에서 생성하지 않음 |
| Push | 제외 |
| Realtime | 제외하며 신규 테이블 publication 미포함 |

기존 원장의 `source_type`은 CHECK로 제한되지 않고 `source_id`는 text이므로 새 UUID source와 호환된다. 기존 `(member_id, source_type, source_id)` UNIQUE는 first pass 중복 방지에 재사용한다.

## O. migration 전략

실제 이름은 구현 날짜에 맞춰 정하며 아래는 예시다.

### 2B-1A DB 기반 additive migration

예: `202608010001_expand_learning_content_assignments.sql`

- course/unit/version/stage/question/option/assignment/progress 테이블
- 게시 불변 trigger와 publish/retire/assign/cancel service-role 최소 RPC
- RLS, ACL, indexes, exact preflight
- dependency: families, family_members, pgcrypto, Phase 2A Contract baseline
- backfill: 없음
- lock 위험: 신규 객체 중심으로 낮음. 기존 family table에는 FK metadata lock만 짧게 발생
- 실제 Production 콘텐츠 없음. 격리 테스트 fixture는 migration과 분리

### 2B-1B 배정 API와 최소 UI

- 신규 migration을 원칙적으로 요구하지 않고 2B-1A 계약을 사용한다.
- 부모 catalog/assign/progress/cancel API와 자녀 assignment/stage 조회 API
- 부모 최소 배정 UI, 자녀 단원·잠금 상태 UI
- API/UI family·child scope와 자녀 전환 회귀 검증
- 실제 콘텐츠 대신 테스트 fixture만 사용하며 Production 적용·콘텐츠 투입은 별도 승인
- 응시·답안·채점·보상 없음

### 2B-2 응시·채점 additive migration

예: `202608010002_expand_learning_attempts_answers.sql`

- attempts, attempt_questions, answers
- start/resume, submit answer, `in_progress` abandon RPC
- snapshot 기준 동일 가중치와 `ceil(total×0.8)` 채점
- 정답 표시 문구·해설 즉시 피드백
- immutable trigger, partial UNIQUE, idempotency 제약
- dependency: 2B-1A와 2B-1B
- feature exposure: 2B-3 전 Production 자녀 풀이 UI 비활성

### 2B-3 보상·해금 migration

예: `202608010003_expand_learning_stage_rewards.sql`

- first_pass table, finalize RPC, progress/assignment 최종 연결
- sticker ledger FK/index와 service-role 계약
- dependency: 2B-1A, 2B-1B, 2B-2, `sticker_transactions`
- 기존 원장 데이터 backfill: 없음
- 기존 원장에는 FK 추가보다 신규 first_pass→ledger 단방향 FK만 두어 장시간 lock을 줄임

### verification, rollback, 배포

- 각 migration에 동일 번호의 read-only verification과 사전 데이터 없는 경우에만 가능한 rollback 문서를 둔다.
- 데이터 생성 전 rollback은 신규 RPC/테이블 역순 제거가 가능하다.
- 데이터 생성 후에는 history/answers/rewards를 삭제하는 rollback을 금지하고 API feature flag 또는 EXECUTE 회수로 emergency disable한다.
- 신규 모델은 처음부터 default-deny이므로 legacy Contract 단계가 별도로 필요하지 않다. 2B-1A/2/3의 DB 변경은 additive Expand이고 2B-1B는 그 위의 API/UI 단계다.
- 각 단계는 로컬 정적 테스트 → 격리 PostgreSQL parse/transaction/concurrency → Production read-only metadata preflight → linked dry-run → 별도 승인 실제 push → 원본 verification 순서다.
- dry-run은 해당 migration 하나만 보여야 하며 drift/remote-only/예상 밖 migration이면 중단한다.
- verification은 신규 테이블이 `pg_publication_tables`의 Realtime publication에 0개인지 검사한다.
- rollback은 자동 실행하지 않는다.

## P. 테스트 전략과 계약 매트릭스

### 필수 교차 축

- actor: 부모 / 하겸 / 다율 / inactive member
- scope: 자기 가족·자녀 / 같은 가족 다른 자녀 / 다른 가족
- 배정: 최초 / 동일 unit·동일 version 중복 / 동일 unit·다른 version active 중복 / 구 배정 terminal 후 새 version / 취소 / 완료
- 진행: locked / unlocked / passed
- 응시: 최초 / 중단 / 재개 / failed / passed / abandoned
- 점수: 전부 정답 / 정확히 80% 경계 / 한 문제 아래 / 오답 / 소수 문항 ceil 경계
- 보상: seed 1 / leaf 2 / tree 3 / crown 5 / 재통과 0
- 요청: 단일 / 같은 key 재전송 / 다른 payload key 재사용 / 동시 두 탭
- 접근: 정상 server API / anon REST·RPC / authenticated REST·RPC
- UI: 부모 자녀 전환 / child 과정명 미노출 / stale response 폐기
- version: published 불변 / retire / 새 version / 과거 attempt 재현
- 회귀: 일반 계획, 교재, 독서, Academy, 한글, 기존 완료·잔액

### 단계별 검증

| 단계 | 범위 | 통과 기준 | 중단 조건 |
|---|---|---|---|
| 정적 계약 | migration 위험 구문, RLS/ACL, 함수 signature/search_path, API 직접 REST 금지, 응답 allow-list | 모든 계약 assertion 통과 | broad grant/policy, client service key/RPC, 불변성 누락 |
| 단위 테스트 | 80% ceil, 난이도 map, DTO, UUID/idempotency validation, 상태 전이 | 경계값 전부 정확 | client 계산값 신뢰, 반올림 불일치 |
| API 테스트 | membership/role/scope/error, retries, 자녀 override, 정답 노출 | 정상/차단 및 401/403/404/409 계약 일치 | 타 family/child 정보 노출 |
| 격리 PostgreSQL | 실제 SQL parse, FK/CHECK/UNIQUE/trigger, RPC atomicity, ledger | 모든 정상·실패 transaction과 rollback 일치 | partial commit, orphan, failed reward |
| 동시성 | answer/start/finalize/reset/cancel 두 connection barrier 테스트 | active attempt/answer/first pass/ledger 각 최대 1 | deadlock 반복, 중복 지급·해금 |
| linked metadata/dry-run | Production dependency/ACL/history 및 단일 migration 예정 | drift 0, 대상 1, write 0 | signature/baseline 불일치 |
| Production 최소 회귀 | 실제 콘텐츠 투입 전에는 empty catalog·metadata·ACL과 기존 기능만 확인. 별도 콘텐츠 단계 이후 부모 배정, 두 자녀 독립 풀이, 80% pass/fail, 재통과 확인 | 원장 정확, 격리, 기존 기능 정상 | 데이터 혼합, 보상 불일치, 5xx |

Production 테스트 데이터는 명시적으로 표시하고 제거 대신 cancelled/retired/history 보존 정책을 따른다. 보상 테스트는 실제 지급 영향이 있으므로 별도 승인과 사전/사후 잔액·원장 확인이 필요하다.

## Q. 단계별 구현 파일 계획

경로와 파일명은 다음 승인에서 확정한다.

### 2B-1A

- DB/migration: `supabase/migrations/<version>_expand_learning_content_assignments.sql`
- verification/rollback: `supabase/verification/<version>_expand_learning_content_assignments_verify.sql`, `supabase/rollbacks/<version>_rollback_learning_content_assignments.sql`
- 서버 API/UI: 없음
- 공통 helper: DB 구현에는 없음
- 테스트: `test/learning-content-static.test.js`, 격리 PostgreSQL용 테스트 전용 최소 fixture와 schema/ACL/constraint assertion
- 문서: 이 문서 상태 갱신은 별도 승인
- 콘텐츠 seed/import: 실제 JSON, validator, import 도구, Production 콘텐츠 없음. fixture는 Production migration과 분리

### 2B-1B

- DB/migration: 원칙적으로 없음. 2B-1A schema/RPC 사용
- verification/rollback: API/UI 계약에는 없음. 2B-1A DB verification 유지
- 서버 API: `server/api/learning/catalog.js`, `server/api/learning/assignments.js`
- 공통 helper: `server/api/learning/_utils.js` — UUID, membership, DTO, idempotency 오류 변환
- UI: 기존 부모/자녀 shell의 별도 learning tab, 부모 최소 배정 UI, 자녀 단원·잠금 목록
- 테스트: `test/learning-assignments.test.js`, 자녀 전환 및 family/member scope UI/API 테스트
- 문서/콘텐츠: 실제 콘텐츠 없음

### 2B-2

- DB/migration: `supabase/migrations/<version>_expand_learning_attempts_answers.sql`
- verification/rollback: 동일 번호 verify/rollback
- 서버 API: `server/api/learning/attempts.js`, `server/api/learning/answers.js`
- 공통 helper: 2B-1B `_utils.js`에 response DTO와 safe DB error mapping만 최소 확장
- UI: 자녀 단원/단계/문항/정답 문구·해설 즉시 피드백/이어하기 화면
- 테스트: attempt/answer API, snapshot 불변, 동일 가중치 80% 채점, `in_progress` reset, 두 탭 동시성, PostgreSQL fixture
- 문서/콘텐츠: 신규 변경 없음

### 2B-3

- DB/migration: `supabase/migrations/<version>_expand_learning_stage_rewards.sql`
- verification/rollback: 동일 번호 verify 및 emergency-disable 중심 rollback
- 서버 API: finalize/result route; 기존 reward wallet API는 generic ledger 호환이면 변경하지 않음
- 공통 helper: 난이도 표시 DTO만 필요 시 추가; 보상 계산은 DB 전용
- UI: 단계 결과, 해금, 보상, 부모 진행률
- 테스트: 80% ceil, 1/2/3/5, first/repass, 원장·잔액, 동시 finalize, 전 기능 회귀
- 문서: 운영 runbook과 Production 회귀 체크리스트를 별도 승인으로 추가
- 콘텐츠: 없음. 검증된 최초 system content version은 2B-3 계약 검증 후 별도 콘텐츠 단계와 별도 승인으로 적용

## R. 미확정 사항 분류

### 구현 전 반드시 사용자 결정 필요

없음. 실제 콘텐츠의 구체적인 과정·단원·문항은 엔진 구현의 선행 결정이 아니라 별도 콘텐츠 단계의 승인 대상이다.

### 권장 기본값으로 진행 가능

1. 배정 취소는 active attempt를 같은 transaction에서 abandoned로 만들고 terminal 배정은 변경하지 않는다.
2. retired 콘텐츠의 기존 배정·응시는 계속 가능하고 신규 배정만 막는다.
3. 마지막 답안 제출이 finalize를 시도하되 명시적 finalize endpoint도 idempotent하게 제공한다.

### 구현 중 기술적으로 결정 가능

1. JSON schema validator의 라이브러리 없이 직접 검증할지 기존 도구를 활용할지.
2. API route를 하나의 method router로 합칠지 파일별로 나눌지.
3. snapshot JSONB의 정확한 key 이름과 최대 길이.
4. serialization failure의 서버 내부 제한 재시도 횟수.

다음 항목은 더 이상 미확정이 아니다.

- 실제 Production 콘텐츠는 엔진 검증 후 별도 단계에서 투입한다.
- 같은 자녀·logical unit의 구/신 version은 동시에 active 배정할 수 없다.
- 답안 제출 직후 정답 여부, 정답 선택지 표시 문구, 해설을 반환한다.
- 초기에는 문제·선택지 `display_order`를 고정하고 모든 문항을 동일 가중치로 채점한다.
- 부모 reset은 `in_progress`에만 허용한다.

## S. 설계 자체 점검

- [x] 문제풀이 모델은 `study_plans`와 분리했다.
- [x] 실제 콘텐츠와 테스트 fixture를 엔진 및 Production migration에서 분리했다.
- [x] assignment가 logical unit과 정확한 content version을 함께 참조한다.
- [x] 같은 자녀·logical unit의 구/신 version active 중복을 금지했다.
- [x] 새 version은 새 assignment이므로 최초 통과·보상이 독립적이며 구 이력과 충돌하지 않는다.
- [x] 보상은 문항이 아닌 단계 최초 통과 1회다.
- [x] 난이도 보상은 seed/leaf/tree/crown = 1/2/3/5다.
- [x] 통과 기준은 `ceil(total × 0.8)`로 일관된다.
- [x] 실패·abandoned에는 보상·차감·해금이 없다.
- [x] 제출 답안은 변경할 수 없다.
- [x] 제출 직후 정답 표시 문구와 해설만 안전하게 공개한다.
- [x] 부모 초기화는 삭제가 아닌 abandoned 전환이다.
- [x] 부모 초기화는 `in_progress` 응시에만 허용한다.
- [x] published 콘텐츠와 응시 snapshot으로 과거 채점을 보존한다.
- [x] 초기 순서는 published `display_order`로 고정하고 모든 문항을 동일 가중치로 처리한다.
- [x] family ID를 client 입력으로 신뢰하지 않는다.
- [x] 신규 식별자는 UUID다.
- [x] 최종 결과·최초 통과·원장·해금·완료가 단일 transaction이다.
- [x] anon/authenticated 직접 접근과 browser RPC 실행을 차단한다.
- [x] 자녀 응답에서 과정명·정답·다른 자녀 정보를 제외한다.
- [x] Push와 Realtime을 제외했다.
- [x] 기존 일반 계획·교재·독서·Academy를 재설계하지 않았다.
- [x] 구현 전 사용자 결정과 권장 기본값을 분리했다.

## T. 2B-1A 다음 승인 권장 범위

다음 요청은 **2B-1A DB 기반의 로컬 구현과 비외부 검증만** 승인하는 것이 안전하다.

포함:

1. 2B-1A additive migration, verification, pre-data rollback 작성
2. course/unit/version/stage/question/option/assignment/progress 모델
3. assignment의 unit/version 복합 일치와 logical unit 기준 active partial UNIQUE
4. publish 불변성과 콘텐츠 구조 검증 RPC
5. service-role 전용 최소 assign/cancel DB 함수 및 exact ACL/RLS
6. 정적 SQL 계약 테스트
7. Production migration과 분리된 테스트 전용 최소 fixture
8. 격리 PostgreSQL schema·권한·constraint 테스트와 전체 기존 테스트

제외:

- Production 연결·dry-run·push
- 부모·자녀 서버 API 및 UI
- 응시/답안/finalize/보상
- 실제 Production 콘텐츠, versioned JSON, validator, import 도구
- Push/Realtime
- commit/push/deploy

중단 조건은 기존 schema·ACL과의 불일치, family/member 복합 FK 부재, browser 직접 권한 발견, published 불변성 검증 실패, 예상 밖 파일 변경이다.
