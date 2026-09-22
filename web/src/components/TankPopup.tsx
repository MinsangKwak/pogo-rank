// ─────────────────────────────────────────────────────────────────────────────
// components/TankPopup.tsx — 11월 다이맥스 레이드(디아루가·펄기아 **예상**) 탱커 준비 팝업
//
// 운영자가 준 그림 네 장(보스별 탱커 · 육성 순서 · 종합 순위)을 글과 조각으로 다시 그린 것이다.
// 그림을 그대로 싣지 않는 이유 둘 — 한 장 1MB 가 넘어 첫 방문 743KB 를 두 배로 만들고(광고 트래픽 앞),
// 글자가 그림 속에 있으면 검색·번역·읽기 도구가 못 읽는다.
//
// **이름은 전부 도감 데이터에서 온다** (§3). 여기 적힌 것은 도감번호뿐이고 한글 이름·타입·그림은
// DEX_DATA 가 준다. 기술 이름(하이드로펌프 …)은 게임 원문이라 그대로 적되 사전(moveKo)이 영문을 맡는다.
// **내구 순위(EHP N위)는 우리 표(DMAX_TANK)에서 찍는다** — 그림의 종합 순위는 운영자의 편집 순위
// (범용성·내구력·다이월 효율)라 우리 표와 다를 수 있다. 둘을 나란히 두고 어느 쪽인지 적는다.
//
// 날짜는 **예상**이다 — 화면에 그렇게 적는다. 확정 일정은 gameday 가 맡는다.
// 하루 한 번 자동으로 열리고(pogo_novtank_hide), 같은 세션에서는 다시 안 뜬다(pogo_novtank_seen).
// 새 저장 키라 pogo_ 접두사를 붙였다 (§2).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import type { DexBundle, MaxBundle } from '../types/data';
import type { MonPick, OpenMon } from '../lib/mon';
import { useDex, useMax } from '../lib/data';
import { useRoute } from '../lib/useRoute';
import { spriteSrc } from '../lib/sprite';
import { word } from '../lib/cell';
import { track } from '../lib/track';
import { routeHref } from '../routes';
import { Badge, Button, Callout, Card, FormBadge, Inline, Label, Text, TypePill } from '../ds';
import KoOnlyNote from './KoOnlyNote';

type Form = '다이맥스' | '거다이맥스';
interface Pick { dex: number; form: Form; why: string; role: string }
interface Boss {
  dex: number; date: string; picks: readonly Pick[];
  aside?: { dex: number; form: Form; text: string };
  resists?: readonly string[]; caution?: string; verdict: string;
}
interface Ranked { dex: number; form: Form; tag: string }

/** 그림 네 장의 내용. 도감번호만 적는다 — 이름은 데이터가 준다 */
export const NOV_TANK: {
  bosses: readonly Boss[];
  order: { verdict: string; rows: readonly Ranked[]; owned: Ranked };
  overall: { note: string; rows: readonly Ranked[] };
} = {
  bosses: [
    {
      dex: 483, date: '11월 14일',
      picks: [
        { dex: 379, form: '다이맥스', why: '용·강철 반감 / 번개 중립', role: '다이월 3' },
        { dex: 242, form: '다이맥스', why: '모든 기술 중립 / 높은 HP', role: '맥스 회복 3' },
        { dex: 143, form: '거다이맥스', why: '범용 예비 탱커', role: '예비 탱커' },
      ],
      aside: { dex: 9, form: '거다이맥스', text: '아이언헤드는 반감하지만 번개에 약함' },
      verdict: '레지스틸이 디아루가 전담',
    },
    {
      dex: 484, date: '11월 15일',
      picks: [
        { dex: 9, form: '거다이맥스', why: '물·불꽃 반감 / 용성군 중립', role: '다이월 3' },
        { dex: 242, form: '다이맥스', why: '용성군 대응 / 높은 HP', role: '맥스 회복 3' },
        { dex: 143, form: '거다이맥스', why: '범용 예비 탱커', role: '예비 탱커' },
      ],
      resists: ['하이드로펌프', '아쿠아테일', '불대문자'],
      caution: '물 G-Max 공격은 펄기아에게 반감',
      verdict: '거북왕은 펄기아 전담 탱커',
    },
  ],
  order: {
    verdict: '잠만보가 있다면 해피너스부터',
    rows: [
      { dex: 242, form: '다이맥스', tag: '범용 회복 · 최우선' },
      { dex: 379, form: '다이맥스', tag: '디아루가 전담 · 다이월' },
      { dex: 9, form: '거다이맥스', tag: '펄기아 전담 · 다이월' },
      { dex: 245, form: '다이맥스', tag: '물·불꽃 특화' },
      { dex: 380, form: '다이맥스', tag: '상성 특화' },
    ],
    owned: { dex: 143, form: '거다이맥스', tag: '다이월 3레벨만 마무리' },
  },
  overall: {
    note: '범용성 · 내구력 · 다이월 효율 종합',
    rows: [
      { dex: 242, form: '다이맥스', tag: '범용 회복' },
      { dex: 379, form: '다이맥스', tag: '다이월' },
      { dex: 143, form: '거다이맥스', tag: '범용 복합' },
      { dex: 380, form: '다이맥스', tag: '상성 특화' },
      { dex: 245, form: '다이맥스', tag: '물 방어' },
      { dex: 9, form: '거다이맥스', tag: '공격형 탱커' },
      { dex: 376, form: '다이맥스', tag: '강철 특화' },
      { dex: 131, form: '거다이맥스', tag: '고체력' },
      { dex: 823, form: '다이맥스', tag: '방어 상성' },
      { dex: 530, form: '다이맥스', tag: '탱커 겸 딜러' },
    ],
  },
};

