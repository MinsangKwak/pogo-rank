// ─────────────────────────────────────────────────────────────────────────────
// lib/authApi.ts — 로그인·저장소를 만지는 **유일한 자리**
//
// 왜 어댑터를 두나
//   ① SDK 를 첫 화면에서 받지 않는다. auth + firestore 는 무겁고, 티어표를 보는 데 필요 없다.
//      `await import(…)` 로 갈라 두면 vite 가 별도 덩이로 빼고, 로그인을 실제로 쓸 때 받는다
//      (v3 도 같은 이유로 compat SDK 를 첫 렌더 뒤에 붙였다).
//   ② 로컬에서 확인할 길을 남긴다. localhost 에서 Google 팝업은 자주 막혀, 로그인 뒤 화면을
//      한 번도 못 보고 짐작으로 짜게 된다. v3 의 dev-mock.js 와 같은 자리를 여기 둔다.
//
// **접근 제어의 주체는 이 파일이 아니다.** 여기서 하는 판정은 '보여 주는 방식' 일 뿐이고,
// 실제 차단은 전부 Firestore 보안 규칙이 한다 — 이 코드는 공개 번들이라 누구나 고칠 수 있다.
// ─────────────────────────────────────────────────────────────────────────────
export interface AuthUser { uid: string; email: string; displayName: string; photoURL: string }
export type DocData = Record<string, unknown>;

export interface AuthApi {
  onUser(fn: (user: AuthUser | null) => void): void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  deleteUser(): Promise<void>;
  getDoc(path: string): Promise<DocData | null>;
  setDoc(path: string, data: DocData): Promise<void>;
  deleteDoc(path: string): Promise<void>;
  /** 컬렉션 하나를 통째로 읽는다. 문서 id 를 `id` 로 붙여 준다 (트레이너 코드 목록) */
  listDocs(path: string): Promise<(DocData & { id: string })[]>;
  /** 배열 필드를 통째로 덮어쓰지 않고 한 값만 넣고 뺀다 (다른 기기의 변경과 부딪히지 않게) */
  arrayEdit(path: string, field: string, value: number, add: boolean): Promise<void>;
}

/** 로컬에서 ?mock 을 붙였을 때만 — 배포에서는 절대 타지 않는 길이다 (v3 mockAuthWanted 와 같은 조건) */
export function mockWanted(): boolean {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return local && new URLSearchParams(location.search).has('mock');
}

let api: Promise<AuthApi> | null = null;

export function getAuthApi(config: Record<string, string>, adminUid: string): Promise<AuthApi> {
  api ??= mockWanted() ? import('./authMock').then((m) => m.makeMockApi(adminUid)) : makeFirebaseApi(config);
  return api;
}

async function makeFirebaseApi(config: Record<string, string>): Promise<AuthApi> {
  const [{ initializeApp, getApps }, auth, store] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const app = getApps().length ? getApps()[0]! : initializeApp(config);
  const authObj = auth.getAuth(app);
  const db = store.getFirestore(app);
  // 지속성을 **명시**한다. 기본값이 이미 LOCAL 이지만, 적어 두면 "새로고침하면 풀리는 것 아니냐" 에
  // 코드가 답한다. 저장소를 막은 브라우저에서는 실패해도 그냥 간다
  await auth.setPersistence(authObj, auth.browserLocalPersistence).catch(() => { /* 저장소를 막은 브라우저 */ });

  const ref = (path: string) => store.doc(db, path);
  const trim = (user: import('firebase/auth').User): AuthUser => ({
    uid: user.uid,
    email: (user.email ?? '').toLowerCase(),
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
  });

  return {
    onUser(fn) { auth.onAuthStateChanged(authObj, (user) => fn(user ? trim(user) : null)); },
    async signIn() {
      const provider = new auth.GoogleAuthProvider();
      // 팝업이 막히는 브라우저가 있다 — 그때는 리다이렉트로 되돌아간다 (v3 와 같은 갈래)
      try { await auth.signInWithPopup(authObj, provider); }
      catch { await auth.signInWithRedirect(authObj, provider); }
    },
    signOut() { return auth.signOut(authObj); },
    async deleteUser() {
      const user = authObj.currentUser;
      if (!user) return;
      try { await auth.deleteUser(user); }
      catch {
        // 최근 로그인이 필요하면 다시 인증받고 한 번 더 (v3 confirmDeleteAccount 와 같은 길)
        await auth.reauthenticateWithPopup(user, new auth.GoogleAuthProvider());
        await auth.deleteUser(user);
      }
    },
    async getDoc(path) {
      const snapshot = await store.getDoc(ref(path)).catch(() => null);
      return snapshot?.exists() ? (snapshot.data() as DocData) : null;
    },
    async setDoc(path, data) {
      await store.setDoc(ref(path), { ...data, updatedAt: store.serverTimestamp() }, { merge: true });
    },
    async deleteDoc(path) { await store.deleteDoc(ref(path)).catch(() => { /* 없으면 그만 */ }); },
    async listDocs(path) {
      // 승인 전에는 규칙이 읽기를 막는다 — 실패는 조용히 빈 목록이다 (v3 loadTrainers 와 같다)
      const snapshot = await store.getDocs(store.collection(db, path)).catch(() => null);
      return snapshot ? snapshot.docs.map((one) => ({ id: one.id, ...(one.data() as DocData) })) : [];
    },
    async arrayEdit(path, field, value, add) {
      await store.setDoc(ref(path), {
        [field]: add ? store.arrayUnion(value) : store.arrayRemove(value),
        updatedAt: store.serverTimestamp(),
      }, { merge: true });
    },
  };
}
