const RAW_WORDS = [
  { id: 'bag', word: '가방', image: '/images/words/bag.svg', imageAlt: '노란 별 장식이 달린 분홍색 가방', letterLevel: 1, syllables: ['가', '방'], color: '#ff817d' },
  { id: 'eggplant', word: '가지', image: '/images/words/eggplant.svg', imageAlt: '초록 꼭지가 달린 보라색 가지', letterLevel: 1, syllables: ['가', '지'], color: '#9b82cc' },
  { id: 'scissors', word: '가위', image: '/images/words/scissors.svg', imageAlt: '손잡이가 노란색인 안전 가위', letterLevel: 1, syllables: ['가', '위'], color: '#f2b94b' },
  { id: 'butterfly', word: '나비', image: '/images/words/butterfly.svg', imageAlt: '꽃밭 위를 날아가는 알록달록한 나비', letterLevel: 1, syllables: ['나', '비'], color: '#ffb44a' },
  { id: 'tree', word: '나무', image: '/images/words/tree.svg', imageAlt: '둥근 초록 잎이 풍성한 나무', letterLevel: 1, syllables: ['나', '무'], color: '#6fbd78' },
  { id: 'trumpet', word: '나팔', image: '/images/words/trumpet.svg', imageAlt: '소리가 퍼져 나오는 노란 나팔', letterLevel: 1, syllables: ['나', '팔'], color: '#ef9e42' },
  { id: 'leg', word: '다리', image: '/images/words/leg.svg', imageAlt: '노란 양말과 빨간 운동화를 신은 사람의 다리', letterLevel: 1, syllables: ['다', '리'], color: '#72c98f' },
  { id: 'squirrel', word: '다람쥐', image: '/images/words/squirrel.svg', imageAlt: '도토리를 안고 있는 갈색 다람쥐', letterLevel: 1, syllables: ['다', '람', '쥐'], color: '#d99555' },
  { id: 'moon', word: '달', image: '/images/words/moon.svg', imageAlt: '별이 빛나는 밤하늘의 노란 초승달', letterLevel: 1, syllables: ['달'], color: '#7c82c9', supportedTypes: ['first-letter', 'full-word'] },
  { id: 'radio', word: '라디오', image: '/images/words/radio.svg', imageAlt: '음표가 흘러나오는 민트색 손잡이 라디오', letterLevel: 1, syllables: ['라', '디', '오'], color: '#6dbbd1' },
  { id: 'garlic', word: '마늘', image: '/images/words/garlic.svg', imageAlt: '초록 잎이 달린 통통한 마늘 여러 쪽', letterLevel: 1, syllables: ['마', '늘'], color: '#a98ade' },
  { id: 'carriage', word: '마차', image: '/images/words/carriage.svg', imageAlt: '갈색 말이 끄는 빨간 지붕의 마차', letterLevel: 1, syllables: ['마', '차'], color: '#df765f' },

  { id: 'banana', word: '바나나', image: '/images/words/banana.svg', imageAlt: '노랗게 익은 바나나 한 송이', letterLevel: 2, syllables: ['바', '나', '나'], color: '#f5bf3f' },
  { id: 'pants', word: '바지', image: '/images/words/pants.svg', imageAlt: '주머니가 달린 파란색 바지', letterLevel: 2, syllables: ['바', '지'], color: '#5eadd0' },
  { id: 'sea', word: '바다', image: '/images/words/sea.svg', imageAlt: '물고기와 돛단배가 있는 푸른 바다', letterLevel: 2, syllables: ['바', '다'], color: '#55b8d5' },
  { id: 'apple', word: '사과', image: '/images/words/apple.svg', imageAlt: '초록 잎이 달린 빨간 사과', letterLevel: 2, syllables: ['사', '과'], color: '#ef6f68' },
  { id: 'lion', word: '사자', image: '/images/words/lion.svg', imageAlt: '둥근 갈기가 있는 웃는 아기 사자', letterLevel: 2, syllables: ['사', '자'], color: '#e4a44c' },
  { id: 'deer', word: '사슴', image: '/images/words/deer.svg', imageAlt: '작은 뿔과 하얀 점무늬가 있는 사슴', letterLevel: 2, syllables: ['사', '슴'], color: '#c58a5b' },
  { id: 'baby', word: '아기', image: '/images/words/baby.svg', imageAlt: '노란 턱받이를 하고 웃는 아기', letterLevel: 2, syllables: ['아', '기'], color: '#72c7b1' },
  { id: 'icecream', word: '아이스크림', image: '/images/words/icecream.svg', imageAlt: '딸기와 바닐라가 올라간 아이스크림', letterLevel: 2, syllables: ['아', '이', '스', '크', '림'], color: '#ee91ad' },
  { id: 'automobile', word: '자동차', image: '/images/words/automobile.svg', imageAlt: '노란 불빛이 켜진 빨간 자동차', letterLevel: 2, syllables: ['자', '동', '차'], color: '#ed736d' },
  { id: 'bicycle', word: '자전거', image: '/images/words/bicycle.svg', imageAlt: '민트색 바퀴가 달린 빨간 자전거', letterLevel: 2, syllables: ['자', '전', '거'], color: '#5eadd0' },
  { id: 'plum', word: '자두', image: '/images/words/plum.svg', imageAlt: '초록 잎이 달린 동그란 보라색 자두', letterLevel: 2, syllables: ['자', '두'], color: '#a075c4' },
  { id: 'car', word: '차', image: '/images/words/car.svg', imageAlt: '둥근 모양의 하늘색 자동차', letterLevel: 2, syllables: ['차'], color: '#8f83db', supportedTypes: ['first-letter', 'full-word'] },

  { id: 'camera', word: '카메라', image: '/images/words/camera.svg', imageAlt: '큰 렌즈가 달린 분홍색 카메라', letterLevel: 3, syllables: ['카', '메', '라'], color: '#e982a1' },
  { id: 'card', word: '카드', image: '/images/words/card.svg', imageAlt: '노란 별과 하트가 그려진 카드', letterLevel: 3, syllables: ['카', '드'], color: '#e5b94c' },
  { id: 'curry', word: '카레', image: '/images/words/curry.svg', imageAlt: '밥과 당근이 담긴 따뜻한 카레 한 그릇', letterLevel: 3, syllables: ['카', '레'], color: '#e1a441' },
  { id: 'ostrich', word: '타조', image: '/images/words/ostrich.svg', imageAlt: '긴 다리로 서 있는 귀여운 타조', letterLevel: 3, syllables: ['타', '조'], color: '#e4a44c' },
  { id: 'tire', word: '타이어', image: '/images/words/tire.svg', imageAlt: '하늘색 휠이 끼워진 검은색 타이어', letterLevel: 3, syllables: ['타', '이', '어'], color: '#6a6875' },
  { id: 'wave', word: '파도', image: '/images/words/wave.svg', imageAlt: '하얀 물보라가 치는 파란 파도', letterLevel: 3, syllables: ['파', '도'], color: '#4faecc' },
  { id: 'fly', word: '파리', image: '/images/words/fly.svg', imageAlt: '투명한 날개가 달린 귀여운 파리', letterLevel: 3, syllables: ['파', '리'], color: '#76b49a' },
  { id: 'green-onion', word: '파', image: '/images/words/green-onion.svg', imageAlt: '하얀 뿌리가 달린 싱싱한 초록색 파', letterLevel: 3, syllables: ['파'], color: '#65ad68', supportedTypes: ['first-letter', 'full-word'] },
  { id: 'hippo', word: '하마', image: '/images/words/hippo.svg', imageAlt: '물가에서 웃고 있는 보라색 하마', letterLevel: 3, syllables: ['하', '마'], color: '#9b82cc' },
  { id: 'sky', word: '하늘', image: '/images/words/sky.svg', imageAlt: '해와 구름과 무지개가 떠 있는 파란 하늘', letterLevel: 3, syllables: ['하', '늘'], color: '#65b9df' },
  { id: 'heart', word: '하트', image: '/images/words/heart.svg', imageAlt: '작은 별에 둘러싸인 커다란 분홍색 하트', letterLevel: 3, syllables: ['하', '트'], color: '#ef7890' },
]

export const WORDS = RAW_WORDS.map((word) => ({
  ...word,
  image: `${import.meta.env.BASE_URL}${word.image.replace(/^\/+/, '')}`,
}))

export function getWordsForLevel(level) {
  return WORDS.filter((word) => word.letterLevel === Number(level))
}
