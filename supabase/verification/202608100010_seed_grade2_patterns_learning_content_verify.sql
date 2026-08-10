-- Phase 2B grade2-patterns v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":12,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"53dd9e8a-c8a3-4eb6-9d29-f7f4da198ee7","questions":[{"displayOrder":1,"explanation":"앞 수에 3씩 더하므로 11+3=14입니다.","id":"bcf7c4ce-c209-4963-b937-bf95cba1991e","options":[{"displayOrder":1,"id":"ed929f1c-817c-455f-b3ac-dff4274b815f","isCorrect":true,"text":"14"},{"displayOrder":2,"id":"b8767360-9a8f-47b5-b395-8b6d8df8a676","isCorrect":false,"text":"15"},{"displayOrder":3,"id":"6e7306ab-15a7-4e62-8c20-1ac7354d4bb4","isCorrect":false,"text":"13"},{"displayOrder":4,"id":"65be7336-0276-4202-bb8a-f574d29e46a9","isCorrect":false,"text":"24"}],"prompt":"2, 5, 8, 11, □의 규칙에서 다음 수는?","skillCode":"continue-increasing-pattern","weight":1},{"displayOrder":2,"explanation":"앞 수에 2씩 더하므로 11+2=13입니다.","id":"809ed509-13ba-4bb1-abec-e802d78e931b","options":[{"displayOrder":1,"id":"bbc9d5f5-8d97-49a3-8b96-cf0787d72d1c","isCorrect":false,"text":"14"},{"displayOrder":2,"id":"e41135fc-7f6d-411a-af97-7fff4056af67","isCorrect":true,"text":"13"},{"displayOrder":3,"id":"d6c1ea5b-1701-4262-863e-bcd4fb872f25","isCorrect":false,"text":"12"},{"displayOrder":4,"id":"1154fea4-1204-4228-93e9-5452c45a6305","isCorrect":false,"text":"23"}],"prompt":"5, 7, 9, 11, □의 규칙에서 다음 수는?","skillCode":"continue-increasing-pattern","weight":1},{"displayOrder":3,"explanation":"앞 수에 5씩 더하므로 25+5=30입니다.","id":"fe57f48c-94f0-4616-9f7e-989f1004d0ca","options":[{"displayOrder":1,"id":"4ffeca28-888c-4282-a7a3-6cd66b3beeb7","isCorrect":false,"text":"31"},{"displayOrder":2,"id":"74e4a2fa-c37b-4a27-8c57-60134e1926df","isCorrect":false,"text":"29"},{"displayOrder":3,"id":"0c815712-2578-4e3e-b3fb-68f66f85d56c","isCorrect":true,"text":"30"},{"displayOrder":4,"id":"5a0c0672-d2da-4643-b2ae-a6c85f07e779","isCorrect":false,"text":"40"}],"prompt":"10, 15, 20, 25, □의 규칙에서 다음 수는?","skillCode":"continue-increasing-pattern","weight":1},{"displayOrder":4,"explanation":"앞 수에 4씩 더하므로 16+4=20입니다.","id":"3f266b2a-e293-4c35-9a2f-9b50a16b145c","options":[{"displayOrder":1,"id":"9142fd35-7731-4157-8803-7c0571e06bfb","isCorrect":false,"text":"21"},{"displayOrder":2,"id":"48dad00f-1758-4f29-b570-c4fb7037a21d","isCorrect":false,"text":"19"},{"displayOrder":3,"id":"19b83544-1e82-4105-a0c6-787ce65b689c","isCorrect":false,"text":"30"},{"displayOrder":4,"id":"0e511397-4b94-4d4e-b197-456c3fecf309","isCorrect":true,"text":"20"}],"prompt":"4, 8, 12, 16, □의 규칙에서 다음 수는?","skillCode":"continue-increasing-pattern","weight":1},{"displayOrder":5,"explanation":"앞 수에 3씩 더하므로 16+3=19입니다.","id":"ac1d89a9-0ed5-4a8e-a763-cc4019dea98a","options":[{"displayOrder":1,"id":"4f58ab25-e1d5-4ef2-9037-4daa4ad2bbe0","isCorrect":true,"text":"19"},{"displayOrder":2,"id":"fe18a0bd-eb38-4279-8b87-4183fb1e7db1","isCorrect":false,"text":"20"},{"displayOrder":3,"id":"bcd0a1fe-3f64-46ab-8ac9-8a368848014d","isCorrect":false,"text":"18"},{"displayOrder":4,"id":"d2a7c420-6e4e-4038-acde-2dad001978c5","isCorrect":false,"text":"29"}],"prompt":"7, 10, 13, 16, □의 규칙에서 다음 수는?","skillCode":"continue-increasing-pattern","weight":1},{"displayOrder":6,"explanation":"앞 수에서 2씩 빼므로 14-2=12입니다.","id":"dd858357-d6e2-4b29-8a42-e99e360f785e","options":[{"displayOrder":1,"id":"74c991c0-4a6e-4879-80f3-7a0291186b59","isCorrect":false,"text":"13"},{"displayOrder":2,"id":"40f617ad-041d-4f6f-b0d5-d88c1f3db536","isCorrect":true,"text":"12"},{"displayOrder":3,"id":"8b83ea28-eed5-4e9c-9b55-8b1f16572241","isCorrect":false,"text":"11"},{"displayOrder":4,"id":"c528f0f7-0e5e-4c5e-a982-655081de85f2","isCorrect":false,"text":"22"}],"prompt":"20, 18, 16, 14, □의 규칙에서 다음 수는?","skillCode":"continue-decreasing-pattern","weight":1},{"displayOrder":7,"explanation":"앞 수에서 5씩 빼므로 20-5=15입니다.","id":"113af70b-9a1d-48c6-981b-f37673e3de6f","options":[{"displayOrder":1,"id":"5cd22757-7be7-4a07-be91-7a97427c6a20","isCorrect":true,"text":"15"},{"displayOrder":2,"id":"f7eee891-412b-4179-8859-12cb5d987ae8","isCorrect":false,"text":"16"},{"displayOrder":3,"id":"dc3e8909-b505-43f4-a06e-5398c099abe1","isCorrect":false,"text":"14"},{"displayOrder":4,"id":"fd364d82-2a82-46c8-9365-00ba93cd9b4a","isCorrect":false,"text":"25"}],"prompt":"35, 30, 25, 20, □의 규칙에서 다음 수는?","skillCode":"continue-decreasing-pattern","weight":1},{"displayOrder":8,"explanation":"앞 수에서 3씩 빼므로 9-3=6입니다.","id":"0e62a840-9dc6-4b3b-bda7-2cbe6ef7ec1d","options":[{"displayOrder":1,"id":"9e5fc67b-f672-4e3a-a75c-f87fdb528710","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"a9b92687-0fa0-435e-8bbb-abc0f0433af3","isCorrect":true,"text":"6"},{"displayOrder":3,"id":"3dc6b87e-5a07-4c71-a25a-a79c4c16f967","isCorrect":false,"text":"5"},{"displayOrder":4,"id":"123d98d0-d948-4f2c-be5c-cccc5cdcb487","isCorrect":false,"text":"16"}],"prompt":"18, 15, 12, 9, □의 규칙에서 다음 수는?","skillCode":"continue-decreasing-pattern","weight":1},{"displayOrder":9,"explanation":"앞 수에서 4씩 빼므로 28-4=24입니다.","id":"a525d3e0-0e4c-4606-9da3-9a337eff9f0e","options":[{"displayOrder":1,"id":"45006352-5e08-4b90-9614-e9ebb649af59","isCorrect":false,"text":"25"},{"displayOrder":2,"id":"072e8043-5b96-4bd6-a85d-a0094364a72d","isCorrect":false,"text":"23"},{"displayOrder":3,"id":"1ddbfe14-1fba-40de-8d52-fb5500b1751a","isCorrect":true,"text":"24"},{"displayOrder":4,"id":"90f7faf3-623b-4b95-8960-c227e4f746fa","isCorrect":false,"text":"34"}],"prompt":"40, 36, 32, 28, □의 규칙에서 다음 수는?","skillCode":"continue-decreasing-pattern","weight":1},{"displayOrder":10,"explanation":"앞 수에서 3씩 빼므로 18-3=15입니다.","id":"a19d31a7-d747-4281-b995-48816cd10edf","options":[{"displayOrder":1,"id":"243d7e29-43d0-4f0f-981d-a2da1e999125","isCorrect":false,"text":"16"},{"displayOrder":2,"id":"71f75633-a0b1-48c5-b24f-87c51f6e36e9","isCorrect":false,"text":"14"},{"displayOrder":3,"id":"706fe0ac-bbb4-47cf-baae-4d471e58681d","isCorrect":false,"text":"25"},{"displayOrder":4,"id":"f1af7789-a4c7-4448-af88-f3d8862cd4ef","isCorrect":true,"text":"15"}],"prompt":"27, 24, 21, 18, □의 규칙에서 다음 수는?","skillCode":"continue-decreasing-pattern","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"062ebd95-5c1e-4acb-b955-7d35c9f06546","questions":[{"displayOrder":1,"explanation":"○ △가 반복되므로 다음에는 △이 옵니다.","id":"e00583d7-92a4-4d16-9481-6a4a4dc80b4e","options":[{"displayOrder":1,"id":"96f57080-43e9-48a5-b54a-d00ae172a29a","isCorrect":true,"text":"△"},{"displayOrder":2,"id":"809fe7f3-ecc4-4121-8a7e-77c8632f3e2b","isCorrect":false,"text":"○"},{"displayOrder":3,"id":"462ddb94-7afa-4da1-b19e-1ffe9864cce3","isCorrect":false,"text":"★"},{"displayOrder":4,"id":"c319152c-0f41-4787-80ea-75365c9df4ea","isCorrect":false,"text":"가"}],"prompt":"○ △ ○ △ ○ △ ○ 다음에 올 것은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":2,"explanation":"★ ★ □가 반복되므로 다음에는 ★이 옵니다.","id":"cc9cf0b9-8f42-43ae-af8e-2c8a7488fa28","options":[{"displayOrder":1,"id":"f84d3773-b307-4857-9ef7-bc5f7781e35a","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"a77dde54-d598-4e19-8ca1-d29900e902d2","isCorrect":true,"text":"★"},{"displayOrder":3,"id":"937bdcd8-4619-4c27-8124-65fdcf88e50d","isCorrect":false,"text":"가"},{"displayOrder":4,"id":"a7369f45-4b11-4b6d-a517-9ba4dbfb9299","isCorrect":false,"text":"빨강"}],"prompt":"★ ★ □ ★ ★ □ ★ 다음에 올 것은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":3,"explanation":"가 나 다가 반복되므로 다음에는 나이 옵니다.","id":"a0520efc-890b-45ab-94e6-082e1fa467b0","options":[{"displayOrder":1,"id":"919b6735-55cd-4f44-a3a6-708c4177f900","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"f11eef13-e85f-444e-ac6f-3a07b0abeea2","isCorrect":false,"text":"★"},{"displayOrder":3,"id":"d59a6196-3bd3-493d-b2c4-5b01fe964e9b","isCorrect":true,"text":"나"},{"displayOrder":4,"id":"8b3a42ee-e3ba-4fee-be1c-b2a508d05f03","isCorrect":false,"text":"가"}],"prompt":"가 나 다 가 나 다 가 다음에 올 것은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":4,"explanation":"빨강 파랑가 반복되므로 다음에는 파랑이 옵니다.","id":"b549f1c2-8c93-43ba-9e8f-aeffed4348b7","options":[{"displayOrder":1,"id":"f39cc1d9-35b7-401b-96ae-1ebf68f8dc57","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"98def6b1-dd30-47b8-9b89-c5c1c0bc2a0f","isCorrect":false,"text":"★"},{"displayOrder":3,"id":"3cfae5bd-e7dc-481e-8e1d-ce1724dfc158","isCorrect":false,"text":"가"},{"displayOrder":4,"id":"00fe64b4-70c1-441e-9946-dfb98ea8f892","isCorrect":true,"text":"파랑"}],"prompt":"빨강 파랑 빨강 파랑 빨강 파랑 빨강 다음에 올 것은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":5,"explanation":"1 2 2가 반복되므로 다음에는 2이 옵니다.","id":"01971220-8c4d-47c9-9065-6f78b331b8ae","options":[{"displayOrder":1,"id":"2f82704c-6326-4c6f-a027-74c957d9073a","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"8945a971-2b76-4b0b-af2a-5afd5ef043e2","isCorrect":false,"text":"★"},{"displayOrder":3,"id":"96beb75a-7d42-41f9-ba2d-ecaa42e68518","isCorrect":true,"text":"2"},{"displayOrder":4,"id":"372c8c20-be3a-4ee7-bf01-4d2e15c8b3dc","isCorrect":false,"text":"가"}],"prompt":"1 2 2 1 2 2 1 다음에 올 것은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":6,"explanation":"4씩 커지는 규칙이므로 7+4=11입니다.","id":"3e774a40-b0d8-4fd7-9211-ea81885af772","options":[{"displayOrder":1,"id":"e73856bd-a6b6-4e4e-a98a-b925617bf90a","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"b47f3645-f015-4327-ab0b-22ca8d3ad20c","isCorrect":false,"text":"15"},{"displayOrder":3,"id":"1af6bc76-7a45-4207-a474-0b6129fcce89","isCorrect":false,"text":"12"},{"displayOrder":4,"id":"52f647c1-1c78-4aca-96cf-526bd32d95d6","isCorrect":true,"text":"11"}],"prompt":"3, 7, □, 15에서 빈칸은?","skillCode":"infer-missing-pattern-item","weight":1},{"displayOrder":7,"explanation":"3씩 커지는 규칙이므로 9+3=12입니다.","id":"f9523add-9dae-4883-bbc8-eaf5886495d2","options":[{"displayOrder":1,"id":"1a421ec5-d4c6-4aa8-8a3b-5952e27d5949","isCorrect":true,"text":"12"},{"displayOrder":2,"id":"e07ea952-7bf4-4d38-9060-a53d50549643","isCorrect":false,"text":"9"},{"displayOrder":3,"id":"430fcd27-325b-4384-8d84-5b4a21026499","isCorrect":false,"text":"15"},{"displayOrder":4,"id":"b951c5d5-98ae-4e3b-91f5-b42317b001d2","isCorrect":false,"text":"13"}],"prompt":"6, 9, □, 15에서 빈칸은?","skillCode":"infer-missing-pattern-item","weight":1},{"displayOrder":8,"explanation":"5씩 커지는 규칙이므로 7+5=12입니다.","id":"5eed51d1-7d25-4f1f-a013-4ef29ad4fa23","options":[{"displayOrder":1,"id":"e76914e5-155b-4812-ab6f-7be88f1a6e81","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"cdb2ef54-29d1-467a-8789-e2443a95abc5","isCorrect":true,"text":"12"},{"displayOrder":3,"id":"aca7fb54-bfdf-4eba-bb8f-871bff0188a0","isCorrect":false,"text":"17"},{"displayOrder":4,"id":"ab7bc50d-cebe-46f7-93f9-eae9fa4349b0","isCorrect":false,"text":"13"}],"prompt":"2, 7, □, 17에서 빈칸은?","skillCode":"infer-missing-pattern-item","weight":1},{"displayOrder":9,"explanation":"2씩 커지는 규칙이므로 12+2=14입니다.","id":"48661048-edc6-4450-86e0-42f77e0a8ff2","options":[{"displayOrder":1,"id":"4e333c44-a4a0-408b-b990-a975408b7510","isCorrect":false,"text":"12"},{"displayOrder":2,"id":"f49d983d-63da-480d-b329-f535f0fa6e2b","isCorrect":false,"text":"16"},{"displayOrder":3,"id":"bd6f80a6-5548-4d90-b14f-9227c41180a6","isCorrect":true,"text":"14"},{"displayOrder":4,"id":"62c2c138-248c-410f-97c6-03f4cf4530bf","isCorrect":false,"text":"15"}],"prompt":"10, 12, □, 16에서 빈칸은?","skillCode":"infer-missing-pattern-item","weight":1},{"displayOrder":10,"explanation":"6씩 커지는 규칙이므로 7+6=13입니다.","id":"1db982b5-1b04-4381-9d0a-bf5bccc2fdaa","options":[{"displayOrder":1,"id":"2ee96a33-f568-475f-ad7e-158465784d0e","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"9ebb63b0-3ce5-44d7-a017-a1ced050b3b0","isCorrect":false,"text":"19"},{"displayOrder":3,"id":"1e0441ea-83b6-464d-bcc9-7e9eb32c591d","isCorrect":false,"text":"14"},{"displayOrder":4,"id":"a1996851-c713-42a9-8a31-519a470212ad","isCorrect":true,"text":"13"}],"prompt":"1, 7, □, 19에서 빈칸은?","skillCode":"infer-missing-pattern-item","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"b856efa8-64e7-4b4b-a14e-adb108e2c7e8","questions":[{"displayOrder":1,"explanation":"7에서 2를 더할 차례이므로 9입니다.","id":"5bdf19a0-203c-4f84-916e-8dc636252619","options":[{"displayOrder":1,"id":"ee5ac20d-b743-4071-aa04-4452510eced9","isCorrect":true,"text":"9"},{"displayOrder":2,"id":"6de1c3b1-cdb2-46df-9742-6230878f6e0d","isCorrect":false,"text":"10"},{"displayOrder":3,"id":"c43b9d61-dc10-4653-9cee-feb36b774f22","isCorrect":false,"text":"8"},{"displayOrder":4,"id":"b2d6c77c-02bf-4e44-aa00-a6bea43ddedb","isCorrect":false,"text":"19"}],"prompt":"1, 3, 4, 6, 7, □는 “2 더하기, 1 더하기”를 반복합니다. 다음 수는?","skillCode":"extend-two-step-pattern","weight":1},{"displayOrder":2,"explanation":"12에서 3를 더할 차례이므로 15입니다.","id":"0c969d53-c49e-4273-9959-b897721528cd","options":[{"displayOrder":1,"id":"2d4d4cdf-69cd-41d3-9518-dfc0760c178f","isCorrect":false,"text":"16"},{"displayOrder":2,"id":"6299157b-6cab-4c1a-83fb-2a8264fac620","isCorrect":true,"text":"15"},{"displayOrder":3,"id":"121f05af-33b3-4349-8cf9-2aa1c01596de","isCorrect":false,"text":"14"},{"displayOrder":4,"id":"f1788c37-23db-4ad9-aa9e-007549fbeb5a","isCorrect":false,"text":"25"}],"prompt":"4, 7, 8, 11, 12, □는 “3 더하기, 1 더하기”를 반복합니다. 다음 수는?","skillCode":"extend-two-step-pattern","weight":1},{"displayOrder":3,"explanation":"12에서 4를 더할 차례이므로 16입니다.","id":"9690eb97-df1c-4939-92da-53a784b436e0","options":[{"displayOrder":1,"id":"db265fcf-0c35-4f04-9b84-0cda00f99667","isCorrect":false,"text":"17"},{"displayOrder":2,"id":"f7109bec-5637-423b-8c36-1984c9413ea5","isCorrect":false,"text":"15"},{"displayOrder":3,"id":"077a2eea-7757-48a4-8e03-f9eb6911101d","isCorrect":true,"text":"16"},{"displayOrder":4,"id":"c1ad0306-736d-4d55-8a28-b9570cedc06a","isCorrect":false,"text":"26"}],"prompt":"2, 6, 7, 11, 12, □는 “4 더하기, 1 더하기”를 반복합니다. 다음 수는?","skillCode":"extend-two-step-pattern","weight":1},{"displayOrder":4,"explanation":"11에서 2를 더할 차례이므로 13입니다.","id":"282b93cb-0c1e-41bc-b480-1c2902973f3b","options":[{"displayOrder":1,"id":"89e62dfd-b1c3-4d32-9b60-a15dc3eddcfc","isCorrect":false,"text":"14"},{"displayOrder":2,"id":"c932e8a1-b069-4448-9939-70088ad02695","isCorrect":false,"text":"12"},{"displayOrder":3,"id":"a0b61660-1678-4aa1-bce7-9bfa683c2048","isCorrect":false,"text":"23"},{"displayOrder":4,"id":"35698092-98eb-4e15-b582-3b8c87b62d47","isCorrect":true,"text":"13"}],"prompt":"5, 7, 8, 10, 11, □는 “2 더하기, 1 더하기”를 반복합니다. 다음 수는?","skillCode":"extend-two-step-pattern","weight":1},{"displayOrder":5,"explanation":"이웃한 두 수의 차가 항상 4이므로 4씩 커집니다.","id":"cade81f5-6b84-4aa9-9958-3cf3e68fc959","options":[{"displayOrder":1,"id":"9cbaf749-dd01-4ff9-a197-a3a7e2098290","isCorrect":true,"text":"4씩 커집니다."},{"displayOrder":2,"id":"fddc1fb7-59d3-4016-bb78-b33ec8dac813","isCorrect":false,"text":"5씩 커집니다."},{"displayOrder":3,"id":"4adba03d-7c1a-4b63-9d62-12ebb59ab6f3","isCorrect":false,"text":"항상 같은 수입니다."},{"displayOrder":4,"id":"30750439-26af-407e-b5f8-c8002ff460a2","isCorrect":false,"text":"4씩 작아집니다."}],"prompt":"5, 9, 13, 17의 규칙을 바르게 설명한 것은?","skillCode":"explain-pattern-rule","weight":1},{"displayOrder":6,"explanation":"이웃한 두 수의 차가 항상 3이므로 3씩 작아집니다.","id":"1bef81e3-d76c-4694-b152-9fa39436ba7b","options":[{"displayOrder":1,"id":"7a412fb6-07f6-4904-8725-2dea133d2a73","isCorrect":false,"text":"4씩 작아집니다."},{"displayOrder":2,"id":"9d463e36-3304-4c4e-8fd9-1c670db585f2","isCorrect":true,"text":"3씩 작아집니다."},{"displayOrder":3,"id":"bbed6924-2988-4649-aadd-72ea23961947","isCorrect":false,"text":"항상 같은 수입니다."},{"displayOrder":4,"id":"f186abed-228d-44ef-be85-f816c0a6fb8d","isCorrect":false,"text":"3씩 커집니다."}],"prompt":"30, 27, 24, 21의 규칙을 바르게 설명한 것은?","skillCode":"explain-pattern-rule","weight":1},{"displayOrder":7,"explanation":"이웃한 두 수의 차가 항상 6이므로 6씩 커집니다.","id":"caa2e723-2c14-443e-aeba-eb6f8e0fa1bd","options":[{"displayOrder":1,"id":"0a52ae23-487c-4dc1-b28d-b8634a93bfb8","isCorrect":true,"text":"6씩 커집니다."},{"displayOrder":2,"id":"06976c77-1cca-435e-b777-83844add29ff","isCorrect":false,"text":"7씩 커집니다."},{"displayOrder":3,"id":"36d891d2-50f4-45b6-97a5-d3d383171209","isCorrect":false,"text":"항상 같은 수입니다."},{"displayOrder":4,"id":"24517f38-73aa-4af5-a8c3-e2a1bd016403","isCorrect":false,"text":"6씩 작아집니다."}],"prompt":"2, 8, 14, 20의 규칙을 바르게 설명한 것은?","skillCode":"explain-pattern-rule","weight":1},{"displayOrder":8,"explanation":"반복 길이는 3이고 11번째는 주기의 2번째이므로 △입니다.","id":"1e5cfa88-0627-41ed-a278-817e3d16327a","options":[{"displayOrder":1,"id":"38e4aebe-9264-4e93-93a2-aa9d155060be","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"82e9bbea-f7fc-4883-b40b-d6a76c934157","isCorrect":true,"text":"△"},{"displayOrder":3,"id":"159369c1-1ba8-4370-ad27-6620048ea36d","isCorrect":false,"text":"★"},{"displayOrder":4,"id":"28517169-268e-4701-9de5-8a9a61db54eb","isCorrect":false,"text":"가"}],"prompt":"○ △ □가 반복됩니다. 11번째 항목은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":9,"explanation":"반복 길이는 2이고 11번째는 주기의 1번째이므로 ★입니다.","id":"f1af6863-e3f4-4ebb-ad92-f379b92a4af9","options":[{"displayOrder":1,"id":"fc5507ed-a4e8-4544-bfb4-43b603869e20","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"b14b9337-5954-4ba9-901f-9ec632d10b48","isCorrect":false,"text":"가"},{"displayOrder":3,"id":"8bf4f0c2-816c-4944-a0e5-0975703f8132","isCorrect":true,"text":"★"},{"displayOrder":4,"id":"b6e425d9-ed9b-4b6b-931a-599444fb34af","isCorrect":false,"text":"빨강"}],"prompt":"★ □가 반복됩니다. 11번째 항목은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":10,"explanation":"반복 길이는 3이고 11번째는 주기의 2번째이므로 나입니다.","id":"342f3c51-d41e-4b85-86d6-e5a1f8226bc0","options":[{"displayOrder":1,"id":"83c7b46f-217a-4db1-bc2a-a55f0db2261c","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"17db41ea-f1aa-4d04-a377-dd8b62246d01","isCorrect":false,"text":"★"},{"displayOrder":3,"id":"448a32ce-3d50-4891-9807-8bb2931cc3f4","isCorrect":false,"text":"가"},{"displayOrder":4,"id":"f42dc781-5f72-47a3-8fdf-fec9dc1be284","isCorrect":true,"text":"나"}],"prompt":"가 나 나가 반복됩니다. 11번째 항목은?","skillCode":"identify-repeating-cycle","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"1a70471b-9e62-4fc9-9c8f-8f13fa0be476","questions":[{"displayOrder":1,"explanation":"3씩 커지는 규칙이면 3, 6, 9, 12이므로 13이 잘못되었습니다.","id":"39f5d8d4-5efa-49f7-a9cf-146d441a196b","options":[{"displayOrder":1,"id":"31e60f8f-3ae9-4a98-83b8-b3faee308829","isCorrect":true,"text":"13"},{"displayOrder":2,"id":"8426a33e-05a8-4615-9b23-61325ec40793","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"9e04bb0f-db6c-452f-a04b-f7a7df3ec979","isCorrect":false,"text":"6"},{"displayOrder":4,"id":"38bf6246-5bac-407f-b7b4-69636319805f","isCorrect":false,"text":"9"}],"prompt":"3, 6, 9, 13에서 규칙에 맞지 않는 수는?","skillCode":"correct-pattern-reasoning","weight":1},{"displayOrder":2,"explanation":"4씩 작아지는 규칙이므로 12 다음은 8입니다.","id":"90c733ff-7cec-4ef2-b341-6773e956549c","options":[{"displayOrder":1,"id":"a1a056cb-6f51-41f1-b368-3745261137f7","isCorrect":false,"text":"20, 17, 14, 11"},{"displayOrder":2,"id":"21002500-ef26-4200-bbcf-00cdf5571ce3","isCorrect":true,"text":"20, 16, 12, 8"},{"displayOrder":3,"id":"e0c8c09c-6c94-4a6c-8a55-72dc097a3e4e","isCorrect":false,"text":"20, 16, 12, 9"},{"displayOrder":4,"id":"4f004dc8-3b20-497b-ac3f-7dd55aaea4e2","isCorrect":false,"text":"20, 15, 10, 5"}],"prompt":"20, 16, 12, 9를 바르게 고친 배열은?","skillCode":"correct-pattern-reasoning","weight":1},{"displayOrder":3,"explanation":"○ △ ○의 세 항목이 반복되므로 다음은 △입니다.","id":"f9195dcb-a6d1-473e-b829-508047103fa0","options":[{"displayOrder":1,"id":"6ff6dc91-ba9c-471c-b815-f28fb2ea81a7","isCorrect":false,"text":"○"},{"displayOrder":2,"id":"479ffc82-6e95-4377-ac09-5ea132b9c4b4","isCorrect":false,"text":"□"},{"displayOrder":3,"id":"44ff089d-3c88-4b41-8a9b-0cd3b099225d","isCorrect":true,"text":"△"},{"displayOrder":4,"id":"41ab21aa-8bf6-4f81-af5a-b09bb76cf497","isCorrect":false,"text":"★"}],"prompt":"○ △ ○ ○ △ ○ ○ 다음 항목은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":4,"explanation":"10 다음에는 3을 더할 차례이므로 13입니다.","id":"39605b8e-0e1a-46af-8230-1c1d92454af3","options":[{"displayOrder":1,"id":"72de7b36-5a14-4d47-ad69-7b829adfe9fe","isCorrect":false,"text":"11"},{"displayOrder":2,"id":"28d462c8-dabf-4ca6-b364-99b24c396258","isCorrect":false,"text":"12"},{"displayOrder":3,"id":"99162def-58fe-4a49-833d-c0a5040a74d5","isCorrect":false,"text":"14"},{"displayOrder":4,"id":"ef197252-1024-452e-9464-962d377af431","isCorrect":true,"text":"13"}],"prompt":"2, 5, 6, 9, 10은 “3 더하기, 1 더하기” 규칙입니다. 다음 수는?","skillCode":"extend-two-step-pattern","weight":1},{"displayOrder":5,"explanation":"14보다 4 작은 수는 10이므로 10, 14, 18, 22가 됩니다.","id":"d5495d4c-b1a0-447f-b317-895f138ccd12","options":[{"displayOrder":1,"id":"7b435861-44d0-4b51-a728-0a85dfbae22b","isCorrect":false,"text":"8"},{"displayOrder":2,"id":"8be36ef4-4e52-4f66-be0e-a549f44ee565","isCorrect":false,"text":"12"},{"displayOrder":3,"id":"779e00fc-9ac6-4e03-af8f-0228c8f22302","isCorrect":true,"text":"10"},{"displayOrder":4,"id":"bb1f15a9-8e7e-45ab-b87a-cd3214d192e9","isCorrect":false,"text":"16"}],"prompt":"□, 14, 18, 22가 4씩 커질 때 □는?","skillCode":"infer-missing-pattern-item","weight":1},{"displayOrder":6,"explanation":"반복 길이는 3이고 8번째는 두 번째 자리이므로 ★입니다.","id":"4484319c-c496-4426-a0f3-e7c1cede3e42","options":[{"displayOrder":1,"id":"b5ad0d68-1423-446f-9b85-ebbebea4e623","isCorrect":false,"text":"□이며 8번째는 주기의 세 번째입니다."},{"displayOrder":2,"id":"e8f02884-9e9e-4ddd-b7f4-da78cbcbac4f","isCorrect":false,"text":"★이며 모든 항목이 같습니다."},{"displayOrder":3,"id":"2d74e118-aa80-4f2e-a59d-0eaecc78e7f4","isCorrect":false,"text":"□이며 8을 2로 나눕니다."},{"displayOrder":4,"id":"55544ae8-b8a7-49e0-9dd5-e9970c1f4996","isCorrect":true,"text":"★이며 8번째는 주기의 두 번째입니다."}],"prompt":"★ ★ □가 반복될 때 8번째 항목과 까닭이 맞는 것은?","skillCode":"identify-repeating-cycle","weight":1},{"displayOrder":7,"explanation":"5씩 커지므로 22 뒤에 27, 32, 37이 이어집니다.","id":"4d2b5d1f-0316-4d63-893f-778dfad0d289","options":[{"displayOrder":1,"id":"bcf4b1de-29c8-4853-86ce-1a366b44f029","isCorrect":true,"text":"27, 32, 37"},{"displayOrder":2,"id":"113f64fd-8044-4c1c-ac2b-ba39bf137fac","isCorrect":false,"text":"23, 24, 25"},{"displayOrder":3,"id":"f6506a38-93b4-4afe-9b19-4b50659f6168","isCorrect":false,"text":"27, 31, 35"},{"displayOrder":4,"id":"7880695e-5857-411f-a3d9-1fa5f9c1e2aa","isCorrect":false,"text":"17, 12, 7"}],"prompt":"7, 12, 17, 22의 규칙을 3번 더 이어 쓴 것은?","skillCode":"continue-increasing-pattern","weight":1},{"displayOrder":8,"explanation":"6씩 작아지므로 22-6=16, 16-6=10입니다.","id":"05604d82-c37e-4c5e-8457-581f5872a93d","options":[{"displayOrder":1,"id":"db6fd7d5-6bc6-4153-836a-def5f6d69a70","isCorrect":false,"text":"18, 14"},{"displayOrder":2,"id":"04ecddc6-6733-4a2d-997a-62e4047f7518","isCorrect":true,"text":"16, 10"},{"displayOrder":3,"id":"238c618e-d17c-41ee-a239-2463710ea56c","isCorrect":false,"text":"16, 12"},{"displayOrder":4,"id":"d198c6fe-21d4-491e-8a65-0b0d2132c164","isCorrect":false,"text":"28, 34"}],"prompt":"40, 34, 28, 22에서 다음 두 수는?","skillCode":"continue-decreasing-pattern","weight":1},{"displayOrder":9,"explanation":"1+2=3, 3+3=6, 6+2=8 다음은 8+3=11이어야 하므로 12가 잘못되었습니다.","id":"470b06ce-ee69-4fa8-9f8c-c70ac565932b","options":[{"displayOrder":1,"id":"e533c5c4-ca68-4ef0-90e0-0bc1db6f7fc4","isCorrect":false,"text":"3"},{"displayOrder":2,"id":"cdaa534a-966b-4673-bebc-d1e15cd5dbdc","isCorrect":false,"text":"6"},{"displayOrder":3,"id":"8ab4a620-2a00-4b91-bb0f-32d5d4c3cfcb","isCorrect":true,"text":"12"},{"displayOrder":4,"id":"677bd11d-f4ca-4c61-b7b8-951712cfabb2","isCorrect":false,"text":"8"}],"prompt":"1, 3, 6, 8, 12에서 “2 더하기, 3 더하기” 규칙에 맞지 않는 수는?","skillCode":"correct-pattern-reasoning","weight":1},{"displayOrder":10,"explanation":"이웃한 수가 3씩 커지므로 10+3=13이고 다음은 16입니다.","id":"f498bb8d-342e-4abd-aeed-2270e9d1cf3e","options":[{"displayOrder":1,"id":"b0473b7c-4b60-49f5-a080-b010a64f358d","isCorrect":false,"text":"12이며 2씩 커집니다."},{"displayOrder":2,"id":"7dc0dd6c-a007-4464-9bc5-50a1f7e12a06","isCorrect":false,"text":"13이며 3씩 작아집니다."},{"displayOrder":3,"id":"afc1c6a3-9eb1-43ab-9702-0670e5c9eb57","isCorrect":false,"text":"14이며 4씩 커집니다."},{"displayOrder":4,"id":"7c062d6d-6648-45e7-a958-6b6c961a7f5c","isCorrect":true,"text":"13이며 3씩 커집니다."}],"prompt":"4, 7, 10, □, 16에서 빈칸과 규칙 설명이 모두 맞는 것은?","skillCode":"explain-pattern-rule","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":12,"id":"09bafac3-9711-44dc-aa9d-88e5fc052d15","slug":"grade2-patterns","title":"규칙을 찾아요"},"version":{"id":"5dad60cf-1889-4683-b135-667c885b6851","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid
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
  where stage.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_patterns_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_patterns_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 13

  union all
  select 3, 'grade2_patterns_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '1e59acc60adafd8c3ff1023a673927550be70bfa06bdd2907ccd5a651a0078b9'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_patterns_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_patterns_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_patterns_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_patterns_v1_structure_and_orders',
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
    where stage.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_patterns_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_patterns_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid))

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
  where metadata.unit_id = '09bafac3-9711-44dc-aa9d-88e5fc052d15'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 12

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = '09bafac3-9711-44dc-aa9d-88e5fc052d15'::uuid
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
  where metadata.unit_id = '09bafac3-9711-44dc-aa9d-88e5fc052d15'::uuid

  union all
  select 23, 'grade2_patterns_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_patterns_v1_pass_threshold_contract',
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
  select 25, 'grade2_patterns_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_patterns_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '5dad60cf-1889-4683-b135-667c885b6851'::uuid

  union all
  select 27, 'grade2_patterns_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_patterns_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_patterns_v1_question_skills_exact',
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
select 999, 'grade2_patterns_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
