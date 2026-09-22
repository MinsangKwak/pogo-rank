// ─────────────────────────────────────────────────────────────────────────────
// components/DataBoundary.tsx — 데이터를 못 받았을 때 **빈 화면 대신 말을 남긴다**
//
// 2026-09-22 실측에서 드러났다. 데이터 요청(`data/*.json`)을 끊고 화면을 열면
// 셸(머리줄·메뉴)은 그려지는데 **본문이 영원히 빈 채로 남았다.** 오류도 안 나고 기다림도 안 끝난다.
// `useSuspenseQuery` 는 실패하면 던지는데, 받는 경계가 저장소 어디에도 없었기 때문이다.
//
// **광고로 사람이 들어오는 판에서 이게 제일 나쁘다.** 회선이 흔들리는 휴대폰에서 한 번 비면
// 그 사람은 고장 난 사이트를 보고 떠난다 — 다시 누를 자리도 없이.
//
// 그래서 셋을 한다.
//   1. 던진 것을 여기서 받는다 (getDerivedStateFromError)
//   2. 무슨 일인지 적고 **다시 받을 단추**를 준다
//   3. 그 단추가 react-query 의 실패 기록까지 지운다 (QueryErrorResetBoundary) —
//      안 지우면 다시 그려도 캐시에 남은 실패를 그대로 다시 던진다
// ─────────────────────────────────────────────────────────────────────────────
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';

interface Props { children: ReactNode; onReset: () => void }
interface State { failed: boolean }

class Catcher extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // 콘솔에는 남긴다 — 제보를 받을 때 이 줄이 유일한 단서다
    console.error('[moncamp] 화면을 그리지 못했습니다', error, info.componentStack);
  }

  retry = () => {
    this.props.onReset();
    this.setState({ failed: false });
  };

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="data-boundary" role="alert">
        <p className="data-boundary__head">자료를 불러오지 못했어요</p>
        <p className="data-boundary__body">
          잠시 연결이 끊겼을 수 있어요. 다시 시도해 주세요.
        </p>
        <button className="home__btn home__btn--primary" type="button" onClick={this.retry}>
          다시 불러오기
        </button>
      </div>
    );
  }
}

/** 기다림이 있는 자리를 감싼다. 실패를 받고, 다시 받을 길을 준다 */
export function DataBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => <Catcher onReset={reset}>{children}</Catcher>}
    </QueryErrorResetBoundary>
  );
}
