// ─────────────────────────────────────────────────────────────────────────────
// components/name.js — 포켓몬 이름을 [폼 라벨 뱃지] + 종 이름 으로 나눠 그리는 조각 (2026-09-06 v2.10.0, QA-44)
//
// 왜 필요한가
//   순위표에서 "메가 개굴닌자"·"원시 가이오가"·"섀도우 뮤츠"가 전부 같은 굵기의 한 줄이라
//   메가/원시/섀도우가 눈에 안 들어온다는 요청. 라벨을 작은 뱃지로 떼어 놓으면 종 이름만 남아 훑기 쉽다.
//
// 제공하는 전역
//   splitFormName(name)  → { labels: ['메가'], base: '개굴닌자' }
//   nameNode(name)       → DocumentFragment: <span class="form-tag …">메가</span><b>개굴닌자</b>
//
// 의존하는 전역
//   el (dom.js) · FORM_LABELS (data.js — backend/names.py FORM_KO 에서 빌드가 뽑아 넣는다, 긴 라벨이 앞)
// 라벨은 이름 앞쪽 토큰 중 FORM_LABELS 에 있는 것만 인정한다. 마지막 토큰은 언제나 종 이름으로 남겨
// "가라르 파오리"처럼 라벨이 하나뿐인 이름도, 시트 원문이 그대로 온 이름도 깨지지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

const _formLabelSet = new Set(typeof FORM_LABELS !== 'undefined' ? FORM_LABELS : []);

// 뱃지 색 갈래: 메가·원시 / 섀도우 / 맥스(다이맥스·거다이맥스) / 그 밖(리전·폼)
// 블록 이름을 붙이지 않은 '갈래' 만 돌려준다 — 쓰는 쪽이 자기 블록의 수식어로 만든다
// (form-tag--mega · sprite-box--mega 처럼 같은 갈래를 두 블록이 쓴다)
function formLabelKind(label) {
  if (/^(메가|원시)/.test(label)) return 'mega';
  if (label === '섀도우') return 'shadow';
  if (label === '다이맥스' || label === '거다이맥스') return 'max';
  return '';  // 리전·그 밖의 폼은 기본 뱃지 색 그대로
}

function splitFormName(name) {
  const tokens = String(name ?? '').trim().split(/\s+/);
  const labels = [];
  // 앞에서부터 라벨을 떼어 낸다. 두 단어짜리 라벨('가라르 달마모드')도 있어 두 토큰 묶음을 먼저 본다
  while (tokens.length > 1) {
    const two = tokens.length > 2 ? `${tokens[0]} ${tokens[1]}` : null;
    if (two && _formLabelSet.has(two)) { labels.push(two); tokens.splice(0, 2); continue; }
    if (_formLabelSet.has(tokens[0])) { labels.push(tokens.shift()); continue; }
    break;
  }
  return { labels, base: tokens.join(' ') };
}

// 이름 노드. 라벨이 없으면 <b>이름</b> 하나만 든 fragment 를 돌려준다 (호출부는 늘 같은 모양으로 쓴다)
//   attrs  마지막 <b> 에 붙일 속성 (예: { title: 영문명 })
function nameNode(name, attrs = {}) {
  const { labels, base } = splitFormName(name);
  const fragment = document.createDocumentFragment();
  for (const label of labels) fragment.append(el('span', { class: `form-tag${formLabelKind(label) ? ' form-tag--' + formLabelKind(label) : ''}` }, label));
  fragment.append(el('b', attrs, base));
  return fragment;
}

// 2026-09-10 v2.47.0 한국어 조사 — 앞 글자의 받침을 보고 고른다.
// 안내 문구에 포켓몬 이름을 끼워 넣을 때 "거북왕 와" · "리자몽 로" 처럼 틀린 말이 나오고 있었다.
//   kind 'wa'   와 / 과      (받침 없으면 와)
//   kind 'ro'   로 / 으로    (받침 없거나 ㄹ 이면 로)
//   kind 'i'    이 / 가      (받침 없으면 가)
//   kind 'eun'  은 / 는      (받침 없으면 는)
// 한글이 아닌 글자로 끝나면(영문·숫자) 받침이 있는 것으로 친다 — 이 앱의 이름은 사실상 전부 한글이라
// 예외를 정교하게 다룰 이유가 없고, 틀렸을 때 덜 어색한 쪽이 그쪽이다
function koParticle(word, kind) {
  const last = String(word ?? '').trim().slice(-1);
  const code = last.charCodeAt(0);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const jong = isHangul ? (code - 0xac00) % 28 : -1;      // 0 = 받침 없음
  const hasBatchim = isHangul ? jong !== 0 : true;
  const isRieul = jong === 8;                              // ㄹ 받침
  if (kind === 'ro') return !hasBatchim || isRieul ? '로' : '으로';
  if (kind === 'i') return hasBatchim ? '이' : '가';
  if (kind === 'eun') return hasBatchim ? '은' : '는';
  return hasBatchim ? '과' : '와';
}
