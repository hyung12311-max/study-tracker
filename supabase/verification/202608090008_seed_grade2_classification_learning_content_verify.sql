-- Phase 2B grade2-classification v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":5,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"297bdcac-d755-49d0-b4bd-09a839e0e4db","questions":[{"displayOrder":1,"explanation":"사과와 딸기와 수박은 모두 과일이므로 과일이라는 기준으로 묶었습니다.","id":"c3dadff8-a851-4b99-874b-43b527ae2ac4","options":[{"displayOrder":1,"id":"a843ece1-7885-4e99-bc4e-422c1b76b91b","isCorrect":true,"text":"과일"},{"displayOrder":2,"id":"8a34cd5a-28f9-439d-93cf-1ce140b1b0a6","isCorrect":false,"text":"탈것"},{"displayOrder":3,"id":"42c1df87-b825-4b9f-a00a-00c745da23c6","isCorrect":false,"text":"학용품"},{"displayOrder":4,"id":"e74d400e-3f02-41de-a332-6b30b7ecc042","isCorrect":false,"text":"동물"}],"prompt":"사과, 딸기, 수박을 한 모둠으로 묶었습니다. 알맞은 기준은?","skillCode":"identify-classification-rule","weight":1},{"displayOrder":2,"explanation":"세 물건은 모양과 쓰임은 다르지만 모두 빨간색입니다.","id":"d2671053-580c-496a-9aae-75e8490e9227","options":[{"displayOrder":1,"id":"c6038263-6516-4267-8a6a-e5619dba790a","isCorrect":false,"text":"동그란 것"},{"displayOrder":2,"id":"279aac18-961d-43bd-b8a2-5f398f996f98","isCorrect":true,"text":"빨간색인 것"},{"displayOrder":3,"id":"2c39db67-c99e-4906-b60e-923315a653e3","isCorrect":false,"text":"먹을 수 있는 것"},{"displayOrder":4,"id":"e9c651e7-0f03-4c97-926d-5ebe5b99a00d","isCorrect":false,"text":"나무로 만든 것"}],"prompt":"빨간 공, 빨간 연필, 빨간 모자를 한 모둠으로 묶었습니다. 알맞은 기준은?","skillCode":"identify-classification-rule","weight":1},{"displayOrder":3,"explanation":"책은 앞면이 네모 모양이므로 주어진 모둠에 들어갑니다.","id":"d383eaf6-61f2-4109-8b22-7dae50225ae8","options":[{"displayOrder":1,"id":"39d6a6b9-f64d-45bb-bd93-fecad2f0ea22","isCorrect":false,"text":"동그란 접시"},{"displayOrder":2,"id":"dceb8e78-7692-4675-892b-c3eea9aac01f","isCorrect":false,"text":"세모 깃발"},{"displayOrder":3,"id":"8c70bce2-b63c-49fd-a5d3-e29f7b7bec97","isCorrect":true,"text":"네모난 책"},{"displayOrder":4,"id":"d634fcc0-e759-421e-9ef5-c336817ce282","isCorrect":false,"text":"공 모양 풍선"}],"prompt":"''네모 모양인 것'' 모둠에 들어갈 것은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":4,"explanation":"공책은 학교에서 공부할 때 쓰는 물건입니다.","id":"3f3ea6a6-b981-4f26-a8b3-4893e1028653","options":[{"displayOrder":1,"id":"df32fddf-ef85-4616-93dd-1dc46bb72b4c","isCorrect":false,"text":"프라이팬"},{"displayOrder":2,"id":"95581a2e-eecf-4c7f-a463-412904efdf0a","isCorrect":false,"text":"베개"},{"displayOrder":3,"id":"73b9fae7-e8ef-404f-9c0d-69f810ca8d2b","isCorrect":false,"text":"칫솔"},{"displayOrder":4,"id":"617ca236-10aa-4db0-8f62-237e161269b3","isCorrect":true,"text":"공책"}],"prompt":"''학교에서 쓰는 물건'' 모둠에 들어갈 것은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":5,"explanation":"2와 4와 6과 8은 모두 2로 나누어떨어지는 짝수입니다.","id":"7fb21abf-8b0c-4f82-adb2-b854990d121d","options":[{"displayOrder":1,"id":"b269512a-d5e1-4074-853f-f710f39b3ece","isCorrect":true,"text":"짝수"},{"displayOrder":2,"id":"0e3443ba-5594-4f31-80a7-6661cdeedc6c","isCorrect":false,"text":"홀수"},{"displayOrder":3,"id":"caa1152c-db99-4ab1-a842-eea4ce555f9c","isCorrect":false,"text":"10보다 큰 수"},{"displayOrder":4,"id":"9a5b719b-001e-410d-b163-9f65dc75b4e0","isCorrect":false,"text":"한 자리 홀수"}],"prompt":"2, 4, 6, 8을 한 모둠으로 묶었습니다. 알맞은 기준은?","skillCode":"identify-classification-rule","weight":1},{"displayOrder":6,"explanation":"참새는 날개가 있는 동물이고 나머지 동물은 날개가 없습니다.","id":"0c2c9cd1-f350-4d9d-89e1-9589fe4f8953","options":[{"displayOrder":1,"id":"544bb3b6-8726-47ba-b232-527ce941ae92","isCorrect":false,"text":"고양이"},{"displayOrder":2,"id":"dee40ca5-841b-4d50-9b38-7eee3dc94e32","isCorrect":true,"text":"참새"},{"displayOrder":3,"id":"12cf2e3b-edd8-44de-81dd-8920afa0c149","isCorrect":false,"text":"토끼"},{"displayOrder":4,"id":"684afc71-4032-473f-ab9a-84d43101a919","isCorrect":false,"text":"거북"}],"prompt":"''날개가 있는 동물'' 모둠에 들어갈 것은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":7,"explanation":"실험에서 물 위에 뜬 나무토막만 ''물에 뜨는 물건'' 모둠에 들어갑니다.","id":"242f564a-a221-4ba2-97ee-f37122a3ca35","options":[{"displayOrder":1,"id":"301fca38-aaee-4784-a617-f33f5e686404","isCorrect":false,"text":"물속에 가라앉은 쇠구슬"},{"displayOrder":2,"id":"d2ee5f23-0cb8-427e-b3c9-54fbe2467c29","isCorrect":false,"text":"물속에 가라앉은 돌"},{"displayOrder":3,"id":"16a6f7b0-1ea6-4315-be37-03c9ee67a19a","isCorrect":true,"text":"물 위에 뜬 나무토막"},{"displayOrder":4,"id":"cd4e8463-58c1-45f5-8a07-3a2ca2f8a6db","isCorrect":false,"text":"물속에 가라앉은 유리구슬"}],"prompt":"''물에 뜨는 물건''을 찾는 실험 결과에 따라 모둠에 넣을 것은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":8,"explanation":"바나나는 먹을 수 있는 과일입니다.","id":"05988807-5115-402f-a310-bb224cd910c1","options":[{"displayOrder":1,"id":"d392ca97-73c8-46fe-9339-b26752da73aa","isCorrect":false,"text":"자"},{"displayOrder":2,"id":"e3a907c9-5a4a-4cee-a637-9f0126862665","isCorrect":false,"text":"우산"},{"displayOrder":3,"id":"3532c566-67fc-464a-aec7-d047c22198cb","isCorrect":false,"text":"비누"},{"displayOrder":4,"id":"16f38fbb-01ab-4f73-9679-bacbce01ed1b","isCorrect":true,"text":"바나나"}],"prompt":"''먹을 수 있는 것'' 모둠에 들어갈 것은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":9,"explanation":"연필과 지우개와 자는 모두 공부할 때 쓰는 학용품입니다.","id":"7014c2c5-a80d-44d1-8bd4-c024c060ff76","options":[{"displayOrder":1,"id":"5cc5ff4d-2a1e-421d-a859-bd95c23bf965","isCorrect":true,"text":"학용품"},{"displayOrder":2,"id":"125b0db1-291b-4cac-a6d4-d73bf2d2a77c","isCorrect":false,"text":"과일"},{"displayOrder":3,"id":"c7915170-c055-4897-8ce7-988d196f1bcf","isCorrect":false,"text":"악기"},{"displayOrder":4,"id":"db0b80ed-53b6-4100-9850-3f7de4f98ffc","isCorrect":false,"text":"옷"}],"prompt":"연필, 지우개, 자를 한 모둠으로 묶었습니다. 알맞은 기준은?","skillCode":"identify-classification-rule","weight":1},{"displayOrder":10,"explanation":"13은 10보다 크고 나머지 수는 10보다 크지 않습니다.","id":"24160d5b-e41c-43a5-acd5-8d3d38be2e7d","options":[{"displayOrder":1,"id":"20dd0681-ee1c-4baa-8ae3-f43d56b5edcc","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"5e405e70-ab5e-4df5-b8ea-a1039f304621","isCorrect":true,"text":"13"},{"displayOrder":3,"id":"f5ff02ce-1280-4139-8c57-6004e6e6f004","isCorrect":false,"text":"10"},{"displayOrder":4,"id":"767685fb-bbd4-4d84-b9d6-60da480fae3b","isCorrect":false,"text":"4"}],"prompt":"''10보다 큰 수'' 모둠에 들어갈 것은?","skillCode":"classify-by-given-rule","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"de886921-0319-43c2-9577-2d6fdea09db0","questions":[{"displayOrder":1,"explanation":"색깔별 수를 알려면 빨간색과 파란색처럼 색깔을 기준으로 나누어야 합니다.","id":"90cc32ef-6232-4c84-b3de-298728557cfd","options":[{"displayOrder":1,"id":"b146f7a8-7b4d-47b4-81c8-76f874206bd6","isCorrect":false,"text":"단추의 재료"},{"displayOrder":2,"id":"98d2d804-3876-4fd4-bbe5-4bee07516dbd","isCorrect":false,"text":"단추의 구멍 수"},{"displayOrder":3,"id":"7ea2f4b7-c57e-4ee7-93cb-848d5de6e8a9","isCorrect":true,"text":"단추의 색깔"},{"displayOrder":4,"id":"a7d93d62-7c13-4c6d-80f5-1ee1b8524b47","isCorrect":false,"text":"단추의 크기"}],"prompt":"단추를 ''빨간색/파란색''으로 나누는 기준과 ''큰 것/작은 것''으로 나누는 기준을 비교했습니다. 색깔별 단추 수를 알고 싶을 때 알맞은 기준은?","skillCode":"compare-classification-rules","weight":1},{"displayOrder":2,"explanation":"읽고 싶은 내용을 찾기 쉽게 하려면 동화책과 과학책처럼 내용으로 나누는 것이 알맞습니다.","id":"1bd7749c-cb04-43af-a24a-a6162b0f4a72","options":[{"displayOrder":1,"id":"2df3cdb8-a9eb-4849-ad7a-37c500a9a987","isCorrect":false,"text":"책의 두께"},{"displayOrder":2,"id":"745bda1a-1ef4-42ec-be54-717a55d39be8","isCorrect":false,"text":"책의 색깔"},{"displayOrder":3,"id":"c38f0ed4-60f4-4f90-bed1-8192b79e10fb","isCorrect":false,"text":"책의 크기"},{"displayOrder":4,"id":"60c09039-37b2-41b8-8927-c1715dc3de86","isCorrect":true,"text":"책의 내용"}],"prompt":"책을 ''동화책/과학책''과 ''큰 책/작은 책''으로 나눌 수 있습니다. 책의 내용을 찾기 쉽게 정리하려면 알맞은 기준은?","skillCode":"compare-classification-rules","weight":1},{"displayOrder":3,"explanation":"1모둠은 짝수이고 2모둠은 홀수이므로 짝수와 홀수로 나누었습니다.","id":"0e972622-b82a-4af6-95a1-9a91fcf181b7","options":[{"displayOrder":1,"id":"6044505f-6a68-4ee1-9e0f-e71062917c85","isCorrect":true,"text":"짝수와 홀수"},{"displayOrder":2,"id":"597df483-6937-4195-bd6d-634255471329","isCorrect":false,"text":"큰 수와 작은 수"},{"displayOrder":3,"id":"880c1794-9ea9-4134-98e9-d43f75be5cb9","isCorrect":false,"text":"한 자리 수와 두 자리 수"},{"displayOrder":4,"id":"3d22f912-a41c-4a98-bc4d-7a3ce9f80439","isCorrect":false,"text":"5보다 큰 수와 작은 수"}],"prompt":"1모둠은 2, 4, 6이고 2모둠은 1, 3, 5입니다. 사용한 기준은?","skillCode":"infer-rule-from-groups","weight":1},{"displayOrder":4,"explanation":"버스와 기차는 많은 사람이 함께 타고 자전거와 킥보드는 주로 한 사람이 탑니다.","id":"fded8424-b6f8-486a-baa3-aa1ff6c56132","options":[{"displayOrder":1,"id":"f717c7ed-b5a4-483c-bec8-df1759c95785","isCorrect":false,"text":"1모둠은 바퀴가 없고 2모둠은 바퀴가 있습니다."},{"displayOrder":2,"id":"cb0cbb11-31c8-48d1-962b-134fbe5d1388","isCorrect":true,"text":"1모둠은 많은 사람이 함께 타고 2모둠은 주로 한 사람이 탑니다."},{"displayOrder":3,"id":"dace2bb0-9403-4619-8d68-9de25beebd11","isCorrect":false,"text":"1모둠은 물에서 다니고 2모둠은 하늘에서 다닙니다."},{"displayOrder":4,"id":"532e0635-2910-4285-a3a1-2ca9f004f9f3","isCorrect":false,"text":"1모둠은 동물이고 2모둠은 식물입니다."}],"prompt":"1모둠은 버스와 기차이고 2모둠은 자전거와 킥보드입니다. 제시된 특징으로 알맞게 설명한 것은?","skillCode":"infer-rule-from-groups","weight":1},{"displayOrder":5,"explanation":"빨간 블록 5개와 파란 블록 3개를 비교하면 빨간 블록이 2개 더 많습니다.","id":"ad08071c-4a9e-4bbc-a961-3124f7c2613b","options":[{"displayOrder":1,"id":"0d0727af-5175-438c-9430-9402b636a4b7","isCorrect":false,"text":"블록의 무게"},{"displayOrder":2,"id":"2f5e67e9-aac2-403e-b3b5-a5f0ab045745","isCorrect":false,"text":"블록의 재료"},{"displayOrder":3,"id":"7bb67582-3f79-48d4-a9f7-5d299f25e1ad","isCorrect":true,"text":"빨간 블록이 파란 블록보다 2개 많습니다."},{"displayOrder":4,"id":"830c3641-6f54-4360-b2f3-a3f1cc8910fd","isCorrect":false,"text":"블록을 만든 사람"}],"prompt":"빨간 블록은 5개, 파란 블록은 3개로 색깔에 따라 분류했습니다. 분류 결과로 알 수 있는 것은?","skillCode":"explain-classification-reasoning","weight":1},{"displayOrder":6,"explanation":"주어진 기준이 다리 수이므로 각 동물의 다리가 몇 개인지 확인해야 합니다.","id":"4fe929fc-0832-4f74-88c2-81a8f155562f","options":[{"displayOrder":1,"id":"9a7b9ad2-e3a6-4a89-83dd-e550c4452cd9","isCorrect":false,"text":"사는 곳"},{"displayOrder":2,"id":"79419442-5916-467f-9456-3ec3133892d8","isCorrect":false,"text":"먹이"},{"displayOrder":3,"id":"f297406b-ce05-424d-ac61-083f9a7de5fa","isCorrect":false,"text":"몸의 색깔"},{"displayOrder":4,"id":"9bee59d7-24b8-4124-8bb5-b3eab59d52a0","isCorrect":true,"text":"다리 수"}],"prompt":"동물 카드를 ''다리가 2개/다리가 4개''로 나누려고 합니다. 이 기준으로 분류할 때 먼저 확인할 특징은?","skillCode":"explain-classification-reasoning","weight":1},{"displayOrder":7,"explanation":"장미와 해바라기는 꽃이 피고 소나무와 전나무는 솔방울이 열리는 나무입니다.","id":"718cf3dc-ca79-46b8-9591-0eb135412805","options":[{"displayOrder":1,"id":"02b06781-cc70-4aa1-b3b2-970469854ce3","isCorrect":true,"text":"꽃이 피는 식물과 솔방울이 열리는 나무"},{"displayOrder":2,"id":"948638eb-ed91-4806-a521-0996f6902953","isCorrect":false,"text":"키가 1m보다 큰 것과 작은 것"},{"displayOrder":3,"id":"15634ead-af7a-481d-a99a-4d4e53849e84","isCorrect":false,"text":"잎이 정확히 10장인 것과 아닌 것"},{"displayOrder":4,"id":"9446b806-0a7f-43d9-b95f-e10149c4d861","isCorrect":false,"text":"실내에만 사는 것과 실외에만 사는 것"}],"prompt":"1모둠은 장미와 해바라기이고 2모둠은 소나무와 전나무입니다. 제시된 특징으로 알맞은 기준은?","skillCode":"infer-rule-from-groups","weight":1},{"displayOrder":8,"explanation":"12와 20은 두 자리 수이고 7과 9는 한 자리 수입니다.","id":"5638de18-500f-4742-a1e5-6e5c68d62125","options":[{"displayOrder":1,"id":"d3c75fc3-d7e9-43ab-a383-626fbf26171b","isCorrect":false,"text":"7, 9"},{"displayOrder":2,"id":"31e48c5f-bf7c-416f-86f9-7f9d70848dfd","isCorrect":true,"text":"12, 20"},{"displayOrder":3,"id":"a4ffc02c-e207-43fc-8c64-2289c3460b1d","isCorrect":false,"text":"12, 9"},{"displayOrder":4,"id":"b963fca5-b0f2-4dea-a314-0c05f95d8a1a","isCorrect":false,"text":"7, 20"}],"prompt":"숫자 카드 12, 7, 20, 9를 ''두 자리 수/한 자리 수''로 분류했습니다. 두 자리 수 모둠은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":9,"explanation":"모양별 개수를 알려면 세모와 네모처럼 모양을 기준으로 분류해야 합니다.","id":"a771d0b4-0cc6-44a9-88aa-9d2b5798afee","options":[{"displayOrder":1,"id":"549eb6e9-8381-4f20-8c46-a573ee0f35a0","isCorrect":false,"text":"물건의 이름"},{"displayOrder":2,"id":"75b1efdc-1929-40db-9c55-677fd52b5ea2","isCorrect":false,"text":"색깔"},{"displayOrder":3,"id":"062fc554-ae22-4bb1-9f7a-f8e5f5c83158","isCorrect":true,"text":"모양"},{"displayOrder":4,"id":"148df56d-bd12-4bbf-9067-22b27c7d3a45","isCorrect":false,"text":"크기"}],"prompt":"빨간 세모, 파란 세모, 빨간 네모, 파란 네모가 있습니다. 모양별 개수를 알고 싶을 때 알맞은 분류 기준은?","skillCode":"compare-classification-rules","weight":1},{"displayOrder":10,"explanation":"윗옷과 아랫옷은 입는 위치에 따라 옷을 찾기 쉽게 나눈 것입니다.","id":"4a7ae45c-7152-4672-b5c5-a37cb2cedf76","options":[{"displayOrder":1,"id":"dc446c6b-85c2-4e27-8140-26f6b4a75d45","isCorrect":false,"text":"색깔별 수 알아보기"},{"displayOrder":2,"id":"b3d2491d-1cb8-4b8a-b411-ebe86cd21cbd","isCorrect":false,"text":"가격 비교하기"},{"displayOrder":3,"id":"14615013-bade-44ea-a0e7-12bf7bc286d7","isCorrect":false,"text":"크기 재기"},{"displayOrder":4,"id":"0d749311-5f4b-4d05-a2b0-c228b2b82f2b","isCorrect":true,"text":"입는 위치에 따라 찾기 쉽게 하기"}],"prompt":"옷을 ''윗옷/아랫옷''으로 정리했습니다. 이 분류 기준과 가장 잘 연결되는 목적은?","skillCode":"explain-classification-reasoning","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"e77163a5-41bd-4b69-a30d-3f6e5f8e9bc7","questions":[{"displayOrder":1,"explanation":"1모둠의 수는 모두 짝수이고 2모둠의 수는 모두 홀수입니다.","id":"d71db0b0-f672-4d83-965d-a503146b9217","options":[{"displayOrder":1,"id":"4bd1233a-f136-42fe-970c-a595ea625154","isCorrect":true,"text":"짝수와 홀수"},{"displayOrder":2,"id":"79f9b59a-5a10-4365-b345-9046f7772ce2","isCorrect":false,"text":"20보다 큰 수와 작은 수"},{"displayOrder":3,"id":"b0c2d109-c8a5-4edf-91da-3eeb0b004cd8","isCorrect":false,"text":"십의 자리 숫자"},{"displayOrder":4,"id":"430b517e-4c2c-4bcd-b424-cf8fdb43e5cb","isCorrect":false,"text":"3의 배수와 아닌 수"}],"prompt":"1모둠은 14, 18, 22이고 2모둠은 13, 17, 21입니다. 사용한 기준은?","skillCode":"infer-rule-from-groups","weight":1},{"displayOrder":2,"explanation":"버스는 바퀴가 2개가 아니므로 이 모둠에 들어갈 수 없습니다.","id":"d65135d7-3489-492d-88ae-8d9fd52e4d86","options":[{"displayOrder":1,"id":"5552db00-04b1-4b0f-b830-7226909ec63f","isCorrect":false,"text":"자전거"},{"displayOrder":2,"id":"d97b3c68-46fb-4eeb-bfe1-19e126911cda","isCorrect":true,"text":"버스"},{"displayOrder":3,"id":"dba69dbb-f214-437c-ba21-d949edd1ba43","isCorrect":false,"text":"오토바이"},{"displayOrder":4,"id":"fd7b4b0b-31a8-4aa4-80ce-4b9fb0e6d5a2","isCorrect":false,"text":"잘못된 것이 없습니다."}],"prompt":"''바퀴가 2개인 탈것'' 모둠에 자전거, 오토바이, 버스가 들어 있습니다. 잘못 분류된 것은?","skillCode":"find-misclassified-item","weight":1},{"displayOrder":3,"explanation":"배는 과일이므로 과일 모둠에 빠져 있습니다.","id":"c8b47fdb-2a56-41ac-8da6-ddab8c0a36b9","options":[{"displayOrder":1,"id":"ef2aad6a-c45c-4585-a6c3-f7537f50af02","isCorrect":false,"text":"당근"},{"displayOrder":2,"id":"1805975f-da92-470d-a111-b2dbeb095a14","isCorrect":false,"text":"오이"},{"displayOrder":3,"id":"79376789-df28-4ddc-88de-4cb7e6197076","isCorrect":true,"text":"배"},{"displayOrder":4,"id":"8075cbbd-5dac-4e90-8406-28a0a21dd1fd","isCorrect":false,"text":"빠진 것이 없습니다."}],"prompt":"전체 카드는 사과, 배, 당근, 오이입니다. ''과일'' 모둠에 사과만 들어 있습니다. 빠진 것은?","skillCode":"find-missing-classified-item","weight":1},{"displayOrder":4,"explanation":"빨간 세모만 빨간색과 세모라는 두 조건을 모두 만족합니다.","id":"8f89136e-8cb9-4525-b809-b6292aca67cf","options":[{"displayOrder":1,"id":"2e97b46f-c3a6-4b14-85be-a50af48513f2","isCorrect":false,"text":"빨간 네모"},{"displayOrder":2,"id":"e30adfc8-bb47-4d6b-bcc8-56ac50e29848","isCorrect":false,"text":"파란 세모"},{"displayOrder":3,"id":"b5c1fe0a-4569-4b34-bcda-f743d4d070b8","isCorrect":false,"text":"파란 네모"},{"displayOrder":4,"id":"203a79e7-67e9-453c-88b0-0a34d217f191","isCorrect":true,"text":"빨간 세모"}],"prompt":"빨간 세모, 빨간 네모, 파란 세모, 파란 네모 중 ''빨간색이면서 세모인 것''은?","skillCode":"classify-by-two-properties","weight":1},{"displayOrder":5,"explanation":"14는 10보다 크면서 짝수인 두 조건을 모두 만족합니다.","id":"13b51c55-6aea-4848-bf78-5df48f927f8e","options":[{"displayOrder":1,"id":"288fa349-f5aa-4869-a28b-11f93d575137","isCorrect":true,"text":"14"},{"displayOrder":2,"id":"9c478dd1-d648-4c42-9363-216528faec51","isCorrect":false,"text":"9"},{"displayOrder":3,"id":"a62d452b-bdce-46a2-a01c-2f65ba47b199","isCorrect":false,"text":"11"},{"displayOrder":4,"id":"9d222a09-a672-4c37-a580-ba0398382608","isCorrect":false,"text":"15"}],"prompt":"''10보다 크고 짝수인 수'' 모둠에 들어갈 것은?","skillCode":"classify-by-two-properties","weight":1},{"displayOrder":6,"explanation":"축구공은 학용품도 아니고 네모 모양도 아니므로 잘못 분류되었습니다.","id":"ffed7c7c-0bab-4f37-9a62-5b2f62e1329e","options":[{"displayOrder":1,"id":"556c6149-cbbf-4092-8929-9c7155b36666","isCorrect":false,"text":"책"},{"displayOrder":2,"id":"ed599f22-3e7d-40b9-b87a-95e1b19372ff","isCorrect":true,"text":"축구공"},{"displayOrder":3,"id":"47ec71e5-68df-4dc4-80ac-46bd0eb6171c","isCorrect":false,"text":"공책"},{"displayOrder":4,"id":"3093320c-92b0-4d2f-b7e6-dd21cab55d02","isCorrect":false,"text":"잘못된 것이 없습니다."}],"prompt":"''네모 모양인 학용품'' 모둠에 책, 공책, 축구공이 들어 있습니다. 잘못 분류된 것은?","skillCode":"find-misclassified-item","weight":1},{"displayOrder":7,"explanation":"독수리는 날개가 있으므로 날개가 있는 동물 모둠에 빠져 있습니다.","id":"7d1a86e8-0c01-45f6-b903-4b0f64ea0e14","options":[{"displayOrder":1,"id":"5ccf0fc5-f17b-4ba2-adb9-259efbd55f9a","isCorrect":false,"text":"토끼"},{"displayOrder":2,"id":"2b90b6c7-28c2-4857-b254-33bc7fca6939","isCorrect":false,"text":"거북"},{"displayOrder":3,"id":"1fd194e3-64c1-4b91-852d-29f531de5a10","isCorrect":true,"text":"독수리"},{"displayOrder":4,"id":"46304484-9de4-411a-bd66-b8dba7f29370","isCorrect":false,"text":"빠진 동물이 없습니다."}],"prompt":"전체 동물은 참새, 독수리, 토끼, 거북입니다. ''날개가 있는 동물'' 모둠에 참새만 있습니다. 빠진 동물은?","skillCode":"find-missing-classified-item","weight":1},{"displayOrder":8,"explanation":"파란 큰 공만 파란색과 큰 것이라는 두 조건을 모두 만족합니다.","id":"37ca26ac-35f9-43ed-8ef4-6db548cb1d1d","options":[{"displayOrder":1,"id":"69f6556a-8a97-499c-bbb8-33b72b598e0e","isCorrect":false,"text":"노란 큰 공"},{"displayOrder":2,"id":"92ac7578-e203-4dc9-b645-c7a4400b7e8c","isCorrect":false,"text":"노란 작은 공"},{"displayOrder":3,"id":"fba44793-b793-44a7-9fff-56cba55576e4","isCorrect":false,"text":"파란 작은 공"},{"displayOrder":4,"id":"077c9427-f3b6-4120-9ae0-e9067d7135dc","isCorrect":true,"text":"파란 큰 공"}],"prompt":"노란 큰 공, 노란 작은 공, 파란 큰 공, 파란 작은 공 중 ''파란색이면서 큰 것''은?","skillCode":"classify-by-two-properties","weight":1},{"displayOrder":9,"explanation":"1모둠은 식사할 때 쓰는 도구이고 2모둠은 공부할 때 쓰는 학용품입니다.","id":"2b412b75-12f3-4216-9fc7-51885d8acec2","options":[{"displayOrder":1,"id":"3128ed59-0638-4134-a22b-a094ca5a6806","isCorrect":true,"text":"식사 도구와 학용품"},{"displayOrder":2,"id":"a0f4fca9-51ea-4fd9-89bc-07f1fd7efce9","isCorrect":false,"text":"금속과 나무"},{"displayOrder":3,"id":"e1782207-63d1-41bf-b250-d72c068e49d1","isCorrect":false,"text":"긴 것과 짧은 것"},{"displayOrder":4,"id":"a698b6da-c041-403f-a710-a8c3f8061ea7","isCorrect":false,"text":"빨간 것과 파란 것"}],"prompt":"1모둠은 숟가락, 젓가락, 포크이고 2모둠은 연필, 지우개, 자입니다. 사용한 기준은?","skillCode":"infer-rule-from-groups","weight":1},{"displayOrder":10,"explanation":"18은 20보다 작지만 짝수이므로 두 조건을 모두 만족하지 않습니다.","id":"9a1f7d65-07f8-4439-9aa8-68ad6a33eb47","options":[{"displayOrder":1,"id":"45f5ceca-de95-40ac-94f9-f74b8567c6d2","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"d719cd8e-b4c4-491a-b7a9-c686af0d70e5","isCorrect":true,"text":"18"},{"displayOrder":3,"id":"a2af4115-1eb9-49fa-b7f0-0ec738898477","isCorrect":false,"text":"13"},{"displayOrder":4,"id":"fd107d8d-5e91-48fa-823f-1541bd7d52bc","isCorrect":false,"text":"잘못된 수가 없습니다."}],"prompt":"''20보다 작고 홀수인 수'' 모둠에 7, 13, 18이 들어 있습니다. 잘못 분류된 수는?","skillCode":"find-misclassified-item","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"f1059363-160e-47d7-957c-bddd315676a6","questions":[{"displayOrder":1,"explanation":"색깔과 관계없이 모양이 세모인 빨간 세모와 파란 세모가 함께 들어갑니다.","id":"9e5663ef-86e5-454a-94c7-aa3d0adcb554","options":[{"displayOrder":1,"id":"b2daa3af-1d54-4011-b146-427d756cc79d","isCorrect":true,"text":"빨간 세모와 파란 세모"},{"displayOrder":2,"id":"c113b111-0bef-47b3-82e0-cd144235b64e","isCorrect":false,"text":"빨간 세모와 빨간 네모"},{"displayOrder":3,"id":"761f3ebe-ebb3-45a8-8c18-09f37eb8f932","isCorrect":false,"text":"빨간 네모와 파란 세모"},{"displayOrder":4,"id":"a940ebd7-d4a1-4ebb-8b1f-818b01425f17","isCorrect":false,"text":"빨간 세모만"}],"prompt":"민지는 빨간 세모, 빨간 네모, 파란 세모를 ''세모/네모''로 나누었습니다. 세모 모둠에 들어갈 항목을 모두 고른 것은?","skillCode":"explain-classification-reasoning","weight":1},{"displayOrder":2,"explanation":"지우개는 쓴 글씨를 지우는 물건이므로 글씨를 쓰는 물건 모둠에서 옮겨야 합니다.","id":"1630075d-6852-4645-9141-104ba79af24e","options":[{"displayOrder":1,"id":"d0673441-fb43-41b2-a1b5-e3d290d17c3b","isCorrect":false,"text":"연필"},{"displayOrder":2,"id":"eefca122-e722-4772-a27b-2871ee5fca86","isCorrect":false,"text":"색연필"},{"displayOrder":3,"id":"d8e20ce7-5627-4e62-bd7d-e6af857d4c91","isCorrect":false,"text":"책상"},{"displayOrder":4,"id":"c129cfc2-6a3c-4c04-b2a7-bbe251ef8983","isCorrect":true,"text":"지우개"}],"prompt":"교실 물건을 ''글씨를 쓰는 데 쓰는 것/그 밖의 것''으로 나눕니다. 첫 모둠에 연필, 색연필, 지우개가 있습니다. 옮겨야 할 것은?","skillCode":"find-misclassified-item","weight":1},{"displayOrder":3,"explanation":"6과 12는 짝수이고 15와 21은 홀수이므로 짝수와 홀수 기준이 모든 카드에 맞습니다.","id":"95658c4b-c31b-4e3b-aa88-50f87198b062","options":[{"displayOrder":1,"id":"501bd87b-1cb6-4444-ae6a-caa87772a6a7","isCorrect":false,"text":"15보다 작은 수와 15 이상인 수"},{"displayOrder":2,"id":"e980eb7e-4b32-4919-aa52-b0c8b3bbb43c","isCorrect":true,"text":"짝수와 홀수"},{"displayOrder":3,"id":"82b2fc46-0c47-4cf9-be24-21fa06119e8d","isCorrect":false,"text":"한 자리 수와 두 자리 수"},{"displayOrder":4,"id":"752eac4e-fed5-47c9-a1d2-d39eaada9200","isCorrect":false,"text":"10보다 큰 수와 작은 수"}],"prompt":"숫자 카드 6, 12, 15, 21을 두 모둠으로 나누었습니다. 1모둠은 6, 12이고 2모둠은 15, 21입니다. 제시된 기준 중 알맞은 것은?","skillCode":"infer-rule-from-groups","weight":1},{"displayOrder":4,"explanation":"큰 단추의 수를 알려면 크기를 기준으로 큰 것과 작은 것을 먼저 나누는 것이 알맞습니다.","id":"cd3a0422-f38e-4968-9a61-15e0fadba95a","options":[{"displayOrder":1,"id":"cd72f643-b3a8-4dbc-b4b7-796ff08b4003","isCorrect":false,"text":"색깔"},{"displayOrder":2,"id":"d3e40d1a-3c26-4fb7-8e15-943106a13036","isCorrect":false,"text":"구멍 수"},{"displayOrder":3,"id":"60a305fc-8e52-40b5-a4f7-33316613710d","isCorrect":true,"text":"크기"},{"displayOrder":4,"id":"3f7a97f7-b4d9-4845-90cb-837b1e8ef508","isCorrect":false,"text":"재료"}],"prompt":"빨간 큰 단추, 빨간 작은 단추, 파란 큰 단추, 파란 작은 단추가 있습니다. ''큰 단추가 몇 개인지'' 알려면 가장 알맞은 첫 분류 기준은?","skillCode":"compare-classification-rules","weight":1},{"displayOrder":5,"explanation":"빨간 네모도 빨간색이므로 빨간색 모둠에 더 넣어야 합니다.","id":"ce19dbfb-683c-48f7-9026-5d0b5035c8ea","options":[{"displayOrder":1,"id":"f95b950e-29fd-4ce0-97d4-ddb4ea0b5418","isCorrect":false,"text":"파란 네모를 더 넣습니다."},{"displayOrder":2,"id":"71837364-5cf6-45cc-8e2e-572bf13ad5e5","isCorrect":false,"text":"파란 세모를 더 넣습니다."},{"displayOrder":3,"id":"3f4f5830-c183-4e52-a579-3081334e7913","isCorrect":true,"text":"빨간 네모를 더 넣습니다."},{"displayOrder":4,"id":"ea383ea3-2f7f-46be-8235-373d95a372c6","isCorrect":false,"text":"아무것도 더 넣지 않습니다."}],"prompt":"전체 카드는 빨간 세모, 빨간 네모, 파란 세모, 파란 네모입니다. ''빨간색인 것'' 모둠에는 빨간 세모만 있습니다. 분류를 완성하려면?","skillCode":"find-missing-classified-item","weight":1},{"displayOrder":6,"explanation":"24는 짝수이면서 20보다 크므로 두 조건과 이유를 모두 만족합니다.","id":"06516ce7-7865-4105-9777-c6f2fe054ce5","options":[{"displayOrder":1,"id":"411f6b56-da1c-4e07-af3e-d4bdb8ab0cfc","isCorrect":false,"text":"18, 짝수이기 때문입니다."},{"displayOrder":2,"id":"88a4127f-b00a-4ddb-a87f-1df901bc0285","isCorrect":false,"text":"21, 20보다 크기 때문입니다."},{"displayOrder":3,"id":"a8789164-b9f9-4410-b658-1b03ea620b3c","isCorrect":false,"text":"25, 홀수이기 때문입니다."},{"displayOrder":4,"id":"da06aa21-e01d-4b73-a450-e57493189251","isCorrect":true,"text":"24, 짝수이고 20보다 크기 때문입니다."}],"prompt":"''짝수이면서 20보다 큰 수''를 골랐습니다. 선택과 이유가 모두 알맞은 것은?","skillCode":"explain-classification-reasoning","weight":1},{"displayOrder":7,"explanation":"두 모둠은 색깔로 나누었으므로 먹을 수 있는지는 사용한 기준과 관계없습니다.","id":"a993ac7d-ae20-45c2-bd5b-c1007650b521","options":[{"displayOrder":1,"id":"b8883ecf-82b4-4ccf-8704-8b66ba54ed64","isCorrect":true,"text":"먹을 수 있는지"},{"displayOrder":2,"id":"fbc802d1-5737-4c8f-8691-ad5a43a477cb","isCorrect":false,"text":"물건의 색깔"},{"displayOrder":3,"id":"16e8a201-1ba5-46ed-a015-637623675f30","isCorrect":false,"text":"빨간색과 파란색"},{"displayOrder":4,"id":"40dd8a82-8c46-438b-a977-7f55fc87b17d","isCorrect":false,"text":"같은 색끼리 묶기"}],"prompt":"1모둠은 빨간 사과, 빨간 자동차, 빨간 모자이고 2모둠은 파란 공, 파란 연필, 파란 컵입니다. 사용한 기준과 관계없는 특징은?","skillCode":"explain-classification-reasoning","weight":1},{"displayOrder":8,"explanation":"오리와 참새는 날개가 있고 고양이와 토끼는 날개가 없습니다.","id":"06427732-d3b5-4474-8488-604fc93a28f1","options":[{"displayOrder":1,"id":"e807ebb6-2b6e-470b-b04b-229c6288d072","isCorrect":false,"text":"날개 있음: 오리, 고양이 / 날개 없음: 참새, 토끼"},{"displayOrder":2,"id":"0f0108df-bba5-41a3-a909-fb11f51d448e","isCorrect":true,"text":"날개 있음: 오리, 참새 / 날개 없음: 고양이, 토끼"},{"displayOrder":3,"id":"74d1b05e-f85a-42e8-ab03-4ae46c358cd5","isCorrect":false,"text":"날개 있음: 고양이, 토끼 / 날개 없음: 오리, 참새"},{"displayOrder":4,"id":"e5435d71-9e1b-492f-b245-92b665acc60b","isCorrect":false,"text":"날개 있음: 참새, 토끼 / 날개 없음: 오리, 고양이"}],"prompt":"동물 카드가 오리, 참새, 고양이, 토끼입니다. ''날개가 있음/날개가 없음''으로 나눈 결과로 알맞은 것은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":9,"explanation":"파란 작은 상자는 빨간색도 아니고 큰 것도 아니므로 두 조건 중 어느 것도 만족하지 않습니다.","id":"10656aa7-f917-48d5-8148-6967121755c3","options":[{"displayOrder":1,"id":"9cddaff6-b0dd-49c8-b005-158dc3e0b8f7","isCorrect":false,"text":"빨간 큰 상자"},{"displayOrder":2,"id":"e906c480-a5b6-414c-9473-85575c4245a3","isCorrect":false,"text":"빨간 작은 상자"},{"displayOrder":3,"id":"42e46a6f-b4d1-4b14-b6d7-248e938584e2","isCorrect":true,"text":"파란 작은 상자"},{"displayOrder":4,"id":"f54d3a34-097d-4d83-8b8c-eb680ef1a4d5","isCorrect":false,"text":"파란 큰 상자"}],"prompt":"빨간 큰 상자, 빨간 작은 상자, 파란 큰 상자, 파란 작은 상자 중 ''빨간색이거나 큰 것''에 해당하지 않는 것은?","skillCode":"classify-by-two-properties","weight":1},{"displayOrder":10,"explanation":"학급 물건은 쓰임이 같은 것끼리 나누면 필요한 물건을 빠르게 찾을 수 있습니다.","id":"c970faec-edd8-4fe7-b451-65398b5321ba","options":[{"displayOrder":1,"id":"c1f7cd49-a1cd-41c4-a7ad-5ed7299e22ed","isCorrect":false,"text":"모든 물건을 한 상자에 넣으면 가장 빨리 찾습니다."},{"displayOrder":2,"id":"284c90fd-a9c9-47cd-ba4d-c0f8f909afa8","isCorrect":false,"text":"색깔만 보고 연필과 공책을 섞으면 쓰임을 알기 쉽습니다."},{"displayOrder":3,"id":"d68862f4-eb25-402b-b883-c2ccd1068101","isCorrect":false,"text":"크기가 비슷하면 쓰임과 관계없이 함께 둡니다."},{"displayOrder":4,"id":"028abab6-1a78-4887-8e37-0df9cd53b83d","isCorrect":true,"text":"연필류, 공책류처럼 쓰임이 같은 것끼리 두면 필요한 물건을 찾기 쉽습니다."}],"prompt":"학급 물건을 찾기 쉽게 정리하려고 합니다. 가장 알맞은 분류와 이유는?","skillCode":"explain-classification-reasoning","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":5,"id":"0a730ea3-c789-4933-8673-c4869b2a2d20","slug":"grade2-classification","title":"기준에 따라 분류해요"},"version":{"id":"bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d","label":"v1","number":1}}'::jsonb as document
), expected_stages as (
  select
    stage->>'id' as id,
    (stage->>'displayOrder')::integer as display_order,
    stage->>'title' as display_title,
    stage->>'difficulty' as difficulty,
    stage->'questions' as questions
  from expected_content,
       jsonb_array_elements(document->'stages') stage
), expected_questions as (
  select
    question->>'id' as id,
    stage.id as stage_id,
    (question->>'displayOrder')::integer as display_order,
    question->>'prompt' as prompt,
    question->>'explanation' as explanation,
    (question->>'weight')::integer as weight,
    question->'options' as options
  from expected_stages stage,
       jsonb_array_elements(stage.questions) question
), expected_options as (
  select
    option->>'id' as id,
    question.id as question_id,
    (option->>'displayOrder')::integer as display_order,
    option->>'text' as option_text,
    (option->>'isCorrect')::boolean as is_correct
  from expected_questions question,
       jsonb_array_elements(question.options) option
), actual_stages as (
  select id::text, display_order, display_title, difficulty
  from public.learning_stages
  where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
), expected_skill_mappings as (
  select question->>'id' as question_id, question->>'skillCode' as skill_code
  from expected_stages stage,
       jsonb_array_elements(stage.questions) question
  where question ? 'skillCode'
), actual_skill_mappings as (
  select mapping.question_id::text as question_id, mapping.skill_code
  from public.learning_question_skills mapping
  join public.learning_questions question on question.id = mapping.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_classification_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_classification_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 6

  union all
  select 3, 'grade2_classification_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '419cef16bc5930431a2ebe77191a20852bc16cf775bc9725706c34deec6e1e3a'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_classification_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_classification_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_classification_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_classification_v1_structure_and_orders',
    count(*) = 40
      and bool_and(option_count = 4 and correct_count = 1
                   and min_option_order = 1 and max_option_order = 4),
    jsonb_build_object('questions', count(*))
  from (
    select question.id,
      count(option.*) as option_count,
      count(*) filter (where option.is_correct) as correct_count,
      min(option.display_order) as min_option_order,
      max(option.display_order) as max_option_order
    from public.learning_questions question
    join public.learning_stages stage on stage.id = question.stage_id
    join public.learning_question_options option on option.question_id = question.id
    where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_classification_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_classification_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid))

  union all
  select 10, 'learning_content_not_in_realtime_publication', count(*) = 0,
    jsonb_build_object('published_tables', count(*))
  from pg_catalog.pg_publication_tables publication
  where publication.pubname = 'supabase_realtime'
    and publication.schemaname = 'public'
    and publication.tablename in ('learning_courses','learning_units','learning_content_versions','learning_stages','learning_questions','learning_question_options')

  union all
  select 11, 'learning_engine_prerequisites_preserved',
    to_regclass('public.learning_assignments') is not null
      and to_regclass('public.learning_attempts') is not null
      and to_regclass('public.learning_stage_first_passes') is not null
      and to_regprocedure('public.publish_learning_content_version(uuid)') is not null
      and to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)') is not null
      and to_regprocedure('public.finalize_learning_stage_attempt(uuid,uuid,uuid)') is not null,
    jsonb_build_object('preserved', true)

  union all
  select 20, 'learning_recommendation_metadata_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_unit_recommendation_metadata metadata
  where metadata.unit_id = '0a730ea3-c789-4933-8673-c4869b2a2d20'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 5

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = '0a730ea3-c789-4933-8673-c4869b2a2d20'::uuid
    order by version.unit_id, version.version_no desc
  ) latest_version

  union all
  select 22, 'learning_recommendation_profile_classification',
    count(*) filter (
      where profile.level_code = metadata.recommended_start_level_code
        and (metadata.recommended_end_level_code is null or profile.level_code = metadata.recommended_end_level_code)
    ) = 1
      and count(*) filter (
        where profile.level_code = 'ready'
          and profile.level_code = metadata.recommended_start_level_code
          and (metadata.recommended_end_level_code is null or profile.level_code = metadata.recommended_end_level_code)
      ) = 0,
    jsonb_build_object('matching_level', 'elementary_2', 'non_matching_level', 'ready')
  from public.learning_unit_recommendation_metadata metadata
  cross join (values ('elementary_2'), ('ready')) profile(level_code)
  where metadata.unit_id = '0a730ea3-c789-4933-8673-c4869b2a2d20'::uuid

  union all
  select 23, 'grade2_classification_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_classification_v1_pass_threshold_contract',
    (select bool_and(question_count = 10 and total_weight = 10) from (
      select count(*) as question_count, sum(expected.weight) as total_weight
      from expected_questions expected
      group by expected.stage_id
    ) stage_contract) is true
      and ceil(10 * 8 / 10.0)::integer = 8
      and 7 < ceil(10 * 8 / 10.0)::integer
      and pg_get_functiondef(to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)')) ~* 'ceil\(question_count \* 8 / 10\.0\)',
    jsonb_build_object('questions_per_stage', 10, 'weight_per_stage', 10, 'required_correct_answers', 8)

  union all
  select 25, 'grade2_classification_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_classification_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = 'bf3dd0af-3cff-4d29-bdd3-f12e2ef08d9d'::uuid

  union all
  select 27, 'grade2_classification_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_classification_v1_course_unit_sort_orders_unique',
    count(*) = 0,
    jsonb_build_object('duplicate_orders', count(*))
  from (
    select unit.course_id, unit.sort_order
    from public.learning_units unit
    where unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    group by unit.course_id, unit.sort_order
    having count(*) > 1
  ) duplicate_order

  union all
  select 29, 'grade2_classification_v1_question_skills_exact',
    (select count(*) from actual_skill_mappings) = 40
      and not exists (
        (select question_id, skill_code from expected_skill_mappings)
        except
        (select question_id, skill_code from actual_skill_mappings)
      )
      and not exists (
        (select question_id, skill_code from actual_skill_mappings)
        except
        (select question_id, skill_code from expected_skill_mappings)
      ),
    jsonb_build_object('count', (select count(*) from actual_skill_mappings))
)
select check_order, check_name, passed, result_data
from checks
union all
select 999, 'grade2_classification_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
