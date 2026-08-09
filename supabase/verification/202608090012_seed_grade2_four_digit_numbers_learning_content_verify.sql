-- Phase 2B grade2-four-digit-numbers v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":7,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"f646b1de-ed3e-4975-9980-25008f8c5a6a","questions":[{"displayOrder":1,"explanation":"백 묶음 10개는 100을 10번 모은 것이므로 1000입니다.","id":"5365613b-3514-454b-af03-9f2b6fb4da8d","options":[{"displayOrder":1,"id":"6085f833-16a8-4fc2-829e-fe288b369cc6","isCorrect":true,"text":"1000"},{"displayOrder":2,"id":"45677e70-4e32-44f5-a81d-2aa084755f33","isCorrect":false,"text":"100"},{"displayOrder":3,"id":"442a5ee6-3c9b-4479-bd6a-b71c7d7faddc","isCorrect":false,"text":"110"},{"displayOrder":4,"id":"e3e9a947-e388-4308-99c9-3e11c0a9bf83","isCorrect":false,"text":"10000"}],"prompt":"백 묶음이 10개 모인 수는?","skillCode":"understand-thousands","weight":1},{"displayOrder":2,"explanation":"1000이 3개이면 1000+1000+1000이므로 3000입니다.","id":"fa4d9905-ccd3-4620-8682-74693da52eba","options":[{"displayOrder":1,"id":"4f84a33d-551f-4653-9b4a-ba8ef79f9018","isCorrect":false,"text":"300"},{"displayOrder":2,"id":"4674b177-07ff-4ccc-97ee-3f2ae4cc414f","isCorrect":true,"text":"3000"},{"displayOrder":3,"id":"54319a6f-bed1-48cb-8672-710fca1ab6db","isCorrect":false,"text":"1030"},{"displayOrder":4,"id":"cf34c81f-f204-4a0a-a67f-f9eda4b9a8e7","isCorrect":false,"text":"1003"}],"prompt":"1000이 3개 모인 수는?","skillCode":"understand-thousands","weight":1},{"displayOrder":3,"explanation":"3247은 3000과 200과 40과 7로 이루어져 삼천이백사십칠이라고 읽습니다.","id":"34a6e215-3b95-481c-88af-293fb0524045","options":[{"displayOrder":1,"id":"aec7a60f-e592-4706-8296-b99408a1606b","isCorrect":false,"text":"삼천이백칠십사"},{"displayOrder":2,"id":"dad1da28-be11-4d33-8eaf-09d94758ba53","isCorrect":false,"text":"삼백이십사"},{"displayOrder":3,"id":"f03f2924-4ea6-4d7d-ad11-aa5e31086d98","isCorrect":true,"text":"삼천이백사십칠"},{"displayOrder":4,"id":"8884f077-8a3d-4264-a458-3e479751e950","isCorrect":false,"text":"삼천사백이십칠"}],"prompt":"3247을 바르게 읽은 것은?","skillCode":"read-four-digit-number","weight":1},{"displayOrder":4,"explanation":"사천은 4000, 오백은 500, 육십은 60, 이는 2이므로 4562입니다.","id":"bf3cb627-931c-415e-8b4b-f61ac050acd1","options":[{"displayOrder":1,"id":"bd76527f-69d3-47a9-a93f-fe302338af6c","isCorrect":false,"text":"456"},{"displayOrder":2,"id":"8003a56b-552f-41d2-8c83-998c14fca398","isCorrect":false,"text":"40562"},{"displayOrder":3,"id":"9eab4cb3-f28c-4cfd-8aa5-53941e3eb7d9","isCorrect":false,"text":"4652"},{"displayOrder":4,"id":"aa819628-e569-44b8-a227-e55d034aaf9f","isCorrect":true,"text":"4562"}],"prompt":"사천오백육십이를 숫자로 쓴 것은?","skillCode":"write-four-digit-number","weight":1},{"displayOrder":5,"explanation":"5821의 천의 자리는 가장 왼쪽 자리이고 그 숫자는 5입니다.","id":"1a3f30a1-a3bc-4a6f-82a7-8b2390377b09","options":[{"displayOrder":1,"id":"8171ec79-d7ad-4d7e-b0be-0d65b113c763","isCorrect":true,"text":"5"},{"displayOrder":2,"id":"a29bf13f-ee6a-4809-8791-993c80a34612","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"c427cced-f92b-4270-9513-cb3c07060044","isCorrect":false,"text":"2"},{"displayOrder":4,"id":"28ace09d-5793-47ad-9ab2-29ef0ee4d1f6","isCorrect":false,"text":"1"}],"prompt":"5821에서 천의 자리 숫자는?","skillCode":"identify-place-value","weight":1},{"displayOrder":6,"explanation":"7은 백의 자리에 있으므로 7백, 즉 700을 나타냅니다.","id":"5fc61bee-3422-4fdd-8d12-ae671decf383","options":[{"displayOrder":1,"id":"cf5a8315-f43e-4367-a365-fb4902b9ed3f","isCorrect":false,"text":"70"},{"displayOrder":2,"id":"43b1acde-164c-49dd-af4e-a781361d2f8b","isCorrect":true,"text":"700"},{"displayOrder":3,"id":"6256b72c-0f4c-49eb-9e0a-972824350634","isCorrect":false,"text":"7000"},{"displayOrder":4,"id":"4c961b33-c390-4bdf-98a0-4ab00b3bcbe4","isCorrect":false,"text":"7"}],"prompt":"4726에서 백의 자리 숫자 7이 나타내는 값은?","skillCode":"value-of-digit","weight":1},{"displayOrder":7,"explanation":"6000+300+20+5를 합하면 6325입니다.","id":"5bb71624-5724-4f36-b8e2-2e69254d28ee","options":[{"displayOrder":1,"id":"ca2d175f-1b86-4e87-989a-dfd2d490fb9c","isCorrect":false,"text":"632"},{"displayOrder":2,"id":"0e99e13b-fc93-43cc-aacd-90ab7bb03034","isCorrect":false,"text":"6253"},{"displayOrder":3,"id":"3aa4f057-45f8-41d2-9c95-2ec9540455ff","isCorrect":true,"text":"6325"},{"displayOrder":4,"id":"6ed3bf33-2787-4df4-abe6-aa9d97824823","isCorrect":false,"text":"6352"}],"prompt":"천이 6개, 백이 3개, 십이 2개, 일이 5개인 수는?","skillCode":"represent-four-digit-place-units","weight":1},{"displayOrder":8,"explanation":"7010은 천이 7개, 백이 0개, 십이 1개, 일이 0개이므로 칠천십이라고 읽습니다.","id":"fd8970af-4896-4ee3-abfb-12afe7612e05","options":[{"displayOrder":1,"id":"123ff46a-c4a8-4e6e-9265-4f566fc54c3d","isCorrect":false,"text":"칠천백"},{"displayOrder":2,"id":"9d81ba60-d88c-4667-a720-a4c271ba2cb5","isCorrect":false,"text":"칠백십"},{"displayOrder":3,"id":"89f8468d-cdea-4624-a718-4983c0dbe0c1","isCorrect":false,"text":"칠천일"},{"displayOrder":4,"id":"a0347f14-390c-4576-b2ce-50c5a44f9aac","isCorrect":true,"text":"칠천십"}],"prompt":"7010을 바르게 읽은 것은?","skillCode":"read-four-digit-number","weight":1},{"displayOrder":9,"explanation":"3052는 천의 자리 3, 백의 자리 0, 십의 자리 5, 일의 자리 2로 이루어집니다.","id":"037d804e-133c-497a-b934-9c7be73b0056","options":[{"displayOrder":1,"id":"e7c77257-4cd2-448d-88fa-5085f746c8eb","isCorrect":true,"text":"백의 자리"},{"displayOrder":2,"id":"d7394cfc-4615-4c89-892f-2ba969492323","isCorrect":false,"text":"천의 자리"},{"displayOrder":3,"id":"1001ccbf-abd5-4295-8a98-3da64177d2c3","isCorrect":false,"text":"십의 자리"},{"displayOrder":4,"id":"bc5aa398-f167-4121-a168-729ebe7ffac7","isCorrect":false,"text":"일의 자리"}],"prompt":"3052에서 0은 어느 자리에 있습니까?","skillCode":"understand-zero-placeholder","weight":1},{"displayOrder":10,"explanation":"오천육은 5000과 6을 합한 수이므로 백과 십의 자리에 0을 써서 5006입니다.","id":"9ba2ec43-6c70-4ea2-a392-f1be74de368f","options":[{"displayOrder":1,"id":"7926432c-37ee-4ffc-a40b-8688cd218c7f","isCorrect":false,"text":"5060"},{"displayOrder":2,"id":"79143184-2e59-4a62-89c9-023038b5ee62","isCorrect":true,"text":"5006"},{"displayOrder":3,"id":"aca5aacd-5f07-4d89-897c-12d3a616d4d6","isCorrect":false,"text":"5600"},{"displayOrder":4,"id":"459ebdb1-df06-4605-b51f-7e523a99f5e6","isCorrect":false,"text":"506"}],"prompt":"오천육을 숫자로 쓴 것은?","skillCode":"write-four-digit-number","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"4de7cc6a-8fed-4d4e-acfb-00ec148f1154","questions":[{"displayOrder":1,"explanation":"4020은 천 4개, 백 0개, 십 2개, 일 0개로 이루어집니다.","id":"772c1328-584a-4de6-aec2-b01bd95ad1d4","options":[{"displayOrder":1,"id":"331a32f6-0861-418a-9e35-f5c244402ef9","isCorrect":false,"text":"천 4개, 백 2개"},{"displayOrder":2,"id":"619d8684-dd0a-4b05-8f29-1d3ca2902818","isCorrect":false,"text":"천 4개, 일 2개"},{"displayOrder":3,"id":"01018794-eac5-458a-8572-d08728730b01","isCorrect":true,"text":"천 4개, 백 0개, 십 2개, 일 0개"},{"displayOrder":4,"id":"a5f3d82b-ba40-436e-b000-65b18712aab8","isCorrect":false,"text":"천 4개, 백 2개, 십 0개, 일 0개"}],"prompt":"4020을 천·백·십·일로 나타낸 것은?","skillCode":"represent-four-digit-place-units","weight":1},{"displayOrder":2,"explanation":"천 백 십 일의 값을 각 자리에 놓으면 6348입니다.","id":"66c928af-7917-4a3e-9e7f-5458763b1fc2","options":[{"displayOrder":1,"id":"c6b33870-680b-49ad-aae8-ff4a7a6efbf8","isCorrect":false,"text":"6380"},{"displayOrder":2,"id":"491c498e-4667-4a9a-ac08-a1fbb7cbb5aa","isCorrect":false,"text":"6048"},{"displayOrder":3,"id":"e738941e-dcd4-4d94-a9be-5ee19adeef18","isCorrect":false,"text":"6340"},{"displayOrder":4,"id":"09629c71-b2bc-44e1-b291-57a037ab1cb1","isCorrect":true,"text":"6348"}],"prompt":"6000+300+40+8을 하나의 수로 나타낸 것은?","skillCode":"compose-four-digit-number","weight":1},{"displayOrder":3,"explanation":"7254의 각 자리 값은 7000, 200, 50, 4이므로 이 값을 모두 더합니다.","id":"e1ff22a3-a43e-4b31-93d8-7b55b5ef03e8","options":[{"displayOrder":1,"id":"68287dbb-dd06-44dd-ab4d-5585612ce365","isCorrect":true,"text":"7000+200+50+4"},{"displayOrder":2,"id":"10140329-aa8e-4870-b495-4ac2ffa76a07","isCorrect":false,"text":"700+20+50+4"},{"displayOrder":3,"id":"0b314c70-819a-45b2-bf21-79086f3ea559","isCorrect":false,"text":"7000+20+500+4"},{"displayOrder":4,"id":"e9ffd17a-3bf0-4862-857f-b651d8756076","isCorrect":false,"text":"7000+200+5+40"}],"prompt":"7254를 바르게 분해한 것은?","skillCode":"decompose-four-digit-number","weight":1},{"displayOrder":4,"explanation":"5006은 천의 자리 값 5000과 일의 자리 값 6으로 이루어지고 백과 십의 값은 0입니다.","id":"0670cd48-c983-4820-8266-734f5e2524da","options":[{"displayOrder":1,"id":"9040f01f-7a07-46f0-8dbc-060ca3482f4a","isCorrect":false,"text":"5000+60"},{"displayOrder":2,"id":"74d3a36f-54ec-4169-a1b3-3353e8a88b20","isCorrect":true,"text":"5000+6"},{"displayOrder":3,"id":"b2d2917c-b7b0-47cd-b5f7-e105cfda02cf","isCorrect":false,"text":"5000+600"},{"displayOrder":4,"id":"c4344d0d-e5bd-47c7-b29e-c25fe9448180","isCorrect":false,"text":"500+6"}],"prompt":"5006을 바르게 분해한 것은?","skillCode":"decompose-four-digit-number","weight":1},{"displayOrder":5,"explanation":"천의 자리에서 4가 3보다 크므로 4321이 더 큽니다.","id":"88d5681c-454a-4c4c-a5a8-a400e82b2aa5","options":[{"displayOrder":1,"id":"734b126c-3b97-4e9e-b317-ec2142daeea8","isCorrect":false,"text":"3987"},{"displayOrder":2,"id":"e77c16ce-f79e-403e-9175-3c87bd218b77","isCorrect":false,"text":"두 수가 같습니다."},{"displayOrder":3,"id":"685fd3b1-1ee6-40e2-981d-c596f37c1823","isCorrect":true,"text":"4321"},{"displayOrder":4,"id":"c1423a2d-c383-4cfb-b97e-9a2ca885c3d4","isCorrect":false,"text":"비교할 수 없습니다."}],"prompt":"다음 중 더 큰 수는? 4321, 3987","skillCode":"compare-four-digit-numbers","weight":1},{"displayOrder":6,"explanation":"천과 백의 자리는 같고 십의 자리에서 0이 3보다 작으므로 5608<5630입니다.","id":"90d2a44f-4158-4abc-a7ce-fc6587354399","options":[{"displayOrder":1,"id":"ccc41134-0e3f-4ab9-a6e4-4ba9c3385de5","isCorrect":false,"text":"5608>5630"},{"displayOrder":2,"id":"783b7d95-49ad-4469-9310-d476f951d124","isCorrect":false,"text":"5608=5630"},{"displayOrder":3,"id":"46bd0777-2798-436a-aee6-8ec49c15f687","isCorrect":false,"text":"비교할 수 없음"},{"displayOrder":4,"id":"300b4dae-a38a-42eb-a1fb-29309d1b43c4","isCorrect":true,"text":"5608<5630"}],"prompt":"5608과 5630의 크기를 바르게 비교한 것은?","skillCode":"compare-four-digit-numbers","weight":1},{"displayOrder":7,"explanation":"1998에 1을 더하면 1999이므로 바로 다음 수는 1999입니다.","id":"c106d647-b5fa-4f12-b869-f2cfe6f0b24d","options":[{"displayOrder":1,"id":"5ed2963f-2964-4b95-94c0-252656158035","isCorrect":true,"text":"1999"},{"displayOrder":2,"id":"6917490e-71d2-4c56-bf43-9507f7fcb19c","isCorrect":false,"text":"2000"},{"displayOrder":3,"id":"c31dc381-160f-4112-8d35-ec485ef2a431","isCorrect":false,"text":"1997"},{"displayOrder":4,"id":"9eb6f3ca-16b9-4202-a327-6942486823f1","isCorrect":false,"text":"2098"}],"prompt":"1998 다음에 오는 수는?","skillCode":"complete-number-sequence","weight":1},{"displayOrder":8,"explanation":"3999에 1을 더하면 천의 자리가 바뀌어 4000이 됩니다.","id":"b79dfd71-feb0-40a5-a72f-1d13cb56e000","options":[{"displayOrder":1,"id":"983eb289-a897-42fb-ad81-42b6a1a007af","isCorrect":false,"text":"3998"},{"displayOrder":2,"id":"c604143e-a4b8-4e42-bdaa-44817365fea2","isCorrect":true,"text":"4000"},{"displayOrder":3,"id":"fe6facdc-cf41-439c-82eb-01852c6b9ca1","isCorrect":false,"text":"4099"},{"displayOrder":4,"id":"26988104-a3af-427e-8a98-3bf2600cabc5","isCorrect":false,"text":"4999"}],"prompt":"3999 다음에 오는 수는?","skillCode":"complete-number-sequence","weight":1},{"displayOrder":9,"explanation":"9□42의 백의 자리에 5를 넣으면 천 9, 백 5, 십 4, 일 2인 9542입니다.","id":"aa5adf84-ab86-4c91-b447-18090e7d4939","options":[{"displayOrder":1,"id":"82fee1d2-b0ab-45df-b47a-205156575471","isCorrect":false,"text":"9452"},{"displayOrder":2,"id":"d32dab7e-a078-4e53-9eba-61bdc1c34801","isCorrect":false,"text":"9052"},{"displayOrder":3,"id":"9deadd56-0493-42fe-8353-35686371280e","isCorrect":true,"text":"9542"},{"displayOrder":4,"id":"9d85f87d-f3dc-4469-adcc-ed69d24f3511","isCorrect":false,"text":"9524"}],"prompt":"9□42에서 □가 백의 자리 숫자라면 □에 5를 넣은 수는?","skillCode":"infer-number-from-place-conditions","weight":1},{"displayOrder":10,"explanation":"8000과 70과 1을 각 자리에 놓고 백의 자리에는 0을 써서 8071입니다.","id":"cd40645a-ca65-44e3-a77e-866a473f4737","options":[{"displayOrder":1,"id":"4429dcf4-1061-459f-9bdd-463f43581bd7","isCorrect":false,"text":"8070"},{"displayOrder":2,"id":"7bd65506-cfdb-4107-ace6-095213504b99","isCorrect":false,"text":"8701"},{"displayOrder":3,"id":"898888d5-057d-4317-8f24-a59f785d11e7","isCorrect":false,"text":"80071"},{"displayOrder":4,"id":"221056e2-9a4a-4af4-9fe8-a83bb6ad7d13","isCorrect":true,"text":"8071"}],"prompt":"8000+70+1을 숫자로 나타낸 것은?","skillCode":"compose-four-digit-number","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"3d052fdd-93bf-4129-8f78-4f7e63160401","questions":[{"displayOrder":1,"explanation":"천의 자리는 모두 3이고 백의 자리와 그다음 자리를 비교하면 3025<3205<3250입니다.","id":"6e9fd626-d9ce-451d-9e2b-9d9ebe9410b5","options":[{"displayOrder":1,"id":"ded50d57-aaf1-4ef1-852b-d8dbe27f58cb","isCorrect":true,"text":"3025, 3205, 3250"},{"displayOrder":2,"id":"14df948b-4db6-46c2-b942-48ddbbc8036e","isCorrect":false,"text":"3205, 3025, 3250"},{"displayOrder":3,"id":"1d94353e-aa75-4e7b-9b55-63c59cf10a8f","isCorrect":false,"text":"3250, 3205, 3025"},{"displayOrder":4,"id":"925f4aee-8792-4560-84c5-d9180332ca3b","isCorrect":false,"text":"3025, 3250, 3205"}],"prompt":"작은 수부터 차례로 나열한 것은? 3205, 3025, 3250","skillCode":"order-four-digit-numbers","weight":1},{"displayOrder":2,"explanation":"천의 자리는 같고 백과 십의 자리를 비교하면 7100>7010>7001입니다.","id":"f285db75-c8d0-4c88-a876-ab0b89f0c2c8","options":[{"displayOrder":1,"id":"1d0b62d6-24ad-4d16-b1a9-86f6dfe52221","isCorrect":false,"text":"7001, 7010, 7100"},{"displayOrder":2,"id":"746f3a85-171d-4987-a52e-42e7f33b18d5","isCorrect":true,"text":"7100, 7010, 7001"},{"displayOrder":3,"id":"6a7a8248-8a6e-48b0-b1ea-19a9782a21d0","isCorrect":false,"text":"7010, 7100, 7001"},{"displayOrder":4,"id":"cec277eb-13dd-478a-8a93-2a8a15a94ca3","isCorrect":false,"text":"7100, 7001, 7010"}],"prompt":"큰 수부터 차례로 나열한 것은? 7010, 7100, 7001","skillCode":"order-four-digit-numbers","weight":1},{"displayOrder":3,"explanation":"4425보다 크고 4625보다 작으려면 백의 자리 숫자는 4보다 크고 6보다 작은 5입니다.","id":"fef7f6d8-551f-48d0-8a59-da214c4affee","options":[{"displayOrder":1,"id":"fff46bac-6267-47d4-873f-ef546c5c6d28","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"efc233dd-01c3-4845-a6d6-bf4c16c4b0e8","isCorrect":false,"text":"6"},{"displayOrder":3,"id":"54bb2c57-b785-42b7-b66b-404128920929","isCorrect":true,"text":"5"},{"displayOrder":4,"id":"92ebdb8e-5b04-4a93-950a-5e8d9b941484","isCorrect":false,"text":"2"}],"prompt":"4□25가 4425보다 크고 4625보다 작을 때 □에 알맞은 숫자는?","skillCode":"infer-number-from-place-conditions","weight":1},{"displayOrder":4,"explanation":"가장 큰 수를 만들려면 큰 숫자부터 천 백 십 일의 자리에 놓아 8530을 만듭니다.","id":"593a7129-09cf-4c95-a004-efe73ee48340","options":[{"displayOrder":1,"id":"328cee31-4bcf-471d-9921-066ba0bd9ff0","isCorrect":false,"text":"8350"},{"displayOrder":2,"id":"79004c62-54e9-454d-804f-d9454da25b04","isCorrect":false,"text":"8053"},{"displayOrder":3,"id":"f918a172-5ffb-43ed-8c10-2c377eeb792d","isCorrect":false,"text":"8305"},{"displayOrder":4,"id":"0660d19b-aed9-4c88-a68c-2cb68e033db4","isCorrect":true,"text":"8530"}],"prompt":"3, 0, 5, 8 숫자 카드를 한 번씩 사용하여 가장 큰 네 자리 수를 만든 것은?","skillCode":"build-four-digit-number-from-digits","weight":1},{"displayOrder":5,"explanation":"네 자리 수의 천의 자리에는 0을 쓸 수 없으므로 가장 작은 2를 앞에 놓고 나머지는 0,4,7 순서로 놓아 2047입니다.","id":"00d3b241-3b4e-4209-835f-effdbbc6730f","options":[{"displayOrder":1,"id":"016c864e-c323-48b8-ad28-1c3c3425cd2f","isCorrect":true,"text":"2047"},{"displayOrder":2,"id":"c8fb4fff-541f-4b3b-93d0-d9ea2897b773","isCorrect":false,"text":"0247"},{"displayOrder":3,"id":"20eaaf73-3dca-4b0a-af4c-b3bbcf4a7c78","isCorrect":false,"text":"2074"},{"displayOrder":4,"id":"beb16e8c-7cf2-4740-b279-339185355dc6","isCorrect":false,"text":"2407"}],"prompt":"2, 0, 7, 4 숫자 카드를 한 번씩 사용하여 가장 작은 네 자리 수를 만든 것은?","skillCode":"build-four-digit-number-from-digits","weight":1},{"displayOrder":6,"explanation":"천의 자리는 같고 백의 자리 숫자가 5보다 커야 하므로 가장 작은 숫자는 6입니다.","id":"c52599e4-c7f3-4a7d-aa88-6fabad28d8ee","options":[{"displayOrder":1,"id":"9fe000e0-723b-4d88-bf38-110c0211e0f7","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"d50c205d-ff36-4b35-90de-bb76c751afa0","isCorrect":true,"text":"6"},{"displayOrder":3,"id":"0e0c993a-40e0-414c-8f8c-39448b6bd2af","isCorrect":false,"text":"5"},{"displayOrder":4,"id":"2e1156e4-58fa-44af-bda4-018077e48d40","isCorrect":false,"text":"0"}],"prompt":"6□08이 6508보다 클 때 □에 들어갈 수 있는 가장 작은 숫자는?","skillCode":"infer-number-from-place-conditions","weight":1},{"displayOrder":7,"explanation":"천 4개는 4000, 십 3개는 30, 일 9개는 9이고 백의 자리에 0을 써서 4039입니다.","id":"5bd7c0eb-f4b1-4c10-81c6-16951dd5bd36","options":[{"displayOrder":1,"id":"249a60b2-368b-4707-981d-969d5293afd2","isCorrect":false,"text":"4093"},{"displayOrder":2,"id":"e6eda6b5-1636-4d7d-bed9-3d9207f4a1d4","isCorrect":false,"text":"4309"},{"displayOrder":3,"id":"654fe9e0-354d-46f3-9644-82f181ecbd3c","isCorrect":true,"text":"4039"},{"displayOrder":4,"id":"44f86860-c40e-4891-ac01-b2a6381bccd3","isCorrect":false,"text":"40039"}],"prompt":"어떤 수는 천이 4개, 십이 3개, 일이 9개이고 백은 없습니다. 이 수는?","skillCode":"represent-four-digit-place-units","weight":1},{"displayOrder":8,"explanation":"10씩 커지는 배열이므로 5000 다음 수는 5010입니다.","id":"a17c19e4-890b-4513-af63-91e3b259ed60","options":[{"displayOrder":1,"id":"a7268f5f-71c3-41d4-810c-aef5e1b93471","isCorrect":false,"text":"5001"},{"displayOrder":2,"id":"bbf2a3bf-b719-4802-b87a-e1ba7e0c618a","isCorrect":false,"text":"5090"},{"displayOrder":3,"id":"40496a2a-7e73-4f7a-bd89-2086c3daac4f","isCorrect":false,"text":"5100"},{"displayOrder":4,"id":"048f454b-5326-4906-8b46-16047011ccff","isCorrect":true,"text":"5010"}],"prompt":"수 배열 4980, 4990, 5000, □에서 같은 규칙으로 이어질 수는?","skillCode":"complete-number-sequence","weight":1},{"displayOrder":9,"explanation":"천의 자리 5는 같고 백의 자리에서 4와 0이 처음 다르므로 백의 자리를 비교합니다.","id":"f80a7337-bbc9-4972-979e-adadfa3838db","options":[{"displayOrder":1,"id":"feb758d9-1879-42f1-b280-c5f3958adf51","isCorrect":true,"text":"백의 자리"},{"displayOrder":2,"id":"1829a869-4eb8-489c-b0e1-610cde3d1a42","isCorrect":false,"text":"천의 자리"},{"displayOrder":3,"id":"fe9b40f1-9c35-42b7-a30a-9c88f07587e3","isCorrect":false,"text":"십의 자리"},{"displayOrder":4,"id":"026d2768-913e-44f5-b7e5-1040c7abbb74","isCorrect":false,"text":"일의 자리"}],"prompt":"5402와 5042를 비교할 때 가장 먼저 다른 자리는?","skillCode":"compare-four-digit-numbers","weight":1},{"displayOrder":10,"explanation":"3052는 백의 자리가 0이고 십의 자리가 5이며 일의 자리가 2이므로 삼천오십이라고 읽어야 합니다.","id":"2793976f-ed6e-4c67-be7e-450e366d6c4e","options":[{"displayOrder":1,"id":"eea6ec29-b9a9-4606-b77d-cf3d74d4ee26","isCorrect":false,"text":"천의 자리 3을 빠뜨려서"},{"displayOrder":2,"id":"34f71430-95e7-42da-9361-085d6396ce65","isCorrect":true,"text":"백의 자리 0을 5백으로 잘못 읽고 자리 순서를 바꾸어서"},{"displayOrder":3,"id":"c798e380-00c1-4a3a-a898-c639964e8ba7","isCorrect":false,"text":"일의 자리 2를 십으로 읽지 않아서"},{"displayOrder":4,"id":"9a89cbe4-9b38-4e23-b0c6-671729651e41","isCorrect":false,"text":"3052는 읽을 수 없는 수라서"}],"prompt":"친구가 3052를 ''삼천오백이십''이라고 읽었습니다. 잘못 읽은 까닭은?","skillCode":"correct-zero-place-value-error","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"bc44d9d9-489c-4b71-8188-7e29ec3d1f8f","questions":[{"displayOrder":1,"explanation":"천의 자리 숫자는 4보다 크고 6보다 작은 홀수 5이므로 가능한 수는 5205입니다.","id":"774cec79-4513-428e-b909-6e963c19dada","options":[{"displayOrder":1,"id":"615844df-5194-41f2-af5c-0ef4ab04dd17","isCorrect":true,"text":"5205"},{"displayOrder":2,"id":"0e1e8355-45fa-4a6e-b265-d769c14a3572","isCorrect":false,"text":"3205"},{"displayOrder":3,"id":"89d388c8-f703-40ab-a3f7-2ea2b350cade","isCorrect":false,"text":"4205"},{"displayOrder":4,"id":"05e244d4-e118-48da-a4b7-dbc9e337a95e","isCorrect":false,"text":"6205"}],"prompt":"□205가 4205보다 크고 6205보다 작으며 천의 자리 숫자가 홀수일 때 가능한 수는?","skillCode":"infer-number-from-place-conditions","weight":1},{"displayOrder":2,"explanation":"3000보다 크려면 천의 자리에 3을 놓고 남은 숫자를 작은 순서 0,1,9로 놓아 3019입니다.","id":"628ea576-0015-457f-ae7a-8af355f75284","options":[{"displayOrder":1,"id":"33039568-6ffa-4650-89c8-0c402d2c0106","isCorrect":false,"text":"3091"},{"displayOrder":2,"id":"da33fd21-2668-47f1-a3bd-2ff1578bc62a","isCorrect":true,"text":"3019"},{"displayOrder":3,"id":"a024936b-e668-4f7f-b2f7-e542c9ee9b9f","isCorrect":false,"text":"3109"},{"displayOrder":4,"id":"36fb3d68-7934-4a2b-b637-e28f61af6295","isCorrect":false,"text":"3190"}],"prompt":"1, 3, 0, 9를 한 번씩 사용해 3000보다 큰 가장 작은 수는?","skillCode":"build-four-digit-number-from-digits","weight":1},{"displayOrder":3,"explanation":"네 자리 수가 세 자리 수보다 크고 네 자리 수끼리는 높은 자리부터 비교하여 4200>4020>4002>420입니다.","id":"e6991067-bd8d-4801-8f08-f34427646830","options":[{"displayOrder":1,"id":"0f930398-f9f7-406c-8bd3-e53945c2230d","isCorrect":false,"text":"420, 4002, 4020, 4200"},{"displayOrder":2,"id":"2aab95ac-6c09-4c09-9ccf-3d4d70c1acb7","isCorrect":false,"text":"4020, 4200, 4002, 420"},{"displayOrder":3,"id":"acad31ec-60bc-44cb-9d62-31f81d745bfc","isCorrect":true,"text":"4200, 4020, 4002, 420"},{"displayOrder":4,"id":"6df38de2-9679-4175-b178-037ce3a25ca0","isCorrect":false,"text":"4200, 4002, 4020, 420"}],"prompt":"가장 큰 수부터 나열한 것은? 4020, 4200, 4002, 420","skillCode":"order-four-digit-numbers","weight":1},{"displayOrder":4,"explanation":"5074에서 백의 자리는 0이고 7은 십의 자리이므로 5000+70+4로 분해합니다.","id":"d7696201-a8e8-4136-98c4-aa2656bd0776","options":[{"displayOrder":1,"id":"282697ba-ac5f-4ba6-a21c-5dae70752a00","isCorrect":false,"text":"7은 백의 자리이므로 700이 맞습니다."},{"displayOrder":2,"id":"c4f33147-55a0-430f-a97b-1d9d329f3521","isCorrect":false,"text":"5074=500+70+4입니다."},{"displayOrder":3,"id":"2116a67f-3deb-4c92-8388-eaa9c605d823","isCorrect":false,"text":"0을 100으로 바꾸어야 합니다."},{"displayOrder":4,"id":"f2c09374-11f5-4b33-acd6-38899192a50f","isCorrect":true,"text":"7은 십의 자리이므로 5074=5000+70+4입니다."}],"prompt":"친구가 5074=5000+700+4라고 했습니다. 바르게 고친 설명은?","skillCode":"correct-zero-place-value-error","weight":1},{"displayOrder":5,"explanation":"5000보다 작으려면 천의 자리에 4를 놓고 나머지를 큰 순서 8,6,2로 놓아 4862입니다.","id":"d0bdecd9-332b-4832-9d4e-b56824cd17fa","options":[{"displayOrder":1,"id":"71812e0f-7e49-4be0-8ad6-3fac7c5312e0","isCorrect":false,"text":"8642"},{"displayOrder":2,"id":"6c03681f-92cb-4d1e-b27e-89ee549d2f33","isCorrect":false,"text":"4682"},{"displayOrder":3,"id":"eee40e5b-3171-4fcf-ae35-e0dde53b92d5","isCorrect":true,"text":"4862"},{"displayOrder":4,"id":"093aea98-bbff-423a-9df2-2fe82b4c5550","isCorrect":false,"text":"4826"}],"prompt":"2, 4, 6, 8을 한 번씩 사용하여 5000보다 작은 가장 큰 수는?","skillCode":"build-four-digit-number-from-digits","weight":1},{"displayOrder":6,"explanation":"천과 백의 자리는 같고 십의 자리에서 0보다 커야 하므로 가장 작은 숫자는 1입니다.","id":"cf47fe5f-bebf-4ede-a12f-7998efe248d0","options":[{"displayOrder":1,"id":"2950dc87-deeb-4e8e-8417-8143a8321958","isCorrect":false,"text":"0"},{"displayOrder":2,"id":"4ccd6819-e720-4866-86b9-daa77428fee0","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"b7189b56-34fc-49f4-88b7-f72130110fc3","isCorrect":false,"text":"2"},{"displayOrder":4,"id":"2c7b378e-bcd7-487f-8d1a-cf09a40954aa","isCorrect":true,"text":"1"}],"prompt":"4308<43□8이 되도록 □에 들어갈 수 있는 가장 작은 숫자는?","skillCode":"infer-number-from-place-conditions","weight":1},{"displayOrder":7,"explanation":"천의 자리는 모두 9이고 백의 자리에서 9800이 가장 큽니다. 9080은 십의 자리 8이 있어 9008보다 큽니다.","id":"d2569537-db19-4e64-9b6c-fb43367031bd","options":[{"displayOrder":1,"id":"d585280c-9f16-4cf9-854a-7186c83bc581","isCorrect":true,"text":"9080은 9008보다 작습니다."},{"displayOrder":2,"id":"bbc8d62e-b71c-4492-aac3-78e8bab32c9a","isCorrect":false,"text":"9800이 가장 큽니다."},{"displayOrder":3,"id":"d12333c9-ff70-4158-8a65-8516ba5b69e7","isCorrect":false,"text":"9008은 9080보다 작습니다."},{"displayOrder":4,"id":"5f9c2dc9-52f0-49c7-84bb-5ce5aa4ccfe1","isCorrect":false,"text":"세 수의 천의 자리 숫자는 모두 9입니다."}],"prompt":"9080, 9008, 9800을 비교한 설명 중 잘못된 것은?","skillCode":"correct-comparison-order-error","weight":1},{"displayOrder":8,"explanation":"6725는 6000+700+20+5이므로 백의 자리 값을 나타내는 □는 700입니다.","id":"a68bff06-b805-4e2f-88ec-d26fc8e09bc5","options":[{"displayOrder":1,"id":"990b79ef-4a63-41a7-9cba-a67aca34a11f","isCorrect":false,"text":"70"},{"displayOrder":2,"id":"36910bd9-0b05-4daa-b28c-117b899555e7","isCorrect":true,"text":"700"},{"displayOrder":3,"id":"1eaacb15-453b-4d3c-8a44-4c690c830cb3","isCorrect":false,"text":"7"},{"displayOrder":4,"id":"d993df02-5a84-438a-b7fa-63817bd90291","isCorrect":false,"text":"720"}],"prompt":"어떤 수를 6000+□+20+5로 분해했습니다. 그 수가 6725라면 □는?","skillCode":"decompose-four-digit-number","weight":1},{"displayOrder":9,"explanation":"가장 크게 만들려면 백의 자리에 가능한 가장 큰 5를, 십의 자리에 0을 놓아 7506입니다.","id":"fcfe2f99-8858-4c6a-9828-19b19450b2f9","options":[{"displayOrder":1,"id":"3c8cee8f-8264-40d8-850b-beb7dbe32bce","isCorrect":false,"text":"7056"},{"displayOrder":2,"id":"3b467b11-ce2b-4b9a-920b-25c41ed9ea1f","isCorrect":false,"text":"7416"},{"displayOrder":3,"id":"2f0cf1c8-c954-4f6d-a9a3-41d015eba67b","isCorrect":true,"text":"7506"},{"displayOrder":4,"id":"4f59c590-6bfc-44b0-b76a-73b05fcdb2ee","isCorrect":false,"text":"7526"}],"prompt":"천의 자리 7, 일의 자리 6이고 백과 십의 자리 숫자의 합이 5인 가장 큰 수는?","skillCode":"infer-number-from-place-conditions","weight":1},{"displayOrder":10,"explanation":"가장 작은 수는 2057이고 일의 자리 5와 7의 순서를 바꾼 2075가 두 번째로 작습니다.","id":"e158bc18-d93f-4b31-b494-3d07eceec5b2","options":[{"displayOrder":1,"id":"1ce2393a-75ab-410b-a573-c9a3506dec36","isCorrect":false,"text":"2057"},{"displayOrder":2,"id":"c4564231-9005-41b1-ba51-d33cdcef1a49","isCorrect":false,"text":"2507"},{"displayOrder":3,"id":"ad60b21c-4644-4572-a914-1003dcea928f","isCorrect":false,"text":"2570"},{"displayOrder":4,"id":"7f5863c8-a4b6-4af5-a615-5bd1eab51e85","isCorrect":true,"text":"2075"}],"prompt":"수 카드 0, 2, 5, 7로 만든 네 자리 수 중 두 번째로 작은 수는?","skillCode":"build-four-digit-number-from-digits","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":7,"id":"66bef880-3b26-4dc3-84a6-13986aae72d8","slug":"grade2-four-digit-numbers","title":"네 자리 수를 알아봐요"},"version":{"id":"06abbe3b-4061-4afe-84ca-d69122f9d7b8","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid
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
  where stage.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_four_digit_numbers_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_four_digit_numbers_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 8

  union all
  select 3, 'grade2_four_digit_numbers_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '6c6f062b0c64aeac7c4ff9b0a2fee6bdfa4d2537b06737a52164123844009ca8'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_four_digit_numbers_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_four_digit_numbers_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_four_digit_numbers_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_four_digit_numbers_v1_structure_and_orders',
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
    where stage.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_four_digit_numbers_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_four_digit_numbers_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid))

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
  where metadata.unit_id = '66bef880-3b26-4dc3-84a6-13986aae72d8'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 7

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = '66bef880-3b26-4dc3-84a6-13986aae72d8'::uuid
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
  where metadata.unit_id = '66bef880-3b26-4dc3-84a6-13986aae72d8'::uuid

  union all
  select 23, 'grade2_four_digit_numbers_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_four_digit_numbers_v1_pass_threshold_contract',
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
  select 25, 'grade2_four_digit_numbers_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_four_digit_numbers_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '06abbe3b-4061-4afe-84ca-d69122f9d7b8'::uuid

  union all
  select 27, 'grade2_four_digit_numbers_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_four_digit_numbers_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_four_digit_numbers_v1_question_skills_exact',
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
select 999, 'grade2_four_digit_numbers_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