export const HIDE_KEY = 'pogo_novtank_hide';
export const SEEN_KEY = 'pogo_novtank_seen';

/** 오늘을 'YYYY-MM-DD' 로 — 기기 시간 기준. '오늘 하루' 는 사람이 사는 하루다 */
export function todayKey(now = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** 자동으로 열 것인가 — 오늘 숨김도 아니고 이 세션에서 본 적도 없을 때만 */
export function shouldAutoOpen(hide: string | null, seen: string | null, today: string): boolean {
  return hide !== today && seen !== '1';
}

/** 여기서 열 것인가 — **홈 라우트에서만.** `#/mon/…` 은 상세 뒤에 홈이 깔리는 자리라(App 의 'mon' 갈래)
 *  거기서도 열면 겹판이 둘이 되어 상세를 덮거나 상세를 닫자 팝업이 튀어나온다 (v4.9.x 리뷰 제보) */
export function autoOpenHere(routeId: string, hide: string | null, seen: string | null, today: string): boolean {
  return routeId === 'home' && shouldAutoOpen(hide, seen, today);
}

/** 닫음을 기록한다 — 저장과 통계를 한 자리에서, 통계는 **한 건**만 (v4.9.x 리뷰 제보: hide 가 close 까지 두 번 찍었다) */
export function recordDismiss(action: 'close' | 'hide', today = todayKey()): void {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* 저장소를 막은 브라우저 */ }
  if (action === 'hide') { try { localStorage.setItem(HIDE_KEY, today); } catch { /* 저장소를 막은 브라우저 */ } }
  track('home_popup', { id: 'novtank', action });
}

/** 우리 탱커 표(DMAX_TANK.overall)에서 이 종의 내구 순위 — 영문 이름으로 맞춘다(거다이맥스 폼은 스프라이트가 다르다) */
export function ehpRank(max: MaxBundle, en: string | undefined): { rank: number; ehp: number } | null {
  if (!en) return null;
  const rows = max.DMAX_TANK['overall'] ?? [];
  const at = rows.findIndex((row) => row.en === en);
  const row = rows[at];
  return at >= 0 && row && typeof row.ehp === 'number' ? { rank: at + 1, ehp: row.ehp } : null;
}

/** 거다이맥스 폼의 스프라이트 — 우리 D-MAX 표에서 영문 이름으로 찾는다 (거다이맥스는 그림·항목이 따로다) */
export function gmaxSprite(max: MaxBundle, en: string | undefined): number | null {
  if (!en) return null;
  const rows = [...(max.DMAX_TANK['overall'] ?? []), ...(max.DMAX_TIER['overall'] ?? [])];
  const hit = rows.find((row) => row.en === en && row.gmax);
  return hit ? hit.sprite : null;
}

