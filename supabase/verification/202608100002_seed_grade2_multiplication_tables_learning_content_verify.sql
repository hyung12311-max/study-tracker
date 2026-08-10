-- Phase 2B grade2-multiplication-tables v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":8,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"fcfdae70-f84c-47c4-8558-cde9ac381187","questions":[{"displayOrder":1,"explanation":"2를 3번 더하면 2+2+2=6이므로 2×3=6입니다.","id":"6d061a04-a11d-4e96-a95f-fe99bdbce39d","options":[{"displayOrder":1,"id":"1407bbc5-dc20-43c2-b0b7-d9ffa53928b6","isCorrect":true,"text":"6"},{"displayOrder":2,"id":"7bc33228-2c5f-4b2b-ae27-f9bb92c4e758","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"58c757bf-ab3f-491d-938b-4fd49bcdcd4d","isCorrect":false,"text":"8"},{"displayOrder":4,"id":"8f040604-849d-444b-beee-9c4f55d1e205","isCorrect":false,"text":"9"}],"prompt":"2×3의 값은 얼마입니까?","skillCode":"multiply-by-2","weight":1},{"displayOrder":2,"explanation":"5를 4번 더하면 5+5+5+5=20이므로 5×4=20입니다.","id":"a43e3789-7db5-4c9d-bc8d-16d4b9df3d4c","options":[{"displayOrder":1,"id":"b5658913-3fe4-4aeb-b229-30e8ea566392","isCorrect":false,"text":"25"},{"displayOrder":2,"id":"dbb02d73-be77-4a7f-a23a-309d121f6146","isCorrect":true,"text":"20"},{"displayOrder":3,"id":"897834ed-547c-45bd-ae6b-6d6e657f36b5","isCorrect":false,"text":"15"},{"displayOrder":4,"id":"351e99e1-6360-41ae-bae0-f1f121179028","isCorrect":false,"text":"9"}],"prompt":"5×4의 값은 얼마입니까?","skillCode":"multiply-by-5","weight":1},{"displayOrder":3,"explanation":"2씩 7묶음은 2를 7번 더한 14이므로 2×7=14입니다.","id":"f3eafca7-b748-47d3-a44f-483a1f88fcc9","options":[{"displayOrder":1,"id":"6c02621d-d7e5-4af9-a486-dba7b0ae48eb","isCorrect":false,"text":"12"},{"displayOrder":2,"id":"3f693cff-4e77-4971-bcf1-992990503565","isCorrect":false,"text":"16"},{"displayOrder":3,"id":"9c8a32ed-1926-4432-b316-c7b600c21578","isCorrect":true,"text":"14"},{"displayOrder":4,"id":"3391c7a4-2456-49ea-a02b-ccdba012deb0","isCorrect":false,"text":"9"}],"prompt":"2×7의 알맞은 곱은?","skillCode":"multiply-by-2","weight":1},{"displayOrder":4,"explanation":"5씩 6묶음은 30이므로 5×6=30입니다.","id":"1a299e0f-4d64-493f-bf06-8b2fe831ba52","options":[{"displayOrder":1,"id":"6d50364c-aa40-4498-b5d0-0a7035f17271","isCorrect":false,"text":"25"},{"displayOrder":2,"id":"55d9b8b5-1176-4dfd-a33d-65ef4e76c104","isCorrect":false,"text":"35"},{"displayOrder":3,"id":"c08e411f-53fe-494f-8bcd-97c7d1984c9a","isCorrect":false,"text":"11"},{"displayOrder":4,"id":"1db76670-4367-4aa2-9989-fa02736d8dbe","isCorrect":true,"text":"30"}],"prompt":"5×6을 바르게 계산한 것은?","skillCode":"multiply-by-5","weight":1},{"displayOrder":5,"explanation":"묶음 수가 하나 늘면 2만큼 커지므로 2×5=10입니다.","id":"0ef3e74f-ad8c-4c63-9a4c-5340a6a6ba66","options":[{"displayOrder":1,"id":"29d47eb0-a858-4501-837c-b162e8f7d927","isCorrect":true,"text":"2×5=10"},{"displayOrder":2,"id":"1d927c67-c034-46af-b60a-8ae9166ee770","isCorrect":false,"text":"2×5=8"},{"displayOrder":3,"id":"9a0d64ae-6511-4d53-9d84-884237ccd50a","isCorrect":false,"text":"2×6=10"},{"displayOrder":4,"id":"101c2afa-df93-4f50-86dc-441f1d08b78f","isCorrect":false,"text":"2×4=10"}],"prompt":"2×4=8 다음에 이어지는 2단 식은?","skillCode":"identify-multiplication-table-pattern","weight":1},{"displayOrder":6,"explanation":"5를 8번 더한 값은 40이므로 5×8=40입니다.","id":"f60d6ca8-de60-4d66-8b1b-5815ff277f00","options":[{"displayOrder":1,"id":"5a8c9d57-6694-4513-bd94-e7c710ae18ad","isCorrect":false,"text":"35"},{"displayOrder":2,"id":"bec09180-5a9a-4766-85e9-deb08add427f","isCorrect":true,"text":"40"},{"displayOrder":3,"id":"cc840754-1ba6-4eb2-99bb-f13645dd8974","isCorrect":false,"text":"45"},{"displayOrder":4,"id":"a4a1605a-2c75-42c7-a120-37212a884098","isCorrect":false,"text":"13"}],"prompt":"5×8의 값은 얼마입니까?","skillCode":"multiply-by-5","weight":1},{"displayOrder":7,"explanation":"2씩 9묶음은 18이므로 2×9=18입니다.","id":"715abbba-ef59-4bcf-8128-48a6a6c31748","options":[{"displayOrder":1,"id":"2d8aff86-90ea-4755-884e-9be6e9e43fd8","isCorrect":false,"text":"16"},{"displayOrder":2,"id":"18bcd40f-a75e-4354-81a4-b21342f7d958","isCorrect":false,"text":"20"},{"displayOrder":3,"id":"7185bd93-0a58-4135-a6de-95c6d7fd749d","isCorrect":true,"text":"18"},{"displayOrder":4,"id":"9fb7d786-dced-4994-abeb-79968b51425a","isCorrect":false,"text":"11"}],"prompt":"2×9의 계산 결과는?","skillCode":"multiply-by-2","weight":1},{"displayOrder":8,"explanation":"5씩 7묶음은 35이므로 5×7=35입니다.","id":"f43290fa-da02-46df-bbd7-f350d7ff5478","options":[{"displayOrder":1,"id":"ccc8ce48-3d09-4d2c-82dd-1209457815ba","isCorrect":false,"text":"30"},{"displayOrder":2,"id":"2d09e07c-10f4-4490-85fe-8d42eff20fc9","isCorrect":false,"text":"40"},{"displayOrder":3,"id":"1d12a5c4-8a35-4b20-ac3d-682aee9b7467","isCorrect":false,"text":"12"},{"displayOrder":4,"id":"9c8fdffc-a73a-4f7a-9c52-1f303eaedcf2","isCorrect":true,"text":"35"}],"prompt":"5×7에 알맞은 값은?","skillCode":"multiply-by-5","weight":1},{"displayOrder":9,"explanation":"2를 6번 더하면 12이므로 2×6=12입니다.","id":"6c10010d-ba70-47fa-b8de-161481d400a7","options":[{"displayOrder":1,"id":"a563b845-2566-4d8b-9b92-337d5e893040","isCorrect":true,"text":"12"},{"displayOrder":2,"id":"19cfb0c4-17fe-4d21-b182-8aa843cf5a94","isCorrect":false,"text":"10"},{"displayOrder":3,"id":"7937b64e-677f-4581-aafd-9cd881e3610e","isCorrect":false,"text":"14"},{"displayOrder":4,"id":"edaf3b62-aed5-4014-961a-e291dbb6d64e","isCorrect":false,"text":"8"}],"prompt":"2×6을 바르게 계산한 것은?","skillCode":"multiply-by-2","weight":1},{"displayOrder":10,"explanation":"5를 9번 더한 값은 45이므로 5×9=45입니다.","id":"0ac2fb54-0b88-49ad-8e72-e6bf479faa91","options":[{"displayOrder":1,"id":"8bd3536a-ec34-482f-acf1-944687243b32","isCorrect":false,"text":"40"},{"displayOrder":2,"id":"dfa25a61-c49d-4b9c-b1d1-6e94de23f05b","isCorrect":true,"text":"45"},{"displayOrder":3,"id":"6a296cf4-16b0-4ae5-a84b-d98fb2e926b5","isCorrect":false,"text":"50"},{"displayOrder":4,"id":"20db72f3-58a2-4b7b-b8ca-c851ce666ff7","isCorrect":false,"text":"14"}],"prompt":"5×9의 값은 얼마입니까?","skillCode":"multiply-by-5","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"e79a7bb8-879e-42c0-865e-f14278841162","questions":[{"displayOrder":1,"explanation":"3을 4번 더하면 3+3+3+3=12이므로 3×4=12입니다.","id":"0ddd41c0-5946-436f-a09e-2ce3de79dec0","options":[{"displayOrder":1,"id":"79ff2a2e-8d60-4509-94f2-7a7e191b7f73","isCorrect":true,"text":"12"},{"displayOrder":2,"id":"88ee5224-dda3-4e5d-acf5-831c4b7c2b69","isCorrect":false,"text":"9"},{"displayOrder":3,"id":"1ba7a1e2-e518-43b6-bf70-4a5c846d78cd","isCorrect":false,"text":"16"},{"displayOrder":4,"id":"a102d383-2200-4226-9f97-bcebd20dc75d","isCorrect":false,"text":"7"}],"prompt":"3×4의 값은 얼마입니까?","skillCode":"multiply-by-3","weight":1},{"displayOrder":2,"explanation":"4씩 6묶음은 24이므로 4×6=24입니다.","id":"d13f6fe4-bacd-4542-a354-a032a54a4bea","options":[{"displayOrder":1,"id":"85f6d044-9e37-4c6b-9916-badd9931f4a3","isCorrect":false,"text":"20"},{"displayOrder":2,"id":"a3a62147-960a-48bd-a553-6302c90a3c75","isCorrect":true,"text":"24"},{"displayOrder":3,"id":"23a1cc9c-898c-4c70-9ffc-ba62ce5a862f","isCorrect":false,"text":"28"},{"displayOrder":4,"id":"8d0d4741-bea8-4048-bef5-67f47a53825e","isCorrect":false,"text":"10"}],"prompt":"4×6을 바르게 계산한 것은?","skillCode":"multiply-by-4","weight":1},{"displayOrder":3,"explanation":"3×7=21이므로 빈칸에는 7이 들어갑니다.","id":"e9735267-4bc5-4dcc-92e1-d75c7182502d","options":[{"displayOrder":1,"id":"1dcce90e-9958-4893-9294-4f007771533b","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"f758d8f9-47ed-4540-8ae6-d10806efa37c","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"ac88c2cd-1405-4461-9d28-1f9598a7c940","isCorrect":true,"text":"7"},{"displayOrder":4,"id":"8d660e1b-e2ec-4aa7-acc9-8e1dbd944bd6","isCorrect":false,"text":"9"}],"prompt":"3×□=21에서 □에 알맞은 수는?","skillCode":"infer-missing-multiplication-factor","weight":1},{"displayOrder":4,"explanation":"4×5=20이고 3×6=18이므로 4×5가 더 큽니다.","id":"d909587c-6dac-43f2-82bf-f6170f4786ac","options":[{"displayOrder":1,"id":"07f3f927-31fb-4f15-9e00-af52eb0c1155","isCorrect":false,"text":"4×5<3×6"},{"displayOrder":2,"id":"a4589ab1-110e-49df-b864-e24d9b456a56","isCorrect":false,"text":"4×5=3×6"},{"displayOrder":3,"id":"7dc11932-9b62-41e3-8001-ad8a8cb53e56","isCorrect":false,"text":"20<18"},{"displayOrder":4,"id":"2ce30dd1-737c-4d41-978f-9d7b9a10a95c","isCorrect":true,"text":"4×5>3×6"}],"prompt":"4×5와 3×6의 크기를 바르게 비교한 것은?","skillCode":"compare-multiplication-products","weight":1},{"displayOrder":5,"explanation":"한 묶음의 수 3을 앞에 쓰고 사람 수 8을 뒤에 써서 3×8=24입니다.","id":"3bf4f190-03f0-4a11-a94d-0926a2ac4773","options":[{"displayOrder":1,"id":"d1cb67bb-90b6-4be7-86ba-e823be62e0da","isCorrect":true,"text":"3×8=24"},{"displayOrder":2,"id":"e9af1b69-aae5-438a-84a6-2197988a6ed1","isCorrect":false,"text":"8×3=24"},{"displayOrder":3,"id":"859aa9a9-3cd7-40c7-9d1e-899d24317cfd","isCorrect":false,"text":"3+8=11"},{"displayOrder":4,"id":"812c297b-ead3-4d26-99db-9a38edf4c448","isCorrect":false,"text":"3×7=21"}],"prompt":"연필을 한 사람에게 3자루씩 8명에게 줍니다. 필요한 연필 수를 구하는 식과 답은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":6,"explanation":"4×7은 한 묶음에 4개씩 7묶음이므로 바구니 7개에 사과가 4개씩 있는 상황입니다.","id":"cdf30c28-d61a-4203-b954-b102c6014b54","options":[{"displayOrder":1,"id":"bc0354ac-5a2a-41e0-aee2-48972418edcd","isCorrect":false,"text":"바구니 4개에 사과가 7개씩 있음"},{"displayOrder":2,"id":"b086031b-3bc8-409d-b361-12f0d99d400c","isCorrect":true,"text":"바구니 7개에 사과가 4개씩 있음"},{"displayOrder":3,"id":"cdf3e726-6465-4137-965c-6a337fc04545","isCorrect":false,"text":"사과 4개와 7개를 더함"},{"displayOrder":4,"id":"a7d36d38-0d0a-4843-b863-70eebd1354eb","isCorrect":false,"text":"바구니마다 사과 수가 다름"}],"prompt":"4×7에 알맞은 상황은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":7,"explanation":"묶음 수가 5에서 6으로 하나 늘면 곱은 3만큼 커져 3×6=18입니다.","id":"92068d41-150b-4585-8316-990e53db6602","options":[{"displayOrder":1,"id":"571474e8-4297-42a9-bea7-f0fbf1921de7","isCorrect":false,"text":"3×4=12"},{"displayOrder":2,"id":"922a8431-f57c-4e28-bf97-97a054fc4b14","isCorrect":false,"text":"3×5=18"},{"displayOrder":3,"id":"81a3079f-1333-4eaa-9a9a-4605aff9b0e9","isCorrect":true,"text":"3×6=18"},{"displayOrder":4,"id":"f9aab803-f204-4024-b70a-7b1cb33315db","isCorrect":false,"text":"3×6=15"}],"prompt":"3×5=15에서 묶음 수가 하나 늘어난 식은?","skillCode":"identify-multiplication-table-pattern","weight":1},{"displayOrder":8,"explanation":"4×8=32이므로 빈칸에는 8이 들어갑니다.","id":"56d024fb-d0c4-4cc9-8260-1ff74f61f253","options":[{"displayOrder":1,"id":"5240b40b-b557-48fa-a91c-c6ea8c580c24","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"b1d1151e-292f-4797-aade-b59ca37281ca","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"43ef8e4d-06da-4097-99dc-95494c0b6926","isCorrect":false,"text":"9"},{"displayOrder":4,"id":"dc588377-cc15-4b28-a592-8167a41fcd57","isCorrect":true,"text":"8"}],"prompt":"4×□=32에서 □에 알맞은 수는?","skillCode":"infer-missing-multiplication-factor","weight":1},{"displayOrder":9,"explanation":"3을 9번 더한 값은 27이므로 3×9=27입니다.","id":"a120b3af-fb9f-4cd2-8ae9-aba68ec14297","options":[{"displayOrder":1,"id":"cfa2a9db-fa89-4d78-82ec-2cef07add6f7","isCorrect":false,"text":"24"},{"displayOrder":2,"id":"fe9a4f7a-c2be-4f59-b69b-1788a5aee2a6","isCorrect":false,"text":"30"},{"displayOrder":3,"id":"a976df5b-ca0e-4ecf-a0bd-635750e1ed84","isCorrect":true,"text":"27"},{"displayOrder":4,"id":"aebf718a-e94e-41ca-a2d9-c78a89d8f271","isCorrect":false,"text":"12"}],"prompt":"3×9의 값은 얼마입니까?","skillCode":"multiply-by-3","weight":1},{"displayOrder":10,"explanation":"한 상자의 4장이 한 묶음이고 상자가 9개이므로 4×9=36장입니다.","id":"12989413-5f95-4e0c-90d8-4335ca3718bb","options":[{"displayOrder":1,"id":"d1636a82-823c-4b4c-bad7-7d08b8afd053","isCorrect":false,"text":"13장"},{"displayOrder":2,"id":"a47e3097-6f83-4473-af6e-6ee86650a5e0","isCorrect":false,"text":"32장"},{"displayOrder":3,"id":"648a97ac-169d-4768-9e2e-45b14b54706c","isCorrect":false,"text":"40장"},{"displayOrder":4,"id":"247f272b-ec18-449c-b829-e85721980d94","isCorrect":true,"text":"36장"}],"prompt":"상자마다 스티커가 4장씩 있고 상자가 9개입니다. 스티커는 모두 몇 장입니까?","skillCode":"model-multiplication-situation","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"fe288080-9edb-4420-9faa-27e90f3fcb77","questions":[{"displayOrder":1,"explanation":"6씩 7묶음은 42이므로 6×7=42입니다.","id":"78ce78d9-6d15-4968-84ba-fe091871ce57","options":[{"displayOrder":1,"id":"fdbe9ecf-3f3c-415b-8222-c06282394f80","isCorrect":true,"text":"42"},{"displayOrder":2,"id":"4da6ed81-956c-4dd9-a7a6-ffaf33f520a9","isCorrect":false,"text":"36"},{"displayOrder":3,"id":"b17bce55-682d-4768-a4eb-474e8a209b8d","isCorrect":false,"text":"48"},{"displayOrder":4,"id":"842fa855-8173-4891-9583-da3daec2176b","isCorrect":false,"text":"13"}],"prompt":"6×7의 값은 얼마입니까?","skillCode":"multiply-by-6","weight":1},{"displayOrder":2,"explanation":"7씩 8묶음은 56이므로 7×8=56입니다.","id":"4e6a0696-742f-4e40-96ac-fc394a4bd4ee","options":[{"displayOrder":1,"id":"b73eae01-b349-4c33-a21f-2bc685762f8b","isCorrect":false,"text":"49"},{"displayOrder":2,"id":"67511979-8101-4d24-b0fe-abf32e293840","isCorrect":true,"text":"56"},{"displayOrder":3,"id":"68c2f1a7-5bd2-4316-99ff-f32a916ff9d9","isCorrect":false,"text":"64"},{"displayOrder":4,"id":"ebfbb124-ab7c-4f19-90d9-e4262d395e49","isCorrect":false,"text":"15"}],"prompt":"7×8을 바르게 계산한 것은?","skillCode":"multiply-by-7","weight":1},{"displayOrder":3,"explanation":"8씩 9묶음은 72이므로 8×9=72입니다.","id":"aaa80252-6e8e-4f9e-a813-e2cd54541fc4","options":[{"displayOrder":1,"id":"d7fae798-c773-4408-97cb-8841c929e70b","isCorrect":false,"text":"64"},{"displayOrder":2,"id":"0e5d6272-7585-4936-aeac-05d6a69f44b1","isCorrect":false,"text":"81"},{"displayOrder":3,"id":"20ed8327-8537-40a8-be12-6889341b6b91","isCorrect":true,"text":"72"},{"displayOrder":4,"id":"a47cbf69-5685-417b-bfb9-573ab3487804","isCorrect":false,"text":"17"}],"prompt":"8×9의 계산 결과는?","skillCode":"multiply-by-8","weight":1},{"displayOrder":4,"explanation":"9를 6번 더한 값은 54이므로 9×6=54입니다.","id":"28f2774a-2163-443c-8258-679ed4af3311","options":[{"displayOrder":1,"id":"3fe6628a-bca7-4031-9cb9-7dcdcb908cf2","isCorrect":false,"text":"45"},{"displayOrder":2,"id":"efc45c61-f4e7-4ac0-923c-9d0e0f5733c1","isCorrect":false,"text":"63"},{"displayOrder":3,"id":"fa2ab5c2-c52f-42a2-92e8-a41c0aed9fc2","isCorrect":false,"text":"15"},{"displayOrder":4,"id":"ead1aa87-9b59-4705-aed4-05d6d544c5d8","isCorrect":true,"text":"54"}],"prompt":"9×6의 값은 얼마입니까?","skillCode":"multiply-by-9","weight":1},{"displayOrder":5,"explanation":"6×8=48이므로 빈칸에는 8이 들어갑니다.","id":"f9a03926-831d-43a7-bc6f-6c8a30198b4a","options":[{"displayOrder":1,"id":"00466354-749f-4bea-a79b-ff71854107e9","isCorrect":true,"text":"8"},{"displayOrder":2,"id":"871a0d57-f247-42b8-81fd-02d518a35136","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"d310fdad-e760-4a09-9cce-dbaf7f453c46","isCorrect":false,"text":"9"},{"displayOrder":4,"id":"d3d77f8d-2688-42f6-85cd-cca25122a545","isCorrect":false,"text":"6"}],"prompt":"6×□=48에서 □에 알맞은 수는?","skillCode":"infer-missing-multiplication-factor","weight":1},{"displayOrder":6,"explanation":"7×6=42이고 8×5=40이므로 7×6이 더 큽니다.","id":"2540bda6-e257-4638-a18c-daede68cb593","options":[{"displayOrder":1,"id":"b78cdfad-50a8-455e-b6f8-367a50c8d3b6","isCorrect":false,"text":"7×6<8×5"},{"displayOrder":2,"id":"c2bd71f9-7c3c-47c7-82f4-36b82ca7dca1","isCorrect":true,"text":"7×6>8×5"},{"displayOrder":3,"id":"00c53da7-e17a-45b5-adb7-2ea686951a8c","isCorrect":false,"text":"7×6=8×5"},{"displayOrder":4,"id":"d73ad3d1-c576-49e3-a1c7-74b63f39c2ba","isCorrect":false,"text":"42<40"}],"prompt":"7×6과 8×5의 크기를 바르게 비교한 것은?","skillCode":"compare-multiplication-products","weight":1},{"displayOrder":7,"explanation":"8×6=48이고 6×8=48이므로 두 식의 결과가 같습니다.","id":"eb695d4a-be93-4d13-af18-9ae866ffd5be","options":[{"displayOrder":1,"id":"69af8249-2732-441d-b667-3e83813bb232","isCorrect":false,"text":"7×6"},{"displayOrder":2,"id":"dde54f56-464a-484e-a9b5-d7b242bd99bf","isCorrect":false,"text":"8×5"},{"displayOrder":3,"id":"1c6bd2bf-c52f-4503-a50d-05a8ddfc2481","isCorrect":true,"text":"6×8"},{"displayOrder":4,"id":"8e88e01b-9876-4c2e-b6fd-b7af5841fd3e","isCorrect":false,"text":"9×6"}],"prompt":"8×6과 같은 결과를 만드는 식은?","skillCode":"reason-about-multiplication-facts","weight":1},{"displayOrder":8,"explanation":"9단에서 묶음 수가 하나 늘면 곱은 9만큼 커져 9×5=45가 됩니다.","id":"1bed5f23-1cbe-4a51-a9e1-0b6d9fc731c3","options":[{"displayOrder":1,"id":"963f7367-b26d-4c9d-ba7e-e2d435298972","isCorrect":false,"text":"4만큼 커져 40"},{"displayOrder":2,"id":"1d250c6d-c5e8-48ef-b5f7-306f70898bfc","isCorrect":false,"text":"9만큼 작아져 27"},{"displayOrder":3,"id":"d6aa0a62-572c-4173-8d8c-8a25130d1406","isCorrect":false,"text":"4만큼 작아져 32"},{"displayOrder":4,"id":"8171b5fe-1263-446a-994f-379c7e3f1279","isCorrect":true,"text":"9만큼 커져 45"}],"prompt":"9×4=36에서 묶음 수가 하나 늘면 곱은 어떻게 됩니까?","skillCode":"identify-multiplication-table-pattern","weight":1},{"displayOrder":9,"explanation":"7×9=63이고 나머지는 56 또는 54이므로 7×9의 결과가 가장 큽니다.","id":"51f243fd-04e5-49f3-8daa-28ff26c366c0","options":[{"displayOrder":1,"id":"08e09f19-9016-4572-84fb-e5008634f3ac","isCorrect":true,"text":"7×9"},{"displayOrder":2,"id":"f7d81e29-9b5d-4849-83ea-dbd9478c264b","isCorrect":false,"text":"8×7"},{"displayOrder":3,"id":"2a969b97-18b6-4089-afd3-5337251c85d7","isCorrect":false,"text":"6×9"},{"displayOrder":4,"id":"25561046-f32b-4da2-a2b2-ac437e16fc59","isCorrect":false,"text":"9×6"}],"prompt":"다음 곱셈식 중 결과가 가장 큰 것은?","skillCode":"compare-multiplication-products","weight":1},{"displayOrder":10,"explanation":"9×8=72이므로 빈칸에는 8이 들어갑니다.","id":"671565bd-924e-4b79-b9d1-48e31685c594","options":[{"displayOrder":1,"id":"edbf63c0-50e8-4052-9526-501fe69195e8","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"9f83e54c-2a92-4aac-884e-baa6a9585837","isCorrect":true,"text":"8"},{"displayOrder":3,"id":"e4c23f26-e057-403a-8710-f3fead390ca1","isCorrect":false,"text":"9"},{"displayOrder":4,"id":"4be1164d-2a76-434c-8823-8b96ed8cfab6","isCorrect":false,"text":"6"}],"prompt":"9×□=72에서 □에 알맞은 수는?","skillCode":"infer-missing-multiplication-factor","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"5a07eeac-894c-4e77-8598-9aab40ea44c5","questions":[{"displayOrder":1,"explanation":"6씩 8묶음은 48이므로 46이 아니라 6×8=48입니다.","id":"37e194a3-1b9f-42af-8c1e-90bf1bc038c0","options":[{"displayOrder":1,"id":"9ae8e1b5-ddf8-4b40-93a3-f2c36ad816f7","isCorrect":true,"text":"6×8=48"},{"displayOrder":2,"id":"9b6615e1-f79d-439a-bfcb-83e838635ce8","isCorrect":false,"text":"6×8=42"},{"displayOrder":3,"id":"7a17fb4d-6297-43b4-bcd5-4be9ed5fbb9a","isCorrect":false,"text":"6×8=54"},{"displayOrder":4,"id":"3b2ecd89-56a2-4a87-961f-08c0e94197c7","isCorrect":false,"text":"6×8=14"}],"prompt":"6×8=46이라고 계산했습니다. 바르게 고친 것은?","skillCode":"reason-about-multiplication-facts","weight":1},{"displayOrder":2,"explanation":"한 봉지의 7개가 한 묶음이고 봉지가 6개이므로 7×6=42입니다.","id":"2efed665-4b28-4355-b67b-07db1b28ec68","options":[{"displayOrder":1,"id":"0ed7040c-becb-4782-80c2-f148eb283de1","isCorrect":false,"text":"6×7=42이고 봉지 수를 앞에 씁니다."},{"displayOrder":2,"id":"995ed56d-dd7a-4121-9856-bfac0d6eb69e","isCorrect":true,"text":"7×6=42이고 한 봉지의 수를 앞에 씁니다."},{"displayOrder":3,"id":"b41d77cb-6d85-4920-aa06-de9b72e7b9e9","isCorrect":false,"text":"7+6=13이고 두 수를 더합니다."},{"displayOrder":4,"id":"cdac4369-df35-43f8-aa45-0de700470ce3","isCorrect":false,"text":"7×5=35이고 봉지 하나를 뺍니다."}],"prompt":"봉지마다 구슬이 7개씩 있고 봉지가 6개입니다. 구슬 수를 구한 식과 설명이 알맞은 것은?","skillCode":"model-multiplication-situation","weight":1},{"displayOrder":3,"explanation":"9×4=36이고 6×6=36이므로 두 식의 결과가 같습니다.","id":"6be4ae8c-d973-4b4f-a61c-a9bc1bdad77f","options":[{"displayOrder":1,"id":"c0926896-5d02-47bb-9656-c6d5ab6ad6e7","isCorrect":false,"text":"8×4"},{"displayOrder":2,"id":"4a67e4de-b5bf-4d49-a761-9b85564bf57b","isCorrect":false,"text":"7×5"},{"displayOrder":3,"id":"fcd5a1fd-f66f-4221-adbd-2fb349f0677a","isCorrect":true,"text":"6×6"},{"displayOrder":4,"id":"7f8c4c37-d3a2-4d16-ac91-ddf0dcc53b41","isCorrect":false,"text":"5×6"}],"prompt":"9×4와 같은 결과를 만드는 곱셈식은?","skillCode":"reason-about-multiplication-facts","weight":1},{"displayOrder":4,"explanation":"8×7=56이고 8×6=48이므로 묶음 수가 하나 늘어 8만큼 큽니다.","id":"bba4724e-cc51-4769-a268-748195ca0f27","options":[{"displayOrder":1,"id":"7ca4cbba-8442-4010-a074-954e598a9520","isCorrect":false,"text":"48이며 8×6보다 8만큼 작습니다."},{"displayOrder":2,"id":"1261c8cf-88aa-46e8-9f44-93aa84c6da8e","isCorrect":false,"text":"54이며 8과 7을 더했습니다."},{"displayOrder":3,"id":"9fd882da-006b-4bc9-8c25-d37e6dcae03e","isCorrect":false,"text":"64이며 8×8과 같습니다."},{"displayOrder":4,"id":"4687ce22-d399-4d34-bca6-c16d01b59ecb","isCorrect":true,"text":"56이며 8×6보다 8만큼 큽니다."}],"prompt":"8×7의 결과와 설명이 모두 알맞은 것은?","skillCode":"identify-multiplication-table-pattern","weight":1},{"displayOrder":5,"explanation":"한 접시의 쿠키 9개가 한 묶음이고 접시가 5개이므로 9×5=45로 씁니다.","id":"d992467c-51fe-443d-83e8-d562a3e15e1b","options":[{"displayOrder":1,"id":"3d29df10-4af2-4c36-a044-9200dd5dbb07","isCorrect":true,"text":"한 묶음의 수 9를 앞에 써서 9×5=45입니다."},{"displayOrder":2,"id":"0c1e0b9e-8148-4030-958e-b505c9efebe2","isCorrect":false,"text":"접시 수 5를 앞에 썼으므로 그대로 맞습니다."},{"displayOrder":3,"id":"fda34eb3-924b-4c60-a0b5-6a225a53fcec","isCorrect":false,"text":"두 수를 더해 5+9=14입니다."},{"displayOrder":4,"id":"7f83c4a8-9beb-49ce-8906-479b38f8c671","isCorrect":false,"text":"전체 수를 앞에 써서 45×1입니다."}],"prompt":"접시 5개에 쿠키가 9개씩 있습니다. 5×9라고 쓴 생각을 바르게 고친 것은?","skillCode":"correct-multiplication-reasoning","weight":1},{"displayOrder":6,"explanation":"7씩 묶인 묶음이 하나 늘 때마다 7이 더해지므로 곱은 7씩 커집니다.","id":"85975377-7e54-4ebb-b773-7dde1df43717","options":[{"displayOrder":1,"id":"ed89e919-6ae4-4b9c-bd3e-338e3a21958f","isCorrect":false,"text":"곱이 1씩 커집니다."},{"displayOrder":2,"id":"ebdd47c1-dd9e-4fe8-bd02-5ac545514f20","isCorrect":true,"text":"곱이 7씩 커집니다."},{"displayOrder":3,"id":"5f2e92ca-69be-42fe-8198-73246068bd0a","isCorrect":false,"text":"곱이 7씩 작아집니다."},{"displayOrder":4,"id":"08393693-c674-4b1c-bc8d-ab7ca1c98087","isCorrect":false,"text":"곱이 항상 같습니다."}],"prompt":"7단에서 묶음 수가 하나씩 늘어날 때의 규칙은?","skillCode":"identify-multiplication-table-pattern","weight":1},{"displayOrder":7,"explanation":"8×7은 56이므로 8×7=54가 잘못된 계산입니다.","id":"f1c936b3-b8da-4f23-9fcd-f0bd8ccec4b3","options":[{"displayOrder":1,"id":"2ba1766e-cad2-4cd4-9570-e670b843cfcc","isCorrect":false,"text":"6×9=54"},{"displayOrder":2,"id":"002cf8ac-f789-4d44-ad22-30535f4207d0","isCorrect":false,"text":"7×7=49"},{"displayOrder":3,"id":"b3ec5455-1773-415b-b0ed-d1252a98f541","isCorrect":true,"text":"8×7=54"},{"displayOrder":4,"id":"2983b040-4e32-4669-aa09-c79c919681ee","isCorrect":false,"text":"9×8=72"}],"prompt":"다음 중 잘못 계산한 식은?","skillCode":"reason-about-multiplication-facts","weight":1},{"displayOrder":8,"explanation":"9×6=54는 9단이면서 결과가 50보다 큽니다.","id":"70cf1187-5f25-4b96-b3ca-d65c3f904f22","options":[{"displayOrder":1,"id":"843b257f-5e57-495e-a2b5-2959c2a1bb30","isCorrect":false,"text":"9×5=45"},{"displayOrder":2,"id":"e361ca6f-5355-4138-90bd-ae1d2c37be96","isCorrect":false,"text":"8×7=56"},{"displayOrder":3,"id":"f0df9f25-1b1a-4e11-bdff-e6fdb0046b95","isCorrect":false,"text":"6×8=48"},{"displayOrder":4,"id":"bb8e50ea-c4e4-4112-93af-87129a3daf5e","isCorrect":true,"text":"9×6=54"}],"prompt":"결과가 50보다 크고 9단인 식은?","skillCode":"reason-about-multiplication-facts","weight":1},{"displayOrder":9,"explanation":"8×8=64이므로 빈칸에 알맞은 수는 8입니다.","id":"8568ac74-cfb5-4b98-a122-76c551e60d32","options":[{"displayOrder":1,"id":"46e950a8-e1a4-4537-8bd0-6d7c595708f1","isCorrect":false,"text":"7이며 7×8=56이기 때문입니다."},{"displayOrder":2,"id":"bce0adf5-7c77-4693-a4cb-34c947ba9c70","isCorrect":false,"text":"9이며 9×8=72이기 때문입니다."},{"displayOrder":3,"id":"eefcb257-f14f-4bfc-b137-8865df42beb1","isCorrect":true,"text":"8이며 8×8=64이기 때문입니다."},{"displayOrder":4,"id":"9910482d-ede6-44dd-a5eb-4a52e923a2cf","isCorrect":false,"text":"6이며 6×8=48이기 때문입니다."}],"prompt":"□×8=64에서 □에 알맞은 수와 까닭은?","skillCode":"infer-missing-multiplication-factor","weight":1},{"displayOrder":10,"explanation":"6×8은 6씩 8묶음이고 8×6은 8씩 6묶음이어서 뜻은 다르지만 결과는 모두 48입니다.","id":"a9ed729c-94b0-492c-a0f3-d8ea6ae49222","options":[{"displayOrder":1,"id":"10df567a-3f2d-43d4-aa28-9326c4b96da7","isCorrect":false,"text":"두 식은 뜻과 결과가 모두 다릅니다."},{"displayOrder":2,"id":"a73a4f93-5ef5-4a7d-bb0f-2b295e8d6b65","isCorrect":false,"text":"두 식은 뜻이 같고 결과만 다릅니다."},{"displayOrder":3,"id":"42280f09-234e-47c0-bdd0-46c417a1b4d3","isCorrect":false,"text":"6×8만 올바른 곱셈식입니다."},{"displayOrder":4,"id":"e0d56565-6c7d-4628-ad80-f7b7e6725dea","isCorrect":true,"text":"한 묶음의 수와 묶음 수는 다르지만 결과는 모두 48입니다."}],"prompt":"6×8과 8×6을 바르게 설명한 것은?","skillCode":"reason-about-multiplication-facts","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":8,"id":"362cafc9-09b4-4582-a5dd-d6e868e573d6","slug":"grade2-multiplication-tables","title":"곱셈구구를 익혀요"},"version":{"id":"db13b15e-752d-4491-832d-75feb9b9eb21","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid
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
  where stage.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_multiplication_tables_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_multiplication_tables_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 9

  union all
  select 3, 'grade2_multiplication_tables_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '7c1b81091398d0e00c97d82dd1c431e399a1f4caa56f9cdf869887e638e65282'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_multiplication_tables_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_multiplication_tables_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_multiplication_tables_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_multiplication_tables_v1_structure_and_orders',
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
    where stage.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_multiplication_tables_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_multiplication_tables_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid))

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
  where metadata.unit_id = '362cafc9-09b4-4582-a5dd-d6e868e573d6'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 8

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = '362cafc9-09b4-4582-a5dd-d6e868e573d6'::uuid
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
  where metadata.unit_id = '362cafc9-09b4-4582-a5dd-d6e868e573d6'::uuid

  union all
  select 23, 'grade2_multiplication_tables_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_multiplication_tables_v1_pass_threshold_contract',
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
  select 25, 'grade2_multiplication_tables_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_multiplication_tables_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = 'db13b15e-752d-4491-832d-75feb9b9eb21'::uuid

  union all
  select 27, 'grade2_multiplication_tables_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_multiplication_tables_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_multiplication_tables_v1_question_skills_exact',
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
select 999, 'grade2_multiplication_tables_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
