-- Phase 2B grade2-three-digit-numbers v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":1,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"4d22bc1a-413c-42a0-8dc4-5b9b00b4bd79","questions":[{"displayOrder":1,"explanation":"347은 백의 자리 3과 십의 자리 4와 일의 자리 7로 이루어져 삼백사십칠이라고 읽습니다.","id":"74cb7602-51a7-485d-a955-6cda8dca913c","options":[{"displayOrder":1,"id":"a5a2f5a3-c7a5-44ec-be13-298d0fee24df","isCorrect":true,"text":"삼백사십칠"},{"displayOrder":2,"id":"dd57e04e-928f-4e8f-bfeb-11968e6722ee","isCorrect":false,"text":"삼백칠십사"},{"displayOrder":3,"id":"efebe57c-0a01-46f9-92fb-2a95b2cf0925","isCorrect":false,"text":"사백삼십칠"},{"displayOrder":4,"id":"78e6c0b6-26c1-4d45-bcdf-aea7d6495316","isCorrect":false,"text":"삼백사십"}],"prompt":"347을 읽은 것은?","weight":1},{"displayOrder":2,"explanation":"608은 백이 6개이고 십이 0개이며 일이 8개이므로 육백팔이라고 읽습니다.","id":"d52ef689-0ec4-4f00-8652-c3d149c8b4d6","options":[{"displayOrder":1,"id":"d12f6874-a422-4a38-828b-7b97e8cb58de","isCorrect":true,"text":"육백팔"},{"displayOrder":2,"id":"ddd55a35-01c9-437e-8c57-5c76143927db","isCorrect":false,"text":"육백팔십"},{"displayOrder":3,"id":"8e0246e9-3f12-4eb8-a989-575d2a2ee46d","isCorrect":false,"text":"육십팔"},{"displayOrder":4,"id":"84e9fdbb-19c6-4424-b9bb-c6ebb31ac3c2","isCorrect":false,"text":"팔백육"}],"prompt":"608을 읽은 것은?","weight":1},{"displayOrder":3,"explanation":"오백은 500이고 이십은 20이며 구는 9이므로 529입니다.","id":"7ae7a5ad-57be-4c25-88b4-eb69693aa38f","options":[{"displayOrder":1,"id":"1f741532-fcb4-4195-a570-4869fea1ef39","isCorrect":false,"text":"592"},{"displayOrder":2,"id":"08e202d0-a02e-477e-a60a-eb881b1d1f6b","isCorrect":false,"text":"509"},{"displayOrder":3,"id":"202a2494-a986-4070-8d3a-34a7d85c882a","isCorrect":true,"text":"529"},{"displayOrder":4,"id":"a18f62ef-6038-4456-abd2-70444c9476a6","isCorrect":false,"text":"259"}],"prompt":"오백이십구를 숫자로 쓴 것은?","weight":1},{"displayOrder":4,"explanation":"칠백사는 700과 4를 합한 수이므로 704입니다.","id":"b3ee2305-6096-4854-8da1-6ee50bba443c","options":[{"displayOrder":1,"id":"89378ac2-7fac-4687-88ae-62a38349b2b7","isCorrect":false,"text":"740"},{"displayOrder":2,"id":"121c59c9-3793-43aa-b808-397209d2c731","isCorrect":false,"text":"714"},{"displayOrder":3,"id":"173865a8-378e-4ab1-a11a-8dfdeb9a7e4e","isCorrect":false,"text":"407"},{"displayOrder":4,"id":"44918797-fb15-4f9f-b9ac-275f9c2130d1","isCorrect":true,"text":"704"}],"prompt":"칠백사를 숫자로 쓴 것은?","weight":1},{"displayOrder":5,"explanation":"백 4개는 400이고 십 2개는 20이며 일 6개는 6이므로 426입니다.","id":"418c89a8-fa82-4972-a286-672d8c7a5765","options":[{"displayOrder":1,"id":"e3643260-12cb-49e9-b39c-b6b99e479d25","isCorrect":false,"text":"246"},{"displayOrder":2,"id":"c4658349-658c-43ed-a7b1-e450de1eac6c","isCorrect":false,"text":"462"},{"displayOrder":3,"id":"244596f5-f822-40e0-8e11-5028ec0ee2bc","isCorrect":true,"text":"426"},{"displayOrder":4,"id":"d4280586-baae-480f-8353-387d712cd2d0","isCorrect":false,"text":"406"}],"prompt":"백이 4개이고 십이 2개이며 일이 6개인 수는?","weight":1},{"displayOrder":6,"explanation":"700에 십 묶음은 없고 일 3개를 더하므로 703입니다.","id":"8ee31fab-9744-4a60-bc14-e832b87bcc7e","options":[{"displayOrder":1,"id":"96fd0453-184c-4674-9538-ab103edaa4c3","isCorrect":false,"text":"730"},{"displayOrder":2,"id":"989c0021-bf9f-4dd3-89e1-d8997d4e22b1","isCorrect":false,"text":"73"},{"displayOrder":3,"id":"1ea5f709-ed6e-4f01-8132-9474f0df8015","isCorrect":false,"text":"700"},{"displayOrder":4,"id":"57c239b9-b4f2-4276-9d50-3fff9582e221","isCorrect":true,"text":"703"}],"prompt":"백이 7개이고 십이 0개이며 일이 3개인 수는?","weight":1},{"displayOrder":7,"explanation":"백 묶음 9개는 900이고 십 묶음 5개는 50이므로 950입니다.","id":"55025c0a-1104-416e-9f30-587b6882747a","options":[{"displayOrder":1,"id":"7e8abbe9-c2b0-4ab0-a6fa-6d335b9b2245","isCorrect":false,"text":"905"},{"displayOrder":2,"id":"bdc380e8-bf94-4a48-be62-56e85aea5544","isCorrect":false,"text":"590"},{"displayOrder":3,"id":"a3bd958a-c9d7-445d-b17e-3be6f5fae9e6","isCorrect":true,"text":"950"},{"displayOrder":4,"id":"85aa9948-cd3a-43da-926a-88a1a58adf38","isCorrect":false,"text":"95"}],"prompt":"백 묶음 9개와 십 묶음 5개가 나타내는 수는?","weight":1},{"displayOrder":8,"explanation":"352에서 백의 자리에 있는 숫자는 3입니다.","id":"30aec327-ca9c-47d5-b510-df173ceead4b","options":[{"displayOrder":1,"id":"0616980e-6180-422a-aabc-c2f2cd35b3cf","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"4d72bd98-b5ab-4dcb-b545-948cc3cf46c7","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"34bbee10-fe6c-4db0-9911-2a66f71f891f","isCorrect":false,"text":"300"},{"displayOrder":4,"id":"07807354-8132-4823-a1b6-0e3c50810a8a","isCorrect":true,"text":"3"}],"prompt":"352의 백의 자리 숫자는?","weight":1},{"displayOrder":9,"explanation":"8은 십의 자리에 있으므로 8이 나타내는 값은 80입니다.","id":"2e8187a3-bcc6-4eca-b142-d992cd6d6ed0","options":[{"displayOrder":1,"id":"170cfba9-9ffd-4258-8b7d-dbe72f2cd7cd","isCorrect":false,"text":"8"},{"displayOrder":2,"id":"70f3c035-0a67-4516-a0ea-2a5ffdb6dfe1","isCorrect":true,"text":"80"},{"displayOrder":3,"id":"691c525d-57cd-48e4-9507-c506cfb36261","isCorrect":false,"text":"800"},{"displayOrder":4,"id":"3c90d2de-6f3c-477e-89e6-af143480dc61","isCorrect":false,"text":"60"}],"prompt":"681에서 십의 자리 숫자 8이 나타내는 값은?","weight":1},{"displayOrder":10,"explanation":"407에서 일의 자리에 있는 숫자는 7입니다.","id":"fbef1249-082f-4d04-8603-a1eb1b1e217b","options":[{"displayOrder":1,"id":"0325256e-878b-4dcb-a942-4bf0b6f1e8db","isCorrect":false,"text":"0"},{"displayOrder":2,"id":"38804556-fa0c-4559-b846-a1339b5b96fe","isCorrect":false,"text":"4"},{"displayOrder":3,"id":"fd510e2c-99a5-405d-9db3-a699a10c4b60","isCorrect":true,"text":"7"},{"displayOrder":4,"id":"7f8d395f-6c0e-4538-b88e-038d53617dfe","isCorrect":false,"text":"40"}],"prompt":"407의 일의 자리 숫자는?","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"6fc97490-b295-4bcd-a138-36d53c5a7464","questions":[{"displayOrder":1,"explanation":"300과 40과 8을 합하면 348입니다.","id":"2bb440ab-b0e5-4c62-85ef-8ac911682f7f","options":[{"displayOrder":1,"id":"042cb4a2-affe-43e1-a151-9b41e63a7af3","isCorrect":true,"text":"348"},{"displayOrder":2,"id":"73735389-9a58-4335-a184-c56545fd739c","isCorrect":false,"text":"384"},{"displayOrder":3,"id":"224600fa-2b93-44af-8ac9-f17a6c2af42d","isCorrect":false,"text":"438"},{"displayOrder":4,"id":"add99121-1ee0-4480-95d5-95d4930c924c","isCorrect":false,"text":"308"}],"prompt":"300과 40과 8을 합한 수는?","weight":1},{"displayOrder":2,"explanation":"백 6개는 600이고 십은 0개이며 일 5개를 더하므로 605입니다.","id":"58641795-7646-40c6-9e91-13debbb3c9f9","options":[{"displayOrder":1,"id":"81212197-870e-4586-b822-e9f8d91d90b8","isCorrect":false,"text":"650"},{"displayOrder":2,"id":"3e125ecf-5cda-4ced-9edc-98f4914a60ea","isCorrect":false,"text":"65"},{"displayOrder":3,"id":"ea27bbc6-55a0-49e5-90a1-4fcaff3e3a15","isCorrect":false,"text":"600"},{"displayOrder":4,"id":"e39c0a32-8045-43fe-8cae-92385f83216a","isCorrect":true,"text":"605"}],"prompt":"백이 6개이고 일이 5개이며 십은 없는 수는?","weight":1},{"displayOrder":3,"explanation":"200과 90을 합하고 일은 더하지 않으므로 290입니다.","id":"2e3bc924-b52b-4121-8051-116932438076","options":[{"displayOrder":1,"id":"5527c98e-3403-4203-8d6c-0710e3b89686","isCorrect":false,"text":"209"},{"displayOrder":2,"id":"65ef7869-d62f-470f-80d8-b7c14d233773","isCorrect":false,"text":"920"},{"displayOrder":3,"id":"24a25e17-bbd7-4764-b202-3be06368850f","isCorrect":false,"text":"29"},{"displayOrder":4,"id":"aae0ade9-8127-4fd7-8ca1-7f8377b84084","isCorrect":true,"text":"290"}],"prompt":"백이 2개이고 십이 9개이며 일이 0개인 수는?","weight":1},{"displayOrder":4,"explanation":"572는 백 5개와 십 7개와 일 2개이므로 500+70+2입니다.","id":"135de36a-13b2-4743-92b7-f2292508b397","options":[{"displayOrder":1,"id":"d90eb8d6-339b-49f3-8c42-e9650e9552b7","isCorrect":true,"text":"500+70+2"},{"displayOrder":2,"id":"218f7a78-fb7a-4f61-8fd6-2cc67dadbde6","isCorrect":false,"text":"500+7+2"},{"displayOrder":3,"id":"1562be98-54c8-4439-b288-a750b83f1759","isCorrect":false,"text":"50+70+2"},{"displayOrder":4,"id":"0a858041-a23e-457e-b5cd-b4656082b9a2","isCorrect":false,"text":"500+72+2"}],"prompt":"572를 바르게 나눈 것은?","weight":1},{"displayOrder":5,"explanation":"406은 백 4개와 십 0개와 일 6개이므로 400+6입니다.","id":"c50e3414-c0e6-4053-9a65-b38a451e362c","options":[{"displayOrder":1,"id":"be28320d-86f2-4034-bfb5-6a98a5e9f7c6","isCorrect":false,"text":"400+60"},{"displayOrder":2,"id":"71ad5840-439f-46c7-b00c-139dc2a71496","isCorrect":false,"text":"40+6"},{"displayOrder":3,"id":"e8862274-19c6-4c5d-b818-8bf43cfbdbaa","isCorrect":true,"text":"400+6"},{"displayOrder":4,"id":"71a3ada4-4268-475d-beab-e7a079166348","isCorrect":false,"text":"400+60+6"}],"prompt":"406을 바르게 나눈 것은?","weight":1},{"displayOrder":6,"explanation":"830은 백 8개와 십 3개와 일 0개이므로 800+30입니다.","id":"7f42a33f-10d9-4a54-96c9-5f12f73e0237","options":[{"displayOrder":1,"id":"fc2fa835-d913-4d7f-a0e6-51df155570b8","isCorrect":false,"text":"800+3"},{"displayOrder":2,"id":"ab0f8899-90e8-4a28-a804-7fa876fb480b","isCorrect":false,"text":"80+30"},{"displayOrder":3,"id":"b4ae66c8-5fc0-4283-a3cf-f7a87ee63692","isCorrect":false,"text":"800+30+3"},{"displayOrder":4,"id":"a6084c2c-a4b5-4b00-9dbd-692d4e6280eb","isCorrect":true,"text":"800+30"}],"prompt":"830을 바르게 나눈 것은?","weight":1},{"displayOrder":7,"explanation":"7은 백의 자리에 있으므로 700을 나타냅니다.","id":"cfb0057a-b980-4963-9630-727d02904c3e","options":[{"displayOrder":1,"id":"51fcb87d-d77c-4201-a69a-927fd5e12d95","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"735b58f5-2b41-4414-a69b-78582ac811aa","isCorrect":false,"text":"70"},{"displayOrder":3,"id":"dec9e40a-5db7-4330-b26d-236610f2e8e4","isCorrect":true,"text":"700"},{"displayOrder":4,"id":"63239d6c-5de5-4353-9d6d-c8615d43f0d2","isCorrect":false,"text":"760"}],"prompt":"764에서 숫자 7이 나타내는 값은?","weight":1},{"displayOrder":8,"explanation":"9는 십의 자리에 있으므로 90을 나타냅니다.","id":"e0bcbacd-8014-4ab4-9e46-df227d25a04f","options":[{"displayOrder":1,"id":"4bcf9e34-9ec0-452c-a94a-12451a759e69","isCorrect":false,"text":"9"},{"displayOrder":2,"id":"ce4bb6c4-4c5e-497c-b58e-5663be3514d9","isCorrect":false,"text":"900"},{"displayOrder":3,"id":"7110d75a-fbc6-42f3-abc9-7f61edd9e64d","isCorrect":false,"text":"20"},{"displayOrder":4,"id":"e301d273-cc16-48bf-ae83-d2327647cccb","isCorrect":true,"text":"90"}],"prompt":"295에서 숫자 9가 나타내는 값은?","weight":1},{"displayOrder":9,"explanation":"509에는 십 묶음이 없으므로 십의 자리 숫자는 0입니다.","id":"61720902-0df0-4b58-8470-bb251b4b6062","options":[{"displayOrder":1,"id":"e8b011e3-d3ea-4164-bbda-8997184aa542","isCorrect":true,"text":"0"},{"displayOrder":2,"id":"56ef1403-de19-4233-b683-b3c010667937","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"71e3bfa1-9e43-4a87-bde2-0e583658a64f","isCorrect":false,"text":"9"},{"displayOrder":4,"id":"618e9cc1-8d0f-4ba3-9866-0d2702bf9683","isCorrect":false,"text":"50"}],"prompt":"509의 십의 자리 숫자는?","weight":1},{"displayOrder":10,"explanation":"470은 백 4개와 십 7개와 일 0개이므로 400+70입니다.","id":"ffe15a79-6f93-42d3-bbcc-fa5b8b29d0b4","options":[{"displayOrder":1,"id":"74363334-09d1-4cc5-8f8e-28c5cb364e3f","isCorrect":false,"text":"400+7"},{"displayOrder":2,"id":"1e6c5e82-5d8a-4828-a695-f3de7fd9d59d","isCorrect":true,"text":"400+70"},{"displayOrder":3,"id":"ee8e5d27-d78f-41a1-8b54-bbe0a093f3df","isCorrect":false,"text":"40+70"},{"displayOrder":4,"id":"98638495-4343-4cdc-a318-7cc00e5552d7","isCorrect":false,"text":"400+70+7"}],"prompt":"470을 나타내는 식은?","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"cd4d5705-d872-417a-8d78-3a1f11463e37","questions":[{"displayOrder":1,"explanation":"백의 자리 수가 같으므로 십의 자리를 비교하면 8이 3보다 커서 483이 더 큽니다.","id":"d35086fd-24e4-44a1-9013-590ac84ae7a9","options":[{"displayOrder":1,"id":"232b8072-1a3d-43cb-851d-a24f05da136b","isCorrect":false,"text":"438"},{"displayOrder":2,"id":"38e1e779-a816-40df-814f-69916a956bc1","isCorrect":true,"text":"483"},{"displayOrder":3,"id":"b7d28c98-0a26-4342-9d17-28b884368a76","isCorrect":false,"text":"두 수는 같습니다"},{"displayOrder":4,"id":"115bfe1c-4c10-4f45-958b-afde22cf7410","isCorrect":false,"text":"알 수 없습니다"}],"prompt":"438과 483 중 더 큰 수는?","weight":1},{"displayOrder":2,"explanation":"백의 자리 수가 같고 십의 자리에서 0이 5보다 작으므로 705가 더 작습니다.","id":"684be076-b409-4422-a53c-fa82ccadef81","options":[{"displayOrder":1,"id":"e3b704ce-3050-4341-9b62-09c4f31e64b8","isCorrect":true,"text":"705"},{"displayOrder":2,"id":"7753c30e-49e7-4d36-aa7f-7b2f741f52b6","isCorrect":false,"text":"750"},{"displayOrder":3,"id":"971534c8-fff8-42d6-8e6c-df9c3c3cda96","isCorrect":false,"text":"두 수는 같습니다"},{"displayOrder":4,"id":"255e9f8e-874f-4381-a8f4-a487faeabae5","isCorrect":false,"text":"알 수 없습니다"}],"prompt":"705와 750 중 더 작은 수는?","weight":1},{"displayOrder":3,"explanation":"692는 백의 자리 수가 같고 십의 자리 9가 2보다 크므로 629보다 큽니다.","id":"6a0b6177-848d-41be-8ee0-33c97584f654","options":[{"displayOrder":1,"id":"d39cd555-4634-4a80-b86f-54951e908cc3","isCorrect":false,"text":"592"},{"displayOrder":2,"id":"3e965309-f182-403c-a752-85b6cf72e726","isCorrect":false,"text":"620"},{"displayOrder":3,"id":"3b841d61-d523-43c9-8be0-f996c5489097","isCorrect":false,"text":"628"},{"displayOrder":4,"id":"d2a7c1ec-20fd-4e4c-a584-b017510b7696","isCorrect":true,"text":"692"}],"prompt":"629보다 큰 수는?","weight":1},{"displayOrder":4,"explanation":"백의 자리부터 비교하면 213이 가장 작고 이어서 312와 321의 순서입니다.","id":"aab9216b-3e1c-4640-9344-802fedc1c218","options":[{"displayOrder":1,"id":"486be5d0-2f52-4295-a6ce-46c5360e7dcc","isCorrect":false,"text":"312 → 321 → 213"},{"displayOrder":2,"id":"81765c53-0f50-4b3a-81d2-6cd67bdc9897","isCorrect":true,"text":"213 → 312 → 321"},{"displayOrder":3,"id":"f9b74b36-7bb8-49ee-b77d-cc7470dd9d32","isCorrect":false,"text":"213 → 321 → 312"},{"displayOrder":4,"id":"9e4ce6cd-8684-41c9-8352-b278c8c73e19","isCorrect":false,"text":"321 → 312 → 213"}],"prompt":"312와 321과 213을 작은 수부터 놓은 것은?","weight":1},{"displayOrder":5,"explanation":"백의 자리가 5인 수들이 먼저이고 그중 564가 546보다 크므로 564 → 546 → 465입니다.","id":"855c16ea-7bed-40f3-8566-dd9306212efc","options":[{"displayOrder":1,"id":"3c46c202-94da-4ca2-9ce6-bf45dae44078","isCorrect":true,"text":"564 → 546 → 465"},{"displayOrder":2,"id":"62a0200e-594a-4d8c-b1c6-f98002edaecf","isCorrect":false,"text":"546 → 564 → 465"},{"displayOrder":3,"id":"77876f7d-4eaa-4d9d-8e5d-b2342161d060","isCorrect":false,"text":"465 → 546 → 564"},{"displayOrder":4,"id":"63d074fe-cb53-402c-85ee-fb9fb81e5842","isCorrect":false,"text":"564 → 465 → 546"}],"prompt":"546과 465와 564를 큰 수부터 놓은 것은?","weight":1},{"displayOrder":6,"explanation":"백의 자리 수는 같고 십과 일의 자리를 차례로 비교하면 800 → 808 → 880입니다.","id":"cb364720-372d-4cd4-832f-8c81e3f6627c","options":[{"displayOrder":1,"id":"b0523aa9-296c-4638-97b7-2a2ebdbab489","isCorrect":true,"text":"800 → 808 → 880"},{"displayOrder":2,"id":"4a70d9bd-6f3d-4e2d-b303-a9b781b90203","isCorrect":false,"text":"808 → 800 → 880"},{"displayOrder":3,"id":"4b89f109-055b-4712-8de9-c09b0b10a3dd","isCorrect":false,"text":"880 → 808 → 800"},{"displayOrder":4,"id":"076e51a5-5e7c-47c2-9a17-ec43cdb9bf1e","isCorrect":false,"text":"800 → 880 → 808"}],"prompt":"808과 880과 800을 작은 수부터 놓은 것은?","weight":1},{"displayOrder":7,"explanation":"500보다 1 작은 수는 499이므로 바로 앞 수는 499입니다.","id":"cb16dc05-188e-4398-961c-005bc4965faf","options":[{"displayOrder":1,"id":"41df98d9-b4a2-4286-93a5-e505a9700046","isCorrect":true,"text":"499"},{"displayOrder":2,"id":"53b41d35-8133-4d0c-b0f0-4942cbdd3f58","isCorrect":false,"text":"501"},{"displayOrder":3,"id":"9dcb7639-d697-45e7-bfd8-fa214d756f1c","isCorrect":false,"text":"490"},{"displayOrder":4,"id":"5612898f-2718-4eb3-bcdf-649574396d20","isCorrect":false,"text":"400"}],"prompt":"500의 바로 앞 수는?","weight":1},{"displayOrder":8,"explanation":"799보다 1 큰 수는 800이므로 바로 뒤 수는 800입니다.","id":"0d5a52ef-ef0b-4987-b7ce-d074ff26d762","options":[{"displayOrder":1,"id":"ae6dcae9-abcf-42b6-8b1d-8ed97e4123b1","isCorrect":false,"text":"798"},{"displayOrder":2,"id":"ca30bafb-cdca-41a5-90df-d785174c88fd","isCorrect":false,"text":"790"},{"displayOrder":3,"id":"9644c3d3-229e-4d8e-aedd-c784d5fc2c8f","isCorrect":true,"text":"800"},{"displayOrder":4,"id":"25c6d4e7-0599-4960-b665-1ebc0688cac9","isCorrect":false,"text":"899"}],"prompt":"799의 바로 뒤 수는?","weight":1},{"displayOrder":9,"explanation":"10씩 커지는 배열이므로 330 다음은 340입니다.","id":"a0d84d53-0a52-4837-8601-41b4d7463441","options":[{"displayOrder":1,"id":"7704f91b-6a8d-4725-bcdc-43091a887472","isCorrect":false,"text":"335"},{"displayOrder":2,"id":"2b87a589-f4d3-4d8b-8271-1aee9e82b6d3","isCorrect":true,"text":"340"},{"displayOrder":3,"id":"d88a1f39-a664-4a36-8b1a-50b8ad0684a1","isCorrect":false,"text":"345"},{"displayOrder":4,"id":"ee60fad6-bca2-41e9-b619-1cb0b4a5c83c","isCorrect":false,"text":"360"}],"prompt":"320 → 330 → □ → 350에서 □에 알맞은 수는?","weight":1},{"displayOrder":10,"explanation":"5씩 커지는 배열이므로 905 다음은 910입니다.","id":"5d1da955-d9e2-44f4-a5ef-8005e56be778","options":[{"displayOrder":1,"id":"8c41d846-cf14-4850-955b-1d94a0acf48d","isCorrect":false,"text":"906"},{"displayOrder":2,"id":"3468c0d4-0798-4f36-9ac5-515340f111b9","isCorrect":false,"text":"908"},{"displayOrder":3,"id":"c7102c58-b5b0-4ef0-a46c-9583d190e9df","isCorrect":true,"text":"910"},{"displayOrder":4,"id":"efce1265-281f-4884-ba96-8e288305c46d","isCorrect":false,"text":"925"}],"prompt":"905 → □ → 915 → 920에서 □에 알맞은 수는?","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"2494eb5c-86c4-47f8-8ae2-1d7b8026c240","questions":[{"displayOrder":1,"explanation":"범위와 일의 자리 조건으로 후보를 좁힙니다. 일의 자리 2의 2배인 4가 십의 자리에 오는 수는 442입니다.","id":"463be537-521e-4655-8298-c3d647ec5694","options":[{"displayOrder":1,"id":"8ffb6318-adda-4457-b592-6b20e3760d45","isCorrect":true,"text":"442"},{"displayOrder":2,"id":"062dc9c1-5495-472e-8366-ceec2f53c05e","isCorrect":false,"text":"452"},{"displayOrder":3,"id":"6bd1fff6-ff21-40ad-9444-1017b146a7b5","isCorrect":false,"text":"462"},{"displayOrder":4,"id":"51f06edf-013d-4231-bf3a-deb611db98c3","isCorrect":false,"text":"432"}],"prompt":"430보다 크고 470보다 작으며 일의 자리 숫자는 2입니다. 십의 자리 숫자가 일의 자리 숫자의 2배인 수는?","weight":1},{"displayOrder":2,"explanation":"십의 자리와 일의 자리의 합이 9인 이웃한 숫자는 4와 5입니다. 작은 4를 십의 자리에 놓으면 645입니다.","id":"b79b2ebe-3137-42e5-aadd-0711d2364b08","options":[{"displayOrder":1,"id":"c864f71a-d92c-48a1-90fb-afabf04245f7","isCorrect":false,"text":"654"},{"displayOrder":2,"id":"027dcaf8-b7d8-42f4-b6d7-af6a49b02b3e","isCorrect":true,"text":"645"},{"displayOrder":3,"id":"12d6f81c-bbee-431a-97a9-dc6822f8d196","isCorrect":false,"text":"634"},{"displayOrder":4,"id":"b3ba38d7-3554-4684-a9f0-a6c6c519f2f7","isCorrect":false,"text":"643"}],"prompt":"600보다 크고 700보다 작은 수입니다. 십의 자리 숫자는 일의 자리 숫자보다 1 작고 두 숫자를 더하면 9입니다. 이 수는?","weight":1},{"displayOrder":3,"explanation":"가장 큰 수는 863입니다. 그다음에는 백의 자리 8을 유지하고 남은 숫자를 3과 6의 순서로 놓은 836이 옵니다.","id":"dd91a344-f3e7-4084-ac0b-a2b4aa835633","options":[{"displayOrder":1,"id":"664ba395-7842-45f1-a6ab-7e5c2d9fb0c2","isCorrect":false,"text":"638"},{"displayOrder":2,"id":"5aef6f03-94c2-4f19-bf0c-91c55ae04aa8","isCorrect":false,"text":"683"},{"displayOrder":3,"id":"203761f6-909a-432a-838a-ae3a3d47a099","isCorrect":true,"text":"836"},{"displayOrder":4,"id":"d77e72d1-3009-45b4-959f-3965d53b3fb3","isCorrect":false,"text":"863"}],"prompt":"숫자 카드 3과 6과 8을 각각 한 번씩 써서 세 자리 수를 만듭니다. 만들 수 있는 두 번째로 큰 수는?","weight":1},{"displayOrder":4,"explanation":"400보다 크면서 가장 작게 하려면 백의 자리에 4를 놓습니다. 남은 숫자 중 작은 0을 십의 자리에 놓으면 407입니다.","id":"29c53182-563c-4465-a4fa-bc4af7f0853b","options":[{"displayOrder":1,"id":"651ae889-0777-444e-8ea4-e61307196ba8","isCorrect":false,"text":"047"},{"displayOrder":2,"id":"9969ac21-42dc-4562-9175-c45d5a92b965","isCorrect":false,"text":"470"},{"displayOrder":3,"id":"3bef1f1b-1f64-46ca-b5bd-2abb152cc64a","isCorrect":false,"text":"704"},{"displayOrder":4,"id":"ba09ae27-2358-490b-af82-2a46bf3c28c2","isCorrect":true,"text":"407"}],"prompt":"숫자 카드 0과 4와 7을 각각 한 번씩 써서 400보다 큰 세 자리 수를 만듭니다. 그중 가장 작은 수는?","weight":1},{"displayOrder":5,"explanation":"십의 자리 7과 일의 자리 2를 바꾸면 427입니다. 427은 420보다 크고 430보다 작습니다.","id":"1528bab3-d29c-419e-ad04-f311e8aeb846","options":[{"displayOrder":1,"id":"19d95115-d247-408b-bed3-7b2aaffc8a8a","isCorrect":true,"text":"420보다 크고 430보다 작습니다."},{"displayOrder":2,"id":"a2247db0-4400-4c5c-956e-f20d6687bbaa","isCorrect":false,"text":"470보다 크고 480보다 작습니다."},{"displayOrder":3,"id":"66cb87a7-a22a-4fe9-b606-c4afd0626dd4","isCorrect":false,"text":"백의 자리 숫자가 2입니다."},{"displayOrder":4,"id":"b9b8e099-6b1a-4d34-af54-685af19c6050","isCorrect":false,"text":"472보다 큽니다."}],"prompt":"472의 십의 자리와 일의 자리 숫자를 서로 바꿨습니다. 바꾼 수를 바르게 설명한 것은?","weight":1},{"displayOrder":6,"explanation":"처음 수가 더 크려면 십의 자리 □가 7보다 커야 합니다. 7보다 큰 짝수는 8이므로 □는 8입니다.","id":"f8c47bf1-e8a1-4c3a-9b4c-b78f5307f4c1","options":[{"displayOrder":1,"id":"d5ce7866-2d19-47c1-b7ae-9c7974283439","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"830c8924-4807-40c6-9d48-3c5abe57c0ad","isCorrect":true,"text":"8"},{"displayOrder":3,"id":"dc7e189e-71b8-4b4e-811c-73a6cbb09c70","isCorrect":false,"text":"4"},{"displayOrder":4,"id":"114fa42e-0149-4f92-becb-e91f8b05ef08","isCorrect":false,"text":"2"}],"prompt":"5□7에서 십의 자리와 일의 자리 숫자를 바꾸면 57□가 됩니다. 처음 수가 바꾼 수보다 크고 □가 짝수일 때 □에 알맞은 숫자는?","weight":1},{"displayOrder":7,"explanation":"10개 묶음 12개에서 10개를 꺼내 100개 묶음 1개로 바꿉니다. 따라서 100개 묶음은 4개가 되고 10개 묶음은 2개가 남습니다.","id":"d9b6e341-7437-47e9-97fc-7bb9dbcd931e","options":[{"displayOrder":1,"id":"3a8c0167-d41b-4be2-b227-6758565f356c","isCorrect":false,"text":"100개 묶음 3개와 10개 묶음 2개"},{"displayOrder":2,"id":"cda1fc49-8fdd-4f11-abb2-3625a4f54cbd","isCorrect":false,"text":"100개 묶음 3개와 10개 묶음 12개"},{"displayOrder":3,"id":"bebb3ecc-ddf7-400d-9398-3351e17638c4","isCorrect":true,"text":"100개 묶음 4개와 10개 묶음 2개"},{"displayOrder":4,"id":"a3b98a0a-dc6c-47fe-959f-32d5fad60657","isCorrect":false,"text":"100개 묶음 4개와 10개 묶음 12개"}],"prompt":"100개 묶음 3개와 10개 묶음 12개가 있습니다. 10개 묶음 10개를 100개 묶음 1개로 바꾼 결과는?","weight":1},{"displayOrder":8,"explanation":"90과 10을 합하면 10개 묶음이 10개입니다. 이를 100개 묶음 1개로 바꾸면 400과 합해 100개 묶음 5개가 됩니다.","id":"1311529f-6cfd-4e86-8f69-2003816ed4bc","options":[{"displayOrder":1,"id":"6e81fb46-6e55-4765-a6b7-5b2379acc984","isCorrect":true,"text":"100개 묶음 5개"},{"displayOrder":2,"id":"be3fab36-1ab9-45a6-a06e-188174884468","isCorrect":false,"text":"100개 묶음 4개와 10개 묶음 9개"},{"displayOrder":3,"id":"2043397a-55a0-4551-84d8-c90d703329aa","isCorrect":false,"text":"100개 묶음 4개와 낱개 10개"},{"displayOrder":4,"id":"99b0a0dc-d83a-46e2-bf8b-1489ce4c6f37","isCorrect":false,"text":"100개 묶음 5개와 10개 묶음 1개"}],"prompt":"400+90+10에서 10개 묶음을 바르게 교환해 같은 수로 나타낸 것은?","weight":1},{"displayOrder":9,"explanation":"십의 자리 0은 십 묶음이 없다는 뜻이지 다른 숫자의 자리를 옮기지 않습니다. 7은 일의 자리에 그대로 있으므로 507입니다.","id":"81025ee1-0713-452e-b075-43427981ca8b","options":[{"displayOrder":1,"id":"e99280be-9024-431a-899a-cec925619cbf","isCorrect":false,"text":"5는 백의 자리이고 7은 십의 자리이므로 570입니다."},{"displayOrder":2,"id":"182e6c76-4ebf-4f49-99ab-1d327e463a9b","isCorrect":false,"text":"0인 자리는 지워도 되므로 57이 맞습니다."},{"displayOrder":3,"id":"71823cd7-8600-43b8-9563-276f8e716782","isCorrect":false,"text":"0은 일의 자리가 없다는 뜻이므로 500입니다."},{"displayOrder":4,"id":"0e412d7f-1f5c-4bfa-9395-5a9f8ec9656a","isCorrect":true,"text":"0은 십이 없다는 뜻이지만 7은 일의 자리에 남으므로 507입니다."}],"prompt":"민수는 507에서 십의 자리 0을 빼고 57이라고 읽었습니다. 잘못된 생각을 바르게 고친 것은?","weight":1},{"displayOrder":10,"explanation":"세 자리 수는 백의 자리부터 비교합니다. 백의 자리 6은 같고 십의 자리에서 8이 1보다 크므로 682가 더 큽니다.","id":"7fa874b1-15d0-401f-bcb3-45b1902d1f63","options":[{"displayOrder":1,"id":"552ead57-d823-4be1-afb2-91774f82533f","isCorrect":false,"text":"일의 자리 9가 2보다 크므로 619가 더 큽니다."},{"displayOrder":2,"id":"3cec4b35-6b83-4d5e-bc0e-3c2102709902","isCorrect":true,"text":"백의 자리는 같고 십의 자리 8이 1보다 크므로 682가 더 큽니다."},{"displayOrder":3,"id":"487d6df1-03fb-4e9a-bdde-9933f99b7aa6","isCorrect":false,"text":"백의 자리 6이 같으므로 두 수의 크기는 같습니다."},{"displayOrder":4,"id":"4fd24492-9f0d-4480-a130-a2b842dd9f02","isCorrect":false,"text":"십의 자리보다 일의 자리를 먼저 비교해야 합니다."}],"prompt":"지수는 682와 619를 일의 자리부터 비교해 619가 더 크다고 했습니다. 잘못된 비교를 바르게 고친 것은?","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":1,"id":"fe8d3391-2563-4d3a-8b9b-89e19dbf0d79","slug":"grade2-three-digit-numbers","title":"세 자리 수를 알아봐요"},"version":{"id":"376377cb-4093-4f29-bc92-5ca42b27a726","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_three_digit_numbers_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_three_digit_numbers_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 2

  union all
  select 3, 'grade2_three_digit_numbers_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '7d079fa600b1c7e3b25a7eb08ff117fc5c174602fc3c04082637ca845f671a3b'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_three_digit_numbers_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_three_digit_numbers_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_three_digit_numbers_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_three_digit_numbers_v1_structure_and_orders',
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
    where stage.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_three_digit_numbers_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_three_digit_numbers_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid))

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
  where metadata.unit_id = 'fe8d3391-2563-4d3a-8b9b-89e19dbf0d79'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 1

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = 'fe8d3391-2563-4d3a-8b9b-89e19dbf0d79'::uuid
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
  where metadata.unit_id = 'fe8d3391-2563-4d3a-8b9b-89e19dbf0d79'::uuid

  union all
  select 23, 'grade2_three_digit_numbers_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_three_digit_numbers_v1_pass_threshold_contract',
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
  select 25, 'grade2_three_digit_numbers_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_three_digit_numbers_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '376377cb-4093-4f29-bc92-5ca42b27a726'::uuid

  union all
  select 27, 'grade2_three_digit_numbers_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_three_digit_numbers_v1_course_unit_sort_orders_unique',
    count(*) = 0,
    jsonb_build_object('duplicate_orders', count(*))
  from (
    select unit.course_id, unit.sort_order
    from public.learning_units unit
    where unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    group by unit.course_id, unit.sort_order
    having count(*) > 1
  ) duplicate_order
)
select check_order, check_name, passed, result_data
from checks
union all
select 999, 'grade2_three_digit_numbers_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
