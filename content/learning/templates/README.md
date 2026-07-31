# 초등 2 수학 CSV 템플릿

이 디렉터리의 CSV는 Excel에서 편집할 수 있는 UTF-8 BOM 형식이며 줄바꿈은 LF로 고정됩니다. `grade2-math-units.csv`는 12개 운영 단원의 메타데이터이고, `grade2-math-questions.csv`는 12단원 × 4단계 × 10문항, 총 480개의 빈 작성 행입니다.

## 안전한 편집

- Excel에서 열 때 UTF-8 인코딩을 유지하고, 저장할 때 **CSV UTF-8(쉼표로 분리)** 형식을 선택합니다.
- 열 이름과 순서는 변경하지 않습니다. 셀 안의 쉼표, 큰따옴표, 줄바꿈은 Excel이 CSV quoting으로 처리하게 둡니다.
- `question_text`, 선택지 4개, `correct_option`, `explanation`, `skill_code`를 모두 작성하고 `review_status`를 `reviewed`로 바꿉니다.
- 사용자 작성 문구를 `=`, `+`, `-`, `@`로 시작하지 않습니다. importer가 spreadsheet formula injection으로 차단합니다.
- 한 번의 import에는 한 단원의 작성 완료 행만 허용됩니다. 다른 단원 행은 원래 빈 `draft` 상태로 둡니다.
- 이 템플릿의 빈 행은 실제 콘텐츠가 아니며 migration이나 Production에 사용하면 안 됩니다.

템플릿을 다시 만들려면 다음 명령을 사용합니다. 기존 파일은 기본적으로 덮어쓰지 않습니다.

```text
node scripts/generate-learning-content-csv-template.js
```

검토 후 의도적으로 재생성할 때만 `--force`를 사용합니다. 출력 경로는 이 두 템플릿 파일로 제한됩니다.