/** 상세로 넘길 것 — 폼을 잃지 않는다. 스프라이트만 넘기면 상세가 접두어 없는 일반 폼을 고른다(monBySprite) */
export function pickFor(dex: DexBundle, max: MaxBundle, id: number, form: Form): MonPick {
  const base = dex.DEX_DATA.names[String(id)] ?? '';
  const en = dex.DEX_DATA.en?.[String(id)];
  const sprite = form === '거다이맥스' ? (gmaxSprite(max, en) ?? id) : id;
  return { sprite, name: base ? `${form} ${base}` : `#${id}`, en: en ?? '', types: dex.DEX_DATA.forms[String(id)]?.types ?? [] };
}

/** 본문 — 데이터를 받아 그린다. 팝업 밖(스토리북)에서도 그대로 선다.
 *  머리·바닥을 <header>·<footer> 로 적지 않는다 — v3 스킨이 footer 요소마다 'moncamp / PLAY & GROW' 를
 *  ::before 로 박는다(shell-notebook.css). 사이트 바닥글용 규칙이 팝업 안까지 들어왔다 (실측) */
export function TankPopupBody({ dex, max, onOpen, onClose, onHide }: {
  dex: DexBundle; max: MaxBundle; onOpen: OpenMon; onClose: () => void; onHide: () => void;
}) {
  const ids = new Set(dex.SPRITE_IDS);
  const name = (id: number) => word(dex.DEX_DATA.names[String(id)]);
  const en = (id: number) => dex.DEX_DATA.en?.[String(id)];
  const types = (id: number) => dex.DEX_DATA.forms[String(id)]?.types ?? [];
  const pic = (id: number, size: number) => {
    const src = spriteSrc(id, ids);
    return src
      ? <img className="sprite" src={src} alt="" width={size} height={size} loading="lazy" decoding="async" />
      : <span className="tankpop__nopic" aria-hidden="true" />;
  };
  // 이름을 누르면 팝업을 닫고 상세로 — 팝업 위에 팝업을 겹치지 않는다
  const mon = (id: number, form: Form) => {
    const pick = pickFor(dex, max, id, form);
    return (
    <button className="tankpop__mon" type="button" onClick={() => { onClose(); onOpen(pick); }}>
      {pic(pick.sprite, 48)}
      <span>
        <FormBadge kind="max">{form}</FormBadge>
        <b>{name(id)}</b>
        <TypePill types={types(id)} names={dex.TYPE_KO} />
      </span>
    </button>
    );
  };

  return (
    <div className="tankpop">
      <div className="tankpop__head">
        <Label size="body" className="tankpop__eyebrow">BATTLE GUIDE / 11월 · 예상 일정</Label>
        <Label size="sec" as="h2">11월 다이맥스 레이드,<br />탱커부터 준비해요</Label>
        <Text tone="muted">거대한 힘에 맞서는, 가장 든든한 수비. 함께라면 버틸 수 있어요.</Text>
      </div>

      <section className="tankpop__bosses" aria-label="보스별 탱커">
        {NOV_TANK.bosses.map((boss) => (
          <Card key={boss.dex} title={<>{pic(boss.dex, 32)} 다이맥스 {name(boss.dex)}</>} action={<Badge tone="strong">{boss.date} 예상</Badge>}>
            <Inline gap="sm" align="center">
              <Text size="sub" tone="muted" as="span">보스 타입</Text>
              <TypePill types={types(boss.dex)} names={dex.TYPE_KO} />
            </Inline>
            <ol className="tankpop__picks">
              {boss.picks.map((pick, index) => (
                <li key={pick.dex}>
                  <Label size="sec" className="tankpop__rank" title={`${index + 1}순위`}>{index + 1}</Label>
                  {mon(pick.dex, pick.form)}
                  <Badge title="추천 역할">{pick.role}</Badge>
                  <Text size="sub" tone="muted" className="tankpop__why">{pick.why}</Text>
                </li>
              ))}
            </ol>
            {boss.aside ? (
              <Text size="sub" tone="muted">
                참고 — {boss.aside.form} {name(boss.aside.dex)}: {boss.aside.text}
              </Text>
            ) : null}
            {boss.resists ? (
              <Text size="sub">
                <b>{name(boss.picks[0]?.dex ?? 0)}</b>이 반감하는 기술 — {boss.resists.join(' · ')}
              </Text>
            ) : null}
            {boss.caution ? <Callout tone="caution" icon="⚠">{boss.caution}</Callout> : null}
            <Callout tone="brand" icon="👑" title="결론">{boss.verdict}</Callout>
          </Card>
        ))}
      </section>

      <section className="tankpop__two" aria-label="육성 순서와 종합 순위">
        <Card title="탱커 육성 순서">
          <Callout tone="good" title="결론">{NOV_TANK.order.verdict}</Callout>
          <ol className="tankpop__list">
            {NOV_TANK.order.rows.map((row, index) => (
              <li key={row.dex}>
                <Label size="sec" className="tankpop__rank">{index + 1}</Label>
                {mon(row.dex, row.form)}
                <Text size="sub" tone="muted" as="span">{row.tag}</Text>
              </li>
            ))}
          </ol>
          <Text size="sub" tone="muted">
            보유 중이라면 — {NOV_TANK.order.owned.form} {name(NOV_TANK.order.owned.dex)}: {NOV_TANK.order.owned.tag}
          </Text>
        </Card>

        <Card title="탱커 종합 순위">
          <ol className="tankpop__list">
            {NOV_TANK.overall.rows.map((row, index) => {
              const ours = ehpRank(max, en(row.dex));
              return (
                <li key={row.dex}>
                  <Label size="sec" className="tankpop__rank">{index + 1}</Label>
                  {mon(row.dex, row.form)}
                  <span className="tankpop__tags">
                    <Text size="sub" tone="muted" as="span">{row.tag}</Text>
                    {/* 우리 표에 없는 종은 칸을 세우지 않는다 — 대시를 찍을 자리가 아니다 */}
                    {ours ? <Badge dashed title={`D-MAX 탱커 표 내구(EHP ${ours.ehp}) 기준`}>{`EHP ${ours.rank}위`}</Badge> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <Text size="sub" tone="muted">
            순위는 {NOV_TANK.overall.note} — 운영자 편집 순위예요. EHP 순위는 <a href={routeHref('dmax')} onClick={onClose}>D-MAX 탱커 표</a> 기준이라 다를 수 있어요.
          </Text>
        </Card>
      </section>

      <div className="tankpop__foot">
        <KoOnlyNote />
        <Inline gap="sm" justify="end">
          <Button variant="secondary" onClick={onHide}>오늘 하루 보지 않기</Button>
          <Button variant="primary" onClick={onClose}>닫기</Button>
        </Inline>
      </div>
    </div>
  );
}

/** 팝업 — <dialog> 로 열어 Esc·배경 잠금을 브라우저에 맡긴다 (TermsConsent 와 같은 틀) */
export function TankPopup({ onOpen, onClose, onHide }: { onOpen: OpenMon; onClose: () => void; onHide: () => void }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = box.current;
    if (node && !node.open && typeof node.showModal === 'function') node.showModal();
  }, []);
  return (
    <dialog className="modal" ref={box} aria-label="11월 다이맥스 레이드 탱커 준비"
      onClick={(event) => { if (event.target === box.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap">
        <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
        <div className="modal__box">
          <TankPopupBody dex={dex} max={max} onOpen={onOpen} onClose={onClose} onHide={onHide} />
        </div>
      </div>
    </dialog>
  );
}

/** 홈에 서는 입구 — 안내 띠 하나와, 조건이 맞으면 처음에 열려 있는 팝업 */
export function TankPopupEntry({ onOpen }: { onOpen: OpenMon }) {
  const { route } = useRoute();
  const [open, setOpen] = useState(() => {
    try { return autoOpenHere(route.id, localStorage.getItem(HIDE_KEY), sessionStorage.getItem(SEEN_KEY), todayKey()); }
    catch { return false; }
  });
  const close = () => { setOpen(false); recordDismiss('close'); };
  const hide = () => { setOpen(false); recordDismiss('hide'); };
  const show = () => { setOpen(true); track('home_popup', { id: 'novtank', action: 'open' }); };
  return (
    <>
      <div className="tankpop-entry">
        <Callout tone="brand" icon="🛡" title="11월 다이맥스 레이드 탱커 준비 (예상 일정)">
          <Inline gap="sm" align="center" justify="between">
            <Text size="sub" tone="muted" as="span">11/14 · 11/15 — 보스별 탱커 · 육성 순서 · 종합 순위</Text>
            <Button variant="tool" onClick={show}>보기</Button>
          </Inline>
        </Callout>
      </div>
      {open ? <TankPopup onOpen={onOpen} onClose={close} onHide={hide} /> : null}
    </>
  );
}
