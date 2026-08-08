-- Phase 2B grade2-shapes v1 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"recommendation":{"parentSortOrder":2,"recommendedEndLevelCode":"elementary_2","recommendedStartLevelCode":"elementary_2","subject":"math"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"c2339c35-8f13-4216-b2f7-4863e78f5e40","questions":[{"displayOrder":1,"explanation":"세모 모양은 곧은 선 3개로 둘러싸여 있습니다.","id":"87022f21-6038-4d55-9589-020bb261be67","options":[{"displayOrder":1,"id":"2cea5aac-20d3-4b22-83d2-a608f8d41919","isCorrect":true,"text":"세모 모양"},{"displayOrder":2,"id":"6fc35960-d34d-4628-83d0-ce16e22a6147","isCorrect":false,"text":"네모 모양"},{"displayOrder":3,"id":"ebc3f2dd-3fa7-4126-84fb-721ef3d0cd2d","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":4,"id":"83b4231f-4620-45e2-a848-e4243c6d26b8","isCorrect":false,"text":"공 모양"}],"prompt":"곧은 선 3개로 둘러싸인 평면 모양은?","skillCode":"identify-plane-shape","weight":1},{"displayOrder":2,"explanation":"네모 모양은 곧은 선 4개로 둘러싸여 있습니다.","id":"9ea72704-775a-46bf-9960-e1929cb31e34","options":[{"displayOrder":1,"id":"57846c82-d1f1-4022-b11b-fa9067a71183","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":2,"id":"0bd79e1b-9e0c-4f4f-a241-9ad15cd4f78a","isCorrect":true,"text":"네모 모양"},{"displayOrder":3,"id":"bfd34ea9-4777-4491-89ea-f9b5f0aa13de","isCorrect":false,"text":"공 모양"},{"displayOrder":4,"id":"672e15db-bd99-41ba-8f8e-f93f3c901960","isCorrect":false,"text":"통 모양"}],"prompt":"곧은 선 4개로 둘러싸인 평면 모양은?","skillCode":"identify-plane-shape","weight":1},{"displayOrder":3,"explanation":"동그라미 모양은 굽은 선으로 둘러싸이고 뾰족한 곳이 없습니다.","id":"67d77a67-e13f-41c9-a63e-08356c4ba2f1","options":[{"displayOrder":1,"id":"27edab53-7c18-4c11-a8b4-d5aaef011a3d","isCorrect":false,"text":"세모 모양"},{"displayOrder":2,"id":"25b404c8-a88a-4b58-8933-77cbfc274f2d","isCorrect":false,"text":"네모 모양"},{"displayOrder":3,"id":"c81fc007-a0b1-4fde-9d81-58c53d50af4c","isCorrect":true,"text":"동그라미 모양"},{"displayOrder":4,"id":"79fba679-bd19-4c20-b434-be9014ffb1e3","isCorrect":false,"text":"상자 모양"}],"prompt":"굽은 선으로 둘러싸이고 뾰족한 곳이 없는 평면 모양은?","skillCode":"identify-plane-shape","weight":1},{"displayOrder":4,"explanation":"공 모양은 공간을 차지하는 입체 모양입니다.","id":"ecb58153-936c-4a35-806e-929623dbd461","options":[{"displayOrder":1,"id":"2026ceff-0086-471b-af0c-a71b0adad44e","isCorrect":false,"text":"세모 모양"},{"displayOrder":2,"id":"c09b924e-bda6-4af7-9d3a-0745229422eb","isCorrect":false,"text":"네모 모양"},{"displayOrder":3,"id":"0b8d3f7f-88a4-49f7-9830-7f51fb54bb8d","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":4,"id":"0d938fe9-9d00-495a-b5cc-ebe04bb7d8d5","isCorrect":true,"text":"공 모양"}],"prompt":"평면 모양이 아닌 것은?","skillCode":"identify-solid-shape","weight":1},{"displayOrder":5,"explanation":"축구공은 어느 쪽에서 보아도 둥근 공 모양과 닮았습니다.","id":"2333208b-609d-4a5f-9a18-5fd89535251d","options":[{"displayOrder":1,"id":"0dbffac2-8e2b-4997-a63d-9cd5ee132e6e","isCorrect":true,"text":"공 모양"},{"displayOrder":2,"id":"81d33706-1268-41ed-b50d-5c2178dde95f","isCorrect":false,"text":"상자 모양"},{"displayOrder":3,"id":"b7003b2b-00dd-4a28-a2d9-559bc49fadb0","isCorrect":false,"text":"통 모양"},{"displayOrder":4,"id":"d2ed35af-c4f7-413d-8af6-ba4fc1fa020f","isCorrect":false,"text":"세모 모양"}],"prompt":"축구공과 가장 닮은 입체 모양은?","skillCode":"connect-object-to-shape","weight":1},{"displayOrder":6,"explanation":"주사위는 평평한 네모 모양의 면들로 둘러싸인 상자 모양입니다.","id":"9295dfa9-b265-4585-bf04-f34e1df6c381","options":[{"displayOrder":1,"id":"f558f5af-76a0-4059-9a8a-88069e908927","isCorrect":false,"text":"공 모양"},{"displayOrder":2,"id":"a70537b5-ef87-445c-a274-b6fc24c6e5a6","isCorrect":true,"text":"상자 모양"},{"displayOrder":3,"id":"d0c1b3b8-cf75-4d17-8cae-27fb50323548","isCorrect":false,"text":"통 모양"},{"displayOrder":4,"id":"ef41c35f-e1aa-48a5-a7f8-e994d6959390","isCorrect":false,"text":"동그라미 모양"}],"prompt":"주사위와 가장 닮은 입체 모양은?","skillCode":"connect-object-to-shape","weight":1},{"displayOrder":7,"explanation":"음료수 캔은 위아래가 평평하고 옆이 굽은 통 모양입니다.","id":"cedf957f-4c7d-4e2c-a394-1e72d91b9348","options":[{"displayOrder":1,"id":"5865fc14-5d2b-410a-b4ba-ef40292577e7","isCorrect":false,"text":"상자 모양"},{"displayOrder":2,"id":"c3b81fc6-f4a7-440e-90b9-27c7acfd0fe2","isCorrect":false,"text":"공 모양"},{"displayOrder":3,"id":"8f780245-2045-45b7-bfae-37f18fc2f7d8","isCorrect":true,"text":"통 모양"},{"displayOrder":4,"id":"85bea504-d3a4-4038-890c-07802287561f","isCorrect":false,"text":"네모 모양"}],"prompt":"음료수 캔과 가장 닮은 입체 모양은?","skillCode":"connect-object-to-shape","weight":1},{"displayOrder":8,"explanation":"상자 모양과 공 모양은 모두 공간을 차지하는 입체 모양입니다.","id":"8cd899c7-3ee4-44bd-bf51-befaa3d442fc","options":[{"displayOrder":1,"id":"8de1a06d-e62e-45a9-9733-5fc8691072d4","isCorrect":false,"text":"세모 모양과 네모 모양"},{"displayOrder":2,"id":"b3180161-12fa-489c-b994-cdc1cc034d3d","isCorrect":false,"text":"네모 모양과 동그라미 모양"},{"displayOrder":3,"id":"1679b4f7-35af-4868-aac4-4a27f3b7aa9d","isCorrect":false,"text":"세모 모양과 공 모양"},{"displayOrder":4,"id":"aca48a8d-aee5-49c1-a81c-4a5824ed1311","isCorrect":true,"text":"상자 모양과 공 모양"}],"prompt":"입체 모양끼리 짝 지은 것은?","skillCode":"classify-shapes","weight":1},{"displayOrder":9,"explanation":"창문 테두리의 바깥선을 보면 네모 모양을 찾을 수 있습니다.","id":"d1f283a4-8edd-4e44-9ca8-672339699bdd","options":[{"displayOrder":1,"id":"cb09f775-5576-4d4d-ba02-3f6696efbe84","isCorrect":true,"text":"네모 모양"},{"displayOrder":2,"id":"07b528a4-e899-40b0-8ace-a727de657beb","isCorrect":false,"text":"공 모양"},{"displayOrder":3,"id":"f543d762-b36a-4b7a-8a27-1003ad6f8ba9","isCorrect":false,"text":"통 모양"},{"displayOrder":4,"id":"6bf17ead-e1e1-4aec-b480-b803d7e0abce","isCorrect":false,"text":"동그라미 모양"}],"prompt":"네모난 창문 테두리에서 찾을 수 있는 평면 모양은?","skillCode":"connect-object-to-shape","weight":1},{"displayOrder":10,"explanation":"표지판의 바깥선이 곧은 선 3개로 이어져 세모 모양입니다.","id":"52858e30-18b9-44be-9fcc-1d0b72511f74","options":[{"displayOrder":1,"id":"e2eb74ac-c6a8-4111-9d0b-7dbc397c3185","isCorrect":false,"text":"공 모양"},{"displayOrder":2,"id":"d0382095-20a2-48a1-90f6-444c2eccd9f2","isCorrect":true,"text":"세모 모양"},{"displayOrder":3,"id":"af5843c7-9a35-4d24-b6f1-cd129ca094ed","isCorrect":false,"text":"통 모양"},{"displayOrder":4,"id":"10f5c439-da4e-4efd-bf45-c165c1de81a9","isCorrect":false,"text":"동그라미 모양"}],"prompt":"세모난 교통 표지판에서 찾을 수 있는 평면 모양은?","skillCode":"connect-object-to-shape","weight":1}],"title":"입문"},{"difficulty":"leaf","displayOrder":2,"id":"af405f9e-df43-4527-b86f-9c4b63710601","questions":[{"displayOrder":1,"explanation":"세모 모양은 곧은 선 3개로 둘러싸여 있습니다.","id":"9b0c21ed-f0c7-47dd-b5c8-8f239b2b673a","options":[{"displayOrder":1,"id":"6e4065d0-649f-4aed-b973-21bedaef5706","isCorrect":false,"text":"1개"},{"displayOrder":2,"id":"b15f4345-a7d7-4aa5-ace4-7e4aca41b227","isCorrect":false,"text":"2개"},{"displayOrder":3,"id":"d36e5000-b88b-49b3-ba25-40d1bdd62845","isCorrect":true,"text":"3개"},{"displayOrder":4,"id":"8308fca8-5e7f-40bb-a12e-218a858b5408","isCorrect":false,"text":"4개"}],"prompt":"세모 모양을 둘러싼 곧은 선은 몇 개인가요?","skillCode":"describe-shape-properties","weight":1},{"displayOrder":2,"explanation":"네모 모양에는 두 곧은 선이 만나는 곳이 4개 있습니다.","id":"4d6bf528-80a5-40e0-a34d-581d0c166008","options":[{"displayOrder":1,"id":"7f59c1e8-e862-4fb6-9cf8-bb161a964403","isCorrect":false,"text":"1개"},{"displayOrder":2,"id":"49ad59a4-07e8-49a0-bc14-668e771a3f00","isCorrect":false,"text":"2개"},{"displayOrder":3,"id":"d7bc1b85-e97f-433c-a492-45cd360a4efd","isCorrect":false,"text":"3개"},{"displayOrder":4,"id":"b1063f6e-5a4b-4652-8952-e165aa8a9367","isCorrect":true,"text":"4개"}],"prompt":"네모 모양에서 두 곧은 선이 만나는 곳은 몇 개인가요?","skillCode":"describe-shape-properties","weight":1},{"displayOrder":3,"explanation":"동그라미 모양의 둘레는 굽은 선 하나로 이어져 있습니다.","id":"79fde641-4f4a-41de-ab03-f953633a354e","options":[{"displayOrder":1,"id":"704493ab-7bdb-4e28-9734-9c64e169e5b6","isCorrect":true,"text":"곧은 선이 없습니다."},{"displayOrder":2,"id":"7ab93a67-5435-46ae-8657-21aee2f6100a","isCorrect":false,"text":"곧은 선이 3개입니다."},{"displayOrder":3,"id":"31ba56a0-8707-4da5-ae64-ea645f0efb75","isCorrect":false,"text":"뾰족한 곳이 4개입니다."},{"displayOrder":4,"id":"35fb58cf-6bd8-4299-9044-53101a6cb557","isCorrect":false,"text":"평평한 면이 6개입니다."}],"prompt":"동그라미 모양의 특징으로 알맞은 것은?","skillCode":"describe-shape-properties","weight":1},{"displayOrder":4,"explanation":"통 모양에는 위아래의 평평한 면과 옆의 굽은 면이 있습니다.","id":"a8a0c74c-98cd-4125-be28-161badc9526b","options":[{"displayOrder":1,"id":"466ff45e-46a5-47d6-b665-82b62a25ef6d","isCorrect":false,"text":"평평한 면만 있습니다."},{"displayOrder":2,"id":"c8e989ce-e55f-4925-9db0-eb2eca1b4070","isCorrect":true,"text":"평평한 면과 굽은 면이 있습니다."},{"displayOrder":3,"id":"e97d7c11-3c1d-4c86-ad43-f1b01a455963","isCorrect":false,"text":"굽은 면만 있습니다."},{"displayOrder":4,"id":"0d87f9f0-06b6-4da1-b7b7-14611745cc2a","isCorrect":false,"text":"면이 없습니다."}],"prompt":"통 모양의 특징으로 알맞은 것은?","skillCode":"describe-shape-properties","weight":1},{"displayOrder":5,"explanation":"세모 모양과 동그라미 모양은 모두 평면에서 찾는 모양입니다.","id":"c9a671c3-c3e5-47c5-8da3-9b2986ef8186","options":[{"displayOrder":1,"id":"630cc3d2-e031-4c60-976b-68069f5aeff8","isCorrect":false,"text":"상자 모양과 공 모양"},{"displayOrder":2,"id":"91250dcf-78da-4f74-8cd4-0a060fb755df","isCorrect":false,"text":"통 모양과 세모 모양"},{"displayOrder":3,"id":"c7e69392-8d14-419d-8de8-3cd86f17ae61","isCorrect":true,"text":"세모 모양과 동그라미 모양"},{"displayOrder":4,"id":"9b468ad1-5225-4e57-9a0e-793406327657","isCorrect":false,"text":"공 모양과 네모 모양"}],"prompt":"평면 모양만 모은 것은?","skillCode":"classify-shapes","weight":1},{"displayOrder":6,"explanation":"상자 모양과 통 모양은 모두 공간을 차지합니다.","id":"1cbcdf92-5a50-4027-8f16-d92cbd927c37","options":[{"displayOrder":1,"id":"1315f3e0-31a3-465d-b471-be20503d6ec6","isCorrect":false,"text":"세모 모양과 네모 모양"},{"displayOrder":2,"id":"810a4bbb-cb8e-49bb-b9b5-820bafad416a","isCorrect":false,"text":"동그라미 모양과 공 모양"},{"displayOrder":3,"id":"6b779d0b-0e56-4b7b-a286-b32bf6623ca1","isCorrect":false,"text":"네모 모양과 통 모양"},{"displayOrder":4,"id":"8919b7fd-c21e-4fb5-be13-e882e242d9c4","isCorrect":true,"text":"상자 모양과 통 모양"}],"prompt":"입체 모양만 모은 것은?","skillCode":"classify-shapes","weight":1},{"displayOrder":7,"explanation":"공 모양만 입체 모양이고 나머지는 평면 모양입니다.","id":"b64801bd-1a16-41d0-b6e1-562aebb2b300","options":[{"displayOrder":1,"id":"9efc5b2a-c2c6-41fc-a2bb-34139d49d44d","isCorrect":true,"text":"공 모양"},{"displayOrder":2,"id":"a2eb32fb-511b-4992-8fe5-9cb43c0cfbce","isCorrect":false,"text":"세모 모양"},{"displayOrder":3,"id":"3344699a-e2e5-43f5-9198-dab24a985290","isCorrect":false,"text":"네모 모양"},{"displayOrder":4,"id":"f76ed2b7-9071-4a32-a1f5-22ec66ff4c31","isCorrect":false,"text":"동그라미 모양"}],"prompt":"나머지 셋과 종류가 다른 하나는?","skillCode":"classify-shapes","weight":1},{"displayOrder":8,"explanation":"상자 모양은 평평한 면이 있어 안정되게 쌓을 수 있습니다.","id":"6ff56548-4b0d-4fab-a06f-a884bb5d5515","options":[{"displayOrder":1,"id":"be712a28-a4f1-46f5-933c-cdf67af460cf","isCorrect":false,"text":"공 모양"},{"displayOrder":2,"id":"01bbb6cb-28da-4ed5-a3f9-56e724a7a263","isCorrect":true,"text":"상자 모양"},{"displayOrder":3,"id":"f5c52932-3168-470c-b20c-a9b0e2606c3b","isCorrect":false,"text":"통 모양"},{"displayOrder":4,"id":"50e87e69-84b9-45a7-81bb-648ba2e1617f","isCorrect":false,"text":"동그라미 모양"}],"prompt":"바닥에 놓았을 때 굴러가지 않고 차곡차곡 쌓기 쉬운 것은?","skillCode":"describe-shape-properties","weight":1},{"displayOrder":9,"explanation":"두 모양은 모두 곧은 선들이 이어져 둘레를 만듭니다.","id":"120bb469-7754-4975-90db-18817d3dfad3","options":[{"displayOrder":1,"id":"e2e4c5c6-f04d-4152-a0be-b102954f7b40","isCorrect":false,"text":"모두 굽은 선만 있습니다."},{"displayOrder":2,"id":"39ad8311-db90-4fa5-b638-2d23c2ff6110","isCorrect":false,"text":"모두 입체 모양입니다."},{"displayOrder":3,"id":"6ec35cc5-8127-480d-970c-66ac9d3b6db4","isCorrect":true,"text":"모두 곧은 선으로 둘러싸여 있습니다."},{"displayOrder":4,"id":"4d40cebd-7010-4672-b6c9-41fe351388a2","isCorrect":false,"text":"모두 뾰족한 곳이 없습니다."}],"prompt":"세모 모양과 네모 모양의 공통점은?","skillCode":"describe-shape-properties","weight":1},{"displayOrder":10,"explanation":"공 모양과 통 모양에는 굽은 면이 있어 굴릴 수 있습니다.","id":"99e42892-f147-405a-81ea-370843ac71b4","options":[{"displayOrder":1,"id":"8b4f783c-0196-4a90-be60-edfc83391bef","isCorrect":false,"text":"모두 평평한 면만 있습니다."},{"displayOrder":2,"id":"cee5b725-42dd-4f95-83c3-af69326c813f","isCorrect":false,"text":"모두 네모 모양의 면이 있습니다."},{"displayOrder":3,"id":"6f92a055-a9f3-4181-be1a-897e6882ba59","isCorrect":false,"text":"모두 평면 모양입니다."},{"displayOrder":4,"id":"f4b6ea39-c146-4454-9684-920e1789f5a1","isCorrect":true,"text":"모두 굽은 면이 있어 굴릴 수 있습니다."}],"prompt":"공 모양과 통 모양의 공통점은?","skillCode":"describe-shape-properties","weight":1}],"title":"기초"},{"difficulty":"tree","displayOrder":3,"id":"8eb84449-513b-42d9-8621-e99cf6277211","questions":[{"displayOrder":1,"explanation":"네모 모양을 대각선으로 자르면 세모 모양 2개가 생깁니다.","id":"a194dd17-4984-4883-9e14-be827a5ad301","options":[{"displayOrder":1,"id":"c47f348f-1eac-40f6-bd60-47a50be3aec3","isCorrect":true,"text":"세모 모양"},{"displayOrder":2,"id":"be2e7f70-c999-4666-9d51-0f16e9d6abf7","isCorrect":false,"text":"네모 모양"},{"displayOrder":3,"id":"749062c3-d994-4189-a174-db4955a44ff8","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":4,"id":"13c20060-f96b-45c8-8e5b-143c18943995","isCorrect":false,"text":"공 모양"}],"prompt":"네모 모양 종이를 한 꼭짓점에서 마주 보는 꼭짓점까지 곧게 잘랐습니다. 생기는 두 조각의 모양은?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":2,"explanation":"네모 모양 2개를 나란히 붙이면 바깥 테두리가 긴 네모 모양이 됩니다.","id":"6b797cf0-f0c7-484a-abd3-b6c1a7a303be","options":[{"displayOrder":1,"id":"a6312f72-6e03-42f5-86e9-8b3027c1b49a","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":2,"id":"30ce16ba-52de-47da-b407-1b8f131de510","isCorrect":true,"text":"긴 네모 모양"},{"displayOrder":3,"id":"bb6f396d-5f5e-4f7f-898a-20bb59dee31a","isCorrect":false,"text":"공 모양"},{"displayOrder":4,"id":"6b5dad0a-44ed-42b6-b697-10b89332acf0","isCorrect":false,"text":"통 모양"}],"prompt":"같은 크기의 네모 모양 2개를 한 변 전체가 맞닿게 옆으로 붙였습니다. 바깥 테두리의 모양은?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":3,"explanation":"크기가 같은 세모 모양 2개를 알맞게 붙이면 네모 모양을 만들 수 있습니다.","id":"a709ffed-9816-4082-8343-6a69c46f6882","options":[{"displayOrder":1,"id":"c5e8ef40-303f-43cd-a66e-049ded8dc7c4","isCorrect":false,"text":"1개"},{"displayOrder":2,"id":"199f8a0d-5057-431f-a94a-3e81e227199e","isCorrect":false,"text":"3개"},{"displayOrder":3,"id":"4e7365b5-ba4a-4d15-b70a-b6eb76450549","isCorrect":true,"text":"2개"},{"displayOrder":4,"id":"b1a795e6-5813-4c68-9c7c-958a02d1c903","isCorrect":false,"text":"4개"}],"prompt":"크기가 같은 세모 모양 조각으로 네모 모양 하나를 만들었습니다. 사용한 조각 수는?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":4,"explanation":"가로와 세로로 똑바로 나누면 작은 네모 모양 4개가 생깁니다.","id":"424eebfd-91dc-4dfc-964e-7725baeab501","options":[{"displayOrder":1,"id":"0c322f90-048e-43bb-9484-c462eb62c687","isCorrect":false,"text":"세모 모양"},{"displayOrder":2,"id":"8fd1beaf-f852-4c33-88e1-e9c332e6e7e7","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":3,"id":"b8fc63b0-b4f4-451a-a69b-b140b5867fc0","isCorrect":false,"text":"공 모양"},{"displayOrder":4,"id":"60506006-2ef3-4206-b209-bf14cc29351f","isCorrect":true,"text":"네모 모양"}],"prompt":"네모 모양 종이를 가로와 세로로 한 번씩 똑바로 잘라 같은 조각 4개를 만들었습니다. 각 조각의 모양은?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":5,"explanation":"상자 모양의 평평한 면을 따라 그리면 네모 모양이 됩니다.","id":"699d83ae-fb53-4a6b-8b42-722cbf45501c","options":[{"displayOrder":1,"id":"da115a0e-e860-4a79-8356-ca6613b2a75f","isCorrect":true,"text":"네모 모양"},{"displayOrder":2,"id":"9a19e506-51c7-4327-b2da-fa0ff66f55a2","isCorrect":false,"text":"공 모양"},{"displayOrder":3,"id":"2d1886b9-90f4-461f-98dd-e72d241c4107","isCorrect":false,"text":"통 모양"},{"displayOrder":4,"id":"ce0841c2-d961-41f4-aa12-1201b789a717","isCorrect":false,"text":"동그라미 모양"}],"prompt":"상자 모양의 평평한 면을 종이에 대고 둘레를 그렸습니다. 가장 알맞은 모양은?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":6,"explanation":"통 모양의 밑면 둘레를 따라 그리면 동그라미 모양이 됩니다.","id":"9153a8b7-eec8-426b-aee7-0334b98c5193","options":[{"displayOrder":1,"id":"b3e586b2-c767-4682-ac2d-baecbaf67f85","isCorrect":false,"text":"세모 모양"},{"displayOrder":2,"id":"27d55ba7-3b01-4ee1-b7b3-d095106d15ac","isCorrect":true,"text":"동그라미 모양"},{"displayOrder":3,"id":"82b440a9-080e-474f-9fa7-9c9e8abebb33","isCorrect":false,"text":"네모 모양"},{"displayOrder":4,"id":"bb4e18fc-6db1-40e4-a725-c4241aba6ffd","isCorrect":false,"text":"상자 모양"}],"prompt":"통 모양의 동그란 밑면을 종이에 대고 둘레를 그렸습니다. 생기는 모양은?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":7,"explanation":"상자 모양은 네모 모양의 평평한 면들로 둘러싸여 있습니다.","id":"ffd1bd60-cb57-461f-86be-4781084461cd","options":[{"displayOrder":1,"id":"03133869-45e4-400f-b551-6c40867de9e5","isCorrect":false,"text":"공 모양"},{"displayOrder":2,"id":"e3a1add8-6aea-4d2f-9e2d-7aa8f5cd06b9","isCorrect":false,"text":"통 모양"},{"displayOrder":3,"id":"b7527e50-0da6-4d41-8842-ecc57b7f733c","isCorrect":true,"text":"네모 모양"},{"displayOrder":4,"id":"ffd3afdf-61c4-4675-8d7a-7c7287d44189","isCorrect":false,"text":"동그라미 모양"}],"prompt":"상자 모양을 펼쳤을 때 볼 수 있는 평평한 면의 모양은?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":8,"explanation":"곧은 선과 만나는 곳이 각각 3개이면 세모 모양입니다.","id":"e3563ab4-8d03-4817-a8d2-6835f2c487b7","options":[{"displayOrder":1,"id":"46601f4c-061c-4d8e-a603-63ec88cf5722","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":2,"id":"651a5b53-d8a4-4fac-9ae1-75b01e95caeb","isCorrect":false,"text":"네모 모양"},{"displayOrder":3,"id":"8baf4afd-7bcc-4ce2-a594-a1f76ffcdf79","isCorrect":false,"text":"공 모양"},{"displayOrder":4,"id":"ae0d5619-a220-4fef-8f43-8b821e9677ad","isCorrect":true,"text":"세모 모양"}],"prompt":"곧은 선 3개와 두 선이 만나는 곳 3개가 있는 평면 모양은?","skillCode":"infer-shape-from-properties","weight":1},{"displayOrder":9,"explanation":"굽은 선으로만 이어진 평면 모양은 동그라미 모양입니다.","id":"336b4350-d2a6-4dcf-a846-22392be148e2","options":[{"displayOrder":1,"id":"08f703fb-a3bd-4e1b-9c83-fa3d35c33276","isCorrect":true,"text":"동그라미 모양"},{"displayOrder":2,"id":"36dd43bd-56c5-4ada-86cc-3d7486dc0fc5","isCorrect":false,"text":"세모 모양"},{"displayOrder":3,"id":"efd2d88d-85cf-42aa-91fa-47a9b8bfcae4","isCorrect":false,"text":"네모 모양"},{"displayOrder":4,"id":"49efe0dd-296e-4962-adbb-c17d100cb6b4","isCorrect":false,"text":"상자 모양"}],"prompt":"곧은 선이 없고 굽은 선으로만 둘러싸인 평면 모양은?","skillCode":"infer-shape-from-properties","weight":1},{"displayOrder":10,"explanation":"위아래에 동그란 면이 있고 옆이 굽은 입체 모양은 통 모양입니다.","id":"0c45bf1f-7b95-47ac-80f5-fa4b5ad41638","options":[{"displayOrder":1,"id":"fa4f7e1d-208d-451c-a5f7-bfe4ceaa52a2","isCorrect":false,"text":"공 모양"},{"displayOrder":2,"id":"8c9c04ee-b40c-4824-90af-3d1fbed7f807","isCorrect":true,"text":"통 모양"},{"displayOrder":3,"id":"0fab5cf7-88eb-4cdb-97e1-c810256c84e7","isCorrect":false,"text":"상자 모양"},{"displayOrder":4,"id":"e6e70085-42e9-4fd4-b7ca-79f3d2515f48","isCorrect":false,"text":"네모 모양"}],"prompt":"동그란 평평한 면 2개와 굽은 면 1개가 있는 입체 모양은?","skillCode":"infer-shape-from-properties","weight":1}],"title":"심화"},{"difficulty":"crown","displayOrder":4,"id":"c5117f97-4db5-4e8e-80a9-4a2126d90c6b","questions":[{"displayOrder":1,"explanation":"세모 모양은 곧은 선 3개와 두 선이 만나는 곳 3개를 가집니다.","id":"67caac36-ec06-4526-ba7b-aba23dae5e06","options":[{"displayOrder":1,"id":"20c144e8-e143-4aa1-afeb-4c6905f6af1c","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":2,"id":"75665ddc-8df7-4b78-a2a3-74df08f70abe","isCorrect":false,"text":"네모 모양"},{"displayOrder":3,"id":"879e81a0-c38b-4b8f-9028-b5b754ae72f0","isCorrect":true,"text":"세모 모양"},{"displayOrder":4,"id":"de9dd70a-8937-4924-904c-98d344b5f91a","isCorrect":false,"text":"공 모양"}],"prompt":"곧은 선 3개와 뾰족한 곳 3개를 모두 가진 모양은?","skillCode":"infer-shape-from-properties","weight":1},{"displayOrder":2,"explanation":"동그라미 모양은 둘레가 굽은 선으로 이어지고 뾰족한 곳이 없습니다.","id":"269c929d-b257-4a79-88e5-eb544ff72259","options":[{"displayOrder":1,"id":"02decf8e-2cb8-42d9-8aab-e6de66f52330","isCorrect":false,"text":"상자 모양"},{"displayOrder":2,"id":"4df34e6d-05f5-4143-813a-c2fb03ebb110","isCorrect":false,"text":"세모 모양"},{"displayOrder":3,"id":"c069d5c3-d885-48dd-bd10-e80a67d76b9c","isCorrect":false,"text":"네모 모양"},{"displayOrder":4,"id":"8e6b6936-eac4-4612-8b9f-9783c80c6015","isCorrect":true,"text":"동그라미 모양"}],"prompt":"굽은 선으로 이어져 있고 뾰족한 곳이 하나도 없는 평면 모양은?","skillCode":"infer-shape-from-properties","weight":1},{"displayOrder":3,"explanation":"동그라미 모양에는 뾰족한 곳이 없습니다.","id":"3b4bdd4f-89c7-4249-8b78-a033112a1fd1","options":[{"displayOrder":1,"id":"b66bafd3-d244-42ce-ae61-a99dce17dd62","isCorrect":true,"text":"뾰족한 곳이 0개입니다."},{"displayOrder":2,"id":"1bfe4785-ffc5-4004-9a22-b5ddc228ab46","isCorrect":false,"text":"뾰족한 곳이 2개입니다."},{"displayOrder":3,"id":"1b11b056-1bd1-463c-87b1-ca1989408369","isCorrect":false,"text":"곧은 선이 3개입니다."},{"displayOrder":4,"id":"c6c06a1a-3ee7-4036-9020-b9028b4dd8f5","isCorrect":false,"text":"평평한 면이 1개입니다."}],"prompt":"민수는 동그라미 모양에 뾰족한 곳이 1개 있다고 말했습니다. 바르게 고친 것은?","skillCode":"correct-shape-reasoning","weight":1},{"displayOrder":4,"explanation":"상자 모양은 평평한 네모 모양의 면들로 둘러싸여 있습니다.","id":"dc28638b-23c3-491c-a872-58a9c1aa6761","options":[{"displayOrder":1,"id":"a61f3a5d-5b1a-4f24-912a-eb014ae472fc","isCorrect":false,"text":"굽은 면만 있습니다."},{"displayOrder":2,"id":"b95b3b8c-3304-4532-a15c-b6bcfe173f72","isCorrect":true,"text":"평평한 네모 모양의 면들이 있습니다."},{"displayOrder":3,"id":"43048f0b-9f18-4b38-9393-b68ef1bfca15","isCorrect":false,"text":"면이 하나도 없습니다."},{"displayOrder":4,"id":"d2b6ff4a-1d66-4adf-baa0-a0558ddad3cd","isCorrect":false,"text":"뾰족한 곳이 없습니다."}],"prompt":"지우는 상자 모양의 모든 면이 동그라미 모양이라고 말했습니다. 바르게 고친 것은?","skillCode":"correct-shape-reasoning","weight":1},{"displayOrder":5,"explanation":"세모 모양과 네모 모양은 모두 곧은 선으로 둘러싸여 있으므로 분류가 알맞습니다.","id":"7059592e-a734-43a9-a618-311555049e23","options":[{"displayOrder":1,"id":"77906861-534a-4584-9536-dd0080220773","isCorrect":false,"text":"세모 모양"},{"displayOrder":2,"id":"3a822aae-2362-4b8c-965b-7e81248ceb85","isCorrect":false,"text":"네모 모양"},{"displayOrder":3,"id":"c76e8d0c-48c7-47a6-863e-c6be11676e03","isCorrect":true,"text":"잘못 들어간 모양이 없습니다."},{"displayOrder":4,"id":"a62afe9b-89a6-42ef-96f6-8edfc8a56171","isCorrect":false,"text":"모두 잘못 들어갔습니다."}],"prompt":"세모 모양 3개와 네모 모양 1개를 곧은 선으로 둘러싸인 모양끼리 모았습니다. 잘못 들어간 모양은?","skillCode":"correct-shape-reasoning","weight":1},{"displayOrder":6,"explanation":"모양의 크기가 달라져도 곧은 선 3개로 둘러싸이면 세모 모양입니다.","id":"aadae9c6-c3f4-42d8-a620-f24fd5367e66","options":[{"displayOrder":1,"id":"c5799f51-251b-49e7-9d0b-9c1cbd2c08df","isCorrect":false,"text":"크기가 커지면 동그라미가 됩니다."},{"displayOrder":2,"id":"6e9d20fe-129b-47ac-9cf6-b5aaeb050209","isCorrect":false,"text":"색에 따라 모양이 바뀝니다."},{"displayOrder":3,"id":"81696b09-8706-4f77-935f-e05c41b3c79c","isCorrect":false,"text":"큰 세모에는 곧은 선이 4개입니다."},{"displayOrder":4,"id":"98ce356e-aec0-42ef-91b6-8547e33ba499","isCorrect":true,"text":"크기가 달라도 곧은 선 3개이면 세모 모양입니다."}],"prompt":"서연이는 세모 모양을 크게 그리면 네모 모양이 된다고 말했습니다. 바르게 설명한 것은?","skillCode":"correct-shape-reasoning","weight":1},{"displayOrder":7,"explanation":"세모 모양 조각을 합쳐 네모 모양을 만든 경우입니다.","id":"08a8a211-6d93-4990-84ec-a70e1fd30c31","options":[{"displayOrder":1,"id":"c6cd8885-e32f-493e-8277-437fb65b5f02","isCorrect":true,"text":"작은 모양을 합쳐 새로운 모양을 만들었습니다."},{"displayOrder":2,"id":"c0d984ea-ac1f-4f7c-8264-8c2738be0e93","isCorrect":false,"text":"입체 모양을 평면 모양으로 바꾸었습니다."},{"displayOrder":3,"id":"85a0e473-85a5-4dd3-a71f-c4c2f2d3782d","isCorrect":false,"text":"동그라미를 두 부분으로 나누었습니다."},{"displayOrder":4,"id":"3a8ee3af-7b4c-4f28-9dea-2de04d5394e3","isCorrect":false,"text":"모양의 수가 줄지 않았습니다."}],"prompt":"같은 크기의 세모 모양 2개를 알맞게 붙여 네모 모양을 만들었습니다. 알맞은 설명은?","skillCode":"compose-decompose-shapes","weight":1},{"displayOrder":8,"explanation":"통 모양은 굽은 면으로 굴릴 수 있고 평평한 면으로 세워 쌓을 수도 있습니다.","id":"325a3aba-91cf-4a8b-a790-5e99e9622d06","options":[{"displayOrder":1,"id":"5f7eff16-fbfa-4e10-9675-6a3efe79a952","isCorrect":false,"text":"굽은 면이 없어 굴릴 수 없습니다."},{"displayOrder":2,"id":"6650d75b-6529-44f3-85d9-c59bc0004a9b","isCorrect":true,"text":"평평한 면으로 세우면 쌓을 수 있습니다."},{"displayOrder":3,"id":"e1c7222d-bcc2-4b36-a0c0-c2d811224d21","isCorrect":false,"text":"모든 면이 네모 모양입니다."},{"displayOrder":4,"id":"39fc8d77-2970-4778-9807-b6e6ae00e49e","isCorrect":false,"text":"공 모양과 완전히 같습니다."}],"prompt":"현우는 통 모양은 굴러가기만 하고 쌓을 수 없다고 말했습니다. 바르게 고친 것은?","skillCode":"correct-shape-reasoning","weight":1},{"displayOrder":9,"explanation":"곧은 선 3개인 가는 세모 모양이고 곧은 선 4개인 나는 네모 모양입니다.","id":"eabb7c04-5eed-434a-8249-3c32017e2752","options":[{"displayOrder":1,"id":"7356cc79-63d9-4d40-831b-503b13631f93","isCorrect":false,"text":"둘 다 동그라미 모양"},{"displayOrder":2,"id":"681e03d1-f133-4e83-bee4-1208a8d942e0","isCorrect":false,"text":"가는 네모 모양이고 나는 세모 모양"},{"displayOrder":3,"id":"096d9a6d-49ef-403f-910d-5fe3ee8ae87f","isCorrect":true,"text":"가는 세모 모양이고 나는 네모 모양"},{"displayOrder":4,"id":"43ddc94b-c06b-45e9-8b71-249baab22762","isCorrect":false,"text":"둘 다 공 모양"}],"prompt":"가 모양은 곧은 선 3개이고 나 모양은 곧은 선 4개입니다. 가와 나의 모양은?","skillCode":"infer-shape-from-properties","weight":1},{"displayOrder":10,"explanation":"공 모양은 굽은 면으로만 둘러싸여 있어 어느 방향으로도 잘 굴러갑니다.","id":"ea03478f-8770-44db-ac13-5dd37aedd7de","options":[{"displayOrder":1,"id":"6a2aea19-a0c4-4740-b395-d7b35226502d","isCorrect":false,"text":"상자 모양"},{"displayOrder":2,"id":"adaa8e60-b130-48ce-891f-c6aa7fb9f156","isCorrect":false,"text":"통 모양"},{"displayOrder":3,"id":"3264c093-250f-4155-ab24-84fca2556e88","isCorrect":false,"text":"동그라미 모양"},{"displayOrder":4,"id":"8547eae1-5ce0-438c-a281-cbfced5b8547","isCorrect":true,"text":"공 모양"}],"prompt":"어느 방향으로 밀어도 잘 굴러가고 평평한 면이 없는 입체 모양은?","skillCode":"infer-shape-from-properties","weight":1}],"title":"최상위 도전!"}],"unit":{"displayOrder":2,"id":"d70914da-44d5-45a5-8f6f-3354227c0ee0","slug":"grade2-shapes","title":"여러 가지 모양을 찾아요"},"version":{"id":"8a600f52-61e6-4d6c-b6d0-b1f524b42df6","label":"v1","number":1}}'::jsonb as document
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
  where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
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
  where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
    and mapping.is_primary
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'grade2_shapes_v1_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'grade2_shapes_v1_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = 3

  union all
  select 3, 'grade2_shapes_v1_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '3e8d5602fce5d8722f535d633aa71a4628b2b36b7c95b208ce2bb1f6d5e5446e'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'grade2_shapes_v1_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'grade2_shapes_v1_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'grade2_shapes_v1_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'grade2_shapes_v1_structure_and_orders',
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
    where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'grade2_shapes_v1_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'grade2_shapes_v1_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid))

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
  where metadata.unit_id = 'd70914da-44d5-45a5-8f6f-3354227c0ee0'::uuid
    and metadata.subject = 'math'
    and metadata.recommended_start_level_code = 'elementary_2'
    and metadata.recommended_end_level_code = 'elementary_2'
    and metadata.parent_sort_order = 2

  union all
  select 21, 'learning_recommendation_latest_published_unit_once',
    count(*) = 1 and bool_and(latest_version.id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid),
    jsonb_build_object('count', count(*), 'version_id', min(latest_version.id::text))
  from (
    select distinct on (version.unit_id) version.id, version.unit_id
    from public.learning_content_versions version
    where version.status = 'published'
      and version.unit_id = 'd70914da-44d5-45a5-8f6f-3354227c0ee0'::uuid
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
  where metadata.unit_id = 'd70914da-44d5-45a5-8f6f-3354227c0ee0'::uuid

  union all
  select 23, 'grade2_shapes_v1_question_weights_exact',
    count(*) = 40
      and bool_and(expected.weight = 1)
      and count(actual.id) = 40,
    jsonb_build_object('questions', count(*), 'weight', min(expected.weight))
  from expected_questions expected
  left join actual_questions actual on actual.id = expected.id

  union all
  select 24, 'grade2_shapes_v1_pass_threshold_contract',
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
  select 25, 'grade2_shapes_v1_forbidden_course_absent',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_courses course
  where course.id = '9b0c7ad0-6cc9-470e-9214-0c97eba89ac4'::uuid
     or course.course_code = 'math-grade2'

  union all
  select 26, 'grade2_shapes_v1_answers_empty',
    count(*) = 0,
    jsonb_build_object('count', count(*))
  from public.learning_attempt_answers answer
  join public.learning_attempts attempt on attempt.id = answer.attempt_id
  where attempt.content_version_id = '8a600f52-61e6-4d6c-b6d0-b1f524b42df6'::uuid

  union all
  select 27, 'grade2_shapes_v1_make_ten_unit_sort_order_preserved',
    count(*) = 1,
    jsonb_build_object('count', count(*), 'sort_order', min(unit.sort_order))
  from public.learning_units unit
  where unit.id = '51000000-0000-4000-8000-000000000002'::uuid
    and unit.course_id = '51000000-0000-4000-8000-000000000001'::uuid
    and unit.unit_code = 'make-ten'
    and unit.sort_order = 1

  union all
  select 28, 'grade2_shapes_v1_course_unit_sort_orders_unique',
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
  select 29, 'grade2_shapes_v1_question_skills_exact',
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
select 999, 'grade2_shapes_v1_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
