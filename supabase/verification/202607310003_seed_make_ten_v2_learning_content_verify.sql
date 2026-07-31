-- Phase 2B v2 content verification. Read-only and row-aggregate only.
begin transaction read only;

with expected_content as (
  select '{"course":{"id":"51000000-0000-4000-8000-000000000001","internalName":"수학 기초 과정","slug":"math-core","subject":"수학"},"schemaVersion":1,"stages":[{"difficulty":"seed","displayOrder":1,"id":"62000000-0000-4000-8000-000000000001","questions":[{"displayOrder":1,"explanation":"7에 3을 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000001","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000001","isCorrect":false,"text":"1"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000002","isCorrect":false,"text":"2"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000003","isCorrect":true,"text":"3"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000004","isCorrect":false,"text":"4"}],"prompt":"7에 얼마를 더하면 10이 될까요?","weight":1},{"displayOrder":2,"explanation":"4에 6을 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000002","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000005","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000006","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000007","isCorrect":true,"text":"6"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000008","isCorrect":false,"text":"7"}],"prompt":"4에 얼마를 더하면 10이 될까요?","weight":1},{"displayOrder":3,"explanation":"2에 8을 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000003","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000009","isCorrect":false,"text":"1"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000010","isCorrect":true,"text":"2"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000011","isCorrect":false,"text":"3"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000012","isCorrect":false,"text":"4"}],"prompt":"얼마에 8을 더하면 10이 될까요?","weight":1},{"displayOrder":4,"explanation":"5와 5를 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000004","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000013","isCorrect":false,"text":"3"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000014","isCorrect":false,"text":"4"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000015","isCorrect":true,"text":"5"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000016","isCorrect":false,"text":"6"}],"prompt":"5에 얼마를 더하면 10이 될까요?","weight":1},{"displayOrder":5,"explanation":"9에 1을 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000005","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000017","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000018","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000019","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000020","isCorrect":false,"text":"10"}],"prompt":"얼마에 1을 더하면 10이 될까요?","weight":1},{"displayOrder":6,"explanation":"6에 4를 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000006","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000021","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000022","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000023","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000024","isCorrect":false,"text":"5"}],"prompt":"6에 얼마를 더하면 10이 될까요?","weight":1},{"displayOrder":7,"explanation":"2와 8을 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000007","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000025","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000026","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000027","isCorrect":true,"text":"8"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000028","isCorrect":false,"text":"9"}],"prompt":"2와 어떤 수를 더하면 10이 될까요?","weight":1},{"displayOrder":8,"explanation":"3과 7의 합은 10입니다.","id":"63000000-0000-4000-8000-000000000008","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000029","isCorrect":false,"text":"5"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000030","isCorrect":false,"text":"6"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000031","isCorrect":true,"text":"7"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000032","isCorrect":false,"text":"8"}],"prompt":"10은 3과 어떤 수의 합일까요?","weight":1},{"displayOrder":9,"explanation":"4와 6을 더한 식의 값은 10입니다.","id":"63000000-0000-4000-8000-000000000009","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000033","isCorrect":false,"text":"4 + 5"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000034","isCorrect":true,"text":"4 + 6"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000035","isCorrect":false,"text":"5 + 4"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000036","isCorrect":false,"text":"6 + 3"}],"prompt":"더해서 10이 되는 식은 무엇일까요?","weight":1},{"displayOrder":10,"explanation":"0에 10을 더하면 10이 됩니다.","id":"63000000-0000-4000-8000-000000000010","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000037","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000038","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000039","isCorrect":false,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000040","isCorrect":true,"text":"10"}],"prompt":"0에 얼마를 더하면 10이 될까요?","weight":1}],"title":"짝을 찾아요"},{"difficulty":"leaf","displayOrder":2,"id":"62000000-0000-4000-8000-000000000002","questions":[{"displayOrder":1,"explanation":"3에서 네 칸 더 가면 7입니다.","id":"63000000-0000-4000-8000-000000000011","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000041","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000042","isCorrect":true,"text":"7"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000043","isCorrect":false,"text":"8"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000044","isCorrect":false,"text":"9"}],"prompt":"3 + 4는 얼마일까요?","weight":1},{"displayOrder":2,"explanation":"2와 5를 더하면 7입니다.","id":"63000000-0000-4000-8000-000000000012","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000045","isCorrect":false,"text":"5"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000046","isCorrect":false,"text":"6"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000047","isCorrect":true,"text":"7"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000048","isCorrect":false,"text":"8"}],"prompt":"2 + 5는 얼마일까요?","weight":1},{"displayOrder":3,"explanation":"6에 3을 더하면 9입니다.","id":"63000000-0000-4000-8000-000000000013","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000049","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000050","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000051","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000052","isCorrect":false,"text":"10"}],"prompt":"6 + 3은 얼마일까요?","weight":1},{"displayOrder":4,"explanation":"1과 8을 더하면 9입니다.","id":"63000000-0000-4000-8000-000000000014","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000053","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000054","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000055","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000056","isCorrect":false,"text":"10"}],"prompt":"1 + 8은 얼마일까요?","weight":1},{"displayOrder":5,"explanation":"4를 두 번 더하면 8입니다.","id":"63000000-0000-4000-8000-000000000015","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000057","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000058","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000059","isCorrect":true,"text":"8"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000060","isCorrect":false,"text":"9"}],"prompt":"4 + 4는 얼마일까요?","weight":1},{"displayOrder":6,"explanation":"5에 3을 더하면 8입니다.","id":"63000000-0000-4000-8000-000000000016","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000061","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000062","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000063","isCorrect":true,"text":"8"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000064","isCorrect":false,"text":"9"}],"prompt":"5 + 3은 얼마일까요?","weight":1},{"displayOrder":7,"explanation":"2와 6을 더하면 8입니다.","id":"63000000-0000-4000-8000-000000000017","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000065","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000066","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000067","isCorrect":true,"text":"8"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000068","isCorrect":false,"text":"9"}],"prompt":"2 + 6은 얼마일까요?","weight":1},{"displayOrder":8,"explanation":"7에 2를 더하면 9입니다.","id":"63000000-0000-4000-8000-000000000018","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000069","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000070","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000071","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000072","isCorrect":false,"text":"10"}],"prompt":"7 + 2는 얼마일까요?","weight":1},{"displayOrder":9,"explanation":"3과 6을 더하면 9입니다.","id":"63000000-0000-4000-8000-000000000019","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000073","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000074","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000075","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000076","isCorrect":false,"text":"10"}],"prompt":"3 + 6은 얼마일까요?","weight":1},{"displayOrder":10,"explanation":"4와 5를 더하면 9입니다.","id":"63000000-0000-4000-8000-000000000020","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000077","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000078","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000079","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000080","isCorrect":false,"text":"10"}],"prompt":"4 + 5는 얼마일까요?","weight":1}],"title":"더해 보아요"},{"difficulty":"tree","displayOrder":3,"id":"62000000-0000-4000-8000-000000000003","questions":[{"displayOrder":1,"explanation":"3에 5를 더하면 8이므로 빈칸은 5입니다.","id":"63000000-0000-4000-8000-000000000021","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000081","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000082","isCorrect":true,"text":"5"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000083","isCorrect":false,"text":"6"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000084","isCorrect":false,"text":"7"}],"prompt":"3 + □ = 8입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":2,"explanation":"6에 4를 더하면 10이므로 빈칸은 6입니다.","id":"63000000-0000-4000-8000-000000000022","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000085","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000086","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000087","isCorrect":true,"text":"6"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000088","isCorrect":false,"text":"7"}],"prompt":"□ + 4 = 10입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":3,"explanation":"9에서 4를 빼면 5이므로 빈칸은 4입니다.","id":"63000000-0000-4000-8000-000000000023","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000089","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000090","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000091","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000092","isCorrect":false,"text":"5"}],"prompt":"9 - □ = 5입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":4,"explanation":"5에 2를 더하면 7이므로 빈칸은 5입니다.","id":"63000000-0000-4000-8000-000000000024","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000093","isCorrect":false,"text":"3"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000094","isCorrect":false,"text":"4"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000095","isCorrect":true,"text":"5"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000096","isCorrect":false,"text":"6"}],"prompt":"□ + 2 = 7입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":5,"explanation":"10에서 7을 빼면 3이므로 빈칸은 7입니다.","id":"63000000-0000-4000-8000-000000000025","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000097","isCorrect":false,"text":"5"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000098","isCorrect":false,"text":"6"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000099","isCorrect":true,"text":"7"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000100","isCorrect":false,"text":"8"}],"prompt":"10 - □ = 3입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":6,"explanation":"6에 3을 더하면 9이므로 빈칸은 6입니다.","id":"63000000-0000-4000-8000-000000000026","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000101","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000102","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000103","isCorrect":true,"text":"6"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000104","isCorrect":false,"text":"7"}],"prompt":"□ + 3 = 9입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":7,"explanation":"8에서 6을 빼면 2이므로 빈칸은 6입니다.","id":"63000000-0000-4000-8000-000000000027","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000105","isCorrect":false,"text":"4"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000106","isCorrect":false,"text":"5"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000107","isCorrect":true,"text":"6"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000108","isCorrect":false,"text":"7"}],"prompt":"8 - □ = 2입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":8,"explanation":"5에 4를 더하면 9이므로 빈칸은 4입니다.","id":"63000000-0000-4000-8000-000000000028","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000109","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000110","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000111","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000112","isCorrect":false,"text":"5"}],"prompt":"5 + □ = 9입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":9,"explanation":"10에서 4를 빼면 6이므로 빈칸은 4입니다.","id":"63000000-0000-4000-8000-000000000029","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000113","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000114","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000115","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000116","isCorrect":false,"text":"5"}],"prompt":"10 - □ = 6입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":10,"explanation":"8에서 3을 빼면 5이므로 빈칸은 8입니다.","id":"63000000-0000-4000-8000-000000000030","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000117","isCorrect":false,"text":"6"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000118","isCorrect":false,"text":"7"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000119","isCorrect":true,"text":"8"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000120","isCorrect":false,"text":"9"}],"prompt":"□ - 3 = 5입니다. □에 들어갈 수는 무엇일까요?","weight":1}],"title":"빈칸을 채워요"},{"difficulty":"crown","displayOrder":4,"id":"62000000-0000-4000-8000-000000000004","questions":[{"displayOrder":1,"explanation":"3개와 2개를 더하면 모두 5개입니다.","id":"63000000-0000-4000-8000-000000000031","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000121","isCorrect":false,"text":"4개"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000122","isCorrect":true,"text":"5개"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000123","isCorrect":false,"text":"6개"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000124","isCorrect":false,"text":"7개"}],"prompt":"사과가 3개 있었는데 2개를 더 받았어요. 모두 몇 개일까요?","weight":1},{"displayOrder":2,"explanation":"7에 3을 더하면 10이므로 3자루가 더 필요합니다.","id":"63000000-0000-4000-8000-000000000032","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000125","isCorrect":false,"text":"1자루"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000126","isCorrect":false,"text":"2자루"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000127","isCorrect":true,"text":"3자루"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000128","isCorrect":false,"text":"4자루"}],"prompt":"연필이 7자루 있어요. 10자루가 되려면 몇 자루가 더 필요할까요?","weight":1},{"displayOrder":3,"explanation":"6에 4를 더하면 10이므로 빈칸은 4입니다.","id":"63000000-0000-4000-8000-000000000033","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000129","isCorrect":false,"text":"2"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000130","isCorrect":false,"text":"3"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000131","isCorrect":true,"text":"4"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000132","isCorrect":false,"text":"5"}],"prompt":"6 + □ = 10입니다. □에 들어갈 수는 무엇일까요?","weight":1},{"displayOrder":4,"explanation":"9에서 2를 빼면 7이므로 공은 7개 남습니다.","id":"63000000-0000-4000-8000-000000000034","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000133","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000134","isCorrect":false,"text":"6개"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000135","isCorrect":true,"text":"7개"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000136","isCorrect":false,"text":"8개"}],"prompt":"공 9개 중에서 2개를 사용했어요. 남은 공은 몇 개일까요?","weight":1},{"displayOrder":5,"explanation":"2와 3을 더한 5에 4를 더하면 9입니다.","id":"63000000-0000-4000-8000-000000000035","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000137","isCorrect":false,"text":"7"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000138","isCorrect":false,"text":"8"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000139","isCorrect":true,"text":"9"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000140","isCorrect":false,"text":"10"}],"prompt":"2 + 3 + 4는 얼마일까요?","weight":1},{"displayOrder":6,"explanation":"4에 6을 더하면 10이므로 6개를 더 모아야 합니다.","id":"63000000-0000-4000-8000-000000000036","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000141","isCorrect":false,"text":"4개"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000142","isCorrect":false,"text":"5개"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000143","isCorrect":true,"text":"6개"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000144","isCorrect":false,"text":"7개"}],"prompt":"구슬이 4개 있어요. 10개가 되려면 몇 개를 더 모아야 할까요?","weight":1},{"displayOrder":7,"explanation":"10에서 3을 빼면 7이므로 7개가 남습니다.","id":"63000000-0000-4000-8000-000000000037","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000145","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000146","isCorrect":false,"text":"6개"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000147","isCorrect":true,"text":"7개"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000148","isCorrect":false,"text":"8개"}],"prompt":"귤 10개 중 3개를 먹었어요. 몇 개가 남았을까요?","weight":1},{"displayOrder":8,"explanation":"2개와 5개를 더하면 모두 7개입니다.","id":"63000000-0000-4000-8000-000000000038","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000149","isCorrect":false,"text":"5개"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000150","isCorrect":false,"text":"6개"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000151","isCorrect":true,"text":"7개"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000152","isCorrect":false,"text":"8개"}],"prompt":"빨간 블록 2개와 파란 블록 5개가 있어요. 모두 몇 개일까요?","weight":1},{"displayOrder":9,"explanation":"8에서 5를 빼면 3이므로 3마리가 남습니다.","id":"63000000-0000-4000-8000-000000000039","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000153","isCorrect":false,"text":"2마리"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000154","isCorrect":true,"text":"3마리"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000155","isCorrect":false,"text":"4마리"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000156","isCorrect":false,"text":"5마리"}],"prompt":"새 8마리 중 5마리가 날아갔어요. 몇 마리가 남았을까요?","weight":1},{"displayOrder":10,"explanation":"6개와 4개를 더하면 모두 10개입니다.","id":"63000000-0000-4000-8000-000000000040","options":[{"displayOrder":1,"id":"64000000-0000-4000-8000-000000000157","isCorrect":false,"text":"7개"},{"displayOrder":2,"id":"64000000-0000-4000-8000-000000000158","isCorrect":false,"text":"8개"},{"displayOrder":3,"id":"64000000-0000-4000-8000-000000000159","isCorrect":false,"text":"9개"},{"displayOrder":4,"id":"64000000-0000-4000-8000-000000000160","isCorrect":true,"text":"10개"}],"prompt":"상자에 공 6개를 넣고 4개를 더 넣었어요. 모두 몇 개일까요?","weight":1}],"title":"이야기로 풀어요"}],"unit":{"displayOrder":1,"id":"51000000-0000-4000-8000-000000000002","slug":"make-ten","title":"10을 만들어요"},"version":{"id":"61000000-0000-4000-8000-000000000003","label":"v2","number":2}}'::jsonb as document
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
  where content_version_id = '61000000-0000-4000-8000-000000000003'::uuid
), actual_questions as (
  select question.id::text, question.stage_id::text, question.display_order,
         question.prompt, question.explanation
  from public.learning_questions question
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '61000000-0000-4000-8000-000000000003'::uuid
), actual_options as (
  select option.id::text, option.question_id::text, option.display_order,
         option.option_text, option.is_correct
  from public.learning_question_options option
  join public.learning_questions question on question.id = option.question_id
  join public.learning_stages stage on stage.id = question.stage_id
  where stage.content_version_id = '61000000-0000-4000-8000-000000000003'::uuid
), checks(check_order, check_name, passed, result_data) as (
  select 1, 'make_ten_course_exact',
    count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_courses course, expected_content expected
  where course.id = (expected.document->'course'->>'id')::uuid
    and course.course_code = expected.document->'course'->>'slug'
    and course.internal_name = expected.document->'course'->>'internalName'
    and course.subject_name = expected.document->'course'->>'subject'
    and course.status = 'published'

  union all
  select 2, 'make_ten_unit_exact', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_units unit, expected_content expected
  where unit.id = (expected.document->'unit'->>'id')::uuid
    and unit.course_id = (expected.document->'course'->>'id')::uuid
    and unit.unit_code = expected.document->'unit'->>'slug'
    and unit.display_title = expected.document->'unit'->>'title'
    and unit.sort_order = (expected.document->'unit'->>'displayOrder')::integer

  union all
  select 3, 'make_ten_version_published', count(*) = 1,
    jsonb_build_object('count', count(*))
  from public.learning_content_versions version, expected_content expected
  where version.id = (expected.document->'version'->>'id')::uuid
    and version.unit_id = (expected.document->'unit'->>'id')::uuid
    and version.version_no = (expected.document->'version'->>'number')::integer
    and version.content_hash = '2deee8d9fe17db4e8d04870de6520c946ce029641f98abe3ce48a4bde172557d'
    and version.status = 'published'
    and version.published_at is not null
    and version.retired_at is null

  union all
  select 4, 'make_ten_stages_exact',
    (select count(*) from actual_stages) = 4
      and not exists ((select id, display_order, display_title, difficulty from expected_stages) except (select * from actual_stages))
      and not exists ((select * from actual_stages) except (select id, display_order, display_title, difficulty from expected_stages)),
    jsonb_build_object('count', (select count(*) from actual_stages))

  union all
  select 5, 'make_ten_questions_exact',
    (select count(*) from actual_questions) = 40
      and not exists ((select id, stage_id, display_order, prompt, explanation from expected_questions) except (select * from actual_questions))
      and not exists ((select * from actual_questions) except (select id, stage_id, display_order, prompt, explanation from expected_questions)),
    jsonb_build_object('count', (select count(*) from actual_questions))

  union all
  select 6, 'make_ten_options_exact',
    (select count(*) from actual_options) = 160
      and not exists ((select id, question_id, display_order, option_text, is_correct from expected_options) except (select * from actual_options))
      and not exists ((select * from actual_options) except (select id, question_id, display_order, option_text, is_correct from expected_options)),
    jsonb_build_object('count', (select count(*) from actual_options))

  union all
  select 7, 'make_ten_structure_and_orders',
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
    where stage.content_version_id = '61000000-0000-4000-8000-000000000003'::uuid
    group by question.id
  ) structure

  union all
  select 8, 'make_ten_stage_question_counts',
    count(*) = 4 and bool_and(question_count = 10),
    jsonb_build_object('stages', count(*), 'questions_per_stage', jsonb_agg(question_count order by display_order))
  from (
    select stage.display_order, count(question.*) as question_count
    from public.learning_stages stage
    join public.learning_questions question on question.stage_id = stage.id
    where stage.content_version_id = '61000000-0000-4000-8000-000000000003'::uuid
    group by stage.id, stage.display_order
  ) structure

  union all
  select 9, 'make_ten_no_user_learning_or_reward_rows',
    (select count(*) from public.learning_assignments where content_version_id = '61000000-0000-4000-8000-000000000003'::uuid) = 0
      and (select count(*) from public.learning_attempts where content_version_id = '61000000-0000-4000-8000-000000000003'::uuid) = 0
      and (select count(*) from public.learning_stage_first_passes where content_version_id = '61000000-0000-4000-8000-000000000003'::uuid) = 0
      and (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '61000000-0000-4000-8000-000000000003'::uuid) = 0,
    jsonb_build_object('assignments', (select count(*) from public.learning_assignments where content_version_id = '61000000-0000-4000-8000-000000000003'::uuid),
                       'attempts', (select count(*) from public.learning_attempts where content_version_id = '61000000-0000-4000-8000-000000000003'::uuid),
                       'first_passes', (select count(*) from public.learning_stage_first_passes where content_version_id = '61000000-0000-4000-8000-000000000003'::uuid),
                       'learning_rewards', (select count(*) from public.sticker_transactions ledger_row join public.learning_stage_first_passes first_pass on first_pass.id::text = ledger_row.source_id where ledger_row.source_type = 'learning_stage_first_pass' and first_pass.content_version_id = '61000000-0000-4000-8000-000000000003'::uuid))

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
  select 12, 'make_ten_v1_preserved',
    exists (
      select 1 from public.learning_content_versions version
      where version.id = '51000000-0000-4000-8000-000000000003'::uuid
        and version.unit_id = '51000000-0000-4000-8000-000000000002'::uuid
        and version.version_no = 1
        and version.status = 'published'
    )
    and (select count(*) from public.learning_stages where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 4
    and (select count(*) from public.learning_questions question join public.learning_stages stage on stage.id = question.stage_id where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 20
    and (select count(*) from public.learning_question_options option join public.learning_questions question on question.id = option.question_id join public.learning_stages stage on stage.id = question.stage_id where stage.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid) = 80,
    jsonb_build_object('preserved', true)

  union all
  select 13, 'make_ten_latest_published_is_v2',
    (select version.id from public.learning_content_versions version where version.unit_id = '51000000-0000-4000-8000-000000000002'::uuid and version.status = 'published' order by version.version_no desc limit 1) = '61000000-0000-4000-8000-000000000003'::uuid,
    jsonb_build_object('version_no', 2)

  union all
  select 14, 'make_ten_v1_assignment_references_preserved',
    not exists (
      select 1 from public.learning_assignments assignment
      where assignment.content_version_id = '51000000-0000-4000-8000-000000000003'::uuid
        and assignment.unit_id is distinct from '51000000-0000-4000-8000-000000000002'::uuid
    ),
    jsonb_build_object('v1_assignments', (select count(*) from public.learning_assignments where content_version_id = '51000000-0000-4000-8000-000000000003'::uuid))

  union all
  select 15, 'make_ten_v2_pass_threshold_snapshot',
    ceil(10 * 8 / 10.0)::integer = 8
      and pg_get_functiondef(to_regprocedure('public.start_or_resume_learning_attempt(uuid,uuid,uuid,uuid,uuid,uuid)')) ~* 'ceil\(question_count \* 8 / 10\.0\)',
    jsonb_build_object('total_questions', 10, 'required_correct_answers', 8)
)
select check_order, check_name, passed, result_data
from checks
union all
select 999, 'make_ten_content_verification_summary', bool_and(passed),
  jsonb_build_object('total_checks', count(*), 'passed_checks', count(*) filter (where passed), 'failed_checks', count(*) filter (where not passed))
from checks
order by check_order;

rollback;
