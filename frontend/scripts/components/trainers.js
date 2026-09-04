// 2026-09-03 v2.2.0 트레이너 코드: 공개 저장소에서 코드를 빼고 Firestore로 이동
// 승인된 로그인 사용자만 조회, 관리자만 등록·삭제 (규칙: firestore.rules의 trainers)
//
// ── 왜 코드를 저장소가 아니라 Firestore에 두는가 ────────────────────────────
// 트레이너 코드는 친구 추가 요청이 그대로 들어오는 개인 식별값이다.
// 이 저장소는 공개이고 빌드 결과(dist/index.html)에도 js가 그대로 인라인되므로,
// 코드를 파일로 두면 검색만으로 누구나 읽을 수 있다.
// 그래서 값은 Firestore trainers 컬렉션에만 두고, 읽기 권한을 보안 규칙에서
// "승인된 사용자(isApproved)"로 제한한다 — 화면 코드가 아니라 규칙이 실제 차단막이다.
//
// TRAINERS_CACHE: 한 세션 안에서 같은 목록을 반복 조회하지 않기 위한 캐시.
// 로그인 계정이 바뀌면(onAuthChange) null로 비워져 다시 조회된다.
let TRAINERS_CACHE = null;

// 복사 버튼의 클릭 핸들러를 만들어 준다(버튼마다 자기 코드를 기억하도록 클로저로 감싼다)
function copyDigits(button, code) {
  return async () => {
    const digits = code.replace(/\D/g, '');  // 게임 입력창에 맞게 숫자만
    let ok = false;
    try {
      await navigator.clipboard.writeText(digits);
      ok = true;
    } catch {
      // 클립보드 API가 막힌 환경 폴백
      // (http 접속·구형 브라우저·권한 거부 등. 화면 밖 textarea를 만들어 execCommand로 복사)
      const textarea = document.createElement('textarea');
      textarea.value = digits;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      textarea.remove();
    }
    // 성공·실패를 버튼 글자로 알려 주고 잠시 뒤 원래 문구로 되돌린다
    button.textContent = ok ? '복사됨 ✓' : '복사 실패';
    setTimeout(() => {
      button.textContent = '복사';
    }, 1500);
  };
}

// 표시용 4자리 묶음
// 화면에서는 읽기 쉽게 띄어 쓰지만, 복사할 때는 copyDigits가 공백을 다시 없앤다
function fmtCode(code) {
  const digits = code.replace(/\D/g, '');
  return digits.length === 12 ? `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}` : code;
}

// force를 주면 캐시를 무시하고 다시 조회한다(관리자 패널에서 등록·삭제 직후)
async function loadTrainers(force) {
  if (TRAINERS_CACHE && !force) return TRAINERS_CACHE;
  // 승인 전에는 규칙이 읽기를 막으므로 조회 자체를 시도하지 않는다
  if (AUTH.status !== 'ok') return [];
  const snapshot = await AUTH.db.collection('trainers').get().catch(() => null);
  // order가 없는 문서는 999로 취급해 뒤로 밀고, 같은 순번끼리는 이름 가나다순
  TRAINERS_CACHE = (snapshot?.docs ?? []).map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((trainerA, trainerB) => (trainerA.order ?? 999) - (trainerB.order ?? 999) || trainerA.name.localeCompare(trainerB.name, 'ko'));
  return TRAINERS_CACHE;
}

async function renderTrainers() {
  const listBox = document.getElementById('trainer-list');
  const accordion = document.getElementById('trainer-acc');
  if (!listBox) return;
  listBox.textContent = '';
  // 2026-09-03 v2.2.1 승인된 사용자가 아니면 메뉴에서 항목 자체를 감춘다 (안내문도 노출 안 함)
  // "로그인하면 보입니다" 같은 안내조차 두지 않는 이유: 트레이너 코드가 있다는 사실 자체를
  // 승인 안 된 사람에게 알릴 필요가 없다. 펼쳐 둔 상태로 감춰지지 않도록 open도 함께 닫는다
  const visible = authEnabled() && AUTH.status === 'ok';
  if (accordion) {
    accordion.hidden = !visible;
    if (!visible) accordion.open = false;
  }
  if (!visible) return;
  const rows = await loadTrainers();
  if (!rows.length) {
    // 비어 있을 때의 안내는 관리자에게만 등록 방법까지 알려 준다
    listBox.append(el('p', { class: 'd-foot' }, AUTH.admin ? '아직 등록된 코드가 없어요. 아래 “코드 관리”에서 추가하세요.' : '아직 등록된 코드가 없어요.'));
  }
  for (const trainer of rows) {
    const copyButton = el('button', { class: 'copy-btn' }, '복사');
    copyButton.addEventListener('click', copyDigits(copyButton, trainer.code));
    listBox.append(el('div', { class: 'trainer-row' }, el('b', {}, trainer.name), el('code', {}, fmtCode(trainer.code)), copyButton));
  }
  if (rows.length) listBox.append(el('p', { class: 'd-foot' }, '복사하면 공백 없는 12자리로 복사됩니다 — 게임의 친구 추가 화면에 바로 붙여넣으세요.'));
  if (AUTH.admin) listBox.append(el('button', { class: 'sched-more', onclick: openTrainerAdmin }, '🛠 코드 관리 (추가·삭제) →'));
}

