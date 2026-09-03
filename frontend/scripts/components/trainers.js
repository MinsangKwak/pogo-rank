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
  const acc = document.getElementById('trainer-acc');
  if (!box) return;
  box.textContent = '';
  // 2026-09-03 v2.2.1 승인된 사용자가 아니면 메뉴에서 항목 자체를 감춘다 (안내문도 노출 안 함)
  const visible = authEnabled() && AUTH.status === 'ok';
  if (acc) { acc.hidden = !visible; if (!visible) acc.open = false; }
  if (!visible) return;
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
  const msg = el('p', { class: 'trainer-msg' }, '이름과 12자리 코드를 한 줄에 하나씩. 같은 이름이 있으면 덮어씁니다.');
  // 2026-09-03 저장 결과를 눈에 보이게: 진행 표시 + 실패 사유(규칙 미게시 등)를 그대로 노출
  const save = el('button', { class: 'sched-more' }, '일괄 저장');
  save.addEventListener('click', async () => {
    const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { msg.textContent = '입력된 줄이 없어요.'; return; }
    save.disabled = true;
    msg.textContent = '저장 중…';
    let saved = 0;
    const badLines = [], errors = [];
    for (const [i, line] of lines.entries()) {
      const digits = (line.match(/[\d\s-]{12,}/)?.[0] ?? '').replace(/\D/g, '');
      const name = line.replace(/[\d\s-]{12,}.*$/, '').trim().replace(/\//g, ' ');
      if (digits.length !== 12 || !name) { badLines.push(line); continue; }
      try {
        // 응답이 없을 때(오프라인·규칙 대기) 화면이 멈추지 않도록 10초 제한
        await Promise.race([
          AUTH.db.collection('trainers').doc(name).set({ name, code: digits, order: i }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('응답 없음(네트워크 확인)')), 10000)),
        ]);
        saved++;
      } catch (e) {
        errors.push(`${name}: ${e.code || e.message || e}`);
      }
    }
    save.disabled = false;
    const parts = [`${saved}개 저장`];
    if (badLines.length) parts.push(`형식이 안 맞는 줄 ${badLines.length}개`);
    if (errors.length) parts.push(`실패 ${errors.length}개 — ${errors[0]}`);
    msg.textContent = parts.join(' · ');
    // permission-denied면 규칙에 trainers 블록이 아직 없다는 뜻
    if (errors.some((e) => /permission-denied/.test(e))) {
      msg.textContent += ' → Firebase 콘솔 > Firestore > 규칙에 trainers 블록을 게시했는지 확인하세요.';
    }
    if (saved) {
      ta.value = '';
      TRAINERS_CACHE = null;
      renderTrainers();
      setTimeout(openTrainerAdmin, 400);
    }
  });
  body.append(el('section', { class: 'd-sec' }, el('h3', {}, '붙여넣어 추가'), ta, msg, save));
}
renderTrainers();
