-- Phase 2B grade2-tables-graphs v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":11,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"759bb6b4-b331-4ee9-b0ba-93503eaa0c32","questions":[{"displayOrder":1,"explanation":"사과가 4개로 세 항목 중 가장 많습니다.","id":"35a77e27-be3d-47f4-80ea-45788de71de1","options":[{"displayOrder":1,"id":"dbe03771-64c2-4371-bc3c-6d128546279e","isCorrect":true,"text":"사과"},{"displayOrder":2,"id":"1d018053-75fb-495f-9f47-9697d382a793","isCorrect":false,"text":"배"},{"displayOrder":3,"id":"23b6ac08-96ed-4909-976c-38a19cbeb1b2","isCorrect":false,"text":"포도"},{"displayOrder":4,"id":"deb3d972-fc5b-435a-843a-69e771af84af","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 4개, 배 2개, 포도 3개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":2,"explanation":"사과가 5개로 세 항목 중 가장 많습니다.","id":"84e42979-4280-477b-81ba-5a4abc706afb","options":[{"displayOrder":1,"id":"26e8c71e-1f5d-41e1-98e2-69db1a4c72d7","isCorrect":false,"text":"배"},{"displayOrder":2,"id":"f1628756-8769-4534-95f6-6103a6b92ced","isCorrect":true,"text":"사과"},{"displayOrder":3,"id":"c84547b4-13af-4c59-b1e2-705b8e35f921","isCorrect":false,"text":"포도"},{"displayOrder":4,"id":"fd44cc09-ad3a-4862-a8f3-358b09442100","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 5개, 배 3개, 포도 1개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":3,"explanation":"배가 6개로 세 항목 중 가장 많습니다.","id":"f340beba-3490-4b0a-8ff3-07b6ab0f5cff","options":[{"displayOrder":1,"id":"cebf09b7-e9ef-4acc-a88e-621172f217a2","isCorrect":false,"text":"사과"},{"displayOrder":2,"id":"4c392015-0a3a-4ca2-ae9d-9a381d4f2f26","isCorrect":false,"text":"포도"},{"displayOrder":3,"id":"00601f31-fce2-488c-b53b-bb06af1a5129","isCorrect":true,"text":"배"},{"displayOrder":4,"id":"b7dee7e9-6ec4-4479-833a-c35d69c0a720","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 2개, 배 6개, 포도 4개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":4,"explanation":"사과가 7개로 세 항목 중 가장 많습니다.","id":"ae6c8e7d-acca-4089-bc4a-020462c58222","options":[{"displayOrder":1,"id":"e609f1a4-6515-4a03-bf6c-ed7db7de9fa2","isCorrect":false,"text":"배"},{"displayOrder":2,"id":"8e162cbb-be27-4fa3-aed5-9de2ee1ef5e4","isCorrect":false,"text":"포도"},{"displayOrder":3,"id":"78418c56-7ddc-4a5e-984a-ac75e59c52a5","isCorrect":false,"text":"모두 같음"},{"displayOrder":4,"id":"9df6abd4-376d-4a2b-ae85-259113bab70f","isCorrect":true,"text":"사과"}],"prompt":"표: 사과 7개, 배 3개, 포도 5개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":5,"explanation":"포도가 6개로 세 항목 중 가장 많습니다.","id":"9dd39f79-6d2b-4c3b-8d56-b7e092be567f","options":[{"displayOrder":1,"id":"158fc5f9-bc36-4e7b-8cbd-f15faa8c076c","isCorrect":true,"text":"포도"},{"displayOrder":2,"id":"bde7160c-cd2c-48ef-b730-5c53208e24e6","isCorrect":false,"text":"사과"},{"displayOrder":3,"id":"c53cac8e-6ec0-4d42-940e-5450a1c96800","isCorrect":false,"text":"배"},{"displayOrder":4,"id":"4abb51e6-8dd8-4114-8c8d-0d211b48e0cc","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 3개, 배 4개, 포도 6개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":6,"explanation":"사과가 6개로 세 항목 중 가장 많습니다.","id":"fbcab2eb-94fe-4155-8c3c-b45b07cb6c77","options":[{"displayOrder":1,"id":"42ecd94f-e127-49ea-a588-8614da54d3fa","isCorrect":false,"text":"배"},{"displayOrder":2,"id":"e1876216-f429-4c16-b5c1-99b1c635ae56","isCorrect":true,"text":"사과"},{"displayOrder":3,"id":"45bb46c9-a17e-4ce9-8c09-89c24c2e7170","isCorrect":false,"text":"포도"},{"displayOrder":4,"id":"59656c9f-bb6c-449a-b6f8-7c03d5a23893","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 6개, 배 2개, 포도 5개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":7,"explanation":"배가 7개로 세 항목 중 가장 많습니다.","id":"0d0b9faf-7a78-4af2-9f94-0e920ef54818","options":[{"displayOrder":1,"id":"0f60a3c5-4a73-4275-b4ab-9f40a8256b13","isCorrect":true,"text":"배"},{"displayOrder":2,"id":"fae9962c-ce4e-4f82-a72a-9ee6393cb56b","isCorrect":false,"text":"사과"},{"displayOrder":3,"id":"34747081-c419-4dbe-86b4-3b3ac5a9c436","isCorrect":false,"text":"포도"},{"displayOrder":4,"id":"bf2bf7d7-2cc0-4172-af1a-52e44d1a4ad3","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 4개, 배 7개, 포도 3개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":8,"explanation":"사과가 5개로 세 항목 중 가장 많습니다.","id":"926c7c17-4ba1-42e0-bae3-4c357ddaf561","options":[{"displayOrder":1,"id":"18be3512-264e-445a-a9e5-0005cea90e69","isCorrect":false,"text":"배"},{"displayOrder":2,"id":"d6a21d73-d2d2-4f98-8cee-07a5df5065ef","isCorrect":true,"text":"사과"},{"displayOrder":3,"id":"3eb5c351-2927-4b4c-895c-8f244bdd573a","isCorrect":false,"text":"포도"},{"displayOrder":4,"id":"65a086fb-e8d8-4b30-9056-2f18c67c013c","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 5개, 배 1개, 포도 4개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":9,"explanation":"배가 6개로 세 항목 중 가장 많습니다.","id":"1173fb20-ed89-48fa-993e-a47550faf348","options":[{"displayOrder":1,"id":"e065563c-e101-4e4c-952b-fff36e447ffb","isCorrect":false,"text":"사과"},{"displayOrder":2,"id":"d3504920-8c12-488b-9859-7a440cbc69f4","isCorrect":false,"text":"포도"},{"displayOrder":3,"id":"48b7750c-27a7-4f4e-aef8-c325c4e91f14","isCorrect":true,"text":"배"},{"displayOrder":4,"id":"a402f956-6ddb-468d-9728-7af994739cde","isCorrect":false,"text":"모두 같음"}],"prompt":"표: 사과 3개, 배 6개, 포도 2개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":10,"explanation":"사과가 8개로 세 항목 중 가장 많습니다.","id":"fabf9de0-b924-4b9b-853e-140a9d014175","options":[{"displayOrder":1,"id":"0ea0b9c7-8d5d-4d89-91d3-f4e104cd4ac8","isCorrect":false,"text":"배"},{"displayOrder":2,"id":"0bc482e1-13db-4875-b0f6-5494a6674cae","isCorrect":false,"text":"포도"},{"displayOrder":3,"id":"a50d2100-0917-42c4-a6fd-1139b9214ae1","isCorrect":false,"text":"모두 같음"},{"displayOrder":4,"id":"a5503bd4-d492-40c8-bedb-bfd4ff0731b8","isCorrect":true,"text":"사과"}],"prompt":"표: 사과 8개, 배 4개, 포도 5개. 가장 많은 것은?","skillCode":"find-most-least-category","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"6f1ff2c3-ac67-4b71-b001-7f92c5159fb0","questions":[{"displayOrder":1,"explanation":"4+2+3=9이므로 모두 9명입니다.","id":"0e4a2adb-4935-48a1-b06f-006254a5658a","options":[{"displayOrder":1,"id":"fc64c900-ca95-4bd5-b101-356ce6ad63a7","isCorrect":true,"text":"9명"},{"displayOrder":2,"id":"9ae312a6-88f0-4491-8bd4-e9e4ca09ccdc","isCorrect":false,"text":"10명"},{"displayOrder":3,"id":"5434b9df-6c8c-4b1c-b9be-393272c8903b","isCorrect":false,"text":"8명"},{"displayOrder":4,"id":"eefc2e1a-2ac3-4367-9d71-9e6dbdf88493","isCorrect":false,"text":"19명"}],"prompt":"표: 빨강 4명, 파랑 2명, 초록 3명. 조사한 사람은 모두 몇 명입니까?","skillCode":"read-data-table","weight":1},{"displayOrder":2,"explanation":"5+3+1=9이므로 모두 9명입니다.","id":"60bac9ce-ee2d-4b90-af39-7fbc50168f67","options":[{"displayOrder":1,"id":"e7efecb6-7e9c-4f84-a7b0-5129b5cca36d","isCorrect":false,"text":"10명"},{"displayOrder":2,"id":"555de5b0-381d-4e31-a8dd-c8d4b6f4c6bb","isCorrect":true,"text":"9명"},{"displayOrder":3,"id":"52fb76bc-d97e-4f9d-9a90-61f4ae55ea7e","isCorrect":false,"text":"8명"},{"displayOrder":4,"id":"220d4fcb-6fa1-4cb2-aec1-09c3bdc78dda","isCorrect":false,"text":"19명"}],"prompt":"표: 빨강 5명, 파랑 3명, 초록 1명. 조사한 사람은 모두 몇 명입니까?","skillCode":"read-data-table","weight":1},{"displayOrder":3,"explanation":"2+6+4=12이므로 모두 12명입니다.","id":"2fe691a0-008e-42ca-a7fb-dca2a18b04ef","options":[{"displayOrder":1,"id":"04d9c613-fd20-43a1-bee6-663b76e63395","isCorrect":false,"text":"13명"},{"displayOrder":2,"id":"725c74ad-4780-4b4b-80a2-ec8e815bbeeb","isCorrect":false,"text":"11명"},{"displayOrder":3,"id":"126ff457-a951-4cb9-abd9-3b8680619f49","isCorrect":true,"text":"12명"},{"displayOrder":4,"id":"296d0291-7c69-47c7-94d9-2b30bc3064f5","isCorrect":false,"text":"22명"}],"prompt":"표: 빨강 2명, 파랑 6명, 초록 4명. 조사한 사람은 모두 몇 명입니까?","skillCode":"read-data-table","weight":1},{"displayOrder":4,"explanation":"7+3+5=15이므로 모두 15명입니다.","id":"11d371da-5af0-472e-8773-8ef5f85bd918","options":[{"displayOrder":1,"id":"4025734a-9909-45c4-98f2-7466ee26277b","isCorrect":false,"text":"16명"},{"displayOrder":2,"id":"b59c3436-0b6c-4191-b5d5-f5be7dfd792a","isCorrect":false,"text":"14명"},{"displayOrder":3,"id":"31d7a693-2c77-438a-85e1-10994af385e5","isCorrect":false,"text":"25명"},{"displayOrder":4,"id":"f7aebcaa-dc7a-4e83-bd45-ca90cff45393","isCorrect":true,"text":"15명"}],"prompt":"표: 빨강 7명, 파랑 3명, 초록 5명. 조사한 사람은 모두 몇 명입니까?","skillCode":"read-data-table","weight":1},{"displayOrder":5,"explanation":"3+4+6=13이므로 모두 13명입니다.","id":"058cd8ea-4577-4ffc-bda3-60d96eadf603","options":[{"displayOrder":1,"id":"7b92ad82-4675-4ef0-9030-e4ff3650e28f","isCorrect":false,"text":"14명"},{"displayOrder":2,"id":"8cbea30a-72af-4330-a977-4ded8221bdf9","isCorrect":false,"text":"12명"},{"displayOrder":3,"id":"6639320d-aff0-41cb-a1b5-67f47b20c36f","isCorrect":true,"text":"13명"},{"displayOrder":4,"id":"030f41c1-5e44-4fe3-a39c-bfd8f8f886cd","isCorrect":false,"text":"23명"}],"prompt":"표: 빨강 3명, 파랑 4명, 초록 6명. 조사한 사람은 모두 몇 명입니까?","skillCode":"read-data-table","weight":1},{"displayOrder":6,"explanation":"6-2=4이므로 차는 4개입니다.","id":"dd59ed44-e971-4d1c-bf55-fd8f26d97a63","options":[{"displayOrder":1,"id":"baa8441c-69df-4d77-90f4-7eb2238a3c65","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"963bad2a-253e-4540-994d-78f49d25598d","isCorrect":false,"text":"3개"},{"displayOrder":3,"id":"2ef7046b-7b04-4377-bada-7b90ca31318a","isCorrect":false,"text":"14개"},{"displayOrder":4,"id":"17d6a67a-43bc-4a38-ac47-0d328ff89dab","isCorrect":true,"text":"4개"}],"prompt":"표의 세 항목 수는 6개, 2개, 5개입니다. 가장 많은 것과 가장 적은 것의 차는?","skillCode":"calculate-data-difference","weight":1},{"displayOrder":7,"explanation":"7-3=4이므로 차는 4개입니다.","id":"acac74bd-5289-49ce-a94e-cfc777cbcd69","options":[{"displayOrder":1,"id":"da7ec343-eb33-40ce-9ac7-ebe2558e74ec","isCorrect":true,"text":"4개"},{"displayOrder":2,"id":"eff611e9-cc28-40db-b1f8-1933ba7057b9","isCorrect":false,"text":"5개"},{"displayOrder":3,"id":"c71b1e92-2b71-4cf2-a11e-372fc3d8c823","isCorrect":false,"text":"3개"},{"displayOrder":4,"id":"e1ddc8f7-b05d-4a27-87cf-9b211f3c37bc","isCorrect":false,"text":"14개"}],"prompt":"표의 세 항목 수는 4개, 7개, 3개입니다. 가장 많은 것과 가장 적은 것의 차는?","skillCode":"calculate-data-difference","weight":1},{"displayOrder":8,"explanation":"5-1=4이므로 차는 4개입니다.","id":"ccbd5ba7-bbd1-474d-bd66-fd68c794fabe","options":[{"displayOrder":1,"id":"c79b3246-90d1-404b-8705-5ebf11138fbf","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"66aa5733-12dd-445a-819f-4bcf1c511dda","isCorrect":true,"text":"4개"},{"displayOrder":3,"id":"9d5cf1ed-a250-4425-9c51-44d0b604c38d","isCorrect":false,"text":"3개"},{"displayOrder":4,"id":"b1fd1b7c-0333-4a06-b313-2328263bf2ae","isCorrect":false,"text":"14개"}],"prompt":"표의 세 항목 수는 5개, 1개, 4개입니다. 가장 많은 것과 가장 적은 것의 차는?","skillCode":"calculate-data-difference","weight":1},{"displayOrder":9,"explanation":"6-2=4이므로 차는 4개입니다.","id":"f9f03be8-ba76-4dde-afbf-c01daa22f389","options":[{"displayOrder":1,"id":"0de26fad-6655-4e3a-8757-b45413e99285","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"e8574766-729c-479a-801e-d060b4864abc","isCorrect":false,"text":"3개"},{"displayOrder":3,"id":"e9c4e013-0bf0-4647-8df6-50c064cc71b5","isCorrect":true,"text":"4개"},{"displayOrder":4,"id":"bd909dd1-3f20-4c41-bfd6-2a1ab47447aa","isCorrect":false,"text":"14개"}],"prompt":"표의 세 항목 수는 3개, 6개, 2개입니다. 가장 많은 것과 가장 적은 것의 차는?","skillCode":"calculate-data-difference","weight":1},{"displayOrder":10,"explanation":"8-4=4이므로 차는 4개입니다.","id":"f25e7093-61d4-4449-b13c-86d8bb9a2c35","options":[{"displayOrder":1,"id":"7e98b88b-18dc-4300-90b8-370a82278004","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"6e1cfbfe-a234-47eb-a936-43619740b664","isCorrect":false,"text":"3개"},{"displayOrder":3,"id":"9da60232-18d9-429f-9ca2-de80b11316dd","isCorrect":false,"text":"14개"},{"displayOrder":4,"id":"0f8b942b-259d-47f4-b75a-e71adf47d834","isCorrect":true,"text":"4개"}],"prompt":"표의 세 항목 수는 8개, 4개, 5개입니다. 가장 많은 것과 가장 적은 것의 차는?","skillCode":"calculate-data-difference","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"3010579f-2808-4e34-b925-0985fd71f861","questions":[{"displayOrder":1,"explanation":"12-3-4=5이므로 C는 5개입니다.","id":"d3ef17d0-016f-4dce-89db-0b4b8499858d","options":[{"displayOrder":1,"id":"f5f99254-9a4f-4210-b10f-7c4a80ad9c86","isCorrect":true,"text":"5개"},{"displayOrder":2,"id":"569a3d8f-969d-4376-ba9c-0545c0532750","isCorrect":false,"text":"6개"},{"displayOrder":3,"id":"ed920f77-45b2-4f5d-b480-6fe3fd83ba2e","isCorrect":false,"text":"4개"},{"displayOrder":4,"id":"4285786c-32bc-40d9-88c2-56f271faa14a","isCorrect":false,"text":"15개"}],"prompt":"표에서 A는 3개, B는 4개이고 전체는 12개입니다. C는 몇 개입니까?","skillCode":"infer-missing-data","weight":1},{"displayOrder":2,"explanation":"11-5-2=4이므로 C는 4개입니다.","id":"b2705a55-4316-4500-b111-acf2adbcdd75","options":[{"displayOrder":1,"id":"4a97fd0c-ead1-40ff-b72b-f72db8db94f6","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"89ac0110-629b-43a5-9091-7d3d6eb7be72","isCorrect":true,"text":"4개"},{"displayOrder":3,"id":"e7897d3f-beda-49c9-a333-0fdae2599a75","isCorrect":false,"text":"3개"},{"displayOrder":4,"id":"1fd7f1f7-dcb8-40e4-876e-ad115843efd6","isCorrect":false,"text":"14개"}],"prompt":"표에서 A는 5개, B는 2개이고 전체는 11개입니다. C는 몇 개입니까?","skillCode":"infer-missing-data","weight":1},{"displayOrder":3,"explanation":"15-4-6=5이므로 C는 5개입니다.","id":"3879ee58-b9e7-47ee-937c-3210255f8440","options":[{"displayOrder":1,"id":"afece356-4b03-44c3-85bd-ab2f19867892","isCorrect":false,"text":"6개"},{"displayOrder":2,"id":"f37c5e48-08c1-4bef-bd6c-6531e62ebdfb","isCorrect":false,"text":"4개"},{"displayOrder":3,"id":"a37451a1-97ab-4ac1-ba4e-f881c73c5749","isCorrect":true,"text":"5개"},{"displayOrder":4,"id":"9440c05e-4cbe-4342-b37a-edd4a793b4bf","isCorrect":false,"text":"15개"}],"prompt":"표에서 A는 4개, B는 6개이고 전체는 15개입니다. C는 몇 개입니까?","skillCode":"infer-missing-data","weight":1},{"displayOrder":4,"explanation":"14-7-3=4이므로 C는 4개입니다.","id":"6465ac00-72da-413e-9d86-b2a58854f21d","options":[{"displayOrder":1,"id":"3a8c2c17-a4e3-4202-a677-81496f7e0208","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"8089480e-46fd-4c79-82ba-a38331c0cd9f","isCorrect":false,"text":"3개"},{"displayOrder":3,"id":"dac47af5-d7a6-4d37-8ded-8bd9038bd559","isCorrect":false,"text":"14개"},{"displayOrder":4,"id":"c8522329-84a5-43e0-8255-d139a541d302","isCorrect":true,"text":"4개"}],"prompt":"표에서 A는 7개, B는 3개이고 전체는 14개입니다. C는 몇 개입니까?","skillCode":"infer-missing-data","weight":1},{"displayOrder":5,"explanation":"■ 한 개가 1개를 뜻하므로 사과 4, 배 2, 포도 5입니다.","id":"c2913ea9-78ef-4bea-9de2-a95a1e62959b","options":[{"displayOrder":1,"id":"5a91857e-95a0-4022-9ac2-4f4722989f53","isCorrect":true,"text":"사과 4, 배 2, 포도 5"},{"displayOrder":2,"id":"656b467d-6cee-41f7-b9d9-2c5849bb5ffc","isCorrect":false,"text":"사과 2, 배 4, 포도 5"},{"displayOrder":3,"id":"6e1cd4c4-1d4b-4a30-9f8e-e8d7881f64cc","isCorrect":false,"text":"사과 5, 배 2, 포도 5"},{"displayOrder":4,"id":"6fb4a9b3-8c6c-476c-8e37-439fea8d5047","isCorrect":false,"text":"사과 4, 배 3, 포도 5"}],"prompt":"텍스트 그래프: 사과 ■■■■, 배 ■■, 포도 ■■■■■. 표로 옮긴 것은?","skillCode":"connect-table-and-graph","weight":1},{"displayOrder":6,"explanation":"■ 한 개가 1개를 뜻하므로 사과 3, 배 6, 포도 1입니다.","id":"b5abd324-fbd8-4408-89af-b489fc56415c","options":[{"displayOrder":1,"id":"a642c71b-fd08-46cc-8fba-7667877055f5","isCorrect":false,"text":"사과 6, 배 3, 포도 1"},{"displayOrder":2,"id":"2eeee3d1-3a08-4fc5-bc76-0d3163deafda","isCorrect":true,"text":"사과 3, 배 6, 포도 1"},{"displayOrder":3,"id":"89952d94-72ed-42aa-8e3e-48ad3fb75c5f","isCorrect":false,"text":"사과 4, 배 6, 포도 1"},{"displayOrder":4,"id":"90a58e16-548c-4f7b-ad7e-9bc8d9da932d","isCorrect":false,"text":"사과 3, 배 7, 포도 1"}],"prompt":"텍스트 그래프: 사과 ■■■, 배 ■■■■■■, 포도 ■. 표로 옮긴 것은?","skillCode":"connect-table-and-graph","weight":1},{"displayOrder":7,"explanation":"■ 한 개가 1개를 뜻하므로 사과 7, 배 4, 포도 2입니다.","id":"aa0692d3-090b-4b64-a790-5e3cfe76004b","options":[{"displayOrder":1,"id":"5c8c3fa8-1080-4fd3-8db9-e7b8463154ed","isCorrect":true,"text":"사과 7, 배 4, 포도 2"},{"displayOrder":2,"id":"7ba52bba-5855-42e7-b242-9156e2be8faf","isCorrect":false,"text":"사과 4, 배 7, 포도 2"},{"displayOrder":3,"id":"042f0804-fa32-4be5-a829-ba05895f65dc","isCorrect":false,"text":"사과 8, 배 4, 포도 2"},{"displayOrder":4,"id":"32e69eac-34f4-4095-85e4-063304d249a0","isCorrect":false,"text":"사과 7, 배 5, 포도 2"}],"prompt":"텍스트 그래프: 사과 ■■■■■■■, 배 ■■■■, 포도 ■■. 표로 옮긴 것은?","skillCode":"connect-table-and-graph","weight":1},{"displayOrder":8,"explanation":"2+5+4=11이므로 전체는 11개입니다.","id":"7eb4abc7-5ea7-4aae-88a7-fbd4efcb4cb9","options":[{"displayOrder":1,"id":"05b61414-f506-45f1-9b3e-317da6da6e64","isCorrect":false,"text":"12개"},{"displayOrder":2,"id":"1083a435-2bff-45e5-8512-fe67c8403e6f","isCorrect":true,"text":"11개"},{"displayOrder":3,"id":"2fa8e0e8-198a-4a2e-a7b2-f1cd861ed997","isCorrect":false,"text":"10개"},{"displayOrder":4,"id":"cbb3e490-d066-4e3d-89d2-3caa295cdb4e","isCorrect":false,"text":"21개"}],"prompt":"그래프: A ■■, B ■■■■■, C ■■■■. 전체 표시 수는?","skillCode":"read-text-graph","weight":1},{"displayOrder":9,"explanation":"6+3+5=14이므로 전체는 14개입니다.","id":"117fa599-6fb3-4fe6-b0c0-cdbb0533ab34","options":[{"displayOrder":1,"id":"22fc917d-bd9b-4be1-a5f1-89ae763d9a68","isCorrect":false,"text":"15개"},{"displayOrder":2,"id":"16d69729-1560-4eb3-8e72-76753140dd4f","isCorrect":false,"text":"13개"},{"displayOrder":3,"id":"76af4e15-16a0-4a16-997d-290ae7d65d14","isCorrect":true,"text":"14개"},{"displayOrder":4,"id":"40551a74-e203-410c-a374-af67730aac46","isCorrect":false,"text":"24개"}],"prompt":"그래프: A ■■■■■■, B ■■■, C ■■■■■. 전체 표시 수는?","skillCode":"read-text-graph","weight":1},{"displayOrder":10,"explanation":"4+7+2=13이므로 전체는 13개입니다.","id":"0695efd3-f02c-4e81-8150-ee2b5ce0991c","options":[{"displayOrder":1,"id":"3c68e420-9476-4657-bf0f-e59dd7759746","isCorrect":false,"text":"14개"},{"displayOrder":2,"id":"cf749361-9261-4c6b-a885-b9c3f08421e0","isCorrect":false,"text":"12개"},{"displayOrder":3,"id":"ab486413-4c41-4f14-857c-3b47d404d07c","isCorrect":false,"text":"23개"},{"displayOrder":4,"id":"3983f17b-d4fb-48e7-b4c8-1fa7f546ae28","isCorrect":true,"text":"13개"}],"prompt":"그래프: A ■■■■, B ■■■■■■■, C ■■. 전체 표시 수는?","skillCode":"read-text-graph","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"19bb103e-bcc6-4ad1-9d30-5edd2e9fa4a8","questions":[{"displayOrder":1,"explanation":"6이 4와 3보다 크므로 축구가 가장 많습니다.","id":"6b3d8129-4e74-427d-8679-fec97a59edf9","options":[{"displayOrder":1,"id":"b67ee73e-9eb0-4308-b92a-317f0c45e92c","isCorrect":true,"text":"축구가 6명으로 가장 많습니다."},{"displayOrder":2,"id":"80c02d16-7c45-4dc6-9065-e45c99758991","isCorrect":false,"text":"야구가 4명으로 가장 많습니다."},{"displayOrder":3,"id":"556e8e51-fd9d-43c6-b049-347a593e684b","isCorrect":false,"text":"농구가 6명으로 가장 많습니다."},{"displayOrder":4,"id":"61ef1070-2f8b-42e3-a4bb-b74b5528d0d9","isCorrect":false,"text":"세 운동은 모두 같습니다."}],"prompt":"표: 축구 6명, 야구 4명, 농구 3명. “야구가 가장 많다”는 해석을 바르게 고친 것은?","skillCode":"correct-data-interpretation","weight":1},{"displayOrder":2,"explanation":"전체에서 A와 B를 빼면 15-5-6=4개입니다.","id":"f3bd0d9e-e883-4e90-afff-f896f5ff7eed","options":[{"displayOrder":1,"id":"14acf598-f540-4b72-9e83-a4cb73451db9","isCorrect":false,"text":"C는 15+5+6=26개입니다."},{"displayOrder":2,"id":"fb79552e-7a5c-4050-9254-3a8c85a68573","isCorrect":true,"text":"C는 15-5-6=4개입니다."},{"displayOrder":3,"id":"06ea3c29-177b-43a3-9cd9-8c122e02f540","isCorrect":false,"text":"C는 6-5=1개입니다."},{"displayOrder":4,"id":"47bbab13-e3ac-4a62-899d-88dc00e48063","isCorrect":false,"text":"C는 5개가 맞습니다."}],"prompt":"표의 합계가 15이고 A 5개, B 6개입니다. C를 5개라고 쓴 오류를 고친 것은?","skillCode":"correct-data-interpretation","weight":1},{"displayOrder":3,"explanation":"지우 5명에서 민수 3명을 빼면 2명이므로 지우가 2명 많습니다.","id":"09ac151d-4d3d-4e10-abf3-dacd09ccc458","options":[{"displayOrder":1,"id":"0b491846-60e1-4ac8-93e9-9969f55140bb","isCorrect":false,"text":"민수가 2명 많습니다."},{"displayOrder":2,"id":"44998dc0-8121-4006-856d-71757e185814","isCorrect":false,"text":"두 사람은 같습니다."},{"displayOrder":3,"id":"8a676679-0c1e-4b4d-8e82-9f5c6c3f68cf","isCorrect":true,"text":"지우가 민수보다 2명 많습니다."},{"displayOrder":4,"id":"53df8d63-35ad-444d-98b3-bd781d511ffa","isCorrect":false,"text":"지우가 8명 많습니다."}],"prompt":"그래프에서 ■ 한 개가 1명을 뜻합니다. 민수 ■■■, 지우 ■■■■■일 때 바른 해석은?","skillCode":"read-text-graph","weight":1},{"displayOrder":4,"explanation":"자료를 하나씩 세면 사과 3개, 배 1개, 포도 1개입니다.","id":"9afe6d94-3d63-444f-86af-b67242ee5f2c","options":[{"displayOrder":1,"id":"06f6d413-f377-45d2-b1f1-9e95d8b71919","isCorrect":false,"text":"사과 2, 배 2, 포도 1"},{"displayOrder":2,"id":"0b4de322-97e5-431b-b1ef-ab6377f79739","isCorrect":false,"text":"사과 3, 배 2, 포도 0"},{"displayOrder":3,"id":"a443dbf8-67f1-40c0-8b8d-0a0690ddf9bd","isCorrect":false,"text":"사과 1, 배 1, 포도 3"},{"displayOrder":4,"id":"848df86b-424a-42a6-9afd-3af096f416b1","isCorrect":true,"text":"사과 3, 배 1, 포도 1"}],"prompt":"자료 사과·사과·배·포도·사과를 표로 나타낸 것은?","skillCode":"classify-by-given-rule","weight":1},{"displayOrder":5,"explanation":"표의 수만큼 ■를 대응시키면 A 4개, B 7개, C 5개입니다.","id":"353f9e44-bce1-4cb5-87bf-e07e0ff19720","options":[{"displayOrder":1,"id":"78653d1f-7825-4a5c-89a9-8ba515e1e941","isCorrect":false,"text":"A ■■■■■■■, B ■■■■, C ■■■■■"},{"displayOrder":2,"id":"7629a045-e5e0-42e8-8499-6716162a5d51","isCorrect":false,"text":"A ■■■■, B ■■■■■■, C ■■■■■"},{"displayOrder":3,"id":"c96be57b-42ce-452f-8527-c12d0c96268b","isCorrect":true,"text":"A ■■■■, B ■■■■■■■, C ■■■■■"},{"displayOrder":4,"id":"6ff5701f-4a35-43d9-8f4c-6fbdb142f2fd","isCorrect":false,"text":"A ■■■■, B ■■■■■■■, C ■■■"}],"prompt":"표 A 4개, B 7개, C 5개와 같은 그래프는?","skillCode":"connect-table-and-graph","weight":1},{"displayOrder":6,"explanation":"차이는 더하지 않고 큰 수에서 작은 수를 빼므로 5개입니다.","id":"d7bfdda2-754a-4a30-bd02-c0f1ab0c7e5f","options":[{"displayOrder":1,"id":"4cfbd68d-787e-4b19-aa98-7df26d1324d8","isCorrect":false,"text":"차는 8+3=11개입니다."},{"displayOrder":2,"id":"d6b94a80-0eb3-4ff7-99cb-5b4d8589f3e8","isCorrect":false,"text":"차는 3-8=5명입니다."},{"displayOrder":3,"id":"4b1f2b57-d6dc-4eb4-852f-8396cdb0ca27","isCorrect":false,"text":"차는 8-3=6개입니다."},{"displayOrder":4,"id":"c7a749c8-ed23-4911-a7c8-0be469e07f55","isCorrect":true,"text":"차는 8-3=5개입니다."}],"prompt":"가장 많은 항목 8개와 가장 적은 항목 3개의 차를 11개라고 했습니다. 바른 설명은?","skillCode":"correct-data-interpretation","weight":1},{"displayOrder":7,"explanation":"전체 13개에서 A 2개와 C 6개를 빼면 B는 5개입니다.","id":"07632fca-8008-416c-8153-6c67e7fae95e","options":[{"displayOrder":1,"id":"fea2cf6b-c29d-497f-99e9-b693dafaf31d","isCorrect":true,"text":"5개이며 13-2-6=5입니다."},{"displayOrder":2,"id":"f45ebf64-c14f-4860-a706-4815440b8921","isCorrect":false,"text":"9개이며 13-2=11입니다."},{"displayOrder":3,"id":"de045df3-850c-416d-a3f0-0fadde4f93fe","isCorrect":false,"text":"3개이며 6-2=4입니다."},{"displayOrder":4,"id":"a700aebe-0672-4a38-9fbd-f84a651d2ef7","isCorrect":false,"text":"21개이며 모두 더합니다."}],"prompt":"표 A 2개, B □개, C 6개이고 전체 13개입니다. □와 설명이 맞는 것은?","skillCode":"infer-missing-data","weight":1},{"displayOrder":8,"explanation":"A는 5개로 가장 많고 B는 2개로 가장 적습니다.","id":"7436f2e6-7fa4-43ad-a398-ccea1590c1d9","options":[{"displayOrder":1,"id":"21646383-d334-4c9f-8d4b-34797c527f15","isCorrect":false,"text":"B가 가장 많습니다."},{"displayOrder":2,"id":"1b4e2ebd-dd6a-4b8a-a957-ebc507d595cc","isCorrect":true,"text":"A가 가장 많고 B가 가장 적습니다."},{"displayOrder":3,"id":"6d9f7ce1-f781-411c-b62b-f70fa6510184","isCorrect":false,"text":"C가 가장 적습니다."},{"displayOrder":4,"id":"95792ce0-0268-4a97-917b-1f45c17fddc1","isCorrect":false,"text":"A와 C가 같습니다."}],"prompt":"그래프 A ■■■■■, B ■■, C ■■■■를 바르게 설명한 것은?","skillCode":"find-most-least-category","weight":1},{"displayOrder":9,"explanation":"원자료의 개수와 표의 합계가 같아야 빠진 자료가 없는지 확인할 수 있습니다.","id":"62989c87-515f-40b1-9e8b-6d3593d98b4a","options":[{"displayOrder":1,"id":"d046cf39-14fa-4042-befc-471f1007c44a","isCorrect":false,"text":"가장 큰 수만 봅니다."},{"displayOrder":2,"id":"5e3b7635-4a07-4a6f-b59b-3e2f3f9d22b5","isCorrect":false,"text":"항목 이름을 모두 지웁니다."},{"displayOrder":3,"id":"4b549e60-7c61-4b56-a697-1a2155b0e591","isCorrect":true,"text":"원자료 수와 표의 전체 수를 비교합니다."},{"displayOrder":4,"id":"4063baae-506e-4e6c-aea6-2e67aa7f0e58","isCorrect":false,"text":"아무 수나 하나 더합니다."}],"prompt":"표를 만들 때 같은 항목을 빠뜨렸습니다. 가장 알맞은 점검 방법은?","skillCode":"complete-data-table","weight":1},{"displayOrder":10,"explanation":"전체는 모든 항목을 더해야 하므로 3+5+4=12입니다.","id":"dc3a1b43-a420-4909-8a08-c8ab704109b9","options":[{"displayOrder":1,"id":"e9c32138-a7ea-4bb2-9f25-8ecc703d22b5","isCorrect":false,"text":"5+4=9이므로 맞습니다."},{"displayOrder":2,"id":"685c3519-d821-4933-b216-3e350f9a3f67","isCorrect":false,"text":"3+5=8이므로 전체는 8입니다."},{"displayOrder":3,"id":"ef30d153-4233-447e-8a0a-71642a4d95da","isCorrect":false,"text":"5-3=2이므로 전체는 2입니다."},{"displayOrder":4,"id":"a2af9153-3365-454a-a8ff-0a39b53c12f2","isCorrect":true,"text":"3+5+4=12이므로 전체는 12입니다."}],"prompt":"표 A 3, B 5, C 4를 보고 “전체는 9”라고 했습니다. 바르게 고친 것은?","skillCode":"correct-data-interpretation","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":11,"id":"41cf53c2-edf0-4585-958e-2d8804c5c443","slug":"grade2-tables-graphs","title":"표와 그래프로 나타내요"},"version":{"id":"f37533f2-54b2-4a3d-99da-88ba28dc7af9","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid
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
  where stage.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_tables_graphs_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_tables_graphs_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 12

  union all
  select 3, 'grade2_tables_graphs_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '2c516217b25218b0cc29df4113a5dc4d70b9505ff48b7c7e61339b3d6bc7f16b'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_tables_graphs_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_tables_graphs_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_tables_graphs_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_tables_graphs_v1_structure_and_orders',
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
    where stage.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_tables_graphs_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_tables_graphs_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid))

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
  where metadata.unit_id = '41cf53c2-edf0-4585-958e-2d8804c5c443'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 11

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = '41cf53c2-edf0-4585-958e-2d8804c5c443'::uuid
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
  where metadata.unit_id = '41cf53c2-edf0-4585-958e-2d8804c5c443'::uuid

  union all
  select 23, 'grade2_tables_graphs_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_tables_graphs_v1_pass_threshold_contract',
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
  select 25, 'grade2_tables_graphs_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_tables_graphs_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = 'f37533f2-54b2-4a3d-99da-88ba28dc7af9'::uuid

  union all
  select 27, 'grade2_tables_graphs_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_tables_graphs_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_tables_graphs_v1_question_skills_exact',
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
select 999, 'grade2_tables_graphs_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
