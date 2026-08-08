-- Phase 2B grade2-measuring-length v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":4,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"902ecc11-bdc2-4b6c-89df-12044de2b6b7","questions":[{"displayOrder":1,"explanation":"0cm에서 시작해 6cm 눈금에서 끝나므로 물체의 길이는 6cm입니다.","id":"d455811a-b35c-4630-a81a-56b6ce3729fe","options":[{"displayOrder":1,"id":"10a0da2c-0db7-4011-a868-04bcf701ed03","isCorrect":true,"text":"6cm"},{"displayOrder":2,"id":"71885671-1e65-40a1-8295-961957bc7b6a","isCorrect":false,"text":"5cm"},{"displayOrder":3,"id":"bd4d2f2a-38bf-4c4c-8c84-5e7b130449b0","isCorrect":false,"text":"7cm"},{"displayOrder":4,"id":"5a9043b5-fc3f-4755-843b-42ebac22bb16","isCorrect":false,"text":"8cm"}],"prompt":"물체의 한쪽 끝을 자의 0cm 눈금에 맞추고 다른 끝이 6cm 눈금에 있습니다. 물체의 길이는?","skillCode":"measure-length-with-ruler","weight":1},{"displayOrder":2,"explanation":"4cm에서 3cm를 빼면 1cm이므로 두 눈금 사이 한 칸은 1cm입니다.","id":"c7e88799-6435-44f9-968d-8186202f008d","options":[{"displayOrder":1,"id":"1f0ea652-6ba7-424f-82b7-f81b7c28160c","isCorrect":false,"text":"2cm"},{"displayOrder":2,"id":"67451159-7f3e-47cd-897c-58c7ba5487bf","isCorrect":true,"text":"1cm"},{"displayOrder":3,"id":"fedd327f-5303-4333-bb38-3111dfc988b0","isCorrect":false,"text":"3cm"},{"displayOrder":4,"id":"07377e6d-2110-497b-b850-5ea3ca84cdb7","isCorrect":false,"text":"4cm"}],"prompt":"자의 3cm 눈금과 4cm 눈금 사이 한 칸의 길이는?","skillCode":"read-ruler-scale","weight":1},{"displayOrder":3,"explanation":"공책처럼 작은 물체의 길이는 cm로 나타내는 것이 알맞습니다.","id":"af7b2b2e-3a49-4a51-9cba-3ef725e96eb9","options":[{"displayOrder":1,"id":"520933ef-0d8c-429b-9785-ea9a28043b13","isCorrect":false,"text":"m"},{"displayOrder":2,"id":"5b60878b-ed57-41ae-af54-ac2077e348ba","isCorrect":false,"text":"kg"},{"displayOrder":3,"id":"a63e2279-34a2-486d-9b76-3d32dfe9e524","isCorrect":true,"text":"cm"},{"displayOrder":4,"id":"56245314-1380-4b55-8c6a-60c9c50620a9","isCorrect":false,"text":"L"}],"prompt":"공책의 짧은 쪽 길이를 나타내기에 알맞은 단위는?","skillCode":"choose-length-unit","weight":1},{"displayOrder":4,"explanation":"교실처럼 긴 공간의 길이는 m로 나타내는 것이 알맞습니다.","id":"7f2ed8da-2739-4d88-8719-28447cddba76","options":[{"displayOrder":1,"id":"84187ff8-a64c-4261-a3d2-9beba9e84583","isCorrect":false,"text":"cm"},{"displayOrder":2,"id":"4f8da9f3-3054-4864-8872-f45896d8affa","isCorrect":false,"text":"kg"},{"displayOrder":3,"id":"51e9a4fb-b03b-4895-828a-6cfad31e4b9a","isCorrect":false,"text":"L"},{"displayOrder":4,"id":"e8b2b1e0-26ca-4ae5-8142-77474a3c0b5d","isCorrect":true,"text":"m"}],"prompt":"교실 앞쪽에서 뒤쪽까지의 길이를 나타내기에 알맞은 단위는?","skillCode":"choose-length-unit","weight":1},{"displayOrder":5,"explanation":"8cm는 5cm보다 크므로 빨간 리본이 더 깁니다.","id":"ab7431cb-3a55-4573-9f06-d820225c777d","options":[{"displayOrder":1,"id":"46993b5d-6899-46d5-8dfd-14b9ff258580","isCorrect":true,"text":"8cm인 빨간 리본"},{"displayOrder":2,"id":"e63e2699-ad43-4de4-adf5-ae2e77de34a4","isCorrect":false,"text":"5cm인 파란 리본"},{"displayOrder":3,"id":"baa4d742-9edb-466c-879c-bac24287f155","isCorrect":false,"text":"두 리본의 길이가 같습니다."},{"displayOrder":4,"id":"2ce7a094-ccc3-470c-bdef-15ad34311f66","isCorrect":false,"text":"비교할 수 없습니다."}],"prompt":"빨간 리본은 8cm이고 파란 리본은 5cm입니다. 더 긴 리본은?","skillCode":"compare-lengths","weight":1},{"displayOrder":6,"explanation":"0cm에서 시작해 9cm 눈금에서 끝나므로 연필의 길이는 9cm입니다.","id":"84e488d3-628b-42f3-8589-60c1646bb1f5","options":[{"displayOrder":1,"id":"f65defa2-a1d0-4bc5-85c3-397c1da1a484","isCorrect":false,"text":"8cm"},{"displayOrder":2,"id":"af2dbb15-d10d-4851-a9f1-11636f5e7526","isCorrect":true,"text":"9cm"},{"displayOrder":3,"id":"1df30114-a673-4635-b982-b5d05458a9fe","isCorrect":false,"text":"10cm"},{"displayOrder":4,"id":"45cda228-3fe2-40a8-90ec-a0ebf391ee42","isCorrect":false,"text":"0cm"}],"prompt":"연필의 한쪽 끝을 자의 0cm 눈금에 맞추었더니 다른 끝이 9cm 눈금에 있습니다. 연필의 길이는?","skillCode":"measure-length-with-ruler","weight":1},{"displayOrder":7,"explanation":"손가락 한 마디는 작은 길이이므로 약 2cm가 알맞습니다.","id":"e67c66d9-9f22-40bc-bdea-140571780fa1","options":[{"displayOrder":1,"id":"463f7304-fce6-434b-b772-2893d9debf44","isCorrect":false,"text":"20m"},{"displayOrder":2,"id":"c28fade8-8f30-42d9-a203-09029618266c","isCorrect":false,"text":"20cm"},{"displayOrder":3,"id":"964baddb-ed7f-4593-ac4f-a5af46410f77","isCorrect":true,"text":"2cm"},{"displayOrder":4,"id":"1ca46ec3-917c-4abc-95d3-e6345508317b","isCorrect":false,"text":"2m"}],"prompt":"손가락 한 마디의 길이로 가장 알맞은 것은?","skillCode":"estimate-length","weight":1},{"displayOrder":8,"explanation":"운동장처럼 긴 곳의 길이는 m로 나타내는 것이 알맞습니다.","id":"8e81456d-01eb-4c15-886f-b9af817e8610","options":[{"displayOrder":1,"id":"ba524343-08d2-48ec-a790-65f2cfe04c78","isCorrect":false,"text":"cm"},{"displayOrder":2,"id":"b23f315e-748f-4491-ac13-2e0c48d0b9f2","isCorrect":false,"text":"kg"},{"displayOrder":3,"id":"0ab08379-b08e-4116-b1e0-5d3e07ff53ba","isCorrect":false,"text":"L"},{"displayOrder":4,"id":"a3134448-2dc9-4e1b-8ed8-2f9c86a1e1e5","isCorrect":true,"text":"m"}],"prompt":"운동장의 긴 쪽 길이를 나타내기에 알맞은 단위는?","skillCode":"choose-length-unit","weight":1},{"displayOrder":9,"explanation":"점이 7cm 눈금에 있으므로 점이 나타내는 길이는 7cm입니다.","id":"7b586413-f98a-494e-ac26-e67b08a9a3d6","options":[{"displayOrder":1,"id":"703af5b6-55c8-4c2d-9975-be5ea60e4951","isCorrect":true,"text":"7cm"},{"displayOrder":2,"id":"ef0434ec-d32e-4c0a-afc6-b215bb4624cc","isCorrect":false,"text":"6cm"},{"displayOrder":3,"id":"ff9a7568-9660-4b73-99bc-e575ba7641f2","isCorrect":false,"text":"8cm"},{"displayOrder":4,"id":"0ae16048-13fa-418f-9141-eb8681185eda","isCorrect":false,"text":"9cm"}],"prompt":"자의 7cm 눈금 바로 위에 점이 찍혀 있습니다. 점이 나타내는 길이는?","skillCode":"read-ruler-scale","weight":1},{"displayOrder":10,"explanation":"12cm는 4cm보다 크므로 연필이 더 깁니다.","id":"af2ca815-8222-4cab-b937-15a2c76b392d","options":[{"displayOrder":1,"id":"f1077315-f44a-425b-a4eb-b3f52af6534f","isCorrect":false,"text":"지우개"},{"displayOrder":2,"id":"9b6bf262-289b-4a1b-9b39-9e91295a5227","isCorrect":true,"text":"연필"},{"displayOrder":3,"id":"46cc91b9-1a0a-42d1-bfb8-30dae7f91c8c","isCorrect":false,"text":"두 물체의 길이가 같습니다."},{"displayOrder":4,"id":"855720e9-a133-4ef1-9e72-6cb5f3b36dad","isCorrect":false,"text":"비교할 수 없습니다."}],"prompt":"연필은 12cm이고 지우개는 4cm입니다. 더 긴 것은?","skillCode":"compare-lengths","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"2a42e139-d700-4f69-bab7-8afbca9f01fa","questions":[{"displayOrder":1,"explanation":"끝 눈금 9cm에서 시작 눈금 2cm를 빼면 7cm입니다.","id":"4986b4a7-fcba-4521-9363-b3fc4fbf51d3","options":[{"displayOrder":1,"id":"083bb00c-f42d-4ddb-9ea2-ea47ce5ae4ef","isCorrect":false,"text":"9cm"},{"displayOrder":2,"id":"e5bb15e4-1f64-44cf-99c5-fcc903df3c87","isCorrect":false,"text":"11cm"},{"displayOrder":3,"id":"c3cd6055-ee42-4f4f-8e83-247d43a55170","isCorrect":true,"text":"7cm"},{"displayOrder":4,"id":"7857f2c0-99c2-4672-83ae-fec290352083","isCorrect":false,"text":"2cm"}],"prompt":"막대의 한쪽 끝은 자의 2cm 눈금, 다른 끝은 9cm 눈금에 있습니다. 막대의 길이는?","skillCode":"measure-from-nonzero-start","weight":1},{"displayOrder":2,"explanation":"끝 눈금 11cm에서 시작 눈금 4cm를 빼면 7cm입니다.","id":"728d191c-68f5-4baa-9e45-5f813bcff8c9","options":[{"displayOrder":1,"id":"b66d75d0-f548-4d4b-843e-c84e7846c874","isCorrect":false,"text":"11cm"},{"displayOrder":2,"id":"014241cf-1160-44ce-842e-04f2c2860c53","isCorrect":false,"text":"15cm"},{"displayOrder":3,"id":"aa52e8ae-63ba-4150-974b-04074b48e691","isCorrect":false,"text":"4cm"},{"displayOrder":4,"id":"397fc327-e4f3-4001-917c-18f1119e6ae8","isCorrect":true,"text":"7cm"}],"prompt":"종이띠의 한쪽 끝은 자의 4cm 눈금, 다른 끝은 11cm 눈금에 있습니다. 종이띠의 길이는?","skillCode":"measure-from-nonzero-start","weight":1},{"displayOrder":3,"explanation":"14cm가 12cm와 9cm보다 크므로 빨간 끈이 가장 깁니다.","id":"b5a624e9-ceda-4a45-95e2-2acba8718f39","options":[{"displayOrder":1,"id":"b1c730a1-0b97-4853-b1df-007e37bde39d","isCorrect":true,"text":"14cm인 빨간 끈"},{"displayOrder":2,"id":"b85a5ec5-5714-40f7-9126-6e9291520780","isCorrect":false,"text":"9cm인 파란 끈"},{"displayOrder":3,"id":"0fe929ad-5d90-445f-9e49-339d9f4f4197","isCorrect":false,"text":"12cm인 초록 끈"},{"displayOrder":4,"id":"686c3355-d10c-4bfd-bc09-5d1fa32d0d8d","isCorrect":false,"text":"세 끈의 길이가 같습니다."}],"prompt":"빨간 끈은 14cm, 파란 끈은 9cm, 초록 끈은 12cm입니다. 가장 긴 끈은?","skillCode":"compare-lengths","weight":1},{"displayOrder":4,"explanation":"5cm가 6cm와 8cm보다 작으므로 나 막대가 가장 짧습니다.","id":"dd1752a1-d975-42da-89c4-85d3d8450da0","options":[{"displayOrder":1,"id":"496a5af3-2654-475e-a049-822833f1f30a","isCorrect":false,"text":"6cm인 가 막대"},{"displayOrder":2,"id":"cce70bd9-74e3-49d3-86b9-c63df3b4e9e1","isCorrect":true,"text":"5cm인 나 막대"},{"displayOrder":3,"id":"04220a2c-9c16-4d67-8538-467528605c4e","isCorrect":false,"text":"8cm인 다 막대"},{"displayOrder":4,"id":"e01d956f-b4ab-49d9-840b-91e8a394beec","isCorrect":false,"text":"세 막대의 길이가 같습니다."}],"prompt":"가 막대는 6cm, 나 막대는 5cm, 다 막대는 8cm입니다. 가장 짧은 막대는?","skillCode":"compare-lengths","weight":1},{"displayOrder":5,"explanation":"연필 한 자루의 길이는 약 15cm로 어림하는 것이 알맞습니다.","id":"5473fbc8-b011-4282-98ca-cc9acdf2589f","options":[{"displayOrder":1,"id":"02840bf6-0b04-4a9d-af56-0aa9eb6e04e4","isCorrect":false,"text":"15m"},{"displayOrder":2,"id":"4828ec85-ed14-4132-9282-f0af10a3dad9","isCorrect":false,"text":"1cm"},{"displayOrder":3,"id":"b0050fe4-7e84-495b-bf87-622ec8b753f2","isCorrect":true,"text":"15cm"},{"displayOrder":4,"id":"abad7a3d-0bd1-4557-83ac-25cfc144b824","isCorrect":false,"text":"150m"}],"prompt":"보통 연필 한 자루의 길이로 가장 알맞은 것은?","skillCode":"estimate-length","weight":1},{"displayOrder":6,"explanation":"교실 문의 높이는 사람의 키보다 조금 크므로 약 2m가 알맞습니다.","id":"78ae29a8-4da9-45b4-ae20-ac6a67298038","options":[{"displayOrder":1,"id":"fb0ffa98-ceb8-4dd7-bf74-202f3e6f9273","isCorrect":false,"text":"2cm"},{"displayOrder":2,"id":"33fbfe69-e632-4a64-9bd6-908cfc5f7a79","isCorrect":false,"text":"20cm"},{"displayOrder":3,"id":"37084958-1181-47db-a448-e3ee02d974ef","isCorrect":false,"text":"20m"},{"displayOrder":4,"id":"0105cc52-2593-4195-9a3d-ea4971c7f313","isCorrect":true,"text":"2m"}],"prompt":"교실 문의 높이로 가장 알맞은 것은?","skillCode":"estimate-length","weight":1},{"displayOrder":7,"explanation":"5cm에서 1cm씩 세 칸 이동하면 6cm, 7cm, 8cm 눈금에 차례로 닿습니다.","id":"79b95acf-a7f9-4a11-a0d1-99dce63065d3","options":[{"displayOrder":1,"id":"00520ac9-19a7-496d-93cc-25c0f551edfe","isCorrect":true,"text":"8cm"},{"displayOrder":2,"id":"86656f92-b880-4c3c-b8b3-3e8d7a2c91a6","isCorrect":false,"text":"6cm"},{"displayOrder":3,"id":"ab700b87-701b-4f79-9096-39d2d26f7982","isCorrect":false,"text":"7cm"},{"displayOrder":4,"id":"eba16e35-8f52-4c6a-903e-bac0a6e0aad0","isCorrect":false,"text":"9cm"}],"prompt":"자의 5cm 눈금에서 오른쪽으로 1cm씩 세 칸 이동한 눈금은?","skillCode":"read-ruler-scale","weight":1},{"displayOrder":8,"explanation":"0cm에서 시작해 13cm 눈금에서 끝나므로 줄의 길이는 13cm입니다.","id":"0566963d-c57e-4884-ae2b-e28ecacf0544","options":[{"displayOrder":1,"id":"a39cf361-4951-446f-aff9-fbfe0e521b26","isCorrect":false,"text":"12cm"},{"displayOrder":2,"id":"7a65dbf2-641b-4462-85f7-7c73d99a506e","isCorrect":true,"text":"13cm"},{"displayOrder":3,"id":"e5fe42ba-abd2-45c5-bd85-dc038e5db8a3","isCorrect":false,"text":"14cm"},{"displayOrder":4,"id":"7221ee82-94d0-4a9f-ae6c-e22079556533","isCorrect":false,"text":"0cm"}],"prompt":"줄의 한쪽 끝을 자의 0cm 눈금에 맞추었더니 다른 끝이 13cm 눈금에 있습니다. 줄의 길이는?","skillCode":"measure-length-with-ruler","weight":1},{"displayOrder":9,"explanation":"8cm부터 세 번째 눈금은 10cm이므로 화살표가 나타내는 길이는 10cm입니다.","id":"7a9ae9af-6ca4-44a1-a776-37b467ce4dfa","options":[{"displayOrder":1,"id":"4a699506-ca70-44af-afc8-0e8fd5ab352d","isCorrect":false,"text":"8cm"},{"displayOrder":2,"id":"b897bb74-523e-459e-9cf3-95c1cab2c823","isCorrect":false,"text":"9cm"},{"displayOrder":3,"id":"466d60a6-d133-47ba-b90e-52b9ba25733f","isCorrect":true,"text":"10cm"},{"displayOrder":4,"id":"f38cd3ca-ea63-402c-8620-6e0e6039f3cc","isCorrect":false,"text":"11cm"}],"prompt":"자의 눈금이 8cm, 9cm, 10cm, 11cm 순서로 있습니다. 화살표가 세 번째 눈금을 가리킬 때 나타내는 길이는?","skillCode":"read-ruler-scale","weight":1},{"displayOrder":10,"explanation":"창문의 너비는 약 1m로 나타내는 것이 알맞습니다.","id":"c64e80b7-ac89-4dab-b18f-c66b51b5cfdd","options":[{"displayOrder":1,"id":"11d1cce7-9b55-441a-8774-9db6cdefb9cb","isCorrect":false,"text":"cm"},{"displayOrder":2,"id":"6894236c-1111-49ba-9bf3-2a908a3ae1ee","isCorrect":false,"text":"kg"},{"displayOrder":3,"id":"9cca9e6e-01cb-47b3-afbb-8ce69d41de94","isCorrect":false,"text":"L"},{"displayOrder":4,"id":"101fc011-130b-43ae-bdc2-db652acf4c5e","isCorrect":true,"text":"m"}],"prompt":"창문의 너비가 약 1일 때 빈칸에 알맞은 단위는?","skillCode":"choose-length-unit","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"158c3fa0-e476-48d8-aa52-063429845367","questions":[{"displayOrder":1,"explanation":"끝 눈금 14cm에서 시작 눈금 3cm를 빼면 11cm입니다.","id":"6943fcc1-0d74-4661-9574-a8f38b6405ab","options":[{"displayOrder":1,"id":"32698200-85cc-410b-a94a-8aef2968083a","isCorrect":true,"text":"11cm"},{"displayOrder":2,"id":"70e048d3-f75f-4444-8c28-88e09538024b","isCorrect":false,"text":"14cm"},{"displayOrder":3,"id":"5242ebce-b006-45fb-89d1-dc2c408ee89b","isCorrect":false,"text":"17cm"},{"displayOrder":4,"id":"9414f1af-f1fd-4fd0-92f7-37c6b20446cb","isCorrect":false,"text":"3cm"}],"prompt":"리본의 시작은 자의 3cm 눈금이고 끝은 14cm 눈금입니다. 리본의 길이는?","skillCode":"measure-from-nonzero-start","weight":1},{"displayOrder":2,"explanation":"끝 눈금 16cm에서 시작 눈금 7cm를 빼면 9cm입니다.","id":"12c33111-9536-475d-9c1e-d24ccb9abde6","options":[{"displayOrder":1,"id":"2dee3a9c-2faf-4082-a643-34ddfd88da7f","isCorrect":false,"text":"23cm"},{"displayOrder":2,"id":"7660d51a-aa3d-4d00-8417-2d3ee43f809c","isCorrect":true,"text":"9cm"},{"displayOrder":3,"id":"3613e667-1cfa-497d-b3f9-8e9c6df282e1","isCorrect":false,"text":"16cm"},{"displayOrder":4,"id":"7ac2940e-2d2f-4f56-8dee-29db1b5875d5","isCorrect":false,"text":"7cm"}],"prompt":"빨대의 시작은 자의 7cm 눈금이고 끝은 16cm 눈금입니다. 빨대의 길이는?","skillCode":"measure-from-nonzero-start","weight":1},{"displayOrder":3,"explanation":"가 막대는 12cm, 나 막대는 13cm, 다 막대는 11cm이므로 나 막대가 가장 깁니다.","id":"777c9b3f-c7a2-4023-8f6b-2057b8e21f9a","options":[{"displayOrder":1,"id":"75b981f6-6a5b-45dc-8586-0d7272df120d","isCorrect":false,"text":"가 막대"},{"displayOrder":2,"id":"8c88195f-56c7-4f2d-a614-bee52195faba","isCorrect":false,"text":"다 막대"},{"displayOrder":3,"id":"c7b64d41-5e5e-4f87-a5b6-e0a51e24bca6","isCorrect":true,"text":"나 막대"},{"displayOrder":4,"id":"e346cb7b-764e-4d71-9ea3-dadeb97cdfcf","isCorrect":false,"text":"세 막대의 길이가 같습니다."}],"prompt":"가 막대는 0cm부터 12cm까지, 나 막대는 2cm부터 15cm까지, 다 막대는 5cm부터 16cm까지 놓였습니다. 가장 긴 막대는?","skillCode":"compare-lengths","weight":1},{"displayOrder":4,"explanation":"가 막대는 8cm, 나 막대는 9cm, 다 막대는 6cm이므로 다 막대가 가장 짧습니다.","id":"e4914597-adff-45a6-9fe1-eb2afb0cc9ad","options":[{"displayOrder":1,"id":"374ffdfc-1b4e-486a-861c-1cb199901a4c","isCorrect":false,"text":"8cm인 가 막대"},{"displayOrder":2,"id":"9eb47f92-a027-4d2a-9a4c-b2d0860ee941","isCorrect":false,"text":"9cm인 나 막대"},{"displayOrder":3,"id":"d1188358-2fba-47c3-b51b-f1b2d57776e6","isCorrect":false,"text":"세 막대의 길이가 같습니다."},{"displayOrder":4,"id":"bab5208e-a589-488f-9149-9e6ac5a63e7d","isCorrect":true,"text":"6cm인 다 막대"}],"prompt":"가 막대는 2cm부터 10cm까지, 나 막대는 4cm부터 13cm까지, 다 막대는 6cm부터 12cm까지 놓였습니다. 가장 짧은 막대는?","skillCode":"compare-lengths","weight":1},{"displayOrder":5,"explanation":"끝 눈금 13cm에서 길이 8cm를 빼면 시작 눈금은 5cm입니다.","id":"a6ce38ea-ef4d-4bf5-b7e5-5d724b90fd08","options":[{"displayOrder":1,"id":"39d0ef82-9c44-494f-916a-8c4516cc84b1","isCorrect":true,"text":"5cm"},{"displayOrder":2,"id":"f3a55fcd-219d-4117-9ba3-3b67841bc6f0","isCorrect":false,"text":"8cm"},{"displayOrder":3,"id":"40d32ff8-4b38-4eb6-aa11-73639b278324","isCorrect":false,"text":"13cm"},{"displayOrder":4,"id":"bff6c717-2cc3-4864-b091-76b61fca2cbb","isCorrect":false,"text":"21cm"}],"prompt":"테이프의 끝 눈금은 13cm이고 길이는 8cm입니다. 시작 눈금은?","skillCode":"infer-length-from-measurement","weight":1},{"displayOrder":6,"explanation":"시작 눈금 4cm에서 9cm만큼 이어지므로 끝 눈금은 13cm입니다.","id":"7df5b633-b8f2-4dcf-ba21-c39891b6bb4d","options":[{"displayOrder":1,"id":"929332a6-4546-409b-9f82-3a2aa61a68bd","isCorrect":false,"text":"5cm"},{"displayOrder":2,"id":"d7ec7526-3fef-4cb9-97da-2f52f83136e1","isCorrect":true,"text":"13cm"},{"displayOrder":3,"id":"6ddf163f-02cc-4868-b490-07c578338f40","isCorrect":false,"text":"9cm"},{"displayOrder":4,"id":"d8a8fc3d-5a72-48f2-bc39-54aea7bf220e","isCorrect":false,"text":"36cm"}],"prompt":"끈의 시작 눈금은 4cm이고 길이는 9cm입니다. 끝 눈금은?","skillCode":"infer-length-from-measurement","weight":1},{"displayOrder":7,"explanation":"끝 눈금 15cm에서 시작 눈금 6cm를 빼면 물체의 길이는 9cm입니다.","id":"2bf3a716-fe4c-4b25-85b1-0d316fe1d1ad","options":[{"displayOrder":1,"id":"6630745e-7149-42d2-b264-20fbeeb42d8e","isCorrect":false,"text":"15cm"},{"displayOrder":2,"id":"38981071-fbed-4d87-84c3-e80ae089c917","isCorrect":false,"text":"21cm"},{"displayOrder":3,"id":"3e9eb578-b652-4317-9e47-d42815178462","isCorrect":true,"text":"9cm"},{"displayOrder":4,"id":"5e741035-8610-4de5-8aa3-76b7f2cd1175","isCorrect":false,"text":"6cm"}],"prompt":"부러진 자에서 물체의 양 끝이 6cm 눈금과 15cm 눈금에 있습니다. 물체의 길이는?","skillCode":"measure-from-nonzero-start","weight":1},{"displayOrder":8,"explanation":"7cm보다 크고 10cm보다 작은 수 중 짝수는 8이므로 길이는 8cm입니다.","id":"6382a9f8-026a-4437-b308-5b3b556da05a","options":[{"displayOrder":1,"id":"d61e62a5-a790-4024-8df8-824ad13dfa05","isCorrect":false,"text":"7cm"},{"displayOrder":2,"id":"99c0da39-bc1c-40b8-a902-074572e001a9","isCorrect":false,"text":"9cm"},{"displayOrder":3,"id":"73db810a-0d1c-4bb0-9066-9a78cd9d033a","isCorrect":false,"text":"10cm"},{"displayOrder":4,"id":"757fc668-ca89-4b37-990e-aea293d21f0e","isCorrect":true,"text":"8cm"}],"prompt":"어떤 물체의 길이는 7cm보다 길고 10cm보다 짧은 짝수입니다. 물체의 길이는?","skillCode":"infer-length-from-measurement","weight":1},{"displayOrder":9,"explanation":"빨간 막대는 9cm이고 파란 막대는 8cm이므로 빨간 막대가 1cm 더 깁니다.","id":"a55763cd-ad23-4d39-96f3-58e9c60e4fe3","options":[{"displayOrder":1,"id":"80e64e00-4e37-4c63-997c-37a59859c3c6","isCorrect":true,"text":"빨간 막대가 1cm 더 깁니다."},{"displayOrder":2,"id":"d6937396-3e52-4beb-8bc4-1146daaa60e3","isCorrect":false,"text":"파란 막대가 1cm 더 깁니다."},{"displayOrder":3,"id":"a883129c-aef0-44a7-abc5-5d8a90c820c9","isCorrect":false,"text":"두 막대의 길이가 같습니다."},{"displayOrder":4,"id":"595abf2a-4369-4fa1-a018-967b581fe583","isCorrect":false,"text":"비교할 수 없습니다."}],"prompt":"빨간 막대는 2cm부터 11cm까지, 파란 막대는 5cm부터 13cm까지 놓였습니다. 알맞은 비교는?","skillCode":"compare-lengths","weight":1},{"displayOrder":10,"explanation":"복도처럼 긴 공간은 m, 연필처럼 작은 물체는 cm로 나타내는 것이 알맞습니다.","id":"0b42e785-047e-437c-a070-0173b341ec8e","options":[{"displayOrder":1,"id":"f8c25e68-5595-456c-bc29-f13b4d7d6460","isCorrect":false,"text":"복도 12cm, 연필 18m"},{"displayOrder":2,"id":"59ed19d2-7e82-41b8-ae3b-beb14a0e1dca","isCorrect":true,"text":"복도 12m, 연필 18cm"},{"displayOrder":3,"id":"9f232fbf-2e99-4842-9cdb-c4754659299b","isCorrect":false,"text":"복도 12kg, 연필 18kg"},{"displayOrder":4,"id":"ad822337-4dab-4317-98f9-8a3419a2c54c","isCorrect":false,"text":"복도 12L, 연필 18m"}],"prompt":"길이와 단위를 바르게 짝 지은 것은?","skillCode":"choose-length-unit","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"8029ea54-cecc-4e97-8932-45ae40a5a17c","questions":[{"displayOrder":1,"explanation":"0cm에서 시작하지 않았으므로 끝 눈금 11cm에서 시작 눈금 3cm를 빼야 합니다. 막대의 길이는 8cm입니다.","id":"b860e868-5512-439f-8d73-42346835673e","options":[{"displayOrder":1,"id":"6d4fe7a3-c8a0-474f-953d-243e7c59258d","isCorrect":false,"text":"시작 눈금 3cm를 더해 14cm입니다."},{"displayOrder":2,"id":"34e2e9d8-42ac-490c-b55d-18c4724b98dd","isCorrect":false,"text":"끝 눈금만 읽었으므로 11cm가 맞습니다."},{"displayOrder":3,"id":"cde114bf-2a53-4f28-938c-dc644b9ad000","isCorrect":true,"text":"11cm에서 3cm를 빼야 하므로 8cm입니다."},{"displayOrder":4,"id":"711ea380-85c3-445b-8468-f78c8e7234fa","isCorrect":false,"text":"눈금 수와 관계없이 3cm입니다."}],"prompt":"수아는 자의 3cm 눈금부터 11cm 눈금까지 놓인 막대의 길이를 11cm라고 했습니다. 바른 설명은?","skillCode":"correct-measurement-reasoning","weight":1},{"displayOrder":2,"explanation":"길이를 정확히 재려면 자를 물체의 가장자리와 나란히 곧게 놓아야 합니다.","id":"affb99e5-e509-424c-8b6c-94c44c903d4d","options":[{"displayOrder":1,"id":"ca4980f9-682e-4802-8f0a-7d0dfd9e70af","isCorrect":false,"text":"자를 책과 멀리 떨어뜨립니다."},{"displayOrder":2,"id":"cf95a265-cdc4-49a9-95a4-6f6c3d6ddea6","isCorrect":false,"text":"자의 뒷면만 사용합니다."},{"displayOrder":3,"id":"cddf11db-5a41-42bf-985a-551c04fe3788","isCorrect":false,"text":"책을 접어서 잽니다."},{"displayOrder":4,"id":"ebb276ac-e696-4573-96b2-894407274f5f","isCorrect":true,"text":"자를 책의 가장자리와 나란히 곧게 놓습니다."}],"prompt":"책의 길이를 잴 때 자를 책의 옆에 비스듬히 놓았습니다. 올바르게 재는 방법은?","skillCode":"correct-measurement-reasoning","weight":1},{"displayOrder":3,"explanation":"긴 눈금의 수가 2씩 커지므로 4 다음 긴 눈금은 6cm입니다.","id":"6dc74739-176e-47c7-a67b-c9b96c41cad2","options":[{"displayOrder":1,"id":"eba796d5-33c5-4cc5-9ccb-d7b40449cfc9","isCorrect":true,"text":"6cm"},{"displayOrder":2,"id":"f7785695-d329-4750-af81-4a0b101cbcc9","isCorrect":false,"text":"5cm"},{"displayOrder":3,"id":"5f7646a1-fef2-42e8-8753-2368320d016d","isCorrect":false,"text":"8cm"},{"displayOrder":4,"id":"3253d350-0aff-475f-9229-fc45de815644","isCorrect":false,"text":"4cm"}],"prompt":"자의 긴 눈금에 0, 2, 4가 차례로 적혀 있습니다. 같은 간격으로 다음 긴 눈금이 나타내는 길이는?","skillCode":"read-ruler-scale","weight":1},{"displayOrder":4,"explanation":"가 막대는 11cm이고 나 막대는 12cm이므로 나 막대가 1cm 더 깁니다.","id":"6c88e334-fb08-42fd-be41-f80579a96bb7","options":[{"displayOrder":1,"id":"9ceb308c-2150-42ac-9962-db7ea49aa496","isCorrect":false,"text":"가 막대가 1cm 더 깁니다."},{"displayOrder":2,"id":"33d9d0a4-db06-4960-84c5-d858095fddf6","isCorrect":true,"text":"나 막대가 1cm 더 깁니다."},{"displayOrder":3,"id":"5f866675-4e27-4dd8-af98-b7a215a711d4","isCorrect":false,"text":"두 막대의 길이가 같습니다."},{"displayOrder":4,"id":"e35cec10-e3bc-44f1-ab63-ed6bbf1e9dc7","isCorrect":false,"text":"가 막대가 4cm 더 깁니다."}],"prompt":"가 막대는 4cm부터 15cm까지, 나 막대는 0cm부터 12cm까지 놓였습니다. 바르게 비교한 것은?","skillCode":"correct-measurement-reasoning","weight":1},{"displayOrder":5,"explanation":"시작 눈금 2cm에서 12cm만큼 이어지므로 끝 눈금은 14cm입니다.","id":"eaf32cbc-d9e4-4610-96ab-44022b7c2486","options":[{"displayOrder":1,"id":"2f8f1b69-f524-4042-9de1-b6c057c87156","isCorrect":false,"text":"10cm"},{"displayOrder":2,"id":"99e714e6-c87d-468c-b624-60e78ab98a34","isCorrect":false,"text":"12cm"},{"displayOrder":3,"id":"d8376516-9c10-43a8-a179-dbbf451684af","isCorrect":true,"text":"14cm"},{"displayOrder":4,"id":"028e399b-81b8-4dfe-bc0b-b021a3619454","isCorrect":false,"text":"24cm"}],"prompt":"막대의 시작 눈금은 2cm이고 길이는 12cm입니다. 끝 눈금은?","skillCode":"infer-length-from-measurement","weight":1},{"displayOrder":6,"explanation":"끝 눈금 18cm에서 길이 11cm를 빼면 시작 눈금은 7cm입니다.","id":"315d6ef5-296c-4fd9-8446-7ec24014fd34","options":[{"displayOrder":1,"id":"a62ceb5d-9b8e-4aee-b05b-33be59c85da8","isCorrect":false,"text":"29cm"},{"displayOrder":2,"id":"44af8e29-1588-4741-90d2-ad4ba9ffaad3","isCorrect":false,"text":"18cm"},{"displayOrder":3,"id":"7f31c8c7-35f0-40c2-86ec-10c42ab1959f","isCorrect":false,"text":"11cm"},{"displayOrder":4,"id":"af7bbeff-11b5-453b-ba4c-235abb0cee35","isCorrect":true,"text":"7cm"}],"prompt":"끈의 끝 눈금은 18cm이고 길이는 11cm입니다. 시작 눈금은?","skillCode":"infer-length-from-measurement","weight":1},{"displayOrder":7,"explanation":"9cm보다 크고 13cm보다 작은 수 중 홀수는 11이므로 막대의 길이는 11cm입니다.","id":"e05e9df5-d67a-4eb4-b07a-7de617c67bbd","options":[{"displayOrder":1,"id":"8fda4772-2ef7-436a-a6d2-b22d32df712a","isCorrect":true,"text":"11cm"},{"displayOrder":2,"id":"97bb8de1-1752-43cf-b4b2-95bcd70c0564","isCorrect":false,"text":"10cm"},{"displayOrder":3,"id":"7debeae5-a3f6-4a7d-bbf6-fef8f7067461","isCorrect":false,"text":"12cm"},{"displayOrder":4,"id":"bf0d4ead-aa28-4dec-9f2c-3ffe7d3d9fc5","isCorrect":false,"text":"13cm"}],"prompt":"어떤 막대의 길이는 9cm보다 길고 13cm보다 짧은 홀수입니다. 막대의 길이는?","skillCode":"infer-length-from-measurement","weight":1},{"displayOrder":8,"explanation":"물체를 자와 나란히 놓고 한쪽 끝을 기준 눈금에 맞춘 뒤 다른 끝의 눈금을 읽어야 합니다.","id":"3c24c97a-b47b-4619-b126-c52620390d6f","options":[{"displayOrder":1,"id":"f38b8592-f5e9-4e75-bde1-4ca5ecde0c1e","isCorrect":false,"text":"물체를 자와 비스듬하게 놓습니다."},{"displayOrder":2,"id":"bad79b81-8ce3-4d5b-8e35-9d86f283897f","isCorrect":true,"text":"물체의 한쪽 끝을 기준 눈금에 맞추고 자와 나란히 놓습니다."},{"displayOrder":3,"id":"0cec3fbf-e34d-43e0-a14c-34bcdbe93e46","isCorrect":false,"text":"끝 눈금 숫자는 보지 않습니다."},{"displayOrder":4,"id":"c0a1156a-44a5-4df0-b6d1-83ba0bc6c0ba","isCorrect":false,"text":"물체를 구부려 자에 맞춥니다."}],"prompt":"자를 사용해 물체의 길이를 재는 방법으로 옳은 것은?","skillCode":"correct-measurement-reasoning","weight":1},{"displayOrder":9,"explanation":"끝 눈금 10cm에서 시작 눈금 2cm를 빼면 막대의 길이는 8cm입니다.","id":"286c2a44-9d61-43f9-94d5-2b2b4b575496","options":[{"displayOrder":1,"id":"361aaf20-c3ea-4a21-b0f3-87aa2c3ad4dc","isCorrect":false,"text":"12cm"},{"displayOrder":2,"id":"addee060-bc1c-4fb1-8be2-781c0f53fd74","isCorrect":false,"text":"10cm"},{"displayOrder":3,"id":"6a86754c-6ca7-4120-b00d-f151cfc354c9","isCorrect":true,"text":"8cm"},{"displayOrder":4,"id":"0a10f919-3711-401d-9ead-f26b886a1d6b","isCorrect":false,"text":"2cm"}],"prompt":"민준이는 2cm 눈금부터 10cm 눈금까지 놓인 막대의 길이를 10cm라고 했습니다. 바른 결과는?","skillCode":"correct-measurement-reasoning","weight":1},{"displayOrder":10,"explanation":"가 막대는 9cm이고 나 막대는 11cm입니다. 나 막대가 5cm 눈금에서 시작하므로 끝 눈금은 16cm입니다.","id":"583f0f27-2dfe-4f6f-b157-6a2a90152385","options":[{"displayOrder":1,"id":"12f7af0a-0465-4d94-86be-443f7413f2dd","isCorrect":false,"text":"11cm"},{"displayOrder":2,"id":"81cea5a8-293e-4792-ab18-6a82ebde080a","isCorrect":false,"text":"14cm"},{"displayOrder":3,"id":"eeb30db1-3fae-469f-9944-9c36bf7511d2","isCorrect":false,"text":"15cm"},{"displayOrder":4,"id":"b52666d1-52e9-4808-87c8-b7e80adee129","isCorrect":true,"text":"16cm"}],"prompt":"가 막대는 4cm부터 13cm까지 놓였습니다. 나 막대는 가 막대보다 2cm 더 길고 5cm 눈금에서 시작합니다. 나 막대의 끝 눈금은?","skillCode":"infer-length-from-measurement","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":4,"id":"ab61feac-d390-4542-9eea-d049b007096d","slug":"grade2-measuring-length","title":"길이를 재어 봐요"},"version":{"id":"29ac4fe6-847f-4c01-a402-ffce3440fad7","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid
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
  where stage.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_measuring_length_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_measuring_length_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 5

  union all
  select 3, 'grade2_measuring_length_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '7920a5b05c79553cefd7fe985c69d17a14cb522564125465842a07530451ce11'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_measuring_length_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_measuring_length_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_measuring_length_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_measuring_length_v1_structure_and_orders',
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
    where stage.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_measuring_length_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_measuring_length_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid))

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
  where metadata.unit_id = 'ab61feac-d390-4542-9eea-d049b007096d'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 4

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = 'ab61feac-d390-4542-9eea-d049b007096d'::uuid
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
  where metadata.unit_id = 'ab61feac-d390-4542-9eea-d049b007096d'::uuid

  union all
  select 23, 'grade2_measuring_length_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_measuring_length_v1_pass_threshold_contract',
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
  select 25, 'grade2_measuring_length_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_measuring_length_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '29ac4fe6-847f-4c01-a402-ffce3440fad7'::uuid

  union all
  select 27, 'grade2_measuring_length_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_measuring_length_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_measuring_length_v1_question_skills_exact',
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
select 999, 'grade2_measuring_length_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
