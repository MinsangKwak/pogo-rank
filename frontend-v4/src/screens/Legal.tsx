// ─────────────────────────────────────────────────────────────────────────────
// screens/Legal.tsx — 🔒 개인정보처리방침 · 📜 이용약관 (v3 components/privacy.js · terms.js)
//
// **실제로 하는 것만 적는다.** 문구만 그럴싸한 표준 약관 복붙 금지 — 새 기능이 개인정보를
// 더 만지면 이 파일도 같이 고친다. 한국어 원문이 효력을 갖는 문서라 번역하지 않는다.
//
// 문의 이메일은 저장소에 없다 — 빌드가 넣은 값을 데이터 묶음에서 읽는다(meta.CONTACT_EMAIL).
// 비어 있으면 v3 와 같이 '사이트 운영자' 라고 적힌다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { useMeta } from '../lib/data';

export const PRIVACY_VER = '2026-09-07';
export const TERMS_VER = '2026-09-07';
// 권리자 표기는 '상용·오픈소스 전환 점검' 의 결정 — Pokémon GO 는 Scopely Explore, Inc.
export const IP_NOTICE = 'moncamp는 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc. 에, Pokémon GO 는 Scopely Explore, Inc. 에 있으며 이 서비스는 권리자와 무관합니다.';

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return <section className="priv__sec"><h2 className="page__sec">{title}</h2>{children}</section>;
}
function Bullets({ items }: { items: ReactNode[] }) {
  return <ul className="priv__list">{items.map((one, index) => <li key={index}>{one}</li>)}</ul>;
}
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="priv__table-wrap">
      <table className="priv__table">
        <thead><tr>{head.map((one) => <th key={one}>{one}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, at) => <td key={at}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function useContact(): ReactNode {
  const { data } = useMeta();
  const email = data.CONTACT_EMAIL;
  return email ? <a href={`mailto:${email}`}>{email}</a> : '사이트 운영자';
}

export function Privacy() {
  const contact = useContact();
  return (
    <div className="page__body" id="page-privacy" data-route="privacy">
      <p>moncamp(이하 "서비스")는 로그인하지 않으면 개인정보를 수집하지 않습니다. Google 로그인으로 승인된 사용자에게만 즐겨찾기·내 포켓몬 저장 기능을 제공하며, 이 문서는 그 과정에서 무엇을 어디에 얼마나 보관하는지 설명합니다.</p>
      <p className="detail__foot">{`시행일 2026-09-04 · 개정 2026-09-06 (이용 통계에 계정 식별자 연결) · 2026-09-07 (플래너 개체 정보 항목) · ${PRIVACY_VER} v2.18.0 (처리위탁·국외이전·보유기간·14세·보호책임자·자동수집·셀프 삭제 명시). 서비스는 개인이 무료로 운영하며 상업적 목적이 없습니다.`}</p>

      <Sec title="1. 수집하는 개인정보">
        <p>로그인하지 않고 도감·순위표·계산기·플래너 계산을 쓰는 경우 개인정보를 전혀 수집하지 않습니다. 아래 항목은 ☰ 메뉴의 "👤 마이페이지" 에서 Google 로그인을 했을 때만 발생합니다.</p>
        <Table head={['항목', '어디서', '왜']} rows={[
          ['이메일 주소, 이름, 프로필 사진 URL', 'Google 계정 (로그인 시)', '승인제 운영(승인 대기 목록), 계정 카드 표시'],
          ['Firebase 인증 uid', 'Firebase Authentication', '계정 식별, 관리자 판정, 이용 통계 User-ID'],
          ['즐겨찾기(★) 도감번호 목록', '이용자가 직접 입력', '기기 간 동기화'],
          ['🌱 내 포켓몬 개체 정보 (종·폼, 섀도우, 레벨, 개체값, 기술, 상태, 메모)', '이용자가 직접 입력', '개체 저장·비교. 게임 안의 정보라 개인정보는 아니지만 계정에 묶여 저장되므로 명시'],
          ['화면 테마 선택 (밝게 / 어둡게 / 기기 설정)', '헤더의 테마 버튼', '기기 간 동기화 — 어느 기기에서 로그인해도 같은 화면'],
          ['약관 동의 버전·시각', '첫 로그인 동의 팝업', '동의 사실의 증빙'],
        ]} />
        <p>위치정보는 수집하지 않습니다. 서비스 코드에 위치 접근(geolocation) 호출이 없으며, 향후 위치 기능을 넣는다면 이 방침을 먼저 개정합니다.</p>
      </Sec>

      <Sec title="2. 자동으로 수집되는 항목">
        <Bullets items={[
          '방문 통계(Google Analytics 4) — **기본으로 켜져 있습니다.** 클릭한 탭 이름·포켓몬 이름·상성 검색 타입 등 이용 패턴과 기기·브라우저 종류를 기록하며, 로그인한 경우 Firebase uid 와 승인 상태(ok/pending)를 GA 의 User-ID·사용자 속성으로 보냅니다. 이메일·이름·사진은 보내지 않습니다. 광고 목적의 수집(ad_storage 등)은 꺼 두었습니다. **끄려면** ☰ 메뉴 → 통계·저장소 설정(화면 아래 "통계·저장소 설정" 도 같은 곳)에서 "통계 끄기" 를 고르면 되고, 그때부터 통계 스크립트를 아예 불러오지 않습니다',
          '브라우저 로컬 저장소(localStorage) — 패치노트 읽음 여부, 도감 열 수, 마지막으로 보던 탭·모드, 화면 테마(밝게/어둡게), 즐겨찾기 카드 접힘, 일정 분류, 통계 켜짐/꺼짐 선택, 약관 동의 버전(pogo_ 로 시작하는 설정값). 로그인하지 않고 🌱 플래너에 개체를 저장하면 그 내용(plan_guest_mons)도 이 브라우저에만 남습니다 — 서버로 보내지 않으며, 로그인하면 계정 저장으로 바뀝니다. 브라우저의 사이트 데이터 삭제 또는 ☰ 메뉴 → 통계·저장소 설정 → 캐시 비우기로 지울 수 있습니다',
          '서비스워커 캐시 — 오프라인에서도 열리도록 화면 파일·데이터·포켓몬 그림을 브라우저에 저장합니다(pogoplan- 접두사). 개인정보를 담지 않습니다',
          '쿠키 — 서비스가 직접 쿠키를 만들지 않습니다. Google 로그인·Firebase SDK 와 (통계를 끄지 않은 경우) Google Analytics 가 각자의 세션·식별 쿠키를 사용할 수 있습니다',
        ]} />
      </Sec>

      <Sec title="3. 수집 목적">
        <Bullets items={[
          '승인제 운영 — 처음 로그인한 사람을 "승인 대기" 목록에 올리고, 운영자가 승인해야 저장 기능을 씁니다',
          '즐겨찾기·내 포켓몬 동기화 — 어느 기기에서 로그인해도 같은 목록이 보이도록',
          '이용 통계 — 어떤 기능이 쓰이는지 보고 화면을 개선합니다 (끄지 않은 경우)',
        ]} />
      </Sec>

      <Sec title="4. 처리위탁과 국외 이전">
        <p>서비스는 자체 서버가 없습니다. 아래 두 곳(모두 Google LLC, 미국)에 처리를 맡기며, 이용자가 로그인·동의하는 시점에 네트워크를 통해 전송됩니다.</p>
        <Table head={['수탁자', '위탁 업무', '이전 항목', '보유·이용 기간']} rows={[
          ['Google LLC — Firebase Authentication · Cloud Firestore', '로그인 처리, 즐겨찾기·내 포켓몬·승인 정보 저장', '1의 전 항목', '계정 삭제 시까지 (Firestore 리전: 서울 asia-northeast3, 인증 정보는 Google 글로벌 인프라)'],
          ['Google LLC — Google Analytics 4', '방문 통계 (끄지 않은 경우)', '이용 패턴, 기기 정보, Firebase uid, 승인 상태', 'GA 기본 보관 14개월'],
        ]} />
        <p>그 밖의 제3자에게 개인정보를 제공하거나 판매하지 않습니다. 법령에 따른 요청이 있을 때만 예외입니다.</p>
      </Sec>

      <Sec title="5. 보유 기간과 파기">
        <Bullets items={[
          '계정 데이터(이메일·이름·사진 URL·uid·즐겨찾기·내 포켓몬·동의 기록) — 이용자가 계정을 삭제할 때까지. 삭제하면 Firestore 문서와 Firebase 인증 계정을 즉시 지웁니다',
          '승인을 해제해도 데이터는 남고 접근만 막힙니다(다시 승인하면 복원). 완전히 지우려면 계정 삭제를 쓰세요',
          '1년 이상 로그인하지 않은 계정은 운영자가 정리(삭제)할 수 있으며, 정리 전에 패치노트로 공지합니다',
          '통계 데이터는 GA 보관 기간(14개월)이 지나면 자동 삭제됩니다',
        ]} />
      </Sec>

      <Sec title="6. 만 14세 미만">
        <p>만 14세 미만은 가입할 수 없습니다. 첫 로그인 동의 팝업에서 "만 14세 이상"을 확인하며, 14세 미만의 가입이 확인되면 계정을 삭제합니다. 법정대리인 동의를 받는 절차는 두지 않습니다.</p>
      </Sec>

      <Sec title="7. 이용자의 권리와 행사 방법">
        <Bullets items={[
          '열람 — ☰ 메뉴의 계정 카드와 🌱 내 포켓몬 화면에서 저장된 내용을 그대로 볼 수 있습니다',
          '정정·삭제 — 즐겨찾기 ★와 내 포켓몬은 화면에서 직접 고치고 지울 수 있습니다',
          '계정 삭제 — ☰ 메뉴 → 계정 카드 → "계정 삭제". 저장 데이터·승인 정보·가입 요청·인증 계정을 한 번에 지웁니다. 보안상 최근 로그인이 필요하면 Google 재인증 창이 뜹니다',
          '통계 끄기 — ☰ 메뉴 → 통계·저장소 설정',
          '이메일로 요청해도 같은 처리를 합니다 (아래 문의처)',
        ]} />
      </Sec>

      <Sec title="8. 안전성 확보">
        <Bullets items={[
          '접근 제어는 전부 Firestore 보안 규칙(firestore.rules, 저장소에 공개)이 담당합니다 — 본인 문서만 읽고 쓸 수 있고, 승인 전에는 저장이 막힙니다',
          '운영자는 승인 대기 목록(이메일·이름·uid)만 봅니다. 즐겨찾기·내 포켓몬 내용은 규칙상 운영자도 읽을 수 없습니다',
          '서비스는 코드가 전부 공개된 정적 사이트이며, 개인정보를 별도 서버·파일로 옮기지 않습니다',
        ]} />
      </Sec>

      <Sec title="9. 개인정보 보호책임자">
        <p>서비스를 운영하는 개인이 보호책임자를 겸합니다. 문의·열람·삭제 요청: {contact}</p>
        <p>요청은 접수 후 10일 안에 처리하고 결과를 회신합니다.</p>
      </Sec>

      <Sec title="10. 고지">
        <p>방침을 바꾸면 시행 7일 전에 패치노트(☰ 메뉴 → 🎉 패치노트)에 알립니다. 수집 항목이 늘어나는 변경은 다음 로그인 때 다시 동의를 받습니다.</p>
      </Sec>

      <p className="detail__foot">더 자세한 내용은 <a href="https://app.notion.com/p/3d1cbbdd109b81a9b5dcf344e4432ae2" target="_blank" rel="noopener">노션 상세 페이지</a>에서도 확인할 수 있습니다. 이용약관은 <a href="#/terms">#/terms</a>.</p>
      <p className="ip-notice detail__foot">{IP_NOTICE}</p>
    </div>
  );
}

export function Terms() {
  const contact = useContact();
  return (
    <div className="page__body" id="page-terms" data-route="terms">
      <p>moncamp(이하 "서비스")를 이용하기 전에 읽어 주세요. 서비스는 개인이 무료로 운영하는 비공식 팬 프로젝트이며, 이 약관은 서비스가 실제로 하는 것과 하지 않는 것을 정합니다.</p>
      <p className="detail__foot">{`시행일 ${TERMS_VER} (v2.18.0 신설). 개정하면 시행 7일 전에 패치노트로 알리고, 다음 로그인 때 다시 동의를 받습니다.`}</p>

      <Sec title="1. 서비스란">
        <p>포켓몬 GO 의 순위표(D-MAX · PvE · PvP), 도감, 일정표, 계산기와 🌱 플래너(내 개체 저장·비교)를 한 화면에서 보는 웹앱입니다. 홈 화면에 설치(PWA)해 앱처럼 쓸 수 있습니다.</p>
        <Bullets items={[
          '무료입니다. 수익을 목적으로 하지 않으며 광고·유료 기능이 없습니다',
          '누구나 로그인 없이 볼 수 있고, 저장 기능(즐겨찾기 · 내 포켓몬)만 Google 로그인 + 운영자 승인이 필요합니다',
          '운영자는 사전 공지 없이 기능을 바꾸거나 서비스를 중단할 수 있습니다 (개인 운영 프로젝트)',
        ]} />
      </Sec>

      <Sec title="2. 계정과 승인">
        <Bullets items={[
          '로그인은 Google 계정만 지원합니다. 처음 로그인하면 "승인 대기" 상태가 되고, 운영자가 승인해야 저장 기능이 열립니다',
          '만 14세 미만은 가입할 수 없습니다. 로그인 전 체크로 확인하며, 14세 미만으로 확인되면 계정을 삭제합니다',
          '한 사람이 여러 계정을 만들거나 다른 사람의 계정을 쓰는 것은 금지합니다',
          '계정 삭제는 ☰ 메뉴 → 계정 카드의 "계정 삭제" 버튼으로 언제든 직접 할 수 있습니다. 즉시 저장 데이터가 지워집니다',
        ]} />
      </Sec>

      <Sec title="3. 금지 행위">
        <Bullets items={[
          '서비스나 Firebase 저장소에 비정상적으로 많은 요청을 보내는 행위(자동화 스크립트 · 남용)',
          '다른 사용자의 데이터에 접근하거나 보안 규칙을 우회하려는 시도',
          '트레이너 코드 등 다른 사용자의 정보를 서비스 밖으로 퍼뜨리는 행위',
          '위 행위가 확인되면 운영자가 사전 통보 없이 승인을 해제하거나 계정을 정지할 수 있습니다',
        ]} />
      </Sec>

      <Sec title="4. 데이터의 정확성과 면책">
        <p>순위·CP·추천은 공개 데이터(PvPoke · PokeMiners · PokeAPI · 커뮤니티 시트)와 자체 계산으로 만든 참고값입니다. 게임 안의 실제 결과를 보장하지 않으며, 이를 근거로 한 결정(사탕·모래 사용, 교환 등)의 결과는 이용자 책임입니다.</p>
        <Bullets items={[
          '데이터는 매일 자동 갱신되지만 원본 지연·오류로 틀릴 수 있습니다. 오류는 ☰ 메뉴의 제보 창구로 알려 주세요',
          '서비스 장애·데이터 손실에 대해 운영자는 고의 또는 중대한 과실이 없는 한 책임지지 않습니다',
        ]} />
      </Sec>

      <Sec title="5. 지식재산">
        <p>{IP_NOTICE}</p>
        <Bullets items={[
          '서비스의 코드는 열람용으로 공개돼 있습니다. 포크, 재배포는 안 됩니다 (GitHub 저장소의 LICENSE · NOTICE)',
          '포켓몬 데이터·이미지·명칭은 각 권리자의 것이며 이 서비스가 권리를 주장하지 않습니다. 권리자의 요청이 있으면 즉시 내립니다',
          '이용자가 저장한 개체 정보·메모의 권리는 이용자에게 있습니다. 서비스는 그 이용자에게 보여 주는 목적으로만 저장합니다',
        ]} />
      </Sec>

      <Sec title="6. 개인정보">
        <p>수집 항목·목적·보관·위탁·권리는 <a href="#/privacy">개인정보처리방침</a>에 따로 적었습니다. 이 약관과 방침이 다르면 방침이 우선합니다.</p>
      </Sec>

      <Sec title="7. 준거법과 분쟁">
        <p>이 약관은 대한민국 법을 따릅니다. 분쟁이 생기면 먼저 아래 문의처로 연락해 해결을 시도하고, 그래도 해결되지 않으면 민사소송법상 관할 법원에서 다룹니다.</p>
      </Sec>

      <Sec title="문의처">
        <p>약관 관련 문의: {contact}</p>
      </Sec>
      <p className="ip-notice detail__foot">{IP_NOTICE}</p>
    </div>
  );
}
