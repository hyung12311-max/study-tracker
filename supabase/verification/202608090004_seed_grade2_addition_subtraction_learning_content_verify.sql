-- Phase 2B grade2-addition-subtraction v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":3,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"da1b89e9-6091-4f25-8e76-9e205c6a72a0","questions":[{"displayOrder":1,"explanation":"일의 자리 3+4=7, 십의 자리 2+1=3이므로 23+14=37입니다.","id":"f2bdebaa-d6b9-4842-99ae-f7be36fc65ce","options":[{"displayOrder":1,"id":"94ae57aa-6777-4e86-80d5-1ad74cfec2b9","isCorrect":true,"text":"37"},{"displayOrder":2,"id":"aafd1e4b-36d1-45d4-9256-2469a7f46849","isCorrect":false,"text":"27"},{"displayOrder":3,"id":"b144e813-0284-47a3-a6d6-880b8b1b9b99","isCorrect":false,"text":"36"},{"displayOrder":4,"id":"14d9f7ca-7ffd-47f9-83f8-f082e66945ea","isCorrect":false,"text":"47"}],"prompt":"23+14의 값은?","skillCode":"add-without-regrouping","weight":1},{"displayOrder":2,"explanation":"일의 자리 2+5=7, 십의 자리 4+3=7이므로 42+35=77입니다.","id":"7e25f698-6a28-4c6f-9e6e-11f0aad911eb","options":[{"displayOrder":1,"id":"72672f4f-b1bb-4536-9d2d-719250806381","isCorrect":false,"text":"67"},{"displayOrder":2,"id":"a96447a9-c347-42ee-9cb8-9a5c10711332","isCorrect":true,"text":"77"},{"displayOrder":3,"id":"6597f52f-3e71-4973-83be-ba109c3179ce","isCorrect":false,"text":"76"},{"displayOrder":4,"id":"b92bc917-4704-4fd3-8c00-1678a7e0c0c4","isCorrect":false,"text":"87"}],"prompt":"42+35의 값은?","skillCode":"add-without-regrouping","weight":1},{"displayOrder":3,"explanation":"일의 자리 8-5=3, 십의 자리 6-2=4이므로 68-25=43입니다.","id":"8911ee70-d4e8-41bd-ac73-fa73a7a9df83","options":[{"displayOrder":1,"id":"463284dc-1d12-4c94-b3eb-0b8969f86409","isCorrect":false,"text":"33"},{"displayOrder":2,"id":"d1fb80e8-2b26-442a-8cdb-58acfe3f0b31","isCorrect":false,"text":"42"},{"displayOrder":3,"id":"2036c397-a6d3-41aa-b3bd-bebd487dc2f7","isCorrect":true,"text":"43"},{"displayOrder":4,"id":"346b748e-686f-462f-ba3e-ba7ef4e9ca43","isCorrect":false,"text":"53"}],"prompt":"68-25의 값은?","skillCode":"subtract-without-regrouping","weight":1},{"displayOrder":4,"explanation":"일의 자리 4-2=2, 십의 자리 9-3=6이므로 94-32=62입니다.","id":"e828c3e3-7033-40d6-b4a1-bfbead5c7746","options":[{"displayOrder":1,"id":"86784f09-e1e9-4c23-86fe-c638c6dac81a","isCorrect":false,"text":"52"},{"displayOrder":2,"id":"b106e868-bb9e-4bfc-8c18-e3128b5b2770","isCorrect":false,"text":"61"},{"displayOrder":3,"id":"260c43d2-ce6b-4601-a2b5-34e1c789ef93","isCorrect":false,"text":"72"},{"displayOrder":4,"id":"c1ae9616-0b8e-43de-8418-a2109c4e0f10","isCorrect":true,"text":"62"}],"prompt":"94-32의 값은?","skillCode":"subtract-without-regrouping","weight":1},{"displayOrder":5,"explanation":"21장과 16장을 모으면 21+16=37이므로 모두 37장입니다.","id":"ddbf1059-a184-49b4-8e39-33ad6f17283e","options":[{"displayOrder":1,"id":"c91e425b-3cc3-475c-98a0-3583d9a362f6","isCorrect":true,"text":"37장"},{"displayOrder":2,"id":"9307db16-fbfa-4b4d-bd84-b0bc9332e749","isCorrect":false,"text":"27장"},{"displayOrder":3,"id":"49b85eb6-1771-491f-b046-14a9ec63c678","isCorrect":false,"text":"36장"},{"displayOrder":4,"id":"bc51c0a1-548a-4539-9002-32b23f7665ef","isCorrect":false,"text":"47장"}],"prompt":"빨간 색종이가 21장이고 파란 색종이가 16장입니다. 모두 몇 장인가요?","skillCode":"model-addition-situation","weight":1},{"displayOrder":6,"explanation":"58자루에서 24자루를 빼면 58-24=34이므로 34자루가 남습니다.","id":"b3ef9b19-5f36-46d6-a4a2-df1ddafd228f","options":[{"displayOrder":1,"id":"c7658279-a0a6-4027-934b-c08517300c45","isCorrect":false,"text":"24자루"},{"displayOrder":2,"id":"4daba8e9-bb48-4c5a-856d-49bd543b22a1","isCorrect":true,"text":"34자루"},{"displayOrder":3,"id":"2943addc-f60a-4f7f-9cd9-2c55a46638cf","isCorrect":false,"text":"44자루"},{"displayOrder":4,"id":"1c1142fc-c6f3-4612-a93f-23f3d8bcc06a","isCorrect":false,"text":"82자루"}],"prompt":"연필 58자루 중 24자루를 쓰면 몇 자루가 남나요?","skillCode":"model-subtraction-situation","weight":1},{"displayOrder":7,"explanation":"''합한 수''는 덧셈으로 구하므로 32+15=47입니다.","id":"6010da6e-98e2-4456-a421-bf9fedbf6b3b","options":[{"displayOrder":1,"id":"2cb7db98-c4ca-42ca-ba40-4905e3495b75","isCorrect":false,"text":"32-15=17"},{"displayOrder":2,"id":"a9c358ec-26e6-4ebb-9362-4df385838934","isCorrect":false,"text":"32+15=37"},{"displayOrder":3,"id":"9edd522d-b49f-4432-809a-0179331d2af9","isCorrect":true,"text":"32+15=47"},{"displayOrder":4,"id":"dcac471e-d1b2-48c0-9c4e-96387b8a3d27","isCorrect":false,"text":"47-15=32"}],"prompt":"32명과 15명을 합한 수를 구하는 식은?","skillCode":"model-addition-situation","weight":1},{"displayOrder":8,"explanation":"''남은 수''는 전체에서 준 수를 빼어 76-22=54로 구합니다.","id":"9a51b222-5275-4b45-accb-03306711e4a8","options":[{"displayOrder":1,"id":"ac9d3199-83b0-42ea-93f0-3d0480f3ef45","isCorrect":false,"text":"76+22=98"},{"displayOrder":2,"id":"d2b33b7d-8ee9-4ccc-823d-430fe5e9f4fc","isCorrect":false,"text":"76-22=44"},{"displayOrder":3,"id":"fb0e1e33-2483-4595-a493-738c3e7e8433","isCorrect":false,"text":"76+22=88"},{"displayOrder":4,"id":"2174af51-a131-4f8c-adb0-451638469784","isCorrect":true,"text":"76-22=54"}],"prompt":"76개 중 22개를 주고 남은 수를 구하는 식은?","skillCode":"model-subtraction-situation","weight":1},{"displayOrder":9,"explanation":"34+25=59이고 72-14=58이므로 34+25가 1만큼 더 큽니다.","id":"8bccea31-7d34-4a0d-afa2-a3f1e783d33b","options":[{"displayOrder":1,"id":"7fef4d45-b0b7-4a45-be6e-7a4b4638bb3b","isCorrect":true,"text":"34+25가 더 큽니다."},{"displayOrder":2,"id":"8c75d4ec-284b-4630-af86-b6665b7e9de4","isCorrect":false,"text":"72-14가 더 큽니다."},{"displayOrder":3,"id":"7882c8f8-0219-4764-ae11-ef379d94cb86","isCorrect":false,"text":"두 결과가 같습니다."},{"displayOrder":4,"id":"c0af7cde-2e90-4314-a22d-24c74fbc7afd","isCorrect":false,"text":"비교할 수 없습니다."}],"prompt":"34+25와 72-14를 비교한 것은?","skillCode":"compare-calculation-results","weight":1},{"displayOrder":10,"explanation":"68-41=27이므로 41+27=68입니다.","id":"77113c21-f902-4cae-8314-dfab963886c8","options":[{"displayOrder":1,"id":"f9100212-cbcf-44e9-8194-cddd525a193e","isCorrect":false,"text":"17"},{"displayOrder":2,"id":"619241b7-b572-4e0d-b016-583dd2d529d1","isCorrect":true,"text":"27"},{"displayOrder":3,"id":"aa10eb5e-91cd-4a74-9e07-96624546ba31","isCorrect":false,"text":"37"},{"displayOrder":4,"id":"879297d6-6fe6-4b74-9b1a-481b57289794","isCorrect":false,"text":"109"}],"prompt":"41+□=68일 때 □에 들어갈 수는?","skillCode":"find-missing-number","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"75bd76ea-b5e4-4b89-ac30-e7be1eaba1d5","questions":[{"displayOrder":1,"explanation":"7+8=15에서 5를 쓰고 1을 받아올리면 2+3+1=6이므로 65입니다.","id":"10b46024-d55e-4cec-bccc-eaa9c6d7c5cd","options":[{"displayOrder":1,"id":"30b85ce6-265e-48ab-af2a-b98268d308e3","isCorrect":false,"text":"55"},{"displayOrder":2,"id":"a85e53e8-1879-4f37-a6e3-fa10be6fe4ab","isCorrect":false,"text":"64"},{"displayOrder":3,"id":"77bc571c-cf33-422d-9783-81d09f8f2f0d","isCorrect":true,"text":"65"},{"displayOrder":4,"id":"63824af0-2375-4fc3-8959-fa427f2f8da6","isCorrect":false,"text":"75"}],"prompt":"27+38의 값은?","skillCode":"add-with-regrouping","weight":1},{"displayOrder":2,"explanation":"6+9=15에서 5를 쓰고 1을 받아올리면 4+2+1=7이므로 75입니다.","id":"e2ea6ae8-1dbd-4dfe-b9f3-da790b7cb01b","options":[{"displayOrder":1,"id":"ac57d59e-c88d-4a0b-9c2e-287fa749937c","isCorrect":false,"text":"65"},{"displayOrder":2,"id":"16938cbe-9997-4f4f-9446-547bcd6d2158","isCorrect":false,"text":"74"},{"displayOrder":3,"id":"4455f8bd-b503-4101-9c8c-ed89db59afdc","isCorrect":false,"text":"85"},{"displayOrder":4,"id":"a192104d-3bd0-4474-83d2-139f28cdd6e4","isCorrect":true,"text":"75"}],"prompt":"46+29의 값은?","skillCode":"add-with-regrouping","weight":1},{"displayOrder":3,"explanation":"2에서 8을 빼기 어려워 1십을 받아 12-8=4, 4-2=2이므로 24입니다.","id":"6427e95f-7440-43e8-9ec6-88f20cefc80f","options":[{"displayOrder":1,"id":"882ab309-03e9-4e6c-a8d5-22f56a93771a","isCorrect":true,"text":"24"},{"displayOrder":2,"id":"2d2071d5-d5d4-4250-baa9-63122e0eae43","isCorrect":false,"text":"34"},{"displayOrder":3,"id":"e383735e-5b7e-4347-849b-aafaeb5fc012","isCorrect":false,"text":"36"},{"displayOrder":4,"id":"6a0c0a42-578f-4924-a06d-8fdb397e1c8c","isCorrect":false,"text":"44"}],"prompt":"52-28의 값은?","skillCode":"subtract-with-regrouping","weight":1},{"displayOrder":4,"explanation":"1에서 6을 빼기 어려워 1십을 받아 11-6=5, 6-4=2이므로 25입니다.","id":"9e6623dc-0214-4a00-83b0-f2df830d0187","options":[{"displayOrder":1,"id":"ca8a94da-4dd1-4cb2-b093-8f7c98e0d8ab","isCorrect":false,"text":"15"},{"displayOrder":2,"id":"9f58a628-31d8-4082-87f3-55d27ef59605","isCorrect":true,"text":"25"},{"displayOrder":3,"id":"a96491fe-6157-442c-b798-ad77dc3f6113","isCorrect":false,"text":"35"},{"displayOrder":4,"id":"41d285ac-537e-475b-8101-3458bb0f630f","isCorrect":false,"text":"45"}],"prompt":"71-46의 값은?","skillCode":"subtract-with-regrouping","weight":1},{"displayOrder":5,"explanation":"38+27=65이므로 두 종류의 책은 모두 65권입니다.","id":"e18aa374-17aa-43b1-a9b4-917fb017f020","options":[{"displayOrder":1,"id":"4e84d4db-20df-4b6a-a6d3-d8c1465e5bdb","isCorrect":false,"text":"55권"},{"displayOrder":2,"id":"ae7ca7a9-7976-46a7-9929-69da6527a071","isCorrect":false,"text":"64권"},{"displayOrder":3,"id":"326638db-acfc-43f7-b01f-1f8e1ff62b58","isCorrect":true,"text":"65권"},{"displayOrder":4,"id":"b7c94981-4dab-4699-883b-b8472adfb091","isCorrect":false,"text":"75권"}],"prompt":"도서관에 동화책 38권과 과학책 27권이 있습니다. 두 종류의 책은 모두 몇 권인가요?","skillCode":"model-addition-situation","weight":1},{"displayOrder":6,"explanation":"83-47=36이므로 남은 공은 36개입니다.","id":"6453343a-af00-4e7c-a6a4-cd81352a9766","options":[{"displayOrder":1,"id":"2df832bd-c990-4374-a5c3-d92d42164b47","isCorrect":false,"text":"26개"},{"displayOrder":2,"id":"dd3b1ced-4e17-4665-a869-a8600486155d","isCorrect":false,"text":"34개"},{"displayOrder":3,"id":"7f90d894-1e87-4dcf-94d6-fe49b2529bff","isCorrect":false,"text":"46개"},{"displayOrder":4,"id":"e1136f35-79fe-45e7-919c-757927f4d2af","isCorrect":true,"text":"36개"}],"prompt":"공 83개 중 47개를 사용했습니다. 남은 공은 몇 개인가요?","skillCode":"model-subtraction-situation","weight":1},{"displayOrder":7,"explanation":"두 묶음을 모았으므로 26+18=44입니다.","id":"e6855eb1-ec59-4c3d-ab3f-99196a2eb82c","options":[{"displayOrder":1,"id":"3c8ce196-3a19-469f-ab2a-273dd72069e1","isCorrect":true,"text":"26+18=44"},{"displayOrder":2,"id":"8d394f75-ebd6-49e7-9a97-cff260584f92","isCorrect":false,"text":"26-18=8"},{"displayOrder":3,"id":"e1ae4a93-0479-4934-8780-97326a28af28","isCorrect":false,"text":"26+18=34"},{"displayOrder":4,"id":"774fada4-336b-4950-a642-c244f2edd4d0","isCorrect":false,"text":"44-26=28"}],"prompt":"파란 구슬 26개와 노란 구슬 18개를 모았습니다. 알맞은 식은?","skillCode":"model-addition-situation","weight":1},{"displayOrder":8,"explanation":"전체 64장에서 사용한 29장을 빼면 64-29=35입니다.","id":"088aab4c-8832-4017-8f95-81d59b37a668","options":[{"displayOrder":1,"id":"8a0b1b11-27d7-4309-ae4d-1406d2cd2fb4","isCorrect":false,"text":"64+29=93"},{"displayOrder":2,"id":"e91f8d9b-3e23-42b1-a0f5-b7b0b388d5f5","isCorrect":true,"text":"64-29=35"},{"displayOrder":3,"id":"e9c7a4d2-3060-4388-ba71-838f637713ff","isCorrect":false,"text":"64-29=45"},{"displayOrder":4,"id":"3fd9e6fa-8012-4faa-93c3-3fe9ba67c881","isCorrect":false,"text":"64+29=83"}],"prompt":"64장의 색종이 중 29장을 사용했습니다. 알맞은 식은?","skillCode":"model-subtraction-situation","weight":1},{"displayOrder":9,"explanation":"47+26=73이고 90-18=72이므로 47+26이 1만큼 더 큽니다.","id":"47fb7468-014a-43b0-8713-6be1e69c1c6f","options":[{"displayOrder":1,"id":"0e4819bb-e818-4b1d-b4eb-8ddc5b1cdad4","isCorrect":false,"text":"90-18이 더 큽니다."},{"displayOrder":2,"id":"67c2b5b3-311c-4369-abe5-087f14c2c60b","isCorrect":false,"text":"두 결과가 같습니다."},{"displayOrder":3,"id":"bc4b505e-4794-4348-8459-c0cd8e653136","isCorrect":true,"text":"47+26이 더 큽니다."},{"displayOrder":4,"id":"e74775ac-7431-423f-82c8-1f4c98d6ab68","isCorrect":false,"text":"비교할 수 없습니다."}],"prompt":"47+26과 90-18을 비교한 것은?","skillCode":"compare-calculation-results","weight":1},{"displayOrder":10,"explanation":"82-36=46이므로 36+46=82입니다.","id":"b7761c69-14b4-42b3-b9dc-9c1ffcbef992","options":[{"displayOrder":1,"id":"da1ca4fe-0ece-4b1e-8cca-65713ff868e8","isCorrect":false,"text":"36"},{"displayOrder":2,"id":"1a62e7ea-a187-4823-aa8e-bfc40cc847c7","isCorrect":false,"text":"44"},{"displayOrder":3,"id":"0bf0807a-ede4-4cfc-813e-3895c6fea3a4","isCorrect":false,"text":"56"},{"displayOrder":4,"id":"1721026b-d136-4f2a-afe7-c09206256c55","isCorrect":true,"text":"46"}],"prompt":"36+□=82일 때 □에 들어갈 수는?","skillCode":"find-missing-number","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"2fb7c1d4-c5b0-4b4c-a276-0ff09ae45331","questions":[{"displayOrder":1,"explanation":"48+27=75, 39+35=74이므로 48+27이 1만큼 더 큽니다.","id":"de2bc462-9d6a-4783-b9f2-5b027374c1d3","options":[{"displayOrder":1,"id":"8d72a2dd-97d7-4665-a57b-9fed62684a95","isCorrect":true,"text":"48+27이 1만큼 더 큽니다."},{"displayOrder":2,"id":"42e0d33c-5ba2-4378-94c5-ccc80d318f69","isCorrect":false,"text":"39+35가 1만큼 더 큽니다."},{"displayOrder":3,"id":"97f6a4d9-187c-4134-8d2b-e052b0b3f274","isCorrect":false,"text":"두 결과가 같습니다."},{"displayOrder":4,"id":"de3a51ba-af48-46a3-a801-b18652ae3d3a","isCorrect":false,"text":"두 결과의 차이는 10입니다."}],"prompt":"48+27과 39+35의 결과를 비교한 것은?","skillCode":"compare-calculation-results","weight":1},{"displayOrder":2,"explanation":"84-39=45, 72-28=44이므로 84-39가 1만큼 더 큽니다.","id":"4a1f1041-92b1-4b69-8fd3-428c4d0cf6ca","options":[{"displayOrder":1,"id":"026b7f8e-82b4-402a-b6d3-5ca111549e8c","isCorrect":false,"text":"72-28이 더 큽니다."},{"displayOrder":2,"id":"0cd83d70-8ab6-4200-b0c7-82e532f1db85","isCorrect":true,"text":"84-39가 1만큼 더 큽니다."},{"displayOrder":3,"id":"91b0f843-13f7-4409-9032-c775dd1d3d2d","isCorrect":false,"text":"두 결과가 같습니다."},{"displayOrder":4,"id":"f5f5a45f-be61-4788-9232-1b97d359e263","isCorrect":false,"text":"두 결과의 차이는 10입니다."}],"prompt":"84-39와 72-28의 결과를 비교한 것은?","skillCode":"compare-calculation-results","weight":1},{"displayOrder":3,"explanation":"73-28=45이므로 45+28=73입니다.","id":"86dfd93c-721c-4d4f-b3a5-0d03613f60bf","options":[{"displayOrder":1,"id":"c0635a81-21da-441e-b589-3a6b8d1f64fc","isCorrect":false,"text":"35"},{"displayOrder":2,"id":"4d2d825b-1b46-4398-a073-945aea0954c6","isCorrect":false,"text":"44"},{"displayOrder":3,"id":"2e3f2bdc-900a-4d58-a926-103151922bf3","isCorrect":true,"text":"45"},{"displayOrder":4,"id":"4b620f21-11e6-4bbc-87a5-4b45e4ce3bbc","isCorrect":false,"text":"55"}],"prompt":"□+28=73일 때 □에 들어갈 수는?","skillCode":"find-missing-number","weight":1},{"displayOrder":4,"explanation":"91-46=45이므로 91-45=46입니다.","id":"5f96017d-fb5d-4f38-9d56-cd71d2e7d225","options":[{"displayOrder":1,"id":"1eb80cb2-652e-4e8d-814e-2240812b8c9d","isCorrect":false,"text":"35"},{"displayOrder":2,"id":"387a84b2-a00a-4de7-870a-ef9136f5c928","isCorrect":false,"text":"44"},{"displayOrder":3,"id":"d7cd90e4-2e68-43b7-9ac2-844850c11b64","isCorrect":false,"text":"55"},{"displayOrder":4,"id":"ef0a235d-a485-428f-bbc6-f21bc2edc9ed","isCorrect":true,"text":"45"}],"prompt":"91-□=46일 때 □에 들어갈 수는?","skillCode":"find-missing-number","weight":1},{"displayOrder":5,"explanation":"36+28=64이고 64-17=47이므로 47권이 남습니다.","id":"a5ce51f3-81ea-4f55-aefd-defd5d2961cf","options":[{"displayOrder":1,"id":"1f022762-e30d-4881-bec7-4612b67f4447","isCorrect":true,"text":"47권"},{"displayOrder":2,"id":"ed3d3b4b-c8f5-49f4-ae5f-cfd5b3fa7735","isCorrect":false,"text":"37권"},{"displayOrder":3,"id":"80275524-081f-4b1e-ba65-7b5bf829b622","isCorrect":false,"text":"53권"},{"displayOrder":4,"id":"d27de3a6-1775-4443-84ed-085df33fd636","isCorrect":false,"text":"81권"}],"prompt":"책 36권에 28권을 더 가져온 뒤 17권을 빌려주었습니다. 남은 책은 몇 권인가요?","skillCode":"model-subtraction-situation","weight":1},{"displayOrder":6,"explanation":"74-26=48이고 48+15=63이므로 지금 구슬은 63개입니다.","id":"f4e78b1f-7e1b-4645-8a16-95765cc99ad4","options":[{"displayOrder":1,"id":"8eed08e8-1bf4-486c-aa4c-6b86becdd3b9","isCorrect":false,"text":"53개"},{"displayOrder":2,"id":"5c6b8769-f3cc-443d-8d76-21c911ed1d88","isCorrect":true,"text":"63개"},{"displayOrder":3,"id":"b3cc0247-8ab9-43da-8ba1-ea5967001948","isCorrect":false,"text":"73개"},{"displayOrder":4,"id":"3905b8c3-83ed-4947-93ee-e6c7d940bec5","isCorrect":false,"text":"85개"}],"prompt":"구슬 74개 중 26개를 주고 15개를 더 받았습니다. 지금 구슬은 몇 개인가요?","skillCode":"model-addition-situation","weight":1},{"displayOrder":7,"explanation":"먼저 준 18을 빼고 받은 12를 더하면 45-18+12=39입니다.","id":"5c012423-db06-4977-be4b-83860d0eb1f8","options":[{"displayOrder":1,"id":"f03071a9-c2b2-4478-8027-c24bfcc97295","isCorrect":false,"text":"45+18+12=75"},{"displayOrder":2,"id":"fd927de9-bb18-4efb-aa2b-1f743061f4af","isCorrect":false,"text":"45-18-12=15"},{"displayOrder":3,"id":"dab615f0-077d-413a-a710-05cecc4fcd89","isCorrect":true,"text":"45-18+12=39"},{"displayOrder":4,"id":"4c3bc85b-7a4e-4df5-b67c-464d3d0338a8","isCorrect":false,"text":"45+18-12=51"}],"prompt":"연필 45자루 중 18자루를 주고 12자루를 더 받았습니다. 알맞은 식과 답은?","skillCode":"model-subtraction-situation","weight":1},{"displayOrder":8,"explanation":"56+18=74, 93-17=76이므로 93-17이 2만큼 더 큽니다.","id":"95472b55-daa9-44f7-b84e-d7087b41eaea","options":[{"displayOrder":1,"id":"c49a2890-3fc8-4345-b05b-d5e07a9c26ee","isCorrect":false,"text":"56+18이 더 큽니다."},{"displayOrder":2,"id":"d1e52bd6-8ef4-4800-877c-9c931736298d","isCorrect":false,"text":"두 결과가 같습니다."},{"displayOrder":3,"id":"d2fece90-f78c-43af-8bf3-9e2039cb3d75","isCorrect":false,"text":"두 결과의 차이는 12입니다."},{"displayOrder":4,"id":"db1c12e3-77ca-4353-819a-2a3871c448f8","isCorrect":true,"text":"93-17이 2만큼 더 큽니다."}],"prompt":"56+18과 93-17의 결과를 비교한 것은?","skillCode":"compare-calculation-results","weight":1},{"displayOrder":9,"explanation":"65-27=38이므로 3□는 38이고 □에 들어갈 숫자는 8입니다.","id":"85f87c04-593d-4d07-a20e-4c9d7078ae80","options":[{"displayOrder":1,"id":"3d332fa4-7a37-40e9-a456-908c9850d121","isCorrect":true,"text":"8"},{"displayOrder":2,"id":"21f999fe-b93e-4876-87b4-01a7cc8ee32f","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"55848e68-7227-48ca-befd-f050115d7d10","isCorrect":false,"text":"6"},{"displayOrder":4,"id":"3e6129f6-d31d-459a-ab7e-074798d21ac0","isCorrect":false,"text":"5"}],"prompt":"3□+27=65일 때 □에 들어갈 숫자는?","skillCode":"find-missing-number","weight":1},{"displayOrder":10,"explanation":"82-47=35이므로 82-35=47입니다.","id":"ccf47455-a946-4a99-84b2-5cab58b3840f","options":[{"displayOrder":1,"id":"2f84077e-edc1-435a-8ebd-b1e9fd209cfb","isCorrect":false,"text":"25"},{"displayOrder":2,"id":"900877a6-bbd4-479b-af84-80ef5fff4f8a","isCorrect":true,"text":"35"},{"displayOrder":3,"id":"266ff5bf-c8ff-41d9-9beb-a5e374ec81f2","isCorrect":false,"text":"45"},{"displayOrder":4,"id":"e0dc9919-e78c-4f25-a8dc-baf2bb62edf8","isCorrect":false,"text":"129"}],"prompt":"82-□=47일 때 □에 들어갈 수는?","skillCode":"find-missing-number","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"8ba52eca-c986-4897-bdd8-9a7da4e6f271","questions":[{"displayOrder":1,"explanation":"7+8=15의 받아올림 1을 십의 자리에 더해야 하므로 올바른 답은 65입니다.","id":"2a6282ff-83fe-4086-b312-cc89240d0dd3","options":[{"displayOrder":1,"id":"491928fc-f844-405e-9252-f53fa1fed376","isCorrect":false,"text":"십의 자리를 먼저 더했습니다."},{"displayOrder":2,"id":"5b671f65-716e-4a25-9041-d3925fea4262","isCorrect":false,"text":"3과 2를 더했습니다."},{"displayOrder":3,"id":"a4e6bbb8-15b7-44f7-b9ea-bee932c3391e","isCorrect":true,"text":"7+8에서 생긴 받아올림 1을 십의 자리에 더하지 않았습니다."},{"displayOrder":4,"id":"7ea1c671-73c3-4f70-b1b2-6b5d73609211","isCorrect":false,"text":"덧셈 대신 뺄셈을 했습니다."}],"prompt":"민수는 38+27을 55라고 계산했습니다. 틀린 이유는?","skillCode":"correct-calculation-reasoning","weight":1},{"displayOrder":2,"explanation":"72-38은 1십을 받아내림하여 12-8=4, 6-3=3으로 계산하므로 34입니다.","id":"d4de18fb-eea5-401f-be99-374a6cbbd536","options":[{"displayOrder":1,"id":"5e7851da-98ed-4b24-8d23-a93c7c81b5f1","isCorrect":false,"text":"2에서 8을 바로 빼면 6입니다."},{"displayOrder":2,"id":"7bc17e66-e4ca-46cc-8716-f804c71b75a2","isCorrect":false,"text":"72에 38을 더해야 합니다."},{"displayOrder":3,"id":"02e6b719-85ed-474b-bf34-fdf4a4f4f202","isCorrect":false,"text":"올바른 답은 44입니다."},{"displayOrder":4,"id":"d5214796-ddcc-496b-b072-da847aad4059","isCorrect":true,"text":"1십을 받아 12-8=4, 6-3=3이므로 올바른 답은 34입니다."}],"prompt":"지우는 72-38을 46이라고 계산했습니다. 바른 설명은?","skillCode":"correct-calculation-reasoning","weight":1},{"displayOrder":3,"explanation":"46+28은 6+8=14에서 1을 받아올리면 74입니다. 64라는 계산은 잘못되었습니다.","id":"e0e10c90-c21b-44ee-8d14-dbffd1b947c3","options":[{"displayOrder":1,"id":"59f74724-c234-4ba2-bb27-5506e1c32da3","isCorrect":true,"text":"46+28=64"},{"displayOrder":2,"id":"9c6b0063-3e7d-45fa-be13-d8998a22d037","isCorrect":false,"text":"53+19=72"},{"displayOrder":3,"id":"7c44985e-e641-4a1d-a714-c699e868f89f","isCorrect":false,"text":"81-37=44"},{"displayOrder":4,"id":"c752a9d1-36e4-46f1-8388-5c08daffa015","isCorrect":false,"text":"90-26=64"}],"prompt":"계산이 잘못된 것은?","skillCode":"correct-calculation-reasoning","weight":1},{"displayOrder":4,"explanation":"81-46은 1십을 받아 11-6=5, 7-4=3으로 계산하여 35입니다.","id":"e3e8e8d8-9987-4d52-b098-88e4feb730b1","options":[{"displayOrder":1,"id":"5aba48d6-dc2e-43a9-bc8e-5017debd5e14","isCorrect":false,"text":"1-6=5, 8-4=4이므로 45입니다."},{"displayOrder":2,"id":"e8f396ac-3c20-47b5-8508-529dbd73b5b2","isCorrect":true,"text":"1십을 받아 11-6=5, 7-4=3이므로 35입니다."},{"displayOrder":3,"id":"c4f53ce7-ae68-4de6-b1c9-8c2db867a253","isCorrect":false,"text":"81+46을 계산하면 127입니다."},{"displayOrder":4,"id":"0b0c3ba6-6be8-4b49-b1d2-8709426bd325","isCorrect":false,"text":"일의 자리만 빼면 5입니다."}],"prompt":"81-46을 계산하는 방법으로 올바른 것은?","skillCode":"correct-calculation-reasoning","weight":1},{"displayOrder":5,"explanation":"83-47=36이므로 다른 한 수는 36입니다.","id":"32f3e6e8-efe1-48d9-af39-88ab086d2f97","options":[{"displayOrder":1,"id":"2b12369d-f603-49a2-88c3-3fcfd485e64a","isCorrect":false,"text":"26"},{"displayOrder":2,"id":"e3fd5e25-738b-48b8-89e9-45dadaed2f00","isCorrect":false,"text":"34"},{"displayOrder":3,"id":"b2aa6fdc-8159-46b3-a392-73dd09817e76","isCorrect":true,"text":"36"},{"displayOrder":4,"id":"59ec9d17-0c93-4b69-8cf5-89d1e7bc9d3b","isCorrect":false,"text":"46"}],"prompt":"두 수의 합은 83이고 한 수는 47입니다. 다른 한 수는?","skillCode":"find-missing-number","weight":1},{"displayOrder":6,"explanation":"큰 수는 작은 수에 차이를 더해 39+28=67입니다.","id":"b84e6faa-8527-418e-b55a-45da84c69f52","options":[{"displayOrder":1,"id":"286196e0-911c-4797-a172-9c19cb15d3f3","isCorrect":false,"text":"57"},{"displayOrder":2,"id":"5438c595-c4d6-405d-8a83-6b605d751431","isCorrect":false,"text":"66"},{"displayOrder":3,"id":"c1daf8c8-2065-443b-a635-a53dc9ff2306","isCorrect":false,"text":"77"},{"displayOrder":4,"id":"966ed727-84b4-48c4-8396-c0e74638f1ac","isCorrect":true,"text":"67"}],"prompt":"두 수의 차이는 28이고 작은 수는 39입니다. 큰 수는?","skillCode":"find-missing-number","weight":1},{"displayOrder":7,"explanation":"72-38=34이므로 34+38=72입니다.","id":"52146340-686a-4f04-a33f-6f102967d9a2","options":[{"displayOrder":1,"id":"d9b69e2f-0807-41e8-a092-407644a3753a","isCorrect":true,"text":"34"},{"displayOrder":2,"id":"3fb576bf-ba7b-4365-93d1-413f2864c95a","isCorrect":false,"text":"24"},{"displayOrder":3,"id":"b707e183-a2f0-4d78-acc2-8f3f9931bd7d","isCorrect":false,"text":"44"},{"displayOrder":4,"id":"8a784e12-4646-4db9-9d2b-2fb332b0af87","isCorrect":false,"text":"110"}],"prompt":"□+38=72입니다. □에 들어갈 수는?","skillCode":"find-missing-number","weight":1},{"displayOrder":8,"explanation":"먹은 사과는 전체에서 없어지므로 65-27=38입니다.","id":"9aed200e-49ff-406e-85c0-fcc05f38a643","options":[{"displayOrder":1,"id":"b40a6597-1165-4847-8233-e7cedd33177b","isCorrect":false,"text":"사과가 늘었으므로 덧셈이 맞습니다."},{"displayOrder":2,"id":"3fa0e2fb-9c36-4856-92c8-fe329abfb29f","isCorrect":true,"text":"먹은 27개를 빼야 하므로 65-27=38입니다."},{"displayOrder":3,"id":"ebbbbc09-b419-4f68-a54c-76f5006c29cd","isCorrect":false,"text":"65-27=48입니다."},{"displayOrder":4,"id":"4122ef81-4e1d-4a9a-9abc-730236c6f56c","isCorrect":false,"text":"두 수를 비교할 수 없습니다."}],"prompt":"사과가 65개 있는데 27개를 먹었습니다. 수호는 65+27로 계산했습니다. 바른 설명은?","skillCode":"correct-calculation-reasoning","weight":1},{"displayOrder":9,"explanation":"57+28은 받아올림하여 85이고 92-18=74이므로 민호의 올바른 결과가 더 큽니다.","id":"82b5875a-97dc-42fb-9e51-a4a807ffe95c","options":[{"displayOrder":1,"id":"535b3186-93db-40fc-b280-534b3be7adb1","isCorrect":false,"text":"지수만 맞고 지수의 결과가 더 큽니다."},{"displayOrder":2,"id":"59f2471d-9ab7-4d9c-8b93-5bb06d837226","isCorrect":false,"text":"두 사람의 계산이 모두 맞습니다."},{"displayOrder":3,"id":"f64de3af-e88d-4a03-92fb-076e93919647","isCorrect":true,"text":"민호의 올바른 결과는 85이고 지수의 74보다 큽니다."},{"displayOrder":4,"id":"5aca9258-49e2-4c61-b1c7-581bab128105","isCorrect":false,"text":"민호의 올바른 결과는 65입니다."}],"prompt":"민호는 57+28=75, 지수는 92-18=74라고 했습니다. 바르게 비교한 것은?","skillCode":"correct-calculation-reasoning","weight":1},{"displayOrder":10,"explanation":"먼저 71-26=45로 어떤 수를 찾고 45-18=27을 구합니다.","id":"e040742f-f7eb-4e67-a95b-05a9ddb0078d","options":[{"displayOrder":1,"id":"f0b13b25-d235-4546-834d-36f1ed2a7c89","isCorrect":false,"text":"17"},{"displayOrder":2,"id":"1de23020-f470-4a42-9275-8e6f07c3e7fc","isCorrect":false,"text":"35"},{"displayOrder":3,"id":"d3484cca-23ca-4766-b496-d97c8ffc2aae","isCorrect":false,"text":"53"},{"displayOrder":4,"id":"774b519d-d862-4b33-a029-a8ef0f5cae82","isCorrect":true,"text":"27"}],"prompt":"어떤 수에 26을 더했더니 71이 되었습니다. 그 수에서 18을 빼면?","skillCode":"find-missing-number","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":3,"id":"05f6dcf6-c9e3-4f5d-b0cb-60a428a82617","slug":"grade2-addition-subtraction","title":"덧셈과 뺄셈을 해요"},"version":{"id":"d6d3caf7-1375-4dde-9fea-c44b5776cc04","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid
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
  where stage.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_addition_subtraction_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_addition_subtraction_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 4

  union all
  select 3, 'grade2_addition_subtraction_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '87ec4002269ad8ecd3e3bab9a14b158af039b8ee57c27786c785b37bb124d422'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_addition_subtraction_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_addition_subtraction_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_addition_subtraction_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_addition_subtraction_v1_structure_and_orders',
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
    where stage.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_addition_subtraction_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_addition_subtraction_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid))

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
  where metadata.unit_id = '05f6dcf6-c9e3-4f5d-b0cb-60a428a82617'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 3

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = '05f6dcf6-c9e3-4f5d-b0cb-60a428a82617'::uuid
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
  where metadata.unit_id = '05f6dcf6-c9e3-4f5d-b0cb-60a428a82617'::uuid

  union all
  select 23, 'grade2_addition_subtraction_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_addition_subtraction_v1_pass_threshold_contract',
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
  select 25, 'grade2_addition_subtraction_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_addition_subtraction_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = 'd6d3caf7-1375-4dde-9fea-c44b5776cc04'::uuid

  union all
  select 27, 'grade2_addition_subtraction_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_addition_subtraction_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_addition_subtraction_v1_question_skills_exact',
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
select 999, 'grade2_addition_subtraction_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
