export const LETTER_LEVELS = [
  { level: 1, title: 'ㅏ 첫걸음', letters: ['가', '나', '다', '라', '마'], available: true },
  { level: 2, title: 'ㅏ 이어가기', letters: ['바', '사', '아', '자', '차'], available: true },
  { level: 3, title: 'ㅏ 힘찬 마무리', letters: ['카', '타', '파', '하'], available: true },
  { level: 4, title: 'ㅓ 첫걸음', letters: ['거', '너', '더', '러', '머'], available: false },
  { level: 5, title: 'ㅓ 이어가기', letters: ['버', '서', '어', '저', '처'], available: false },
  { level: 6, title: 'ㅗ 첫걸음', letters: ['고', '노', '도', '로', '모'], available: false },
  { level: 7, title: 'ㅗ 이어가기', letters: ['보', '소', '오', '조', '초'], available: false },
  { level: 8, title: 'ㅜ 첫걸음', letters: ['구', '누', '두', '루', '무'], available: false },
  { level: 9, title: 'ㅜ 이어가기', letters: ['부', '수', '우', '주', '추'], available: false },
  { level: 10, title: 'ㅡ 글자', letters: ['그', '느', '드', '르', '므'], available: false },
  { level: 11, title: 'ㅣ 첫걸음', letters: ['기', '니', '디', '리', '미'], available: false },
  { level: 12, title: 'ㅣ 이어가기', letters: ['비', '시', '이', '지', '치'], available: false },
  { level: 13, title: '쌍자음', letters: ['까', '따', '빠', '싸', '짜'], available: false },
  { level: 14, title: '복합모음', letters: ['과', '워', '외', '위', '웨'], available: false },
  { level: 15, title: '쉬운 받침', letters: ['간', '밤', '공', '눈', '달'], available: false },
  { level: 16, title: '다양한 받침', letters: ['곰', '집', '꽃', '문', '별'], available: false },
  { level: 17, title: '복합받침', letters: ['닭', '삶', '값', '몫', '흙'], available: false },
]

export const QUESTION_TYPES = [
  { id: 'first-letter', name: '첫 글자 맞히기', description: '그림을 보고 낱말의 첫 글자를 골라요.', available: true },
  { id: 'last-letter', name: '마지막 글자 맞히기', description: '낱말의 마지막 글자를 골라요.', available: true },
  { id: 'middle-letter', name: '가운데 글자 맞히기', description: '낱말 가운데의 빈칸을 채워요.', available: true },
  { id: 'full-word', name: '완성 단어 선택', description: '그림과 같은 완성 낱말을 골라요.', available: true },
  { id: 'word-order', name: '글자 순서 맞추기', description: '흩어진 글자를 순서대로 놓아요.', available: false },
  { id: 'compose-letter', name: '자음·모음 조합', description: '자음과 모음을 합쳐 글자를 만들어요.', available: false },
]

export function getLetterLevel(level) {
  return LETTER_LEVELS.find((item) => item.level === Number(level)) || LETTER_LEVELS[0]
}