// 관리자 전용: 한 줄에 "이름 코드" 형식으로 붙여넣어 일괄 등록 + 개별 삭제
// 한 명씩 입력받는 폼 대신 붙여넣기를 택한 이유: 코드는 보통 카톡 등에서 여러 줄로 한꺼번에 온다
async function openTrainerAdmin() {
  if (!AUTH.admin) return;
  closeDrawer();
  const body = el('div', { class: 'detail admin' }, el('h2', {}, '🛠 트레이너 코드 관리'));
  openModal(body);
  // 관리 화면은 항상 최신 목록이어야 하므로 캐시를 무시하고 다시 읽는다
  const rows = await loadTrainers(true);
  const list = el('div', { class: 'admin-rows' }, ...rows.map((trainer) => el('div', { class: 'admin-row' },
    el('div', { class: 'admin-who' }, el('b', {}, trainer.name), el('span', { class: 'acct-email' }, fmtCode(trainer.code))),
    el('button', { class: 'uchip admin-act danger', onclick: async () => {
      if (!confirm(`${trainer.name} 코드를 삭제할까요?`)) return;
      await AUTH.db.collection('trainers').doc(trainer.id).delete().catch(() => {});
      // 관리 팝업과 드로어의 목록을 둘 다 다시 그린다
      openTrainerAdmin();
      renderTrainers();
    } }, '삭제'))));
  body.append(el('section', { class: 'd-sec' }, el('h3', {}, `등록된 코드 ${rows.length}개`),
    rows.length ? list : el('p', { class: 'empty' }, '아직 없습니다.')));

  const textarea = el('textarea', { class: 'trainer-bulk', rows: '6', placeholder: '한 줄에 하나씩\n이름 0000 0000 0000\n이름2 1111 2222 3333' });
  const message = el('p', { class: 'trainer-msg' }, '이름과 12자리 코드를 한 줄에 하나씩. 같은 이름이 있으면 덮어씁니다.');
  // 2026-09-03 저장 결과를 눈에 보이게: 진행 표시 + 실패 사유(규칙 미게시 등)를 그대로 노출
  const saveButton = el('button', { class: 'sched-more' }, '일괄 저장');
  saveButton.addEventListener('click', async () => {
    const lines = textarea.value.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      message.textContent = '입력된 줄이 없어요.';
      return;
    }
    // 저장 중에는 버튼을 잠가 같은 줄이 두 번 들어가지 않게 한다
    saveButton.disabled = true;
    message.textContent = '저장 중…';
    let saved = 0;
    const badLines = [];
    const errors = [];
    for (const [index, line] of lines.entries()) {
      // 한 줄 파싱 규칙
      //   코드: 숫자·공백·하이픈이 12자 이상 이어지는 첫 덩어리를 뽑아 숫자만 남긴다
      //         ("0000 0000 0000", "0000-0000-0000", "000000000000" 모두 허용)
      //   이름: 그 코드 덩어리부터 줄 끝까지를 잘라낸 앞부분. 문서 id로 쓰기 때문에
      //         경로 구분자가 되는 '/'는 공백으로 바꾼다
      const digits = (line.match(/[\d\s-]{12,}/)?.[0] ?? '').replace(/\D/g, '');
      const name = line.replace(/[\d\s-]{12,}.*$/, '').trim().replace(/\//g, ' ');
      // 12자리가 아니거나 이름이 비면 저장하지 않고 "형식이 안 맞는 줄"로 보고한다
      if (digits.length !== 12 || !name) {
        badLines.push(line);
        continue;
      }
      try {
        // 응답이 없을 때(오프라인·규칙 대기) 화면이 멈추지 않도록 10초 제한
        // Firestore 쓰기는 연결이 없으면 무한정 대기하기 때문에, 그냥 await하면
        // "저장 중…"에서 영구히 멈춘 것처럼 보인다. 먼저 끝나는 쪽을 결과로 쓴다
        await Promise.race([
          // 문서 id를 이름으로 쓰므로 같은 이름을 다시 저장하면 덮어써진다
          AUTH.db.collection('trainers').doc(name).set({ name, code: digits, order: index }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('응답 없음(네트워크 확인)')), 10000)),
        ]);
        saved++;
      } catch (error) {
        errors.push(`${name}: ${error.code || error.message || error}`);
      }
    }
    saveButton.disabled = false;
    // 성공 개수 · 형식 오류 줄 수 · 실패 개수(첫 사유)를 한 줄로 합쳐 보여 준다
    const parts = [`${saved}개 저장`];
    if (badLines.length) parts.push(`형식이 안 맞는 줄 ${badLines.length}개`);
    if (errors.length) parts.push(`실패 ${errors.length}개 — ${errors[0]}`);
    message.textContent = parts.join(' · ');
    // permission-denied면 규칙에 trainers 블록이 아직 없다는 뜻
    // 관리자 본인도 쓰기가 막히는 유일하게 흔한 원인이라, 원인 추측 대신 조치 방법을 바로 안내한다
    if (errors.some((errorText) => /permission-denied/.test(errorText))) {
      message.textContent += ' → Firebase 콘솔 > Firestore > 규칙에 trainers 블록을 게시했는지 확인하세요.';
    }
    if (saved) {
      // 하나라도 저장됐으면 입력창을 비우고 캐시를 버린 뒤 목록을 다시 읽는다.
      // 팝업 재열기를 조금 늦추는 이유: 결과 문구를 읽을 시간을 준다
      textarea.value = '';
      TRAINERS_CACHE = null;
      renderTrainers();
      setTimeout(openTrainerAdmin, 400);
    }
  });
  body.append(el('section', { class: 'd-sec' }, el('h3', {}, '붙여넣어 추가'), textarea, message, saveButton));
}
// 파일이 로드되는 시점에 한 번 그려 둔다(로그인 상태가 확정되면 onAuthChange가 다시 호출한다)
renderTrainers();
