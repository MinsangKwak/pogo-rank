# 로그인(Google) · 승인제 · 즐겨찾기 설정 가이드 (v2.2.0)

정적 사이트(GitHub Pages)에 서버 없이 로그인을 붙이기 위해 **Firebase Authentication + Firestore**를 사용합니다.
코드는 이미 들어가 있고, Firebase 콘솔에서 아래 5단계만 하면 켜집니다. 약 5분.

## 동작 요약

- **로그인**: Google 계정만. 헤더 👤 버튼 또는 ☰ 메뉴 상단에서.
- **승인제**: 처음 로그인한 사람은 "승인 대기" 상태. 관리자가 ☰ → 🔑 가입 승인에서 승인해야 즐겨찾기를 쓸 수 있음. 관리자는 승인 없이 항상 사용 가능.
- **관리자 판정**: `backend/build.py`의 `ADMIN_UID`(Firebase uid)와 `firestore.rules`의 `isAdmin()`이 같은 값을 참조. 이메일 대신 uid를 쓰는 이유는 공개 저장소에 관리자 이메일이 노출되지 않도록 하기 위함.
- **즐겨찾기 ★**: 승인된 사용자가 도감 행·상세 팝업의 ★를 누르면 계정(Firestore `users/{uid}.favs`)에 저장 → 어느 기기에서 로그인해도 같은 도감이 채워짐. 종 단위(도감번호)로 저장.
- **설정이 비어 있으면**(`FIREBASE_CONFIG = {}`) 로그인 UI가 아예 안 뜨고 나머지 기능은 그대로 동작.
- SDK는 첫 화면이 그려진 뒤 지연 로드 → 초기 로딩 속도 영향 없음.

## 콘솔 설정 5단계

1. **프로젝트 만들기** — https://console.firebase.google.com → 프로젝트 추가 (이름 아무거나, 예: pogo-search). Google 애널리틱스 연결 여부는 상관없음(이미 GA4 별도 연결됨).
2. **웹 앱 등록** — 프로젝트 개요 → `</>` 웹 아이콘 → 앱 닉네임 입력 → 등록. 화면에 나오는 `firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "...", ... }` 값을 복사해서
   `backend/build.py`의 `FIREBASE_CONFIG = {...}`에 파이썬 dict 형태로 붙여넣기 (키는 따옴표로 감싸기).
   ```python
   FIREBASE_CONFIG = {
       'apiKey': 'AIza...', 'authDomain': 'pogo-search.firebaseapp.com', 'projectId': 'pogo-search',
       'storageBucket': 'pogo-search.appspot.com', 'messagingSenderId': '1234', 'appId': '1:1234:web:abcd',
   }
   ```
   apiKey는 공개돼도 되는 식별자입니다(접근 제어는 규칙이 담당). 공개 저장소에 올라가도 됩니다.
3. **Google 로그인 켜기** — 빌드(왼쪽 메뉴) → Authentication → 시작하기 → 로그인 방법 → Google → 사용 설정 → 프로젝트 지원 이메일 선택 → 저장.
4. **승인된 도메인 추가** — Authentication → 설정 → 승인된 도메인 → `minsangkwak.github.io` 추가. (localhost는 기본 포함)
5. **Firestore 만들기 + 규칙 붙여넣기** — 빌드 → Firestore Database → 데이터베이스 만들기 → 위치 `asia-northeast3 (서울)` → **프로덕션 모드**로 시작 → 규칙 탭 → 저장소의 `firestore.rules` 내용을 전부 붙여넣고 **게시**.

배포 후 관리자 본인 계정으로 로그인하면 바로 사용 가능. 친구가 로그인하면 ☰ → 🔑 가입 승인에 나타나고, 승인 버튼을 누르면 끝.

## 데이터 구조 (Firestore)

| 컬렉션 | 문서 ID | 내용 | 권한 |
| --- | --- | --- | --- |
| `allowlist` | 이메일(소문자) | `{ approved: true, name, at }` | 관리자만 쓰기, 본인 문서 읽기 |
| `requests` | 이메일(소문자) | `{ email, name, photo, at }` | 본인 생성·갱신, 관리자 열람·삭제 |
| `users` | Firebase uid | `{ email, name, favs: [도감번호...], updatedAt }` | 본인만, 승인된 경우만 |
| `trainers` | 이름 | `{ name, code(12자리), order }` | 승인된 사용자 읽기, 관리자만 쓰기 |

## 트레이너 코드 등록 (최초 1회)

코드는 공개 저장소에 두지 않고 Firestore에 넣습니다. 관리자로 로그인 → ☰ → 👥 트레이너 코드 → **🛠 코드 관리** → 텍스트 상자에 한 줄에 하나씩 `이름 1234 5678 9012` 형식으로 붙여넣고 **일괄 저장**. 이후 승인된 친구에게만 목록이 보입니다.

## 관리자 판정 (uid 기준, v2.2.1부터 적용됨)

공개 저장소에 이메일을 남기지 않기 위해 관리자는 **Firebase uid**로 식별합니다.
`backend/build.py`의 `ADMIN_UID`와 `firestore.rules`의 `isAdmin()`이 **같은 uid**여야 하며, 둘 중 하나만 바꾸면 관리자 기능이 동작하지 않습니다.
uid는 관리자로 로그인한 뒤 ☰ → 🔑 가입 승인 → 맨 아래 **"내 uid 복사"**에서 확인할 수 있습니다.

> 규칙을 바꾸면 반드시 **콘솔에서 다시 게시**해야 적용됩니다. 코드만 배포하면 저장이 permission-denied로 거부됩니다.

## 운영 메모

- 승인 해제: 🔑 가입 승인 → 승인된 친구 → 해제. 그 사람의 즐겨찾기 데이터(users)는 남아 있지만 규칙상 접근 불가가 됨.
- 관리자를 바꾸려면 `backend/build.py`의 `ADMIN_UID`와 `firestore.rules`의 uid를 **둘 다** 수정.
- 무료(Spark) 요금제 한도: 일 읽기 5만·쓰기 2만 — 친구 규모에선 무관.
- 홈 화면 설치(PWA) 환경에서는 팝업이 막혀 리다이렉트 방식으로 자동 전환됨.
- 로컬 미리보기(file://)나 승인되지 않은 도메인에서는 Google 로그인이 거부됨 — 배포 사이트에서 테스트.
