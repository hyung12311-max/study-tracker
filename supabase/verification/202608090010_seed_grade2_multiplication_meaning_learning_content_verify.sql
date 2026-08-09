-- Phase 2B grade2-multiplication-meaning v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":6,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"70a00c90-97e8-45ab-a7a8-33fa4430549d","questions":[{"displayOrder":1,"explanation":"접시마다 사탕이 3개로 같으므로 3개씩 묶인 모습입니다.","id":"aaee2904-d460-458c-a536-6699ab430e33","options":[{"displayOrder":1,"id":"85b2eec0-a59d-430e-b0af-195f4737f93b","isCorrect":true,"text":"접시마다 3개씩"},{"displayOrder":2,"id":"27d7e148-8d2b-4566-918d-26be79515ce6","isCorrect":false,"text":"한 접시에는 2개이고 다른 접시에는 3개"},{"displayOrder":3,"id":"4ea86124-229e-465c-ae7e-40f637c900d5","isCorrect":false,"text":"접시마다 개수가 다름"},{"displayOrder":4,"id":"7ff094c8-90e4-444d-835b-1276e89f728a","isCorrect":false,"text":"사탕을 모두 한 접시에 놓음"}],"prompt":"사탕이 접시마다 3개씩 놓여 있습니다. 모든 접시에 같은 수씩 놓인 모습은?","skillCode":"identify-equal-groups","weight":1},{"displayOrder":2,"explanation":"한 묶음에는 2자루가 있고 같은 묶음이 4개이므로 묶음 수는 4입니다.","id":"9ff12a7a-6bfa-4f9b-bf52-6455145d7927","options":[{"displayOrder":1,"id":"ad6b8462-2b3a-4f5c-8aa8-777ac354c5c3","isCorrect":false,"text":"2묶음"},{"displayOrder":2,"id":"06e0c847-9327-48e7-80b5-2c730908f8f0","isCorrect":true,"text":"4묶음"},{"displayOrder":3,"id":"be79d81d-cfb1-4d7e-ad43-09ed42e9bf86","isCorrect":false,"text":"6묶음"},{"displayOrder":4,"id":"cbf4dab0-79db-4311-a139-68cd93affa93","isCorrect":false,"text":"8묶음"}],"prompt":"연필이 한 묶음에 2자루씩 있고 이런 묶음이 4개 있습니다. 묶음 수는?","skillCode":"count-equal-groups","weight":1},{"displayOrder":3,"explanation":"한 줄의 별 4개를 줄 수 3번 더하므로 4+4+4입니다.","id":"ec504283-f43e-4a52-a24d-e90103d6e59a","options":[{"displayOrder":1,"id":"b837bc4c-b6a9-47cd-8e13-73c705f030f8","isCorrect":false,"text":"3+3+3+3"},{"displayOrder":2,"id":"a0e72d0f-17c8-4fb3-bcd4-23d05fed3db4","isCorrect":false,"text":"4+3"},{"displayOrder":3,"id":"da7cc38b-1390-4a07-a618-5608223458b5","isCorrect":true,"text":"4+4+4"},{"displayOrder":4,"id":"057696c8-a610-4bb1-be47-7f84d78c5d1b","isCorrect":false,"text":"4+4+3"}],"prompt":"별이 한 줄에 4개씩 있고 3줄 있습니다. 같은 수를 더한 식은?","skillCode":"connect-repeated-addition-to-multiplication","weight":1},{"displayOrder":4,"explanation":"한 봉지의 귤이 5개이고 봉지가 2개이므로 5씩 2묶음입니다.","id":"ec5be058-8a68-4c33-a2ef-df7895ba2a66","options":[{"displayOrder":1,"id":"0d51e48a-764f-4bce-9189-881baab24179","isCorrect":false,"text":"2씩 5묶음"},{"displayOrder":2,"id":"c9808d40-411f-4c5e-b0bc-f00358614cb7","isCorrect":false,"text":"5씩 5묶음"},{"displayOrder":3,"id":"51934eb2-f217-464f-ba5d-c0167b1309cd","isCorrect":false,"text":"2씩 2묶음"},{"displayOrder":4,"id":"f6f701ed-8165-46c5-94da-2c5a5235e111","isCorrect":true,"text":"5씩 2묶음"}],"prompt":"한 봉지에 귤이 5개씩 있고 2봉지 있습니다. ''몇씩 몇 묶음''으로 나타낸 것은?","skillCode":"count-equal-groups","weight":1},{"displayOrder":5,"explanation":"2를 네 번 더했으므로 한 묶음에 2개씩 4묶음입니다.","id":"c04873bf-6a7f-406a-846c-ba947f4eb67e","options":[{"displayOrder":1,"id":"ed2b9e1b-6b00-4312-84da-55725575f5dc","isCorrect":true,"text":"2씩 4묶음"},{"displayOrder":2,"id":"eea9834c-fb65-4d6f-96cd-deef1f3695c5","isCorrect":false,"text":"4씩 2묶음"},{"displayOrder":3,"id":"0cecbc90-bb38-4b95-b4ce-0f0613eb1f78","isCorrect":false,"text":"2씩 2묶음"},{"displayOrder":4,"id":"3611472c-1ca9-460e-9617-efe5d0df0681","isCorrect":false,"text":"4씩 4묶음"}],"prompt":"2+2+2+2를 같은 수씩 묶은 말로 나타낸 것은?","skillCode":"connect-repeated-addition-to-multiplication","weight":1},{"displayOrder":6,"explanation":"상자 하나가 한 묶음이므로 한 묶음의 공은 3개입니다.","id":"9076b1aa-e8fd-42bd-bfc5-b68426257391","options":[{"displayOrder":1,"id":"a2145680-da7f-4a10-b55a-92f33d11cc28","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"9c335ff2-d352-4b37-973a-df0ff9e584da","isCorrect":true,"text":"3개"},{"displayOrder":3,"id":"861f8bb3-ad6c-4547-b31a-b6e3295287c7","isCorrect":false,"text":"8개"},{"displayOrder":4,"id":"be7c763a-05da-40bf-8c11-03725059be30","isCorrect":false,"text":"15개"}],"prompt":"공이 상자마다 3개씩 있고 상자가 5개 있습니다. 한 묶음의 수는?","skillCode":"count-equal-groups","weight":1},{"displayOrder":7,"explanation":"쟁반마다 쿠키가 3개로 같고 이런 쟁반이 4개이므로 같은 수씩 묶였습니다.","id":"a5bf319d-9315-411d-812d-dbc27de2fab4","options":[{"displayOrder":1,"id":"dabad4c6-dde7-41a3-9d7d-67d922adfbda","isCorrect":false,"text":"한 접시에 2개, 다른 접시에 3개인 빵"},{"displayOrder":2,"id":"04611732-6bde-4505-bba9-aa1340078387","isCorrect":false,"text":"봉지마다 개수가 다른 구슬"},{"displayOrder":3,"id":"a601c74b-aa57-46db-a7d3-8cd241feb6a0","isCorrect":true,"text":"쟁반 4개에 쿠키가 각각 3개씩 있음"},{"displayOrder":4,"id":"860cad88-26bc-4cad-9712-9fb9964052b6","isCorrect":false,"text":"연필 7자루를 크기가 다르게 늘어놓음"}],"prompt":"다음 중 같은 수씩 묶여 있어 곱셈으로 나타내기 알맞은 것은?","skillCode":"identify-equal-groups","weight":1},{"displayOrder":8,"explanation":"한 묶음의 수 6을 묶음 수 2번 더하므로 6+6입니다.","id":"c1e8d801-fdaf-403e-9d1c-c57a4d640256","options":[{"displayOrder":1,"id":"5e01afb4-eb5c-4671-97e7-bcfaf7589505","isCorrect":false,"text":"2+2+2+2+2+2"},{"displayOrder":2,"id":"0f137d1d-ff7c-44c5-ac85-04bae4220c5c","isCorrect":false,"text":"6+2"},{"displayOrder":3,"id":"8ea13bc5-7631-4338-a8a2-1944ebd27de2","isCorrect":false,"text":"6+6+2"},{"displayOrder":4,"id":"5305fc83-9973-4dc9-88c2-5ba2d9331ec4","isCorrect":true,"text":"6+6"}],"prompt":"6씩 2묶음을 반복 덧셈으로 나타낸 것은?","skillCode":"connect-repeated-addition-to-multiplication","weight":1},{"displayOrder":9,"explanation":"한 줄의 의자 2개가 한 묶음이고 줄이 5개이므로 2씩 5묶음입니다.","id":"8bb07b1f-283d-406f-a59a-96daa86c7aa7","options":[{"displayOrder":1,"id":"2efde2be-97c8-4266-9f44-c0ddbac4a69c","isCorrect":true,"text":"2씩 5묶음"},{"displayOrder":2,"id":"a08990ac-15e0-4980-8344-14c6ed326dab","isCorrect":false,"text":"5씩 2묶음"},{"displayOrder":3,"id":"8a6b6783-85c5-4b22-9e23-ca10ab98ad3b","isCorrect":false,"text":"2와 5를 한 묶음"},{"displayOrder":4,"id":"f572748c-d5b8-424a-a4be-45ef19724903","isCorrect":false,"text":"7씩 1묶음"}],"prompt":"한 줄에 의자가 2개씩 있고 5줄 있습니다. 알맞은 설명은?","skillCode":"count-equal-groups","weight":1},{"displayOrder":10,"explanation":"4가 세 번 더해졌으므로 같은 수는 4이고 더한 횟수는 3입니다.","id":"5dc9058a-e43d-4cda-bfd0-6461fca6347b","options":[{"displayOrder":1,"id":"694dd60a-abf1-42fa-bc17-d044097ac851","isCorrect":false,"text":"같은 수 3, 횟수 4"},{"displayOrder":2,"id":"555873c2-f134-48cb-a076-84c76fb8aa75","isCorrect":true,"text":"같은 수 4, 횟수 3"},{"displayOrder":3,"id":"47cc3e0b-9e43-428f-b87d-c0b204282069","isCorrect":false,"text":"같은 수 4, 횟수 4"},{"displayOrder":4,"id":"689e7f8b-b4b7-4213-b8bf-446639fa0b9d","isCorrect":false,"text":"같은 수 12, 횟수 1"}],"prompt":"4+4+4에서 더해지는 같은 수와 그 수를 더한 횟수는?","skillCode":"connect-repeated-addition-to-multiplication","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"fa6ae6ea-128b-4559-9d63-cd26d951919d","questions":[{"displayOrder":1,"explanation":"한 묶음의 수 3을 앞에, 묶음 수 4를 뒤에 써서 3×4로 나타냅니다.","id":"cd8c1fed-a137-48df-8433-fd5ccf0532e7","options":[{"displayOrder":1,"id":"3e371089-3561-47ce-9cc9-930c65eee0ec","isCorrect":false,"text":"4×3"},{"displayOrder":2,"id":"aa11b57e-dd9e-4c82-b5d7-75cdb066563d","isCorrect":false,"text":"3+4"},{"displayOrder":3,"id":"9e527e51-c0ac-4ec5-ae3a-1f7e3f743cec","isCorrect":true,"text":"3×4"},{"displayOrder":4,"id":"3f5191cf-330b-4eea-a7f0-300cb61e4c73","isCorrect":false,"text":"4+4+4"}],"prompt":"이 단원에서는 ''3씩 4묶음''을 한 묶음의 수 × 묶음 수로 씁니다. 알맞은 곱셈식은?","skillCode":"represent-equal-groups-as-multiplication","weight":1},{"displayOrder":2,"explanation":"한 묶음의 수 4를 앞에, 접시 수 3을 뒤에 써서 4×3입니다.","id":"7ba7b97a-7971-44b6-91d9-b647090c8962","options":[{"displayOrder":1,"id":"6d904641-ce97-4578-881e-6cec7bec8a7f","isCorrect":false,"text":"3×4"},{"displayOrder":2,"id":"7e2ea69b-33e6-40e1-81d6-a34684a8ea6b","isCorrect":false,"text":"4+3"},{"displayOrder":3,"id":"d0fc8508-44a3-4850-8302-d0456bbbd388","isCorrect":false,"text":"3+3+3+3"},{"displayOrder":4,"id":"49034d17-f840-4ae4-80a5-d8fde3f7b1ea","isCorrect":true,"text":"4×3"}],"prompt":"한 접시에 딸기가 4개씩 있고 접시가 3개 있습니다. 알맞은 곱셈식은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":3,"explanation":"5를 네 번 더했으므로 5씩 4묶음이고 곱셈식은 5×4입니다.","id":"22d2d91d-3ca4-4941-8986-a9ff05fa09a2","options":[{"displayOrder":1,"id":"24d357a9-e6a7-4ee2-bfb4-bb98d8af8647","isCorrect":true,"text":"5×4"},{"displayOrder":2,"id":"af5c8271-ce5b-4a20-9b3b-e66c5334fff2","isCorrect":false,"text":"4×5"},{"displayOrder":3,"id":"aea5a38a-973e-42a8-9ebb-2964c882fb71","isCorrect":false,"text":"5×5"},{"displayOrder":4,"id":"2e4d3993-9d88-4610-9f0b-9c372cb9e992","isCorrect":false,"text":"4×4"}],"prompt":"5+5+5+5를 곱셈식으로 나타낸 것은?","skillCode":"connect-repeated-addition-to-multiplication","weight":1},{"displayOrder":4,"explanation":"앞 수 2는 한 묶음의 수이고 뒤 수 6은 묶음 수이므로 2씩 6묶음입니다.","id":"97e93bbe-c0af-48ad-b00c-aa90675401d6","options":[{"displayOrder":1,"id":"e31656e5-6d7c-45cb-a0e9-cb605e37af3a","isCorrect":false,"text":"6씩 2묶음"},{"displayOrder":2,"id":"1a505fdc-b29b-4b24-a92a-6134e4d53596","isCorrect":true,"text":"2씩 6묶음"},{"displayOrder":3,"id":"43e502ae-8999-4753-8392-74dfd72e1bf8","isCorrect":false,"text":"2와 6을 더한 것"},{"displayOrder":4,"id":"6304ce16-997f-4657-83a1-bcca038cbc10","isCorrect":false,"text":"6개를 한 묶음으로만 둔 것"}],"prompt":"2×6이 뜻하는 것은?","skillCode":"interpret-multiplication-expression","weight":1},{"displayOrder":5,"explanation":"3×4의 뒤 수 4는 같은 묶음인 바구니가 4개라는 뜻입니다.","id":"b086b7a4-b374-4954-8c25-e3064b345661","options":[{"displayOrder":1,"id":"9e7d4532-d8a6-40b8-a064-39a33f53ab40","isCorrect":false,"text":"사과의 전체 수"},{"displayOrder":2,"id":"31fbbb57-57c2-454d-972c-e755befbd97b","isCorrect":false,"text":"한 바구니의 사과 수"},{"displayOrder":3,"id":"1f4eb11a-6448-4c6a-aeeb-6c2376690872","isCorrect":true,"text":"바구니의 수"},{"displayOrder":4,"id":"66572987-6123-4159-ae53-0dd4e3b5b93c","isCorrect":false,"text":"사과와 바구니의 차"}],"prompt":"바구니 4개에 사과가 3개씩 있습니다. 3×4에서 4가 뜻하는 것은?","skillCode":"interpret-multiplication-expression","weight":1},{"displayOrder":6,"explanation":"6×3은 한 묶음에 6개씩 3묶음이므로 상자 3개에 공이 6개씩 있는 상황입니다.","id":"15acd98c-4120-4c51-9cc7-282d920319c5","options":[{"displayOrder":1,"id":"0e38f238-0a0b-4687-8bf7-633a973b6286","isCorrect":false,"text":"상자 6개에 공이 3개씩 있음"},{"displayOrder":2,"id":"d230e661-0232-4525-b031-613806a30f34","isCorrect":false,"text":"상자마다 공의 수가 다름"},{"displayOrder":3,"id":"44e1d785-b130-4a7f-b317-bd7ea3150dfe","isCorrect":false,"text":"공 6개와 상자 3개를 한곳에 둠"},{"displayOrder":4,"id":"cc0ba994-a92d-4375-a84d-43a53c2d66db","isCorrect":true,"text":"상자 3개에 공이 6개씩 있음"}],"prompt":"6×3에 알맞은 상황은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":7,"explanation":"한 줄의 5개를 줄 수 3번 더한 5+5+5이고 곱셈식은 5×3입니다.","id":"847f1c1f-5d0b-4e83-bab9-81bbdcde32dd","options":[{"displayOrder":1,"id":"dfd425c1-793c-4240-bf2f-90d23351108f","isCorrect":true,"text":"5+5+5, 5×3"},{"displayOrder":2,"id":"4a2d069f-aad6-45c9-bf6d-4a7f703686d1","isCorrect":false,"text":"3+3+3+3+3, 5×3"},{"displayOrder":3,"id":"3b71e567-c45a-42c6-a1fc-9db6d58f7bd8","isCorrect":false,"text":"5+3, 3×5"},{"displayOrder":4,"id":"999baf8d-a41b-4c69-abcf-777e284519ad","isCorrect":false,"text":"5+5, 5×2"}],"prompt":"한 줄에 화분이 5개씩 있고 3줄 있습니다. 반복 덧셈과 곱셈식이 모두 알맞은 것은?","skillCode":"connect-repeated-addition-to-multiplication","weight":1},{"displayOrder":8,"explanation":"4×2는 ''사 곱하기 이''라고 읽고 4씩 2묶음을 뜻합니다.","id":"0d4e0904-f748-4b03-b0ce-d0e829948f3b","options":[{"displayOrder":1,"id":"5b71c2e9-2742-4992-a583-8fd9efa60834","isCorrect":false,"text":"사 곱하기 이는 2씩 4묶음입니다."},{"displayOrder":2,"id":"50ba07d8-1510-4528-abde-3a822e172311","isCorrect":true,"text":"사 곱하기 이는 4씩 2묶음입니다."},{"displayOrder":3,"id":"3b573e37-bc3e-4ceb-ad5d-904f1b9503be","isCorrect":false,"text":"사 곱하기 이는 4와 2를 이어 쓴 수입니다."},{"displayOrder":4,"id":"a603f20e-3894-4193-84b1-4068d0d1f420","isCorrect":false,"text":"사 곱하기 이는 4씩 4묶음입니다."}],"prompt":"4×2를 읽고 뜻을 바르게 말한 것은?","skillCode":"interpret-multiplication-expression","weight":1},{"displayOrder":9,"explanation":"한 사람에게 주는 2권이 한 묶음이고 사람이 4명이므로 2×4입니다.","id":"b2003b05-45fa-420a-b461-d67a5e675498","options":[{"displayOrder":1,"id":"5402dca0-555c-42b2-9142-f231177e9d03","isCorrect":false,"text":"4×2"},{"displayOrder":2,"id":"6133b1d2-1493-49c6-abd5-307eebc5f556","isCorrect":false,"text":"2+4"},{"displayOrder":3,"id":"27c980dd-b38f-425e-b2c5-82f72cfd12c2","isCorrect":true,"text":"2×4"},{"displayOrder":4,"id":"d0636c9d-b619-4ffe-8580-ee7315accea0","isCorrect":false,"text":"4×4"}],"prompt":"공책을 2권씩 4명에게 나누어 줍니다. 알맞은 곱셈식은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":10,"explanation":"곱셈식의 앞 수 3은 한 묶음에 들어 있는 수를 뜻합니다.","id":"07d91a08-cb18-4301-8cda-5d19670f260b","options":[{"displayOrder":1,"id":"d90f999d-5441-4f0f-a543-e89589da2b50","isCorrect":false,"text":"묶음 수"},{"displayOrder":2,"id":"5e54cada-9728-40c4-b57a-9391fb61cf96","isCorrect":false,"text":"전체 수"},{"displayOrder":3,"id":"fd2167d9-2442-47b1-91ff-d6e6f4b543be","isCorrect":false,"text":"더한 결과"},{"displayOrder":4,"id":"31b45a81-4d96-4ea2-9c9b-fee5e02f92c0","isCorrect":true,"text":"한 묶음의 수"}],"prompt":"3×5에서 3이 뜻하는 것은?","skillCode":"interpret-multiplication-expression","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"88c82137-760d-4e35-a407-046a5eb0ba6c","questions":[{"displayOrder":1,"explanation":"한 줄의 4개가 5줄 있으므로 4씩 5묶음이고 식은 4×5입니다.","id":"07694bd8-16a5-43a4-8eb5-92cf1f5323c0","options":[{"displayOrder":1,"id":"07a69945-e6c7-46b4-8658-1e66bc11b799","isCorrect":true,"text":"4×5, 4씩 5묶음"},{"displayOrder":2,"id":"b235097d-9382-45b5-b70f-27e7f846ebc2","isCorrect":false,"text":"5×4, 4씩 5묶음"},{"displayOrder":3,"id":"a26a7700-703b-4b49-a260-67ef2dddb5d4","isCorrect":false,"text":"4×4, 4씩 5묶음"},{"displayOrder":4,"id":"65be096a-53ca-46c7-b78d-640368b9e177","isCorrect":false,"text":"4+5, 4씩 5묶음"}],"prompt":"한 줄에 별이 4개씩 5줄 있습니다. 식과 설명이 알맞게 짝지어진 것은?","skillCode":"represent-equal-groups-as-multiplication","weight":1},{"displayOrder":2,"explanation":"6개씩 3봉지는 6+6+6=18이므로 봉지는 3개입니다.","id":"cc865498-8cea-49a5-b943-97962a857c50","options":[{"displayOrder":1,"id":"f28844e3-919e-4e90-a387-24815c21092c","isCorrect":false,"text":"2개"},{"displayOrder":2,"id":"0402ed1d-41b0-4471-9559-f05c28d117f0","isCorrect":true,"text":"3개"},{"displayOrder":3,"id":"6da54355-5f5a-4e26-a57b-3572d6108225","isCorrect":false,"text":"6개"},{"displayOrder":4,"id":"d4be3d6f-ab65-428a-9c28-5d9f4e99cd49","isCorrect":false,"text":"12개"}],"prompt":"사탕이 모두 18개이고 한 봉지에 6개씩 담았습니다. 봉지는 몇 개입니까?","skillCode":"infer-missing-group-value","weight":1},{"displayOrder":3,"explanation":"5자루씩 4묶음은 5+5+5+5=20이므로 한 묶음에는 5자루입니다.","id":"82d3f527-70f3-409a-a44b-5052aaece093","options":[{"displayOrder":1,"id":"8853844d-ec3f-486b-b166-b50e74242bf1","isCorrect":false,"text":"4자루"},{"displayOrder":2,"id":"499711dd-3038-4487-bb80-712c5ef9091b","isCorrect":false,"text":"16자루"},{"displayOrder":3,"id":"12a2a45b-8470-4970-bb83-07b5cd300a7a","isCorrect":true,"text":"5자루"},{"displayOrder":4,"id":"bbf60b4e-ebe1-44f6-8d0e-d82a1e4d707b","isCorrect":false,"text":"24자루"}],"prompt":"연필이 모두 20자루이고 4묶음에 똑같이 들어 있습니다. 한 묶음에는 몇 자루입니까?","skillCode":"infer-missing-group-value","weight":1},{"displayOrder":4,"explanation":"3×4는 한 묶음의 수 3을 묶음 수 4번 더한 3+3+3+3입니다.","id":"1a514908-00cd-4e91-ae68-3e63383e14b1","options":[{"displayOrder":1,"id":"b925d5a8-d2e3-4f6d-b264-cb5593c6af11","isCorrect":false,"text":"4+4+4"},{"displayOrder":2,"id":"594e8816-e14f-467c-8c96-b0232843f724","isCorrect":false,"text":"3+4+3+4"},{"displayOrder":3,"id":"5d307f76-ec4a-4de1-85a8-e4091bcc7754","isCorrect":false,"text":"3+3+3"},{"displayOrder":4,"id":"d222ebc6-fa47-4e21-9a78-285176e3a0a8","isCorrect":true,"text":"3+3+3+3"}],"prompt":"3×4에 맞는 반복 덧셈은?","skillCode":"connect-repeated-addition-to-multiplication","weight":1},{"displayOrder":5,"explanation":"꽃 2송이가 한 묶음이고 꽃병이 5개이므로 2씩 5묶음인 2×5입니다.","id":"c5637ee5-6a05-4ffa-8744-fea68afd3106","options":[{"displayOrder":1,"id":"a82c7cf8-7d7d-4e58-8f71-97e0438bce0b","isCorrect":true,"text":"꽃병 5개에 꽃이 2송이씩 있음"},{"displayOrder":2,"id":"e706781d-6655-4e8e-9502-670f0af4699c","isCorrect":false,"text":"꽃병 2개에 꽃이 5송이씩 있음"},{"displayOrder":3,"id":"b3d0c665-6b71-47cd-abfd-45d5aba8deb5","isCorrect":false,"text":"꽃 2송이와 꽃병 5개를 한곳에 둠"},{"displayOrder":4,"id":"dfda40d1-9b3f-458a-b90c-ecaf5f44f53b","isCorrect":false,"text":"꽃병마다 꽃의 수가 다름"}],"prompt":"다음 중 2×5로 나타낼 수 있는 상황은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":6,"explanation":"이 단원에서는 한 묶음의 수를 앞에 쓰므로 4씩 3묶음은 4×3입니다.","id":"467a824e-bf92-44bc-9994-fc97f0d9200a","options":[{"displayOrder":1,"id":"d6bc4758-a3d1-4ebd-a081-1c1db69cbb59","isCorrect":false,"text":"곱셈은 사용할 수 없어서"},{"displayOrder":2,"id":"17d1513b-a93d-4323-a5fc-9564dacf5f7f","isCorrect":true,"text":"한 묶음의 수 4와 묶음 수 3의 순서를 바꾸어 썼기 때문에"},{"displayOrder":3,"id":"f9d84c7a-e7c1-4b84-9d9f-ddf8783ac91b","isCorrect":false,"text":"전체 수가 7이기 때문에"},{"displayOrder":4,"id":"27f3d077-964d-4232-972f-19f384e54732","isCorrect":false,"text":"묶음마다 수가 다르기 때문에"}],"prompt":"민수는 4씩 3묶음을 3×4라고 썼습니다. 잘못된 까닭은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":7,"explanation":"2가 다섯 번 더해졌으므로 묶음 수는 5이고 알맞은 식은 2×5입니다.","id":"d2ea8a50-a9b2-4fb3-9183-1a7586563c24","options":[{"displayOrder":1,"id":"9f597b43-276d-4273-b631-f80d0440e37e","isCorrect":false,"text":"한 묶음의 수가 2인 것"},{"displayOrder":2,"id":"487f4e8d-0384-4a93-8d83-0cea76b523e5","isCorrect":false,"text":"같은 수를 더한 것"},{"displayOrder":3,"id":"0ce55430-831f-456a-af1f-6d94e8fd8192","isCorrect":true,"text":"묶음 수를 4로 센 것"},{"displayOrder":4,"id":"9b1efc94-f235-438c-ba11-92aa749dd100","isCorrect":false,"text":"곱셈을 사용한 것"}],"prompt":"2+2+2+2+2를 2×4라고 쓴 설명에서 잘못된 부분은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":8,"explanation":"오른쪽에서 4가 세 번 더해졌으므로 묶음 수를 나타내는 □는 3입니다.","id":"b5809bd6-765c-4f8f-9d04-730530eff3b0","options":[{"displayOrder":1,"id":"0f1a46a4-7116-4480-a9c7-e6939e31a673","isCorrect":false,"text":"1"},{"displayOrder":2,"id":"23474d4f-54ba-49d0-9c49-16f377d12dd3","isCorrect":false,"text":"2"},{"displayOrder":3,"id":"770dc7de-cacb-4f3d-96b6-f221bbb9ab84","isCorrect":false,"text":"4"},{"displayOrder":4,"id":"00a9bc69-a5b8-4ed4-82fc-f3dca11e5215","isCorrect":true,"text":"3"}],"prompt":"쟁반마다 쿠키가 4개씩 있습니다. 4×□=4+4+4에서 □에 알맞은 수는?","skillCode":"infer-missing-group-value","weight":1},{"displayOrder":9,"explanation":"2씩 6묶음은 12이고 3씩 4묶음도 12이지만 한 묶음의 수와 묶음 수가 다릅니다.","id":"176534b3-274d-441d-9733-5fd6a3731c1b","options":[{"displayOrder":1,"id":"f8d5a121-43f1-430e-af8a-c1585d9bdd5b","isCorrect":true,"text":"3씩 4묶음"},{"displayOrder":2,"id":"f66e5041-d702-4d05-9d8b-92ba612b77ab","isCorrect":false,"text":"2씩 5묶음"},{"displayOrder":3,"id":"fa3facc6-2603-4488-9e6b-91e8d4f31871","isCorrect":false,"text":"4씩 2묶음"},{"displayOrder":4,"id":"f61c0ad2-aa51-445f-a470-488f3b3a6563","isCorrect":false,"text":"6씩 1묶음"}],"prompt":"2씩 6묶음과 같은 전체 수를 만들지만 묶는 방법이 다른 것은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":10,"explanation":"3개씩 놓은 줄이 5줄이므로 한 묶음의 수 × 묶음 수는 3×5입니다.","id":"fe4b5d39-cd09-422e-8855-8785342c5a72","options":[{"displayOrder":1,"id":"80de439b-7fde-4e7b-b404-60bfe7fe9555","isCorrect":false,"text":"5×3"},{"displayOrder":2,"id":"08b2990b-23e5-4a83-a93d-ed7293f7bb5a","isCorrect":true,"text":"3×5"},{"displayOrder":3,"id":"031bef59-1cbf-4a89-83b9-294469dfd31a","isCorrect":false,"text":"3×15"},{"displayOrder":4,"id":"30d09c16-a39e-499b-a006-d72a72d6df82","isCorrect":false,"text":"15×3"}],"prompt":"컵이 15개이고 한 줄에 3개씩 놓습니다. 알맞은 곱셈식은?","skillCode":"infer-missing-group-value","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"6559b39d-f80a-4ed6-a5e7-01c5e800e210","questions":[{"displayOrder":1,"explanation":"4×3은 한 묶음에 4개씩 3묶음이고 반복 덧셈은 4+4+4입니다.","id":"2e03ece4-bcca-4c15-b01d-7921fee22ae0","options":[{"displayOrder":1,"id":"3a4957c0-3027-4807-80e8-f0507f4de748","isCorrect":true,"text":"한 줄에 4개씩 3줄이며 4를 3번 더하기 때문입니다."},{"displayOrder":2,"id":"bef2884f-ea53-4609-92a3-c1a6c86cf67f","isCorrect":false,"text":"한 줄에 3개씩 4줄이며 앞 수가 줄 수이기 때문입니다."},{"displayOrder":3,"id":"78e8fe8c-2fc5-4196-9772-63f5d70430f3","isCorrect":false,"text":"4개와 3개를 한곳에 두며 두 수를 더하기 때문입니다."},{"displayOrder":4,"id":"c3e10041-d3cd-44cb-824f-bc5f0829acdc","isCorrect":false,"text":"줄마다 개수가 다르지만 전체가 12이기 때문입니다."}],"prompt":"4×3을 나타내는 상황과 이유가 모두 알맞은 것은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":2,"explanation":"한 묶음인 상자 하나의 공 3개를 앞에, 상자 수 4를 뒤에 써서 3×4입니다.","id":"99dbcb22-524b-4231-b16c-ff4f188a29d2","options":[{"displayOrder":1,"id":"33477ff6-df4e-477b-9fc1-1d0fd3fc0974","isCorrect":false,"text":"상자 수 4를 앞에 쓰므로 맞습니다."},{"displayOrder":2,"id":"1b2766d5-3b75-4083-950e-c9dbfdbb9b40","isCorrect":true,"text":"한 상자의 공 3을 앞에 써서 3×4로 고칩니다."},{"displayOrder":3,"id":"8aff3fc9-87d5-47ef-ac51-506fb0d62010","isCorrect":false,"text":"전체 수 12를 앞에 써서 12×1로 고칩니다."},{"displayOrder":4,"id":"b926eeba-04c4-45da-aa75-97fda0323a53","isCorrect":false,"text":"곱셈으로 나타낼 수 없습니다."}],"prompt":"상자 4개에 공이 3개씩 있습니다. 4×3이라고 쓴 학생의 생각을 바르게 고친 것은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":3,"explanation":"5개씩 4봉지는 5+5+5+5=20이므로 □는 4입니다.","id":"c3a4ebc2-f202-4310-a9fd-a77691af74e8","options":[{"displayOrder":1,"id":"72688923-6fb1-4467-9544-386fc16025dd","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"5ac884c7-ebdf-4121-b219-08a63b95ec20","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"e3a815fc-b894-4552-adc3-5565b7c50689","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"06abe4c0-bd01-48dd-b149-891153d937b9","isCorrect":false,"text":"15"}],"prompt":"한 봉지에 구슬이 5개씩 있습니다. 구슬 20개를 모두 담으려면 식의 □는 얼마입니까? 5×□","skillCode":"infer-missing-group-value","weight":1},{"displayOrder":4,"explanation":"4씩 3묶음도 전체는 12이지만 한 묶음의 수와 묶음 수가 3×4와 서로 다릅니다.","id":"6e7062b1-f082-43d2-93f8-250d9c139610","options":[{"displayOrder":1,"id":"09d55526-f6f0-4fef-9fda-c3e542f1fad7","isCorrect":false,"text":"3씩 4묶음"},{"displayOrder":2,"id":"79600135-61e6-44e2-832f-63f26c300d87","isCorrect":false,"text":"3을 네 번 더함"},{"displayOrder":3,"id":"13aa1205-c55c-4bfc-ac5d-bab190c1e48b","isCorrect":false,"text":"한 묶음 3개가 4묶음"},{"displayOrder":4,"id":"e3181a70-9957-4109-b3a5-a0d93b90dec6","isCorrect":true,"text":"4씩 3묶음"}],"prompt":"다음 중 3×4와 전체 수는 같지만 묶음의 뜻은 다른 설명은?","skillCode":"interpret-multiplication-expression","weight":1},{"displayOrder":5,"explanation":"처음 2씩 6묶음과 다시 만든 3씩 4묶음은 묶는 방법은 달라도 전체가 12개로 같습니다.","id":"e6f9b58a-0b52-463f-a0b7-36561a74952e","options":[{"displayOrder":1,"id":"d4daf6d7-cf04-46a1-a08e-f7b8f7b59944","isCorrect":true,"text":"처음은 2×6이고 다시 묶으면 3×4이며 전체는 모두 12개입니다."},{"displayOrder":2,"id":"d9efae89-00b6-4892-afeb-5fad254a8d9c","isCorrect":false,"text":"처음과 다시 묶은 식은 모두 2×6입니다."},{"displayOrder":3,"id":"8b371207-285b-4c9d-ab4b-ee57608fc1dd","isCorrect":false,"text":"다시 묶으면 6×3이고 전체는 18개입니다."},{"displayOrder":4,"id":"74cb3215-505c-4ee1-9f31-e40e8ff41506","isCorrect":false,"text":"묶는 방법이 달라지면 전체 수도 달라집니다."}],"prompt":"한 줄에 2개씩 6줄 놓인 단추를 3개씩 다시 묶었습니다. 알맞은 설명은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":6,"explanation":"3씩 7묶음은 3×7의 뜻입니다. 7×3은 7씩 3묶음입니다.","id":"d85b9399-dd4c-454e-b039-3fcc665b4399","options":[{"displayOrder":1,"id":"eb48809e-2ada-4b28-8621-0206815cfef0","isCorrect":false,"text":"7씩 3묶음"},{"displayOrder":2,"id":"b32dae5d-9fa8-4eb8-9a55-3fbb98ef87c7","isCorrect":true,"text":"3씩 7묶음"},{"displayOrder":3,"id":"053a7ad2-82ac-4218-aac3-76d9369b4dc8","isCorrect":false,"text":"7+7+7"},{"displayOrder":4,"id":"b6331ab3-a347-4898-a44a-c9035a3bb571","isCorrect":false,"text":"한 묶음의 수는 7이고 묶음 수는 3입니다."}],"prompt":"7×3을 설명한 것 중 잘못된 것은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":7,"explanation":"24개를 4접시에 똑같이 놓으면 한 접시에 6개씩이고 식은 6×4입니다.","id":"f1c4c7b6-8f54-4bd2-83a2-d106ed25a761","options":[{"displayOrder":1,"id":"f8b48a06-b917-4a1e-ba78-148c4872e5dd","isCorrect":false,"text":"4개, 4×6"},{"displayOrder":2,"id":"96272985-6b10-4407-8d4b-6d289721c85f","isCorrect":false,"text":"24개, 24×4"},{"displayOrder":3,"id":"5a2e9ff9-d91d-4334-8357-f3bcab2c4305","isCorrect":true,"text":"6개, 6×4"},{"displayOrder":4,"id":"a9045256-19b6-475e-9152-51fd13544509","isCorrect":false,"text":"6개, 4×6"}],"prompt":"접시마다 빵이 같은 수씩 있고 접시는 4개입니다. 빵이 모두 24개라면 한 접시의 빵 수와 식은?","skillCode":"infer-missing-group-value","weight":1},{"displayOrder":8,"explanation":"2×5는 2씩 5묶음이므로 2를 다섯 번 더한 식으로 뜻을 설명합니다.","id":"9ad06fd3-3ac8-4aae-96a8-943445542a62","options":[{"displayOrder":1,"id":"d2820535-1185-44d9-89de-c5e01edd42ba","isCorrect":false,"text":"2에서 5를 뺍니다."},{"displayOrder":2,"id":"06929f0e-a87b-49ad-9c5a-385ae39e4753","isCorrect":false,"text":"2와 5를 이어 25로 씁니다."},{"displayOrder":3,"id":"8c8e3101-74ad-495f-9052-c891797bf981","isCorrect":false,"text":"5를 두 번만 더합니다."},{"displayOrder":4,"id":"fa07c099-4d58-4dc7-b7f2-ed2c369ae4e4","isCorrect":true,"text":"2를 다섯 번 더한 2+2+2+2+2로 생각합니다."}],"prompt":"''2×5는 2와 5를 더한 7이다''라는 설명을 바르게 고친 것은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":9,"explanation":"4씩 3묶음과 2씩 6묶음은 모두 12개이지만 묶음의 모양은 다릅니다.","id":"ad8c349d-bf63-4abd-b7a5-4146136a8151","options":[{"displayOrder":1,"id":"2e31c4f0-8169-4203-a247-428a0ebf3efe","isCorrect":false,"text":"두 식은 한 묶음의 수와 묶음 수도 모두 같습니다."},{"displayOrder":2,"id":"d0c742e5-60e3-4876-b5fa-120c1bbe3568","isCorrect":false,"text":"4×3만 곱셈이고 2×6은 곱셈이 아닙니다."},{"displayOrder":3,"id":"d8321ab0-d3f3-4c82-b648-d809fcd91f2f","isCorrect":true,"text":"4×3과 2×6은 묶는 방법은 다르지만 전체는 같습니다."},{"displayOrder":4,"id":"8db61567-9df6-4433-98d9-612a38af80f9","isCorrect":false,"text":"전체는 각각 7개와 8개입니다."}],"prompt":"한 칸에 별이 4개씩 있는 칸이 3개, 한 칸에 별이 2개씩 있는 칸이 6개입니다. 알맞은 설명은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":10,"explanation":"3이 네 번 더해졌으므로 3씩 4묶음이고 곱셈식은 3×4입니다.","id":"914ed9cc-704f-431e-aa39-0a764c46aee9","options":[{"displayOrder":1,"id":"910a8dfa-a325-4645-840c-f702df9df66a","isCorrect":false,"text":"4개씩 3묶음이므로 4×3입니다."},{"displayOrder":2,"id":"0835d5e0-2d2b-4830-96ea-0186933721a8","isCorrect":false,"text":"전체 12개이므로 묶음 없이 12×12입니다."},{"displayOrder":3,"id":"d8fe1da4-cbf8-44f8-af99-4b82dfd8ca14","isCorrect":false,"text":"3개와 4개를 더하므로 3+4입니다."},{"displayOrder":4,"id":"029994d3-8809-477d-b14d-997689f356d5","isCorrect":true,"text":"3개씩 4묶음이므로 3×4입니다."}],"prompt":"3+3+3+3과 어떤 상황을 연결한 설명이 가장 알맞습니까?","skillCode":"connect-repeated-addition-to-multiplication","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":6,"id":"4c8f9c55-37a9-4bf6-a444-e4165f8f30fc","slug":"grade2-multiplication-meaning","title":"곱셈의 뜻을 알아봐요"},"version":{"id":"8eb41f37-e2f1-42e9-a1c8-657ca08c9302","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid
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
  where stage.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_multiplication_meaning_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_multiplication_meaning_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 7

  union all
  select 3, 'grade2_multiplication_meaning_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = 'f97d31dbfa3be6b48d8836ebc31f947dae05a5df25bf05b6fcd5b37a8b666af1'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_multiplication_meaning_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_multiplication_meaning_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_multiplication_meaning_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_multiplication_meaning_v1_structure_and_orders',
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
    where stage.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_multiplication_meaning_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_multiplication_meaning_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid))

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
  where metadata.unit_id = '4c8f9c55-37a9-4bf6-a444-e4165f8f30fc'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 6

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = '4c8f9c55-37a9-4bf6-a444-e4165f8f30fc'::uuid
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
  where metadata.unit_id = '4c8f9c55-37a9-4bf6-a444-e4165f8f30fc'::uuid

  union all
  select 23, 'grade2_multiplication_meaning_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_multiplication_meaning_v1_pass_threshold_contract',
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
  select 25, 'grade2_multiplication_meaning_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_multiplication_meaning_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '8eb41f37-e2f1-42e9-a1c8-657ca08c9302'::uuid

  union all
  select 27, 'grade2_multiplication_meaning_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_multiplication_meaning_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_multiplication_meaning_v1_question_skills_exact',
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
select 999, 'grade2_multiplication_meaning_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
