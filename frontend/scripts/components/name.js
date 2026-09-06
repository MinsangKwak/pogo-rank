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
function formLabelKind(label) {
  if (/^(메가|원시)/.test(label)) return 'mega';
  if (label === '섀도우') return 'shadow';
  if (label === '다이맥스' || label === '거다이맥스') return 'max';
  return 'form';
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
  for (const label of labels) fragment.append(el('span', { class: `form-tag ${formLabelKind(label)}` }, label));
  fragment.append(el('b', attrs, base));
  return fragment;
}
