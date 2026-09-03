// 2026-09-03 v2.2.0 트레이너 코드: 공개 저장소에서 코드를 빼고 Firestore로 이동
// 승인된 로그인 사용자만 조회, 관리자만 등록·삭제 (규칙: firestore.rules의 trainers)
let TRAINERS_CACHE = null;

function copyDigits(btn, code) {
  return async () => {
    const digits = code.replace(/\D/g, '');  // 게임 입력창에 맞게 숫자만
    let ok = false;
    try { await navigator.clipboard.writeText(digits); ok = true; }
    catch {
      // 클립보드 API가 막힌 환경 폴백
      const ta = document.createElement('textarea');
      ta.value = digits; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    btn.textContent = ok ? '복사됨 ✓' : '복사 실패';
    setTimeout(() => { btn.textContent = '복사'; }, 1500);
  };
}

// 표시용 4자리 묶음
function fmtCode(code) {
  const d = code.replace(/\D/g, '');
  return d.length === 12 ? `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}` : code;
}

async function loadTrainers(force) {
  if (TRAINERS_CACHE && !force) return TRAINERS_CACHE;
  if (AUTH.status !== 'ok') return [];
  const snap = await AUTH.db.collection('trainers').get().catch(() => null);
  TRAINERS_CACHE = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'ko'));
  return TRAINERS_CACHE;
}

async function renderTrainers() {
  const box = document.getElementById('trainer-list');
  if (!box) return;
  box.textContent = '';
  if (!authEnabled()) { box.append(el('p', { class: 'd-foot' }, '로그인 기능이 꺼진 빌드입니다.')); return; }
  if (AUTH.status !== 'ok') {
    box.append(el('p', { class: 'd-foot' }, AUTH.status === 'pending'
      ? '⏳ 승인 대기 중 — 승인되면 트레이너 코드가 보입니다.'
      : '🔐 로그인한 친구에게만 보입니다. 위 계정 영역에서 로그인해 주세요.'));
    return;
  }
  const rows = await loadTrainers();
  if (!rows.length) {
    box.append(el('p', { class: 'd-foot' }, AUTH.admin ? '아직 등록된 코드가 없어요. 아래 “코드 관리”에서 추가하세요.' : '아직 등록된 코드가 없어요.'));
  }
  for (const t of rows) {
    const btn = el('button', { class: 'copy-btn' }, '복사');
    btn.addEventListener('click', copyDigits(btn, t.code));
    box.append(el('div', { class: 'trainer-row' }, el('b', {}, t.name), el('code', {}, fmtCode(t.code)), btn));
  }
  if (rows.length) box.append(el('p', { class: 'd-foot' }, '복사하면 공백 없는 12자리로 복사됩니다 — 게임의 친구 추가 화면에 바로 붙여넣으세요.'));
  if (AUTH.admin) box.append(el('button', { class: 'sched-more', onclick: openTrainerAdmin }, '🛠 코드 관리 (추가·삭제) →'));
}

// 관리자 전용: 한 줄에 "이름 코드" 형식으로 붙여넣어 일괄 등록 + 개별 삭제
async function openTrainerAdmin() {
  if (!AUTH.admin) return;
  closeDrawer();
  const body = el('div', { class: 'detail admin' }, el('h2', {}, '🛠 트레이너 코드 관리'));
  openModal(body);
  const rows = await loadTrainers(true);
  const list = el('div', { class: 'admin-rows' }, ...rows.map((t) => el('div', { class: 'admin-row' },
    el('div', { class: 'admin-who' }, el('b', {}, t.name), el('span', { class: 'acct-email' }, fmtCode(t.code))),
    el('button', { class: 'uchip admin-act danger', onclick: async () => {
      if (!confirm(`${t.name} 코드를 삭제할까요?`)) return;
      await AUTH.db.collection('trainers').doc(t.id).delete().catch(() => {});
      openTrainerAdmin();
      renderTrainers();
    } }, '삭제'))));
  body.append(el('section', { class: 'd-sec' }, el('h3', {}, `등록된 코드 ${rows.length}개`),
    rows.length ? list : el('p', { class: 'empty' }, '아직 없습니다.')));

  const ta = el('textarea', { class: 'trainer-bulk', rows: '6', placeholder: '한 줄에 하나씩\n이름 0000 0000 0000\n이름2 1111 2222 3333' });
  const msg = el('p', { class: 'd-foot' }, '이름과 12자리 코드를 한 줄에 하나씩. 같은 이름이 있으면 덮어씁니다.');
  const save = el('button', { class: 'sched-more', onclick: async () => {
    const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
    let n = 0, bad = 0;
    for (const [i, line] of lines.entries()) {
      const digits = (line.match(/[\d\s-]{12,}/)?.[0] ?? '').replace(/\D/g, '');
      const name = line.replace(/[\d\s-]{12,}.*$/, '').trim();
      if (digits.length !== 12 || !name) { bad++; continue; }
      await AUTH.db.collection('trainers').doc(name).set({ name, code: digits, order: i }).catch(() => { bad++; });
      n++;
    }
    msg.textContent = `${n}개 저장${bad ? ` · ${bad}줄은 형식이 안 맞아 건너뜀` : ''}`;
    ta.value = '';
    TRAINERS_CACHE = null;
    renderTrainers();
    if (n) openTrainerAdmin();
  } }, '일괄 저장');
  body.append(el('section', { class: 'd-sec' }, el('h3', {}, '붙여넣어 추가'), ta, save, msg));
}
renderTrainers();
