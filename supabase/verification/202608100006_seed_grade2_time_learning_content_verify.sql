-- Phase 2B grade2-time v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":10,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"81a4c29f-f274-4e60-8608-cc42fcb6c541","questions":[{"displayOrder":1,"explanation":"분침은 0분을, 시침은 2시를 나타내므로 2시 정각입니다.","id":"3818994e-1446-49d0-b6e0-547dbb06c144","options":[{"displayOrder":1,"id":"3e5ce115-44e7-40eb-8fb5-6efd5465b297","isCorrect":true,"text":"2시 정각"},{"displayOrder":2,"id":"87772183-3106-4690-ae5e-baf0bd02e91c","isCorrect":false,"text":"2시 5분"},{"displayOrder":3,"id":"7d1245d8-443f-4535-a3a7-5013d766e452","isCorrect":false,"text":"3시 정각"},{"displayOrder":4,"id":"651c4a4c-d2dc-45f9-9af1-bf3afe61740e","isCorrect":false,"text":"2시 2분"}],"prompt":"분침이 12을 가리키고 시침을 읽으면 2시입니다. 이 시각은?","skillCode":"read-clock-time","weight":1},{"displayOrder":2,"explanation":"분침은 30분을, 시침은 5시를 나타내므로 5시 30분입니다.","id":"ebd9cd93-a2a7-44c5-9077-964730c9db26","options":[{"displayOrder":1,"id":"14c3b689-a863-4f9d-bd13-43511e9c8e93","isCorrect":false,"text":"5시 35분"},{"displayOrder":2,"id":"8c7075d5-4e93-481c-b7cc-464dcb4a77f0","isCorrect":true,"text":"5시 30분"},{"displayOrder":3,"id":"d79b7ad9-4afa-4085-b27c-f260ee5d90dc","isCorrect":false,"text":"6시 30분"},{"displayOrder":4,"id":"f83ffafd-520c-4800-8f19-32ba9e801496","isCorrect":false,"text":"30시 5분"}],"prompt":"분침이 6을 가리키고 시침을 읽으면 5시입니다. 이 시각은?","skillCode":"read-clock-time","weight":1},{"displayOrder":3,"explanation":"분침은 15분을, 시침은 7시를 나타내므로 7시 15분입니다.","id":"bd84f1dd-305a-49f6-9739-52c652eae77d","options":[{"displayOrder":1,"id":"fb0ab948-73d4-4127-a1ce-2d484cbba057","isCorrect":false,"text":"7시 20분"},{"displayOrder":2,"id":"96a79ec6-7d5f-48b9-902d-13fd48bce01b","isCorrect":false,"text":"8시 15분"},{"displayOrder":3,"id":"cf64662c-6e2d-4add-b40a-109135a8cc59","isCorrect":true,"text":"7시 15분"},{"displayOrder":4,"id":"aa0b9c64-4834-4602-af8d-67341e8b3d09","isCorrect":false,"text":"15시 7분"}],"prompt":"분침이 3을 가리키고 시침을 읽으면 7시입니다. 이 시각은?","skillCode":"read-clock-time","weight":1},{"displayOrder":4,"explanation":"분침은 45분을, 시침은 9시를 나타내므로 9시 45분입니다.","id":"e9538d6e-6ad0-4fa8-a057-edf938634b37","options":[{"displayOrder":1,"id":"10f7cc9c-82cb-41de-bfd6-926d5334e8e0","isCorrect":false,"text":"9시 50분"},{"displayOrder":2,"id":"30cdb1d9-eb4d-4717-ae94-1ce696513316","isCorrect":false,"text":"10시 45분"},{"displayOrder":3,"id":"de3042e4-d229-4d2f-8eb5-36a4940c0259","isCorrect":false,"text":"45시 9분"},{"displayOrder":4,"id":"d2684447-9837-4a38-b381-f8930b02d770","isCorrect":true,"text":"9시 45분"}],"prompt":"분침이 9을 가리키고 시침을 읽으면 9시입니다. 이 시각은?","skillCode":"read-clock-time","weight":1},{"displayOrder":5,"explanation":"분침은 25분을, 시침은 11시를 나타내므로 11시 25분입니다.","id":"20cc2f45-4118-44dc-ada0-bd55b00d29cf","options":[{"displayOrder":1,"id":"41f0b0fd-4c2d-461b-8fe6-5975db996c20","isCorrect":true,"text":"11시 25분"},{"displayOrder":2,"id":"7cde75a2-33f9-4f1c-9544-3f2926f0250c","isCorrect":false,"text":"11시 30분"},{"displayOrder":3,"id":"09464608-aaf2-4aea-ac00-20d63ebd51b7","isCorrect":false,"text":"12시 25분"},{"displayOrder":4,"id":"868f3a8f-2182-4368-a2e7-849f1b143374","isCorrect":false,"text":"25시 11분"}],"prompt":"분침이 5을 가리키고 시침을 읽으면 11시입니다. 이 시각은?","skillCode":"read-clock-time","weight":1},{"displayOrder":6,"explanation":"시계의 숫자 한 칸은 5분이므로 1×5=5분입니다.","id":"bed0d5ec-67ac-4092-b623-122e293cc6fb","options":[{"displayOrder":1,"id":"2063ab16-b477-4bc2-ac6b-a3fb82b5c089","isCorrect":false,"text":"1분"},{"displayOrder":2,"id":"a1ede1e6-8892-4d34-acb4-306acd93659e","isCorrect":true,"text":"5분"},{"displayOrder":3,"id":"41c0a05d-d141-475f-b599-2f0fd6e240c3","isCorrect":false,"text":"10분"},{"displayOrder":4,"id":"28208715-76f1-4d27-9214-e892ad51dc7d","isCorrect":false,"text":"0분"}],"prompt":"분침이 숫자 1을 가리킬 때 지난 분은?","skillCode":"use-five-minute-intervals","weight":1},{"displayOrder":7,"explanation":"시계의 숫자 한 칸은 5분이므로 3×5=15분입니다.","id":"23510083-f811-403d-a323-5d21c58aa36a","options":[{"displayOrder":1,"id":"03fd7819-1db4-4ca6-aa1b-cd59f7ba2fbd","isCorrect":true,"text":"15분"},{"displayOrder":2,"id":"fd26077b-1ee2-41a6-b36f-61f018a715d3","isCorrect":false,"text":"3분"},{"displayOrder":3,"id":"4408cfbb-ecc3-45ef-a02f-b0964a551ecd","isCorrect":false,"text":"30분"},{"displayOrder":4,"id":"aaee4ccc-9b82-4551-aef7-df7d0d5efd3d","isCorrect":false,"text":"10분"}],"prompt":"분침이 숫자 3을 가리킬 때 지난 분은?","skillCode":"use-five-minute-intervals","weight":1},{"displayOrder":8,"explanation":"시계의 숫자 한 칸은 5분이므로 6×5=30분입니다.","id":"cc24da79-915c-4d18-8e48-6d5729a6e4b0","options":[{"displayOrder":1,"id":"9dc24878-aa1d-44c9-99a0-f828bcd246b5","isCorrect":false,"text":"6분"},{"displayOrder":2,"id":"f5518741-870b-4d76-b892-d84f8c3a4517","isCorrect":true,"text":"30분"},{"displayOrder":3,"id":"fcbba247-906d-46ff-969a-52358ac0c17b","isCorrect":false,"text":"60분"},{"displayOrder":4,"id":"efbc7335-622a-428f-ba29-b3faddbe87a7","isCorrect":false,"text":"25분"}],"prompt":"분침이 숫자 6을 가리킬 때 지난 분은?","skillCode":"use-five-minute-intervals","weight":1},{"displayOrder":9,"explanation":"시계의 숫자 한 칸은 5분이므로 8×5=40분입니다.","id":"d274099a-7687-4ae2-87d3-6291e13aac94","options":[{"displayOrder":1,"id":"f744d5e1-b663-408c-a0c9-52a4e2bb515a","isCorrect":false,"text":"8분"},{"displayOrder":2,"id":"6ba4979f-ac3e-48a7-9b74-30674c13c58a","isCorrect":false,"text":"80분"},{"displayOrder":3,"id":"586ec7e3-b6eb-430a-b0f8-cd1cbc0f34b9","isCorrect":true,"text":"40분"},{"displayOrder":4,"id":"9b6394c0-9f34-4c7c-a68e-b02987c749d7","isCorrect":false,"text":"35분"}],"prompt":"분침이 숫자 8을 가리킬 때 지난 분은?","skillCode":"use-five-minute-intervals","weight":1},{"displayOrder":10,"explanation":"시계의 숫자 한 칸은 5분이므로 10×5=50분입니다.","id":"54aa7f11-bd83-4f1f-98b9-c7845191117a","options":[{"displayOrder":1,"id":"69e2953a-1540-4d3a-9f76-3c878d979c16","isCorrect":false,"text":"10분"},{"displayOrder":2,"id":"b6d7feac-5111-4380-9fba-b2704c09de26","isCorrect":false,"text":"100분"},{"displayOrder":3,"id":"8ad9a53a-a814-45db-a88b-d930b9194efa","isCorrect":false,"text":"45분"},{"displayOrder":4,"id":"496d9ac7-c5f9-4338-82b1-aafca779c993","isCorrect":true,"text":"50분"}],"prompt":"분침이 숫자 10을 가리킬 때 지난 분은?","skillCode":"use-five-minute-intervals","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"415a7931-2908-41d7-ad5e-7365e74d8876","questions":[{"displayOrder":1,"explanation":"8시 10분에 20분을 더하면 8시 30분입니다.","id":"9a6d16d2-103b-453b-acba-ee89cb3ed4bf","options":[{"displayOrder":1,"id":"c97b3827-a342-4661-91fb-9aca7cbb967e","isCorrect":true,"text":"8시 30분"},{"displayOrder":2,"id":"052a20ee-16f7-45a2-83ba-6f79db4f75e3","isCorrect":false,"text":"8시 25분"},{"displayOrder":3,"id":"76586d39-3805-42d2-933d-55ac325cda95","isCorrect":false,"text":"8시 35분"},{"displayOrder":4,"id":"eca9fc8a-f766-4f13-9db7-650527d440cc","isCorrect":false,"text":"7시 50분"}],"prompt":"8시 10분에서 20분 후는 언제입니까?","skillCode":"calculate-time-after","weight":1},{"displayOrder":2,"explanation":"9시 25분에 30분을 더하면 9시 55분입니다.","id":"8720201d-5792-4f2b-9884-a97d49df3dc0","options":[{"displayOrder":1,"id":"b81dfd4c-0d05-4db2-b142-1fff1d743c3c","isCorrect":false,"text":"9시 50분"},{"displayOrder":2,"id":"7b70a193-7d78-432f-b678-4e4f4d768e08","isCorrect":true,"text":"9시 55분"},{"displayOrder":3,"id":"b39120de-3dce-40f0-b868-a26f46735d8b","isCorrect":false,"text":"10시 정각"},{"displayOrder":4,"id":"889acc32-34ca-4a3a-b9c7-668209648b3e","isCorrect":false,"text":"8시 55분"}],"prompt":"9시 25분에서 30분 후는 언제입니까?","skillCode":"calculate-time-after","weight":1},{"displayOrder":3,"explanation":"1시 40분에 15분을 더하면 1시 55분입니다.","id":"7410ae05-c083-4b13-8a1d-43bde4d55efe","options":[{"displayOrder":1,"id":"2250b9db-7cd0-4e4f-b062-66042009d96c","isCorrect":false,"text":"1시 50분"},{"displayOrder":2,"id":"21ce1f16-0d9b-4a83-b32a-e174cc05965b","isCorrect":false,"text":"2시 정각"},{"displayOrder":3,"id":"46e2de5d-df13-49a7-a27f-d37a95edd2e9","isCorrect":true,"text":"1시 55분"},{"displayOrder":4,"id":"249fd4c6-2f58-4bd9-8224-5ecb129a2528","isCorrect":false,"text":"1시 25분"}],"prompt":"1시 40분에서 15분 후는 언제입니까?","skillCode":"calculate-time-after","weight":1},{"displayOrder":4,"explanation":"3시 5분에 40분을 더하면 3시 45분입니다.","id":"f84676e1-41cf-4da4-bfe0-f63948d84f4f","options":[{"displayOrder":1,"id":"ad03dbcd-0562-4bf0-a925-d3e1d744d0da","isCorrect":false,"text":"3시 40분"},{"displayOrder":2,"id":"1b31e4ea-01d2-4d96-bca1-84bf1d31304c","isCorrect":false,"text":"3시 50분"},{"displayOrder":3,"id":"48a6f8ea-b46b-48f4-964f-a58e6fbcff72","isCorrect":false,"text":"2시 25분"},{"displayOrder":4,"id":"bdbc4a22-85fd-42c6-86d6-cd12a1bb36f9","isCorrect":true,"text":"3시 45분"}],"prompt":"3시 5분에서 40분 후는 언제입니까?","skillCode":"calculate-time-after","weight":1},{"displayOrder":5,"explanation":"10시 30분에서 20분을 빼면 10시 10분입니다.","id":"48ad17a3-5661-4dc8-95b6-dce8035c0569","options":[{"displayOrder":1,"id":"c2892225-36b2-4bea-a7e3-58dbc3a30c15","isCorrect":false,"text":"10시 5분"},{"displayOrder":2,"id":"50a33ae9-e7b5-4fb0-9fa9-b438afe5b034","isCorrect":false,"text":"10시 15분"},{"displayOrder":3,"id":"2fd2a08c-d952-4059-8f3d-1b1b09d43e21","isCorrect":true,"text":"10시 10분"},{"displayOrder":4,"id":"7d480400-7252-486d-9e0b-70eb1442f691","isCorrect":false,"text":"10시 50분"}],"prompt":"10시 30분에서 20분 전은 언제입니까?","skillCode":"calculate-time-before","weight":1},{"displayOrder":6,"explanation":"4시 15분에서 10분을 빼면 4시 5분입니다.","id":"f7d0f319-c128-462c-ab09-2ef9c0a011d2","options":[{"displayOrder":1,"id":"b83e568f-807c-4538-95e5-7c924e0f66a6","isCorrect":false,"text":"4시 정각"},{"displayOrder":2,"id":"3be96bb5-0e82-4fad-93a8-9cb2a25ee7df","isCorrect":false,"text":"4시 10분"},{"displayOrder":3,"id":"3945a00f-3f12-4c98-aaf3-221eebfc8f9b","isCorrect":false,"text":"4시 25분"},{"displayOrder":4,"id":"9c8ac369-31d3-4016-aadc-cbe8d330fad2","isCorrect":true,"text":"4시 5분"}],"prompt":"4시 15분에서 10분 전은 언제입니까?","skillCode":"calculate-time-before","weight":1},{"displayOrder":7,"explanation":"7시 50분에서 25분을 빼면 7시 25분입니다.","id":"da1b07db-bea3-49ba-9a50-411136956fe1","options":[{"displayOrder":1,"id":"c03908d5-faf9-407c-a303-731f58148b42","isCorrect":true,"text":"7시 25분"},{"displayOrder":2,"id":"272710a6-91c3-4403-b1b1-33b177f59e8b","isCorrect":false,"text":"7시 20분"},{"displayOrder":3,"id":"5c390f35-a575-4596-8e82-31174e527aa1","isCorrect":false,"text":"7시 30분"},{"displayOrder":4,"id":"4db9bea6-d499-4ae8-bc0f-9a3fb4a10261","isCorrect":false,"text":"8시 15분"}],"prompt":"7시 50분에서 25분 전은 언제입니까?","skillCode":"calculate-time-before","weight":1},{"displayOrder":8,"explanation":"12시 20분에서 15분을 빼면 12시 5분입니다.","id":"e6898529-1d6a-4396-8364-ac09909692fe","options":[{"displayOrder":1,"id":"40250631-c215-4995-aa06-48c495c9df68","isCorrect":false,"text":"12시 정각"},{"displayOrder":2,"id":"7448c6a9-4b15-4bd2-8619-0958976f6a6f","isCorrect":true,"text":"12시 5분"},{"displayOrder":3,"id":"7d60e0fc-6bff-44f7-a6d9-efc554e476f0","isCorrect":false,"text":"12시 10분"},{"displayOrder":4,"id":"a1478628-f0b4-494d-8fe4-936ef6975afe","isCorrect":false,"text":"12시 35분"}],"prompt":"12시 20분에서 15분 전은 언제입니까?","skillCode":"calculate-time-before","weight":1},{"displayOrder":9,"explanation":"아침은 낮 12시 전이므로 오전 8시가 알맞습니다.","id":"ac794063-753e-4ef8-bc4a-3cb81bd9f42f","options":[{"displayOrder":1,"id":"d634c73b-fb90-4550-a050-4ce36fa2f8e9","isCorrect":false,"text":"오후 8시"},{"displayOrder":2,"id":"eb09ccac-73ca-4c33-8746-c47a08a37e30","isCorrect":false,"text":"오전 12시"},{"displayOrder":3,"id":"9fd41ca5-9696-444f-8a83-c4376014306d","isCorrect":true,"text":"오전 8시"},{"displayOrder":4,"id":"8a08864a-8ef2-47ca-b08b-419421ffe75e","isCorrect":false,"text":"오후 2시"}],"prompt":"아침 식사를 하는 시각으로 알맞은 것은?","skillCode":"distinguish-am-pm","weight":1},{"displayOrder":10,"explanation":"저녁은 낮 12시 뒤이므로 오후 7시가 알맞습니다.","id":"c0ce045b-ef91-4816-ac4f-30fb13e4963b","options":[{"displayOrder":1,"id":"dabe654d-31f2-4ef2-b441-f85dbf7bb6a6","isCorrect":false,"text":"오전 7시"},{"displayOrder":2,"id":"4147bd31-b03a-4532-886f-92beaee9fe76","isCorrect":false,"text":"오전 1시"},{"displayOrder":3,"id":"5653b83e-b2d1-47f5-8361-c0bf1d7edbc7","isCorrect":false,"text":"오후 7분"},{"displayOrder":4,"id":"2c3faef7-955e-49fd-909d-bbefaed18480","isCorrect":true,"text":"오후 7시"}],"prompt":"저녁 운동을 하는 시각으로 알맞은 것은?","skillCode":"distinguish-am-pm","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"0bade680-571a-459e-aa2f-f824a43137a9","questions":[{"displayOrder":1,"explanation":"끝 시각에서 시작 시각을 빼면 515-480=35분입니다.","id":"8334c12b-4df9-4ef5-a9c9-c9076d72e787","options":[{"displayOrder":1,"id":"50c7146c-a77a-4d43-b7f1-84a306830aaa","isCorrect":true,"text":"35분"},{"displayOrder":2,"id":"23234a69-532e-4153-9010-d9e98fbb601e","isCorrect":false,"text":"30분"},{"displayOrder":3,"id":"a62ef26e-83b6-458c-adee-5d797fbf7f77","isCorrect":false,"text":"40분"},{"displayOrder":4,"id":"e6b6979e-f391-4525-8d9a-82262f6d893b","isCorrect":false,"text":"0분"}],"prompt":"8시 정각에 시작해 8시 35분에 끝났습니다. 지난 시간은?","skillCode":"calculate-elapsed-time","weight":1},{"displayOrder":2,"explanation":"끝 시각에서 시작 시각을 빼면 605-560=45분입니다.","id":"73ce8652-8548-40ff-99e4-2e03cdf2321c","options":[{"displayOrder":1,"id":"7bab11f1-aa2b-4ca9-83b6-ddf629afcc69","isCorrect":false,"text":"40분"},{"displayOrder":2,"id":"f10196f1-ee5a-41e9-b78e-6dcd9e544486","isCorrect":true,"text":"45분"},{"displayOrder":3,"id":"16aa7261-b851-40b0-87cf-9f10ab8d940b","isCorrect":false,"text":"50분"},{"displayOrder":4,"id":"ec7846a5-5971-4043-9e43-f514f3a1f20d","isCorrect":false,"text":"1분"}],"prompt":"9시 20분에 시작해 10시 5분에 끝났습니다. 지난 시간은?","skillCode":"calculate-elapsed-time","weight":1},{"displayOrder":3,"explanation":"끝 시각에서 시작 시각을 빼면 120-75=45분입니다.","id":"e20a5ee0-16c2-4355-84ce-f2095316b2d1","options":[{"displayOrder":1,"id":"589f22ba-b00a-4757-adf3-e982fb64ce2f","isCorrect":false,"text":"40분"},{"displayOrder":2,"id":"bac07fb8-be23-4509-adc2-164d9399aa05","isCorrect":false,"text":"50분"},{"displayOrder":3,"id":"139a71f2-84fb-41c0-9883-51ca1c11f8f3","isCorrect":true,"text":"45분"},{"displayOrder":4,"id":"30c2cbeb-c959-42da-93cc-82c55b2653de","isCorrect":false,"text":"1분"}],"prompt":"1시 15분에 시작해 2시 정각에 끝났습니다. 지난 시간은?","skillCode":"calculate-elapsed-time","weight":1},{"displayOrder":4,"explanation":"끝 시각에서 시작 시각을 빼면 250-220=30분입니다.","id":"5b1c8408-682f-431f-bd5b-974dae027ac3","options":[{"displayOrder":1,"id":"8c5c5b33-f31f-4725-b165-a67f7a2b3a2d","isCorrect":false,"text":"25분"},{"displayOrder":2,"id":"09d73fe1-c451-4be0-bfbc-49242978f9b1","isCorrect":false,"text":"35분"},{"displayOrder":3,"id":"f686cdcf-7f47-4a63-896b-5fe274fa67fe","isCorrect":false,"text":"1분"},{"displayOrder":4,"id":"3dfcb048-459f-4cb0-97dd-c76ef1faefdc","isCorrect":true,"text":"30분"}],"prompt":"3시 40분에 시작해 4시 10분에 끝났습니다. 지난 시간은?","skillCode":"calculate-elapsed-time","weight":1},{"displayOrder":5,"explanation":"시작 시각 7시 30분에 45분을 더하면 8시 15분입니다.","id":"38951de1-c85a-4416-a02b-486d8f3b49d1","options":[{"displayOrder":1,"id":"9a7b8441-fa67-465c-a586-a0c88c1291a2","isCorrect":true,"text":"8시 15분"},{"displayOrder":2,"id":"9abf62bb-b33c-4e3b-b738-6a3b81b62263","isCorrect":false,"text":"8시 10분"},{"displayOrder":3,"id":"677f773b-fd88-4c66-b10c-9c866cc16326","isCorrect":false,"text":"8시 20분"},{"displayOrder":4,"id":"3b481696-b5a0-478e-b563-56672f9217f1","isCorrect":false,"text":"6시 45분"}],"prompt":"7시 30분에 시작해 45분 동안 했습니다. 끝난 시각은?","skillCode":"calculate-time-after","weight":1},{"displayOrder":6,"explanation":"시작 시각 10시 10분에 35분을 더하면 10시 45분입니다.","id":"16777806-f79b-49e1-b482-5a50a1d8aea0","options":[{"displayOrder":1,"id":"b9dce2d6-1bfe-49d6-9dbb-8ac3fb30181a","isCorrect":false,"text":"10시 40분"},{"displayOrder":2,"id":"30db0655-cb88-4175-b893-646585eec226","isCorrect":true,"text":"10시 45분"},{"displayOrder":3,"id":"8fe997fc-d630-490f-83b8-0a0ca188f5e9","isCorrect":false,"text":"10시 50분"},{"displayOrder":4,"id":"199f03c4-5ce0-4b20-bd66-a476dc61e0ff","isCorrect":false,"text":"9시 35분"}],"prompt":"10시 10분에 시작해 35분 동안 했습니다. 끝난 시각은?","skillCode":"calculate-time-after","weight":1},{"displayOrder":7,"explanation":"시작 시각 2시 25분에 50분을 더하면 3시 15분입니다.","id":"26ce412e-310e-4d37-8738-5090ddbbfcdd","options":[{"displayOrder":1,"id":"75d46cda-f79b-4c31-af23-d5d40742c474","isCorrect":true,"text":"3시 15분"},{"displayOrder":2,"id":"56f15e49-354e-4453-9c67-7d56b82c9430","isCorrect":false,"text":"3시 10분"},{"displayOrder":3,"id":"363139ed-9f4a-4826-a0f2-41045ac9ee0f","isCorrect":false,"text":"3시 20분"},{"displayOrder":4,"id":"f9098620-e0ba-4004-aad1-7c1fe52ef8cd","isCorrect":false,"text":"1시 35분"}],"prompt":"2시 25분에 시작해 50분 동안 했습니다. 끝난 시각은?","skillCode":"calculate-time-after","weight":1},{"displayOrder":8,"explanation":"끝 시각 9시 50분에서 30분을 빼면 9시 20분입니다.","id":"64f4d13b-3699-45af-8470-69525400d82d","options":[{"displayOrder":1,"id":"7329d0f6-e995-4044-a9e3-b596c54a9266","isCorrect":false,"text":"9시 15분"},{"displayOrder":2,"id":"162ba18a-cd90-4bf2-bc02-6234194bd907","isCorrect":true,"text":"9시 20분"},{"displayOrder":3,"id":"8b744d42-f6cf-48fc-8903-b5eeb61d11bd","isCorrect":false,"text":"9시 25분"},{"displayOrder":4,"id":"ee071734-eb6f-45de-9dee-b7a64284ce3c","isCorrect":false,"text":"10시 20분"}],"prompt":"9시 50분에 끝났고 30분 동안 했습니다. 시작 시각은?","skillCode":"calculate-time-before","weight":1},{"displayOrder":9,"explanation":"끝 시각 4시 20분에서 25분을 빼면 3시 55분입니다.","id":"933c5d1f-f232-4abd-be14-29d42a34038a","options":[{"displayOrder":1,"id":"aa96f19f-d788-4a34-bfde-24ddeefa0c73","isCorrect":false,"text":"3시 50분"},{"displayOrder":2,"id":"c5b16cfe-a548-4ec3-b8e3-a43a161c1e12","isCorrect":false,"text":"4시 정각"},{"displayOrder":3,"id":"24e80355-1655-43e0-add0-9a3a7170c55a","isCorrect":true,"text":"3시 55분"},{"displayOrder":4,"id":"03363e62-e62c-40e1-8d1c-0c3ce4391c5e","isCorrect":false,"text":"4시 45분"}],"prompt":"4시 20분에 끝났고 25분 동안 했습니다. 시작 시각은?","skillCode":"calculate-time-before","weight":1},{"displayOrder":10,"explanation":"끝 시각 11시 15분에서 40분을 빼면 10시 35분입니다.","id":"d1c96f31-9826-4d94-a0f1-58305dc12542","options":[{"displayOrder":1,"id":"443807b2-613a-44d7-b9fc-2dc35704cd64","isCorrect":false,"text":"10시 30분"},{"displayOrder":2,"id":"ea53af1e-c5f0-4ff0-92ab-5997045b87c4","isCorrect":false,"text":"10시 40분"},{"displayOrder":3,"id":"ea800493-08df-4e5a-a209-34bdf62e28d0","isCorrect":false,"text":"11시 55분"},{"displayOrder":4,"id":"a23baa4b-afae-43bc-9ed5-c3b812936d30","isCorrect":true,"text":"10시 35분"}],"prompt":"11시 15분에 끝났고 40분 동안 했습니다. 시작 시각은?","skillCode":"calculate-time-before","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"a822b9e2-d1e4-4119-99f5-84972ffa4bbd","questions":[{"displayOrder":1,"explanation":"분침 6은 30분이고 시침은 아직 4에 이르지 않았으므로 3시 30분입니다.","id":"3abd9f5b-0495-416e-99fd-6aa98d479d2e","options":[{"displayOrder":1,"id":"98b8581e-81b6-47f2-897f-56c099929ad0","isCorrect":true,"text":"3시 30분"},{"displayOrder":2,"id":"7f13be7a-d428-44c8-9e0d-28978681be25","isCorrect":false,"text":"6시 15분"},{"displayOrder":3,"id":"098f8062-4000-4c79-8d1c-72c4a654404a","isCorrect":false,"text":"4시 30분"},{"displayOrder":4,"id":"2795d988-b2b4-4160-8b5c-04edf51cef76","isCorrect":false,"text":"3시 6분"}],"prompt":"분침이 6을 가리키고 시침이 3과 4 사이에 있습니다. 알맞은 시각은?","skillCode":"interpret-clock-hands","weight":1},{"displayOrder":2,"explanation":"20분에 30분을 더하면 50분이므로 8시 50분입니다.","id":"f6f49f34-4c96-498f-9cf9-8541983ecf22","options":[{"displayOrder":1,"id":"b56080b7-d1cd-4ad9-9f6f-2a6349cb9b3d","isCorrect":false,"text":"8시 40분"},{"displayOrder":2,"id":"a46c33a2-71ac-4261-af6f-0ed0b99e9a6d","isCorrect":true,"text":"8시 50분"},{"displayOrder":3,"id":"1652a899-c48f-4968-8643-13171df2637a","isCorrect":false,"text":"9시 10분"},{"displayOrder":4,"id":"9fdacfc0-8121-46f9-a9c6-7b6e2141d7d4","isCorrect":false,"text":"7시 50분"}],"prompt":"8시 20분에서 30분 후를 8시 40분이라고 했습니다. 바르게 고친 것은?","skillCode":"correct-time-reasoning","weight":1},{"displayOrder":3,"explanation":"10시 5분에서 5분 전은 10시이고 15분 더 거슬러 9시 45분입니다.","id":"67622ef9-7597-4c48-9d0e-ce6976689907","options":[{"displayOrder":1,"id":"b1c15edd-072c-427a-9d4c-281d1d566ab5","isCorrect":false,"text":"10시 25분"},{"displayOrder":2,"id":"d004a648-b0b6-4a49-a4ca-546248da0d77","isCorrect":false,"text":"9시 55분"},{"displayOrder":3,"id":"0e76dcdc-2ac4-4fc5-8fa8-3135c01db8a9","isCorrect":true,"text":"9시 45분"},{"displayOrder":4,"id":"1be15a33-3070-49db-a1bd-d1a36676d222","isCorrect":false,"text":"10시 45분"}],"prompt":"10시 5분에서 20분 전을 바르게 구한 것은?","skillCode":"calculate-time-before","weight":1},{"displayOrder":4,"explanation":"오전 11시는 낮 12시 전이고 오후 11시는 밤이므로 서로 다른 시각입니다.","id":"1e9c8732-9b47-4ae2-ae52-929c217c27d6","options":[{"displayOrder":1,"id":"ddff6326-1183-4f24-83db-f9cd1cd000a2","isCorrect":false,"text":"둘 다 아침입니다."},{"displayOrder":2,"id":"ca7f7da2-b71a-4046-9774-a9653a0f6769","isCorrect":false,"text":"완전히 같은 시각입니다."},{"displayOrder":3,"id":"d89706c5-356a-408d-b59b-93b195e8a582","isCorrect":false,"text":"오전 11시는 저녁입니다."},{"displayOrder":4,"id":"a18da500-834e-4ca9-b921-1b979a3664d2","isCorrect":true,"text":"서로 12시간 떨어진 다른 시각입니다."}],"prompt":"오전 11시와 오후 11시를 바르게 설명한 것은?","skillCode":"distinguish-am-pm","weight":1},{"displayOrder":5,"explanation":"2시 35분부터 3시까지 25분, 다시 20분이므로 모두 45분입니다.","id":"bb9d6456-8264-47a1-91e0-628563614abd","options":[{"displayOrder":1,"id":"2f0923e5-71b7-48f4-8149-8b2dbfa1358b","isCorrect":false,"text":"35분"},{"displayOrder":2,"id":"1308a42c-be75-4510-875b-66ebb12423b2","isCorrect":false,"text":"55분"},{"displayOrder":3,"id":"7a2024d3-f67f-45dd-a261-6cc35b608398","isCorrect":true,"text":"45분"},{"displayOrder":4,"id":"a756bc20-4f47-49a5-b6db-5c9ee5ab61af","isCorrect":false,"text":"85분"}],"prompt":"2시 35분부터 3시 20분까지 지난 시간은?","skillCode":"calculate-elapsed-time","weight":1},{"displayOrder":6,"explanation":"분침의 숫자 한 칸은 5분이므로 9는 9×5=45분입니다.","id":"bacb84f3-afe5-4a08-a5cc-551b6b928db1","options":[{"displayOrder":1,"id":"1c7ba565-2fbd-4332-847a-69539ac9dc6f","isCorrect":false,"text":"숫자 9는 90분을 뜻합니다."},{"displayOrder":2,"id":"26e13003-7a7d-4083-b7e1-d659521e679a","isCorrect":false,"text":"분침은 시를 나타냅니다."},{"displayOrder":3,"id":"2ecb56d8-3b75-4521-99bd-5309d7fdb2c3","isCorrect":false,"text":"숫자 9는 항상 9시입니다."},{"displayOrder":4,"id":"6220fa0c-907b-4a4b-90f4-8e9eaa4baa55","isCorrect":true,"text":"숫자 9는 45분을 뜻합니다."}],"prompt":"분침이 9를 가리키면 9분이라고 한 설명의 오류는?","skillCode":"correct-time-reasoning","weight":1},{"displayOrder":7,"explanation":"오후 3시 10분에 40분을 더하면 오후 3시 50분이며 오전·오후는 바뀌지 않습니다.","id":"3a7184e8-e2d5-4327-85ec-40055b8d0836","options":[{"displayOrder":1,"id":"8ad518e8-4ee3-4d1c-aa31-f687867d000f","isCorrect":true,"text":"오후 3시 50분"},{"displayOrder":2,"id":"74883261-125d-4451-a167-aad136c4936c","isCorrect":false,"text":"오전 3시 50분"},{"displayOrder":3,"id":"4215e911-7362-48e2-a871-7f522cff6ce6","isCorrect":false,"text":"오후 4시 10분"},{"displayOrder":4,"id":"bb59e7f3-0293-4e8f-89a0-3cb5b9aa1d3e","isCorrect":false,"text":"오후 2시 30분"}],"prompt":"오후 3시 10분에 시작해 40분 뒤 끝나는 일정은?","skillCode":"calculate-time-after","weight":1},{"displayOrder":8,"explanation":"끝 시각에서 지난 25분을 빼면 9시 15분입니다.","id":"14f42b5c-af11-49c7-9f64-46d40a7f9f04","options":[{"displayOrder":1,"id":"c9c63247-1c3e-477c-9ee1-5dd356e89e01","isCorrect":false,"text":"9시 65분이며 40+25입니다."},{"displayOrder":2,"id":"341dfe49-efb2-413e-b49a-0c98bd624463","isCorrect":true,"text":"9시 15분이며 40-25=15분입니다."},{"displayOrder":3,"id":"7ddc711c-5868-425d-a05f-848bc30008be","isCorrect":false,"text":"10시 5분이며 25분을 더합니다."},{"displayOrder":4,"id":"e3f55ddd-c093-42e4-903a-06972b748718","isCorrect":false,"text":"9시 25분이며 40-25=25입니다."}],"prompt":"9시 40분에 끝난 25분 활동의 시작 시각과 설명이 맞는 것은?","skillCode":"calculate-time-before","weight":1},{"displayOrder":9,"explanation":"시침은 몇 시인지, 분침은 몇 분인지 읽는 데 사용합니다.","id":"63cad63d-789c-481d-ac3f-0fe348ab9f29","options":[{"displayOrder":1,"id":"ccd3417f-6c8b-495c-a669-f1b04b6090cf","isCorrect":false,"text":"짧은 시침은 분만 나타냅니다."},{"displayOrder":2,"id":"b8fb8579-832b-42e6-8b08-6ea419d2fcee","isCorrect":false,"text":"긴 분침은 오전과 오후만 나타냅니다."},{"displayOrder":3,"id":"2244ff09-8ef5-4b1b-b15f-60ebd8630166","isCorrect":true,"text":"짧은 시침은 시를, 긴 분침은 분을 나타냅니다."},{"displayOrder":4,"id":"9c708d11-fb4e-4f78-9f51-3ed8cd2ba830","isCorrect":false,"text":"두 바늘은 언제나 같은 숫자를 가리킵니다."}],"prompt":"시침과 분침의 역할을 바르게 설명한 것은?","skillCode":"interpret-clock-hands","weight":1},{"displayOrder":10,"explanation":"11시 50분에서 10분 후가 낮 12시이고 10분 더 지나 오후 12시 10분입니다.","id":"81dd26c7-17f4-49dd-a852-a74cc47c0399","options":[{"displayOrder":1,"id":"fff43af4-90a5-4d7c-a2a3-194313a29d3c","isCorrect":false,"text":"오전 12시 10분"},{"displayOrder":2,"id":"d66f7326-5211-41fb-baff-256f7b3e1e44","isCorrect":false,"text":"오후 11시 70분"},{"displayOrder":3,"id":"c5f61002-07ab-4b55-8d7b-20acaea45e6e","isCorrect":false,"text":"오전 11시 30분"},{"displayOrder":4,"id":"20051a26-4356-4550-8190-910ca545b9d3","isCorrect":true,"text":"오후 12시 10분"}],"prompt":"오전 11시 50분에서 20분 후의 시각은?","skillCode":"calculate-time-after","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":10,"id":"bb6cc6d7-e1e6-46e9-9d56-3bcb4b42550d","slug":"grade2-time","title":"시각과 시간을 알아봐요"},"version":{"id":"81f5083b-44b5-4344-8457-9522dbe74c97","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid
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
  where stage.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_time_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_time_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 11

  union all
  select 3, 'grade2_time_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '4dd42cc233dec6339c6882bcdd7f75aa0a37e6d868461f4752fbdc26500aaac0'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_time_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_time_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_time_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_time_v1_structure_and_orders',
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
    where stage.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_time_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_time_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid))

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
  where metadata.unit_id = 'bb6cc6d7-e1e6-46e9-9d56-3bcb4b42550d'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 10

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = 'bb6cc6d7-e1e6-46e9-9d56-3bcb4b42550d'::uuid
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
  where metadata.unit_id = 'bb6cc6d7-e1e6-46e9-9d56-3bcb4b42550d'::uuid

  union all
  select 23, 'grade2_time_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_time_v1_pass_threshold_contract',
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
  select 25, 'grade2_time_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_time_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '81f5083b-44b5-4344-8457-9522dbe74c97'::uuid

  union all
  select 27, 'grade2_time_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_time_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_time_v1_question_skills_exact',
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
select 999, 'grade2_time_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
