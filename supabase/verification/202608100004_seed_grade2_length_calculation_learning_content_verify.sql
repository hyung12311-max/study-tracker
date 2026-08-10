-- Phase 2B grade2-length-calculation v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":9,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"61200041-9365-40d2-ac2d-98e1db27c2fb","questions":[{"displayOrder":1,"explanation":"23cm+14cm=37cm이므로 전체 길이는 37cm입니다.","id":"d6d18c11-f1bb-4cac-a69d-f6e08d39570a","options":[{"displayOrder":1,"id":"312d674a-c392-4eda-8023-0cdb30e1186e","isCorrect":true,"text":"37cm"},{"displayOrder":2,"id":"d0afaadd-98a8-430f-a0ff-168f679477e4","isCorrect":false,"text":"38cm"},{"displayOrder":3,"id":"19624126-5abe-4afe-8262-bcc41310c978","isCorrect":false,"text":"36cm"},{"displayOrder":4,"id":"c7610f2e-2fca-4d12-8214-f19c27445caf","isCorrect":false,"text":"47cm"}],"prompt":"23cm와 14cm를 이어 붙였습니다. 전체 길이는 얼마입니까?","skillCode":"calculate-length-addition","weight":1},{"displayOrder":2,"explanation":"35cm+22cm=57cm이므로 전체 길이는 57cm입니다.","id":"18076f7d-6626-4105-8d76-39e3e841965e","options":[{"displayOrder":1,"id":"eb57fff9-c12c-4e21-81bc-9183f1b3bdef","isCorrect":false,"text":"58cm"},{"displayOrder":2,"id":"deb50d7d-fb76-47b3-9985-6071781e1b78","isCorrect":true,"text":"57cm"},{"displayOrder":3,"id":"2e4858c4-618a-4891-a061-1315d4123795","isCorrect":false,"text":"56cm"},{"displayOrder":4,"id":"a2c74a28-f865-43cf-a322-09284c63dc68","isCorrect":false,"text":"67cm"}],"prompt":"35cm와 22cm를 이어 붙였습니다. 전체 길이는 얼마입니까?","skillCode":"calculate-length-addition","weight":1},{"displayOrder":3,"explanation":"41cm+27cm=68cm이므로 전체 길이는 68cm입니다.","id":"04cdb587-bd52-44d8-9dc6-64e005fe496d","options":[{"displayOrder":1,"id":"7d45d8f8-ff6c-4314-9323-2c22cbffb952","isCorrect":false,"text":"69cm"},{"displayOrder":2,"id":"eb92f08f-7200-48e9-a4fd-fdb607c38571","isCorrect":false,"text":"67cm"},{"displayOrder":3,"id":"c94f0669-ad3c-4e58-bae7-ebd46a8cbac7","isCorrect":true,"text":"68cm"},{"displayOrder":4,"id":"006ce0e3-b749-494d-93c9-170b0c6c0083","isCorrect":false,"text":"78cm"}],"prompt":"41cm와 27cm를 이어 붙였습니다. 전체 길이는 얼마입니까?","skillCode":"calculate-length-addition","weight":1},{"displayOrder":4,"explanation":"56cm+13cm=69cm이므로 전체 길이는 69cm입니다.","id":"7084bae0-6b69-4c67-b9cc-dec42a4a9f71","options":[{"displayOrder":1,"id":"1fcf88e1-dadc-4f1c-8953-bccd4089d93f","isCorrect":false,"text":"70cm"},{"displayOrder":2,"id":"7a315165-5d14-488f-8c84-0a4cd0c8a613","isCorrect":false,"text":"68cm"},{"displayOrder":3,"id":"c75c597b-138f-4f8b-948d-6ea8a0f23c2b","isCorrect":false,"text":"79cm"},{"displayOrder":4,"id":"6572ebba-153b-4e63-8f6b-cd05903124dd","isCorrect":true,"text":"69cm"}],"prompt":"56cm와 13cm를 이어 붙였습니다. 전체 길이는 얼마입니까?","skillCode":"calculate-length-addition","weight":1},{"displayOrder":5,"explanation":"18cm+25cm=43cm이므로 전체 길이는 43cm입니다.","id":"dc03902e-8d0a-4dc3-b646-807bbfd99562","options":[{"displayOrder":1,"id":"f8c9d880-3042-4018-834a-a901c27bc2ee","isCorrect":true,"text":"43cm"},{"displayOrder":2,"id":"e2266b12-9276-407d-896f-a0d30161d536","isCorrect":false,"text":"44cm"},{"displayOrder":3,"id":"06a65445-eb60-40f9-ab52-1badccdc3fee","isCorrect":false,"text":"42cm"},{"displayOrder":4,"id":"1b6bcc0e-e296-4156-a90c-3cadb199df66","isCorrect":false,"text":"53cm"}],"prompt":"18cm와 25cm를 이어 붙였습니다. 전체 길이는 얼마입니까?","skillCode":"calculate-length-addition","weight":1},{"displayOrder":6,"explanation":"48cm-15cm=33cm이므로 남은 길이는 33cm입니다.","id":"d903baaa-1a0b-4835-a047-b91a4e68a85a","options":[{"displayOrder":1,"id":"7b62a4d5-19f7-4419-80c7-fd78965b7b73","isCorrect":false,"text":"34cm"},{"displayOrder":2,"id":"43ae5b32-99f0-44b0-bca6-44df1a9a9360","isCorrect":true,"text":"33cm"},{"displayOrder":3,"id":"de1a7fb3-0b26-49cd-8a6a-cc8a5d440c61","isCorrect":false,"text":"32cm"},{"displayOrder":4,"id":"d1da047b-36fe-4a6b-a4a8-a5902fa71a17","isCorrect":false,"text":"43cm"}],"prompt":"48cm인 끈에서 15cm를 잘랐습니다. 남은 길이는 얼마입니까?","skillCode":"calculate-length-subtraction","weight":1},{"displayOrder":7,"explanation":"67cm-24cm=43cm이므로 남은 길이는 43cm입니다.","id":"871fe10d-e690-458b-b513-00449bed4c94","options":[{"displayOrder":1,"id":"223ff581-be6e-4e96-9d6f-9910e7b12481","isCorrect":true,"text":"43cm"},{"displayOrder":2,"id":"b20b84d0-c207-44b2-ad13-98c57ae969c6","isCorrect":false,"text":"44cm"},{"displayOrder":3,"id":"33a18b4b-fec4-494b-a5ff-ae720ffc2ff4","isCorrect":false,"text":"42cm"},{"displayOrder":4,"id":"90c2e8e3-a9d1-4646-a0d0-eb2f7bf5e658","isCorrect":false,"text":"53cm"}],"prompt":"67cm인 끈에서 24cm를 잘랐습니다. 남은 길이는 얼마입니까?","skillCode":"calculate-length-subtraction","weight":1},{"displayOrder":8,"explanation":"59cm-18cm=41cm이므로 남은 길이는 41cm입니다.","id":"a78f1bf5-6fc4-4047-8653-5d42b9882c77","options":[{"displayOrder":1,"id":"b052db81-94c3-46ec-b3bb-7db86acf831c","isCorrect":false,"text":"42cm"},{"displayOrder":2,"id":"a02b81fd-3e8c-4591-97ea-fa96f1980767","isCorrect":true,"text":"41cm"},{"displayOrder":3,"id":"22cbf558-f3ac-409f-818e-005a5924ec00","isCorrect":false,"text":"40cm"},{"displayOrder":4,"id":"95e57c4f-9b45-46e4-bab7-c54bd60335ac","isCorrect":false,"text":"51cm"}],"prompt":"59cm인 끈에서 18cm를 잘랐습니다. 남은 길이는 얼마입니까?","skillCode":"calculate-length-subtraction","weight":1},{"displayOrder":9,"explanation":"72cm-31cm=41cm이므로 남은 길이는 41cm입니다.","id":"6794c8b5-15e4-410a-bfeb-dd73eacf6b7d","options":[{"displayOrder":1,"id":"1393ad58-84a5-4026-a5c8-4976907c4bb7","isCorrect":false,"text":"42cm"},{"displayOrder":2,"id":"b715476c-940a-47bc-be88-1cbec9bc831e","isCorrect":false,"text":"40cm"},{"displayOrder":3,"id":"c0282b9a-cc33-430a-ab6c-bd6bb96530f4","isCorrect":true,"text":"41cm"},{"displayOrder":4,"id":"848da5c7-1885-4e95-b432-a507ae8af5eb","isCorrect":false,"text":"51cm"}],"prompt":"72cm인 끈에서 31cm를 잘랐습니다. 남은 길이는 얼마입니까?","skillCode":"calculate-length-subtraction","weight":1},{"displayOrder":10,"explanation":"86cm-42cm=44cm이므로 남은 길이는 44cm입니다.","id":"5c69ea52-d9f2-409e-a08b-cdd95e366a75","options":[{"displayOrder":1,"id":"6e9dfe17-cba9-469e-8814-8adc4dca8625","isCorrect":false,"text":"45cm"},{"displayOrder":2,"id":"90251c56-d197-4278-b0de-e6372d728726","isCorrect":false,"text":"43cm"},{"displayOrder":3,"id":"15d3c97d-1770-424c-a799-a2d2ace67ffc","isCorrect":false,"text":"54cm"},{"displayOrder":4,"id":"88a6e782-b058-435d-9287-833a72a28380","isCorrect":true,"text":"44cm"}],"prompt":"86cm인 끈에서 42cm를 잘랐습니다. 남은 길이는 얼마입니까?","skillCode":"calculate-length-subtraction","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"52000029-29e0-4e4e-80a8-7abf227c7c11","questions":[{"displayOrder":1,"explanation":"12m+7m=19m이므로 전체 길이는 19m입니다.","id":"6ce9636c-32b1-41a4-b70d-5ac57fcbf2d2","options":[{"displayOrder":1,"id":"a451f894-b945-4bdc-a788-fa3836444a98","isCorrect":true,"text":"19m"},{"displayOrder":2,"id":"60acfa63-7ac0-464b-bc89-8b53d3b9a0de","isCorrect":false,"text":"20m"},{"displayOrder":3,"id":"73129a78-d080-4104-8ef2-7cf2b766a78f","isCorrect":false,"text":"18m"},{"displayOrder":4,"id":"d86f0a26-3144-4f07-b9bc-36260cc105f8","isCorrect":false,"text":"29m"}],"prompt":"12m 길의 다음에 7m 길이 이어집니다. 두 길의 전체 길이는?","skillCode":"solve-total-length","weight":1},{"displayOrder":2,"explanation":"25m+14m=39m이므로 전체 길이는 39m입니다.","id":"3f93b4db-2e95-4746-937c-6ad2e2e004da","options":[{"displayOrder":1,"id":"6e7cfd39-be1d-419a-820e-42c4e4d72b0c","isCorrect":false,"text":"40m"},{"displayOrder":2,"id":"ccee235f-5178-4c2a-bbb8-e2d10897d358","isCorrect":true,"text":"39m"},{"displayOrder":3,"id":"3dba9781-034d-4d66-9bb8-8290f24accdc","isCorrect":false,"text":"38m"},{"displayOrder":4,"id":"b9861453-f848-426a-aeb3-2fa89b1da428","isCorrect":false,"text":"49m"}],"prompt":"25m 길의 다음에 14m 길이 이어집니다. 두 길의 전체 길이는?","skillCode":"solve-total-length","weight":1},{"displayOrder":3,"explanation":"31m+16m=47m이므로 전체 길이는 47m입니다.","id":"0fdd5a0a-a40b-4e7d-b701-207225a447ca","options":[{"displayOrder":1,"id":"fafbc73a-aa5f-4e33-ad76-7c14c6953e1e","isCorrect":false,"text":"48m"},{"displayOrder":2,"id":"26986b9a-f6f3-482f-a39b-23b4e3393322","isCorrect":false,"text":"46m"},{"displayOrder":3,"id":"f818a74d-ac8a-4614-bfcf-fc4ab4310f51","isCorrect":true,"text":"47m"},{"displayOrder":4,"id":"d57383ab-d8bc-489d-9661-081f05a7b499","isCorrect":false,"text":"57m"}],"prompt":"31m 길의 다음에 16m 길이 이어집니다. 두 길의 전체 길이는?","skillCode":"solve-total-length","weight":1},{"displayOrder":4,"explanation":"40cm-13cm=27cm이므로 남은 리본은 27cm입니다.","id":"9c792f63-0fb4-490b-bbef-62a6d2e7484f","options":[{"displayOrder":1,"id":"41b57fc5-f377-4c22-9aaa-e2237394d1e7","isCorrect":false,"text":"28cm"},{"displayOrder":2,"id":"c1176d43-1fab-4bf5-ae21-e7a15c332157","isCorrect":false,"text":"26cm"},{"displayOrder":3,"id":"8f767d89-c60f-4b0e-91d5-f59a2cfe4c88","isCorrect":false,"text":"37cm"},{"displayOrder":4,"id":"6be3058f-8294-4b14-b064-d31cacef9fa1","isCorrect":true,"text":"27cm"}],"prompt":"리본이 40cm 있었습니다. 13cm를 사용했다면 남은 길이는?","skillCode":"solve-remaining-length","weight":1},{"displayOrder":5,"explanation":"52cm-21cm=31cm이므로 남은 리본은 31cm입니다.","id":"1ce21161-8f5d-4bbf-a4a9-a1004d715962","options":[{"displayOrder":1,"id":"ea48bf46-b74f-4e91-afa6-75c7897eab29","isCorrect":false,"text":"32cm"},{"displayOrder":2,"id":"a33e3cd2-d185-409b-bae0-cbbaa137915c","isCorrect":false,"text":"30cm"},{"displayOrder":3,"id":"31c3c585-4a44-418a-80b7-3ffa4559e4d8","isCorrect":true,"text":"31cm"},{"displayOrder":4,"id":"e10b9619-ff01-4659-bc17-7229d0038393","isCorrect":false,"text":"41cm"}],"prompt":"리본이 52cm 있었습니다. 21cm를 사용했다면 남은 길이는?","skillCode":"solve-remaining-length","weight":1},{"displayOrder":6,"explanation":"63cm-28cm=35cm이므로 남은 리본은 35cm입니다.","id":"9f57752c-2711-40e4-b447-3fe54eb7923d","options":[{"displayOrder":1,"id":"8fa04d4e-d582-4cfb-83da-37a5e0435617","isCorrect":false,"text":"36cm"},{"displayOrder":2,"id":"2ae40581-f371-4fa6-995a-8e50279f99f6","isCorrect":false,"text":"34cm"},{"displayOrder":3,"id":"cf443107-3e24-4e05-ba97-c9533a65ac7b","isCorrect":false,"text":"45cm"},{"displayOrder":4,"id":"7eed2277-25d6-4e27-9e4e-5ba8effcd1a7","isCorrect":true,"text":"35cm"}],"prompt":"리본이 63cm 있었습니다. 28cm를 사용했다면 남은 길이는?","skillCode":"solve-remaining-length","weight":1},{"displayOrder":7,"explanation":"더 긴 46cm에서 29cm를 빼면 46-29=17이므로 차는 17cm입니다.","id":"d55484be-df0c-4aeb-9a8d-48a0a18341e1","options":[{"displayOrder":1,"id":"37885d38-3e96-4315-aabf-b5694e20408f","isCorrect":true,"text":"17cm"},{"displayOrder":2,"id":"95d9c2a4-1a38-4eb6-9321-3daaf6f23e5f","isCorrect":false,"text":"18cm"},{"displayOrder":3,"id":"703484ae-87b3-4ad0-888e-6490009b08ef","isCorrect":false,"text":"16cm"},{"displayOrder":4,"id":"fd82949f-03a0-4b7a-afeb-059731e2d2a8","isCorrect":false,"text":"27cm"}],"prompt":"46cm 막대와 29cm 막대의 길이 차는 얼마입니까?","skillCode":"compare-length-difference","weight":1},{"displayOrder":8,"explanation":"더 긴 71cm에서 38cm를 빼면 71-38=33이므로 차는 33cm입니다.","id":"5ca88489-02e0-4117-b4dc-e85cd86489b6","options":[{"displayOrder":1,"id":"6df591e9-c253-425d-a69d-15b369ed181f","isCorrect":false,"text":"34cm"},{"displayOrder":2,"id":"9d66d17c-4a87-4b55-8b87-8a5f7817a871","isCorrect":true,"text":"33cm"},{"displayOrder":3,"id":"73b1760f-a273-4ffe-9ddb-756e87247cfb","isCorrect":false,"text":"32cm"},{"displayOrder":4,"id":"aa1d458b-4ed3-4096-956b-28a9cdec9b05","isCorrect":false,"text":"43cm"}],"prompt":"71cm 막대와 38cm 막대의 길이 차는 얼마입니까?","skillCode":"compare-length-difference","weight":1},{"displayOrder":9,"explanation":"1m=100cm이므로 1m와 같은 길이는 100cm입니다.","id":"49d8e34c-c045-41f6-9a81-f2bada9cacfb","options":[{"displayOrder":1,"id":"1dceb6b9-df07-4f41-ac78-e4377122255f","isCorrect":false,"text":"10cm"},{"displayOrder":2,"id":"dfdc4248-d8f4-493d-a75a-ec2bb16fbe1b","isCorrect":false,"text":"50cm"},{"displayOrder":3,"id":"4139d235-75de-4641-b87f-f1acca572f52","isCorrect":true,"text":"100cm"},{"displayOrder":4,"id":"428e4c27-619c-4fbe-89c3-1089d2e413e5","isCorrect":false,"text":"1000cm"}],"prompt":"1m와 같은 길이는 어느 것입니까?","skillCode":"use-meter-centimeter-relation","weight":1},{"displayOrder":10,"explanation":"1m=100cm이므로 2m는 100cm가 2번인 200cm입니다.","id":"9ae687f3-e237-4cde-9230-4eb957271029","options":[{"displayOrder":1,"id":"e64b3fc1-9777-4e06-bc94-e1479c9d6235","isCorrect":false,"text":"20cm"},{"displayOrder":2,"id":"f91bc9a0-480e-4ed0-b8de-4be638642af9","isCorrect":false,"text":"102cm"},{"displayOrder":3,"id":"cbd483dd-42a3-4c2b-a8b0-628140056f6a","isCorrect":false,"text":"2000cm"},{"displayOrder":4,"id":"0e5bb903-0cf1-44ba-b6e9-93c281002430","isCorrect":true,"text":"200cm"}],"prompt":"2m와 같은 길이를 cm로 나타낸 것은?","skillCode":"use-meter-centimeter-relation","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"21bd2f11-e69b-44eb-9ea7-bdf0ffa53e58","questions":[{"displayOrder":1,"explanation":"47cm-18cm=29cm이므로 빈칸은 29cm입니다.","id":"831e9fe3-b631-41b9-9fa6-dacd39d68455","options":[{"displayOrder":1,"id":"30f12e35-0af4-46b2-94de-8a18047c427c","isCorrect":true,"text":"29cm"},{"displayOrder":2,"id":"d9b4d377-a89c-4c37-b259-3092082fe05e","isCorrect":false,"text":"30cm"},{"displayOrder":3,"id":"85eb9c7b-eb1d-4175-9e08-d1bf99c5ff98","isCorrect":false,"text":"28cm"},{"displayOrder":4,"id":"1813006b-9f6b-4dd2-a483-c6428b605536","isCorrect":false,"text":"39cm"}],"prompt":"18cm+□=47cm입니다. □에 알맞은 길이는?","skillCode":"infer-missing-length","weight":1},{"displayOrder":2,"explanation":"61cm-26cm=35cm이므로 빈칸은 35cm입니다.","id":"d17edf5c-1dac-4b8b-824b-580f4f21676b","options":[{"displayOrder":1,"id":"66adcfe0-8575-491a-af7e-95758572b450","isCorrect":false,"text":"36cm"},{"displayOrder":2,"id":"93352401-3b36-4c7f-ac02-9552b19bcaba","isCorrect":true,"text":"35cm"},{"displayOrder":3,"id":"afd30cb3-a4f1-4998-aa14-4da014422515","isCorrect":false,"text":"34cm"},{"displayOrder":4,"id":"166003b3-0e85-4fc1-9753-56266eaf75f5","isCorrect":false,"text":"45cm"}],"prompt":"26cm+□=61cm입니다. □에 알맞은 길이는?","skillCode":"infer-missing-length","weight":1},{"displayOrder":3,"explanation":"79cm-35cm=44cm이므로 빈칸은 44cm입니다.","id":"aefc65ac-3c30-405b-a16f-bd0e48748cec","options":[{"displayOrder":1,"id":"e5de0f65-0c00-413a-9a5e-f4d37f1f2b64","isCorrect":false,"text":"45cm"},{"displayOrder":2,"id":"a846a481-16d0-4a6a-a0c3-6504330bcd3d","isCorrect":false,"text":"43cm"},{"displayOrder":3,"id":"781c1c16-1423-4408-9675-bcd8601cdf77","isCorrect":true,"text":"44cm"},{"displayOrder":4,"id":"0a8e4265-bedc-4654-a4eb-533cae7ea941","isCorrect":false,"text":"54cm"}],"prompt":"35cm+□=79cm입니다. □에 알맞은 길이는?","skillCode":"infer-missing-length","weight":1},{"displayOrder":4,"explanation":"90cm-42cm=48cm이므로 빈칸은 48cm입니다.","id":"0d470f74-378d-4a74-a854-77e98592fe0d","options":[{"displayOrder":1,"id":"9ba3d32f-39b9-48df-a35b-abf299dfb3d2","isCorrect":false,"text":"49cm"},{"displayOrder":2,"id":"4cca7c8d-acd2-46fd-a029-9c2b9bcda31d","isCorrect":false,"text":"47cm"},{"displayOrder":3,"id":"08283fb2-8188-4a5d-bee5-249a6ac002c4","isCorrect":false,"text":"58cm"},{"displayOrder":4,"id":"1cb2e6ef-e0a1-4849-afe2-f575a52e51d9","isCorrect":true,"text":"48cm"}],"prompt":"42cm+□=90cm입니다. □에 알맞은 길이는?","skillCode":"infer-missing-length","weight":1},{"displayOrder":5,"explanation":"74m-28m=46m이므로 빈칸은 46m입니다.","id":"7b6901cb-26dc-43e6-ba72-18412b7c1a5f","options":[{"displayOrder":1,"id":"31113979-5219-4118-995a-1f5411416d4b","isCorrect":true,"text":"46m"},{"displayOrder":2,"id":"445cd232-7048-46e9-bba7-5ac4f2a373f9","isCorrect":false,"text":"47m"},{"displayOrder":3,"id":"bfc4aafc-411b-432f-b995-9191d57fb864","isCorrect":false,"text":"45m"},{"displayOrder":4,"id":"7f75f124-84d9-4073-ae93-8e1d9ab42233","isCorrect":false,"text":"56m"}],"prompt":"74m-□=28m입니다. □에 알맞은 길이는?","skillCode":"infer-missing-length","weight":1},{"displayOrder":6,"explanation":"83m-36m=47m이므로 빈칸은 47m입니다.","id":"37c4c368-56b5-4582-bd5c-0ad20f987688","options":[{"displayOrder":1,"id":"b8fb588e-86a2-4b68-81ab-b97d89ac933e","isCorrect":false,"text":"48m"},{"displayOrder":2,"id":"7ef4b2da-4774-4783-b846-cb9b1442c2d7","isCorrect":true,"text":"47m"},{"displayOrder":3,"id":"34b92583-2929-4601-b6b1-12cde203dbb5","isCorrect":false,"text":"46m"},{"displayOrder":4,"id":"378b5df7-609a-480b-b285-f90c64dc81a8","isCorrect":false,"text":"57m"}],"prompt":"83m-□=36m입니다. □에 알맞은 길이는?","skillCode":"infer-missing-length","weight":1},{"displayOrder":7,"explanation":"65m-19m=46m이므로 빈칸은 46m입니다.","id":"51be594b-38a3-4a71-9913-6ea742578ffe","options":[{"displayOrder":1,"id":"24bccb1a-4772-4de2-a932-15e0c094c7d1","isCorrect":true,"text":"46m"},{"displayOrder":2,"id":"7c96fcff-8d46-4741-bc32-31e93b59decb","isCorrect":false,"text":"47m"},{"displayOrder":3,"id":"7424585c-4a45-48dc-aa09-90c559cc089e","isCorrect":false,"text":"45m"},{"displayOrder":4,"id":"3279d5f5-0626-4434-8cae-deee9d91390f","isCorrect":false,"text":"56m"}],"prompt":"65m-□=19m입니다. □에 알맞은 길이는?","skillCode":"infer-missing-length","weight":1},{"displayOrder":8,"explanation":"32+18=50이고 50-15=35이므로 35cm가 남습니다.","id":"319f8aae-607a-4d39-97d5-c8a49fad7120","options":[{"displayOrder":1,"id":"1bd43545-b1f1-4b00-b6f4-d0d7f2afd4b7","isCorrect":false,"text":"36cm"},{"displayOrder":2,"id":"03948c9c-42cb-43dd-9512-78f23ee97976","isCorrect":true,"text":"35cm"},{"displayOrder":3,"id":"8fe5c66e-dbb0-4a10-8d54-0ff90a8fc95b","isCorrect":false,"text":"34cm"},{"displayOrder":4,"id":"16e10c39-b8a1-4ec2-a66c-25d88929cd15","isCorrect":false,"text":"45cm"}],"prompt":"32cm와 18cm를 이은 뒤 15cm를 잘랐습니다. 남은 길이는?","skillCode":"solve-remaining-length","weight":1},{"displayOrder":9,"explanation":"27+24=51이고 51-19=32이므로 32cm가 남습니다.","id":"f0f5fa81-40c5-4103-8ef7-85eaaf39746f","options":[{"displayOrder":1,"id":"e054effd-23c2-458a-9cf9-a083820d77f2","isCorrect":false,"text":"33cm"},{"displayOrder":2,"id":"2cfd7278-8d14-43f2-9b38-c5645153dd57","isCorrect":false,"text":"31cm"},{"displayOrder":3,"id":"cb99f147-07db-4cee-86a3-aaf3733201f2","isCorrect":true,"text":"32cm"},{"displayOrder":4,"id":"64b5feea-80fb-4de0-a164-441cd4c438b0","isCorrect":false,"text":"42cm"}],"prompt":"27cm와 24cm를 이은 뒤 19cm를 잘랐습니다. 남은 길이는?","skillCode":"solve-remaining-length","weight":1},{"displayOrder":10,"explanation":"45+16=61이고 61-22=39이므로 39cm가 남습니다.","id":"a7ac8bee-93e2-48c1-9eb1-f1918e2f8009","options":[{"displayOrder":1,"id":"401b86e3-4f3b-4827-aa65-50c093980ad5","isCorrect":false,"text":"40cm"},{"displayOrder":2,"id":"cec1ef17-e9fb-4cc9-9972-0364953679a3","isCorrect":false,"text":"38cm"},{"displayOrder":3,"id":"ad3faec2-7916-4ec5-830b-2ace3aea0d44","isCorrect":false,"text":"49cm"},{"displayOrder":4,"id":"86c5ef65-758f-4ff7-ab14-5e4f1bf654ff","isCorrect":true,"text":"39cm"}],"prompt":"45cm와 16cm를 이은 뒤 22cm를 잘랐습니다. 남은 길이는?","skillCode":"solve-remaining-length","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"da4dcc57-0bcb-4493-90af-d77c7ecb41c0","questions":[{"displayOrder":1,"explanation":"35+24=59이므로 69cm가 아니라 59cm입니다.","id":"f31dc8f6-9365-4f77-b1e7-6a2d067b3a5a","options":[{"displayOrder":1,"id":"69b8404d-5c58-4642-8c98-2dc83fc5f786","isCorrect":true,"text":"35cm+24cm=59cm"},{"displayOrder":2,"id":"1a84128a-6b35-446f-828a-7cd65f7d5fd9","isCorrect":false,"text":"35cm+24cm=49cm"},{"displayOrder":3,"id":"dc428217-0332-4342-8c11-1f60fd774491","isCorrect":false,"text":"35cm-24cm=59cm"},{"displayOrder":4,"id":"cfdc8a3f-ba9d-41fd-8fad-5f537865191a","isCorrect":false,"text":"35m+24m=59cm"}],"prompt":"35cm+24cm=69cm라고 했습니다. 바르게 고친 것은?","skillCode":"correct-length-calculation-reasoning","weight":1},{"displayOrder":2,"explanation":"80-27=53이므로 남은 길이는 53cm입니다.","id":"302ee39a-efea-440c-b267-4ef22405d27e","options":[{"displayOrder":1,"id":"46cae952-d3f6-4394-aa6f-299dc66df7c6","isCorrect":false,"text":"80cm-27cm=63cm"},{"displayOrder":2,"id":"d229f7c8-b7b6-48ac-9f4f-a9ea64bd8517","isCorrect":true,"text":"80cm-27cm=53cm"},{"displayOrder":3,"id":"343d33b0-a3c3-432c-aef7-bc6ea11c09bf","isCorrect":false,"text":"80cm+27cm=53cm"},{"displayOrder":4,"id":"de1e3e0a-f805-4885-90df-cadd21451026","isCorrect":false,"text":"80m-27m=53cm"}],"prompt":"80cm에서 27cm를 빼면 63cm라고 했습니다. 바른 계산은?","skillCode":"correct-length-calculation-reasoning","weight":1},{"displayOrder":3,"explanation":"두 길이의 차는 긴 길이에서 짧은 길이를 빼므로 42-29=13cm입니다.","id":"9ca3cda7-8f14-434f-b646-e8046fa5cf74","options":[{"displayOrder":1,"id":"c63ba1bd-74f4-4836-91c5-4af2a1c9042d","isCorrect":false,"text":"42cm+29cm=71cm"},{"displayOrder":2,"id":"cb45ab65-9521-4a22-ad88-51983f3c9633","isCorrect":false,"text":"29cm-42cm=13cm"},{"displayOrder":3,"id":"5cea680a-b8f3-4541-8a10-dffcf59c4282","isCorrect":true,"text":"42cm-29cm=13cm"},{"displayOrder":4,"id":"d4dd179a-a05c-4d81-b0cc-813c5216ae42","isCorrect":false,"text":"42m-29m=13cm"}],"prompt":"길이가 42cm와 29cm일 때 차를 구하는 식은?","skillCode":"compare-length-difference","weight":1},{"displayOrder":4,"explanation":"1m가 100cm이므로 3m는 100cm가 3번인 300cm입니다.","id":"2ad85603-219b-4721-87cb-125f9d9be08b","options":[{"displayOrder":1,"id":"0cbcc71a-0d00-49e0-bb4c-b573544387aa","isCorrect":false,"text":"3m는 30cm입니다."},{"displayOrder":2,"id":"97a0b6d5-ee2f-401f-96e1-6c3dcb12729a","isCorrect":false,"text":"100m는 1cm입니다."},{"displayOrder":3,"id":"4caefd94-8a87-4072-a311-951737909af5","isCorrect":false,"text":"1m는 10cm입니다."},{"displayOrder":4,"id":"587063d2-1edd-40b7-8c5a-cd8cc26fc773","isCorrect":true,"text":"3m는 300cm입니다."}],"prompt":"1m=100cm를 바르게 사용한 설명은?","skillCode":"use-meter-centimeter-relation","weight":1},{"displayOrder":5,"explanation":"전체 길이는 두 길이를 더해 18+30=48cm입니다.","id":"134aff17-cca2-432d-bfef-baa365bbb2ce","options":[{"displayOrder":1,"id":"e6de3aa4-9fb0-443a-a8c9-1b43c815b1de","isCorrect":false,"text":"30cm-18cm=12cm"},{"displayOrder":2,"id":"3d113e9a-b6f0-4ebd-ad00-58fc59cf41ba","isCorrect":false,"text":"18m+30m=48cm"},{"displayOrder":3,"id":"54ffc497-5fc0-4fe8-81d9-81546d6ec521","isCorrect":true,"text":"18cm+30cm=48cm"},{"displayOrder":4,"id":"c0e5f7d6-841b-4ab0-a133-6d38637fee27","isCorrect":false,"text":"18cm+30cm=38cm"}],"prompt":"연필 18cm와 자 30cm를 이어 놓았습니다. 전체 길이와 식이 모두 맞는 것은?","skillCode":"solve-total-length","weight":1},{"displayOrder":6,"explanation":"전체 90cm에서 사용한 34cm를 빼면 56cm가 남습니다.","id":"bd44d0ba-0810-4046-a129-33025e3ddab7","options":[{"displayOrder":1,"id":"3f9818bf-d92e-4393-b109-97df60d6a5ff","isCorrect":false,"text":"90+34=124이므로 124cm 남습니다."},{"displayOrder":2,"id":"5fc18963-1bdb-43aa-b398-3c05a9b11cba","isCorrect":false,"text":"90-34=66이므로 66cm 남습니다."},{"displayOrder":3,"id":"c5bee9e5-fc6a-4b4b-b71e-360cd6566849","isCorrect":false,"text":"34-90=56이므로 56m 남습니다."},{"displayOrder":4,"id":"5847a5c8-97d9-41e4-ad14-d8fde3f6fb1a","isCorrect":true,"text":"90-34=56이므로 56cm 남습니다."}],"prompt":"끈 90cm 중 34cm를 썼습니다. 알맞은 풀이 설명은?","skillCode":"solve-remaining-length","weight":1},{"displayOrder":7,"explanation":"전체 73cm에서 알려진 28cm를 빼면 45cm이므로 빈칸은 45cm입니다.","id":"44e6c159-8b94-4b5c-bdb6-c9730f619f05","options":[{"displayOrder":1,"id":"26e1664c-54d3-4f75-9070-7cf76663c1a1","isCorrect":true,"text":"45cm이며 73-28=45입니다."},{"displayOrder":2,"id":"3a39dd2b-13a2-4bd5-859d-8db91c7aa749","isCorrect":false,"text":"101cm이며 73+28=101입니다."},{"displayOrder":3,"id":"c1f2fae9-ca89-4928-b250-c91396830504","isCorrect":false,"text":"55cm이며 73-28=55입니다."},{"displayOrder":4,"id":"374895e4-56cd-43b5-908a-de92a3d785b1","isCorrect":false,"text":"45m이며 28+45=73cm입니다."}],"prompt":"□cm+28cm=73cm의 빈칸과 까닭이 맞는 것은?","skillCode":"infer-missing-length","weight":1},{"displayOrder":8,"explanation":"24cm와 15cm는 같은 단위이고 24+15=39이므로 39cm입니다.","id":"b8dca457-53fa-4a96-8e9d-fa23e0d17276","options":[{"displayOrder":1,"id":"047bd322-1142-41ac-8fca-832d44317ab8","isCorrect":false,"text":"24cm+15m=39cm"},{"displayOrder":2,"id":"bfb1bf76-a1eb-4d2c-a80b-7f509e6fe464","isCorrect":true,"text":"24cm+15cm=39cm"},{"displayOrder":3,"id":"5323348b-1fb8-4aed-987b-8fed3cb83f08","isCorrect":false,"text":"24m-15cm=9m"},{"displayOrder":4,"id":"59719cd6-c401-47c4-a0ab-01d5ff0b5de5","isCorrect":false,"text":"1m+20cm=21cm"}],"prompt":"다음 중 단위를 같게 사용한 계산은?","skillCode":"correct-length-calculation-reasoning","weight":1},{"displayOrder":9,"explanation":"차이는 두 길이를 더하지 않고 긴 길이에서 짧은 길이를 빼므로 18m입니다.","id":"aa99e9a4-5770-46f0-9318-61b519f4ab5a","options":[{"displayOrder":1,"id":"afe690fd-d247-442c-a4a8-5ba92642cde3","isCorrect":false,"text":"차는 56+38=94m가 맞습니다."},{"displayOrder":2,"id":"7987b932-a230-4e72-a0ed-78062408417d","isCorrect":false,"text":"38-56=18cm입니다."},{"displayOrder":3,"id":"295deb30-ed15-4b32-a540-27d5229af770","isCorrect":true,"text":"차는 더하지 않고 56-38=18m입니다."},{"displayOrder":4,"id":"874b0c42-f75c-4161-8ec4-ca452b08dbc1","isCorrect":false,"text":"56-38=28m입니다."}],"prompt":"56m 길과 38m 길의 차를 94m라고 했습니다. 오류를 바르게 설명한 것은?","skillCode":"correct-length-calculation-reasoning","weight":1},{"displayOrder":10,"explanation":"빈칸은 60-25=35cm이고 여기서 12cm를 빼면 23cm가 남습니다.","id":"46b976f7-33e5-432e-a834-f8053dc59ba5","options":[{"displayOrder":1,"id":"bc43fc9b-8b49-42f4-b56c-f20694a7e90b","isCorrect":false,"text":"35cm"},{"displayOrder":2,"id":"e95736aa-2401-4a6f-a34f-ebe071737f5f","isCorrect":false,"text":"47cm"},{"displayOrder":3,"id":"80777a7e-04a7-4bee-bbea-fe291da67d58","isCorrect":false,"text":"13cm"},{"displayOrder":4,"id":"594f4679-3c20-40aa-9e54-b6c3ec7fb11f","isCorrect":true,"text":"23cm"}],"prompt":"25cm+□=60cm이고 □에서 12cm를 잘랐습니다. 마지막에 남는 길이는?","skillCode":"infer-missing-length","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":9,"id":"c4e0df8c-c000-4ff2-aaeb-cfdb13e12746","slug":"grade2-length-calculation","title":"길이를 계산해요"},"version":{"id":"8b54116b-288c-496e-aeb3-5f0dc98b506b","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid
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
  where stage.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_length_calculation_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_length_calculation_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 10

  union all
  select 3, 'grade2_length_calculation_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '185500956383d1a4477d681cf0cc0a1ac06b75ed1060a0fa580fff92bd7262ab'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_length_calculation_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_length_calculation_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_length_calculation_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_length_calculation_v1_structure_and_orders',
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
    where stage.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_length_calculation_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_length_calculation_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid))

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
  where metadata.unit_id = 'c4e0df8c-c000-4ff2-aaeb-cfdb13e12746'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 9

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = 'c4e0df8c-c000-4ff2-aaeb-cfdb13e12746'::uuid
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
  where metadata.unit_id = 'c4e0df8c-c000-4ff2-aaeb-cfdb13e12746'::uuid

  union all
  select 23, 'grade2_length_calculation_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_length_calculation_v1_pass_threshold_contract',
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
  select 25, 'grade2_length_calculation_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_length_calculation_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '8b54116b-288c-496e-aeb3-5f0dc98b506b'::uuid

  union all
  select 27, 'grade2_length_calculation_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_length_calculation_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_length_calculation_v1_question_skills_exact',
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
select 999, 'grade2_length_calculation_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
