// ─────────────────────────────────────────────────────────────────────────────
// i18n-release-en.js — 패치노트 영문판 (2026-09-12 v3.11.0)
//
// 왜 따로 두나
//   패치노트 항목은 `**굵게**` 가 섞인 한 문장 덩어리다. 화면에 그려진 뒤에는 <b> 로 쪼개져
//   텍스트 노드가 여럿이 되므로, 낱말 단위로 찾는 일반 사전(i18n-en.js)으로는 문장을 못 맞춘다.
//   그래서 날짜(= 묶음 키)로 통째 짝지어 둔다. RELEASE_NOTES 의 date 와 글자 하나까지 같아야 한다.
//
// 없는 날짜는 한국어 그대로 나간다 — 빠진 줄을 영어처럼 보이게 지어내지 않는다.
//   (components/release.js releaseItems 가 있는 것만 골라 쓴다)
//
// 번역 원칙
//   문장을 그대로 옮기지 않는다. 한국어 원문은 "무엇이 바뀌었고 왜 바꿨는지" 를 말하는데,
//   그 뜻이 남도록 영어 어순으로 다시 쓴다. 버전 번호 · 픽셀 값 · 화면 이름은 건드리지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

const RELEASE_NOTES_EN = {
  '2026-09-22 · v4.9.6': [
    '**[Scroll down] no longer lands the heading behind the app bar** — the [Top Pokemon by role] heading was hidden under the sticky bar after the jump',
    '**[Many uses] is a single-line card again on narrow screens** — the tall side-card layout was leaking down to phones and stretching the card',
  ],
  '2026-09-22 · v4.9.5': [
    '**A failed load now shows a message instead of an empty screen** — when the connection dropped, the page just stayed blank with nothing to act on. [Try again] now refetches in place',
  ],
  '2026-09-22 · v4.9.4': [
    '**[Many uses] moved beside the home banner** — the space next to the banner sat empty on wide screens. It now shows without scrolling',
    '**The banner has a [Scroll down] button** — the banner filled the first screen, so what came below was easy to miss. It jumps to [Top Pokémon by use]',
  ],
  '2026-09-22 · v4.9.3': [
    '**The home banner was redrawn** — it stays under 600px tall on any screen, with a bigger illustration and smaller text. The date and boss names now sit on the picture',
  ],
  '2026-09-21 · v4.9.2': [
    '**The home banner is shorter on desktop** — it grew with the window and hid everything below it. The rankings below the banner are now visible without scrolling',
    '**Its buttons moved up under the text** — they used to sit at the very bottom of the banner, far from what they refer to',
  ],
  '2026-09-21 · v4.9.1': [
    '**Your favorites now show up when they appear as Dynamax** — Max Mondays and Max Battle Days were never matched to your saved Pokémon. Save today\'s Articuno, Zapdos or Moltres and the event shows as [Now on]',
  ],
  '2026-09-21 · v4.9.0': [
    '**Wording across the screens has been tidied up** — the same thing was described differently from screen to screen. Descriptions in the dex, planner and rankings, plus the Terms and Privacy Policy, now read consistently. Nothing about how the site works has changed',
  ],
  '2026-09-21 · v4.8.7': [
    '**The monthly schedule now fills itself** — 5-star, Mega and Shadow raids, Max Mondays, Raid Hours and Spotlight Hours come straight from LeekDuck announcements, and next month shows up early. English titles are items without a Korean name yet',
    '**Fixed favorites vanishing when one ★ save failed** — tapping several in a row and having one fail used to drop the others from the screen until a refresh; now only the one that failed is reverted',
  ],
  '2026-09-21 · v4.8.0': [
    '**Account backups will be kept in one more place** — they are encrypted weekly and stored on GitHub, but those expire after 90 days, so no copy older than that existed. The same encrypted file now also goes to Google storage (Seoul) and is **deleted automatically after 12 months.** Effective September 28; sections 4 and 5 of the privacy policy say so',
    '**Backups are encrypted** — nobody but us can open them. Deleting your account removes it from Firestore right away, but backups taken before that keep it for up to 12 months and then drop it',
  ],
  '2026-09-21 · v4.7.2': [
    '**The privacy policy now describes IP handling correctly** — your IP address is still never stored. But it is read for a moment on arrival, to stop a flood of requests, so the sentence saying it is **"never even seen" has been corrected.** It is still discarded immediately and kept nowhere',
  ],
  '2026-09-21 · v4.7.1': [
    '**From September 28, searches are also logged on moncamp\'s own server** — they currently go only to Google Analytics, which hides Pokémon with few searches, so a ranking could never be built. This brings back the **search ranking** that was taken down on September 20',
    '**Only four things are stored** — the Pokémon you picked, which search box you used, a random number that exists only in this browser, and a country code. **Your IP address is not stored**, your name and email are never sent, and signing in does not link searches to you',
    '**What you type is never sent** — type "Mew", pick Mewtwo, and only **Mewtwo** is counted. The keystrokes in between are not kept anywhere',
    '**Turning it off is still one switch** — ☰ menu → Analytics & storage settings → "Turn off analytics" switches off visit analytics **and** search logging together. If you already turned it off, nothing is sent at all',
    '**The privacy policy has been revised** — effective September 28. It spells out what is kept, where it goes, and for how long. You will be asked to agree once more at your next sign-in',
  ],
  '2026-09-21 · v4.6.4': [
    '**The home poster is no longer cropped on phones** — it was clipped to a strip that hid the bosses; the full picture now shows',
  ],
  '2026-09-20 · v4.6.3': [
    '**The Pokémon search ranking is down for now** — there are not enough searches yet to call it a ranking. Searches are still being counted, and it comes back once there are enough',
  ],
  '2026-09-20 · v4.6.2': [
    '**The country picker on the search ranking now lists only countries with searches** — it used to list every country, most of them empty; the map is clickable only where there is data',
  ],
  '2026-09-20 · v4.6.1': [
    '**When a single day has too few searches, the ranking widens to the past week** — the note above the table says "past week" when that happened',
  ],
  '2026-09-20 · v4.6.0': [
    '**Home has a new layout** — the Pokémon search ranking on the left, the next Max Battle poster on the right; its date and bosses come from the schedule',
    '**The full ranking page now has a world map** — pick a country to see what people there searched most; only countries with enough searches are shaded',
    '**Only well-searched Pokémon make the ranking** — a name opened just a few times no longer counts; it has to add up before we call it a ranking',
  ],
  '2026-09-20 · v4.5.11': [
    '**The home banner is half as tall on phones** — it used to fill the screen and push everything else below the fold',
    "**Yesterday's most-searched Pokémon now scrolls as a single ticker** on narrow screens; tap [See all] for the full ranking",
  ],
  '2026-09-20 · v4.5.8': [
    '**Fixed CP numbers splitting apart on narrow dex cards** — "1,260" broke into "1,26 / 0"; the label now sits above the number, which stays on one line',
  ],
  '2026-09-20 · v4.5.5': [
    "**Yesterday's most-searched Pokémon now sits on the home screen** — the ones people opened most from search, recounted twice a day at noon and midnight",
    '**It counts the name you landed on** — type "Mew", open Mewtwo, and Mewtwo is what gets counted; the letters you typed are not. Searches from anyone who turned analytics off are not counted',
  ],
  '2026-09-20 · v4.5.3': [
    '**Outlines trimmed once more** — now a subtle edge that just defines the shape',
  ],
  '2026-09-20 · v4.5.2': [
    '**Outlines refined** — half as thick, and now applied to the D-MAX tier, raid and PvP ranking cards that were missing them',
  ],
  '2026-09-20 · v4.5.1': [
    '**Pokémon images now have a cartoon-style outline** — they pop like stickers, and the line flips to light in dark mode',
  ],
  '2026-09-20 · v4.5.0': [
    '**Pokémon images look better** — official artwork replaces the 96px pixel sprites, so the dex, rankings, raids and home are all sharper',
    '**Animated pixel sprites are now opt-in** — artwork stills are the default; turn animation back on under Settings > Animated sprites',
  ],
  '2026-09-20 · v4.4.2': [
    '**Screens no longer jump while opening** — on D-MAX the button row used to slide in late and push the title down; its space is now reserved up front',
    '**Home shows up sooner** — the intro at the top renders without waiting for data, and the picks below fill in after',
    '**Long lists scroll more smoothly** — cards outside the viewport are skipped until they come close',
  ],
  '2026-09-20 · v4.4.1': [
    '**Fixed oversized Pokemon on egg and raid cards** — small sprites were blown up 4x and filled the card; they now scale to at most 2x',
  ],
  '2026-09-20 · v4.4.0': [
    '**The home page was rebuilt** — a Max Battle scene up top and a magazine-style index below, so find, compare and record read at a glance',
    '**Pokedex, ranking and raid cards now have a stage** — every Pokemon stands with its feet on the same line; they used to float or sink depending on the sprite',
    '**The search-string builder works like a workbench** — your string sits large on a dark console at the top, and the common presets say why you would use them',
    '**The event calendar can flip months** — six October entries (Harvest Festival, Cinderace Max Battle Day, Zorua Community Day and more) link to the official notices',
    '**Fixed text that vanished in dark mode** — white labels on pressed chips and the CP calculator button were washing out on the bright red',
  ],
  '2026-09-19 · v4.3.9': [
    '**Type names in the Pokedex are legible now** — bright types like Electric, Ground, Steel and Ice were washing out against the page; the type tint stays, the text just got deeper',
  ],
  '2026-09-19 · v4.3.8': [
    '**The menu is now 80% of the screen width** — a strip of the page stays visible, and tapping outside to close is easier',
    '**The close button follows you as you scroll the menu** — it used to slide off the top and leave no way to close',
    '**Menu type was reworked for reading** — section names and tappable rows were the same size; now they read apart at a glance',
  ],
  '2026-09-19 · v4.3.7': [
    '**On phones, popups now stick to the bottom of the screen** — the close and calculator buttons land where your thumb already is',
    '**The close button is the same in every popup now** — the detail popup and the rest finally match',
  ],
  '2026-09-19 · v4.3.6': [
    '**The Pokemon detail popup no longer covers the whole screen** — it caps at 85% height so you can still see what is behind it',
    '**The close button was redrawn** — it used to be a small white square with a tiny x; now it is a deep red key that sits inside the header band, with a much larger glyph',
  ],
  '2026-09-19 · v4.3.5': [
    '**Small text got bigger** — 11px is gone from the screen; 12px is the new floor, the minimum that both the Naver and Google guidelines set for reading',
    '**Tabs are easier to hit** — the [All / Dealer / Tank] tabs were 26px tall; they are 44px now',
    '**Scores are prominent again** — the number you should read first on a card was the same size as body text',
  ],
  '2026-09-19 · v4.3.4': [
    '**Type and spacing now sit on a grid** — text uses only the sizes the pixel font renders crisply, and spacing steps in 4px. The screen breathes more and the letters are sharper',
  ],
  '2026-09-19 · v4.3.3': [
    '**Shadows are hard-edged now too** — no blur anywhere, so the whole screen matches the square corners',
  ],
  '2026-09-19 · v4.3.2': [
    '**Corners are square again** — the card frames, holographic sheen and type bars all stay; only the rounding is gone, so the chrome matches the pixel art',
  ],
  '2026-09-19 · v4.3.1': [
    '**The cards are red now** — Poké Ball red fills the frames and header bands, over a warm red-tinted cream',
    '**Dark mode is bright red on deep maroon** — a black with red in it, so the red on top never goes muddy',
    '**Anything special (Mega, Legendary, S tier) is marked in blue** — the opposite of red, so it still stands out. Warnings moved to crimson so they no longer read as a selection',
  ],
  '2026-09-19 · v4.3.0': [
    '**The whole look is now a trading-card concept** — each ranking row is a card with a gold frame, rounded corners and a holographic sheen',
    '**The bar across the top of each card is its type** — split in half for dual types. The top three in every group always shimmer',
    '**Dark mode is gold on deep indigo** — the way foil catches light on a real card in a dim room',
    '**Pokémon detail reads as a card front** — foil name bar, holographic art window, rounded card frame',
  ],
  '2026-09-19 · v4.2.5': [
    '**Three nets now catch bad numbers before they reach you** — every value is formatted in one place, and the full dataset plus all 46 screens are swept before each release',
    '**A missing value shows a dash (—) instead of a made-up number** — an empty cell is more honest than a wrong one',
  ],
  '2026-09-19 · v4.2.4': [
    '**D-MAX Tank numbers are back** \u2014 where it read `NaN max damage \u00b7 bulk undefined`, you now get EHP with HP \u00d7 Defense, plus the damage multiplier taken once you pick a boss type.',
    '**Dealer, tier list, raids and PvP were checked too** \u2014 each table has its own row shape, so the score cell is now decided in one place and guarded by a test using real-shaped rows.',
  ],
  '2026-09-18 · v4.2.3': [
    '**Picking a type under Raids \u203a All now lists that type** \u2014 choosing Electric used to return Ground-types (Groudon, Garchomp) that counter Electric, under the heading "Electric-type raid performance".',
    '**All and Easy now differ only in what they filter out** \u2014 same type list; Easy drops legendaries, mythicals, megas and shadows, All keeps them.',
    '**To find what beats a boss, use the solo calculator** \u2014 pick the boss and it picks the attackers. The Usage section on a Pok\u00e9mon page is unchanged.',
  ],
  '2026-09-18 · v4.2.2': [
    '**When beta access is switched off, the [\ud83c\udf92 My Pok\u00e9mon N] row in the menu goes with it** \u2014 the row used to stay and only led to a locked screen.',
    '**Permission changes show up in the menu right away** \u2014 an admin changing their own access no longer needs a reload.',
  ],
  '2026-09-18 · v4.2.1': [
    '**My Pok\u00e9mon and \u2605 favourites are back** — the previous release retired them by mistake, and that has been reversed. Everything you had saved is still on your account. Sorry for the scare.',
    '**Open to beta participants**, exactly as before: once an admin enables it you get My Pok\u00e9mon and the D-MAX [unreleased] view.',
    '**What you saved shows up the moment you are approved** — the screen no longer looks empty right after approval.',
  ],
  '2026-09-18 · v4.2.0': [
    '**My Pok\u00e9mon and \u2605 favourites have been retired** — rather than leave them in beta indefinitely, we folded them. Sorry for taking away what you had saved. The dex, rankings, schedule and calculators are unchanged.',
    '**Old links still work** — bookmarks to My Pok\u00e9mon now land on the home screen.',
    '**Sign-in is for trainer codes and display settings** — once approved you can see trainer codes, and your theme follows you across devices.',
    '**Approvals apply right away** — access is re-checked when you come back to the tab, instead of only after a reload.',
    '**Account deletion no longer half-finishes** — if something blocks it, we tell you and stop rather than leaving data behind.',
  ],
  '2026-09-18 · v4.1.1': [
    '**You can sign in with a different account** — after signing out, the app kept taking you back to the previous account. Sign-in now always asks which account to use.',
  ],
  '2026-09-18 · v4.1.0': [
    '**A new look** — the logo, the cards and the Pok\u00e9mon detail view have been redrawn. Where things live, the URLs and everything you saved stay the same.',
    '**Pok\u00e9mon detail is now two columns on wide screens** — the Pok\u00e9mon on the left, the details on the right. The summary puts max CP and battle usage side by side, and catch CP opens only when you want it.',
    '**A tidier top bar** — screens you can go back from now show just the back arrow. This also fixes the logo overlapping the buttons on narrow phones.',
    '**A slightly faster first load** — the sign-in code is fetched only when it is needed.',
  ],
  '2026-09-18 · v4.0.1': [
    '**Experimental features are now granted separately** — \uD83C\uDF92 My Pok\u00e9mon and the [Unreleased] view on D-MAX are still being worked on. An admin can turn them on for you.',
    '**Admin rights now cover user management only** — helping run the service and trying things early are two different roles. Becoming an admin no longer opens experimental features.',
  ],
  '2026-09-18 · v4.0.0': [
    '**moncamp has evolved — rebuilt on React** — smoother navigation and a faster first load. Screens, URLs and everything you saved stay the same.',
    '**If you installed moncamp to your home screen, please remove and reinstall it** — an older copy of the app may still be cached.',
  ],
  '2026-09-17 · v3.61.2': [
    '**Pokémon that aren\u2019t in the game yet no longer show up in Pokédex search** — 16 data-only forms such as [Gigantamax Zamazenta (Crowned Shield)] were simply listed. Only what you can actually catch now appears.',
    '**Same for IV rank and [Add a Pokémon] in My Pokémon** — those pick a Pokémon you actually own, so unreleased forms are out of the candidate list.',
  ],
  '2026-09-17 · v3.61.1': [
    '**The menu\u2019s [My Pokémon — N] now counts what you saved** — it used to sit at 0 no matter what. Tap it to open the screen, and the number updates the moment you tap ★.',
    '**The [+ My Pokémon] button is gone from Pokémon pages** — while individual records are paused there was nowhere for it to lead.',
    '**Old ★ favourites links go to the right screen** — they used to land on the Pokédex, now they open [My Pokémon].',
  ],
  '2026-09-17 · v3.61.0': [
    '**Training Planner and My Pokémon are one screen now** — everything lives under [My Pokémon] in the menu. Old links still open.',
    '**[Coming up] sits at the top** — Community Day, Spotlight Hour and raid dates for the Pokémon you saved, soonest first.',
    '**Your saved list sits below it** — rows with an event carry a countdown, and ★ removes one.',
    '**📣 news is open to every signed-in account** — it used to be limited to experimental testers.',
    '**Recording individual Pokémon (level, IVs, moves) is paused** — seven fields to fill in, and the numbers went stale the moment you powered one up in game. CP and league reach are still in the calculator.',
  ],
  '2026-09-17 · v3.60.0': [
    '**★ Favourites are back** — the star at the top right of a Pokémon page adds it. That page is the only place you add one.',
    '**Saving one now buys you something** — when that Pokémon shows up in a Community Day, Spotlight Hour or raid rotation, a 📣 badge appears on its page and takes you straight to the event schedule.',
    '**Signing in keeps them** — you can save favourites while your account is still awaiting approval.',
    '**Still an experiment** — the 📣 badge only shows for accounts opted into experimental features.',
    '**Buttons in popups now look the same** — the one you are meant to press is filled in, the rest share a single outline.',
  ],
  '2026-09-17 · v3.59.0': [
    '**Event schedule, raid bosses, egg hatches, PvP and the search builder are open without signing in** — screens that used to be locked are now free to browse.',
    '**Training Planner and My Pokémon need an account** — they record your own Pokémon, so they belong to a signed-in profile.',
    '**The temporary trial is paused** — being locked out two hours after writing things down was worse than not starting.',
  ],
  '2026-09-17 · v3.58.0': [
    '**Solo raid recommendations are more accurate** — against dual-type bosses we now use the moves a Pokémon actually carries, not its own typing.',
    '**For example** Shadow Chandelure is Ghost/Fire but only carries Fire moves, so it gets no Ghost bonus against a Psychic boss. We used to grant it anyway, overstating its damage by 60% and ranking it first.',
    '**238 of 570 attackers changed** — the recommended order for dual-type bosses shifts.',
  ],
  '2026-09-17 · v3.57.1': [
    '**Analytics is collected on moncamp.kr only** — another site sharing the old host no longer mixes into our numbers. Nothing changes on screen.',
  ],
  '2026-09-17 · v3.57.0': [
    '**Screen-by-screen usage is now measured correctly** — moving between screens used to register as a single page. Nothing changes on screen.',
  ],
  '2026-09-17 · v3.56.0': [
    '**Korean text no longer leaks into the English pages** — the new home cards were not being translated.',
    '**The current menu item stands out again** — it had become the same colour as hover.',
    '**The rule between a page title and its body is back** — it had vanished on seven screens.',
    '**Rules no longer thicken when you enlarge text** — a line says present or absent, not how thick.',
    '**Unreleased Pokémon rows are marked again** — their tint had become identical to released rows.',
    '**Column counts on wide screens are back to the ladder** — raids and eggs had gained an extra column.',
  ],
  '2026-09-16 · v3.55.1': [
    '**Home section headers now share one shape** — title and its button on the top line, description on the line below.',
  ],
  '2026-09-16 · v3.55.0': [
    '**Game updates moved to the bottom of the home screen** — what the service is, what it does and the recommended rankings come first; news is the last thing you scroll past.',
  ],
  '2026-09-16 · v3.54.0': [
    '**43 past updates are now browsable** — our 11 written posts plus 32 official items listed as [Source only].',
    '**[Source only] is a verbatim quote from the official source, not our summary** — title, date, link and one passage. When someone writes a summary, that entry becomes a full post.',
    '**[With summary only] filters to posts we have written up.**',
  ],
  '2026-09-16 · v3.53.0': [
    '**Game updates now has 11 posts** — added items confirmed from the official release notes and known issues: the Premier Ball count display during raids, Max Battle rewards showing 0, the egg hatch list mismatch, and more.',
    '**[More past updates] walks back through the archive** — five at a time, more on each tap.',
    '**Posts sourced from release notes carry a \'Checked\' date** — that document does not publish dates, so we state when we last read the original.',
  ],
  '2026-09-16 · v3.52.0': [
    '**A gym post is up** — the additional Charged Attack from Mega Evolution works in GO Battle League but not in Gym battles against defenders. Confirmed against the official source (Korean and English).',
    '**Every post now carries \'What moncamp suggests\'** — instead of our internal status, it says which screen to use and what to do about the change.',
    '**Official sources appear as preview cards** — the original article\'s image, title and address together.',
  ],
  '2026-09-16 · v3.51.0': [
    '**A 📢 Game updates screen has been added** — rule, balance and bug changes in Pokémon GO, collected in one place. Reachable from the menu and the home screen.',
    '**Only posts confirmed against an official announcement are published** — each carries its evidence and rollout status, announced/effective dates, and a link to the official source. Reports still being checked are not published.',
    '**The detail view puts before and after side by side** — when the previous value is unknown it says so instead of inventing one. It also flags whether moncamp\'s rankings still need a check.',
    '**Game updates, Events and Patch notes are three different screens** — what changed in the game / what is on when / what changed in moncamp.',
    '**(fix) The dex number and form badge in the detail popup sat at different heights** — now centered on the same line.',
  ],
  '2026-09-16 · v3.50.5': [
    '**(fix) Opening another Pokémon\'s share link while a detail popup was open dropped you on the home screen** — it now opens that Pokémon.',
    '**In English, the line under the name shows the Korean name** — 메타그로스 under Metagross, instead of Metagross twice. The Korean view keeps the English name there.',
    '**The header shrinks on both the Battle info and Evolution tabs** — next to the small sprite: [Dragon][Flying] #0149 · Dragonite · English name, in the same order as the big header (the Summary tab keeps the big sprite and corner badges).',
  ],
  '2026-09-16 · v3.50.3': [
    '**The PC detail popup is capped at 800px tall** — it no longer grows without limit on large monitors.',
  ],
  '2026-09-16 · v3.50.2': [
    '**(fix) The detail popup\'s [close] sat slightly above [Pokédex]** — now on the same line with the same spacing.',
  ],
  '2026-09-16 · v3.50.1': [
    '**Detail popup buttons rearranged** — top row: [＋ My Pokémon] · [Pokédex] · [close]; bottom row: [Copy link] · [CP calculator]. The Pokédex button leaves for another screen, so it sits on top; sharing acts on this Pokémon, so it sits below.',
    '**Type badges are back on the top-left corner of the sprite**, as before.',
  ],
  '2026-09-16 · v3.50.0': [
    '**The Pokémon detail popup is rebuilt** — instead of one long column, three tabs (**Summary · Battle info · Evolution**) take you straight to what you need. Summary has the big sprite, CP, catch CP and moves; Battle info has weaknesses/resistances, usage rankings and recommended picks when it is the boss.',
    '**Tapping an evolution or a recommended pick switches inside the same window** — [← Back] restores the tab, scroll position and calculator inputs you had.',
    '**[Pokédex] and [CP calculator] buttons stay pinned at the bottom** — the calculator takes typed numbers, ± buttons and level presets (20·25·30·40·50). The Pokédex button closes the popup and opens the Pokédex.',
    '**On PC it is a two-column popup** — Pokémon info fixed on the left, only the right side changes. It replaces the fixed right-hand panel.',
    '**(fix) A detail popup opened right before sign-in finished on the Pokédex used to vanish** — redrawing the same screen no longer touches an open popup.',
  ],
  '2026-09-16 · v3.49.1': [
    '**(fix) Refreshing looked like it signed you out** — you were never signed out; restoring the session took over ten seconds and the [sign in] button sat there meanwhile. It now carries over immediately, and says "checking your sign-in" if it needs a moment.',
    '**(fix) Edits to My Pokémon during that gap did not reach your account** — saving now waits until the sign-in check has finished.',
  ],
  '2026-09-16 · v3.49.0': [
    '**Pokémon that have not launched yet are easier to read** — the blur that hid them is gone, replaced by a red bar on the left. Blurred rows could not actually be read. The [not in GO] chip in the Pokédex is the same red now.',
  ],
  '2026-09-16 · v3.48.2': [
    '**The terms for the code are now explicit** — the repository is public to read and learn from; forking and redistribution are not permitted. The same wording is in the terms (section 5), the page footer, and LICENSE · NOTICE in the repository.',
  ],
  '2026-09-16 · v3.48.1': [
    '**Pokémon without an animated sprite now hold still** — the gentle bobbing of still images is gone; a list of them twitching out of step looked restless. Species with animated sprites still move.',
  ],
  '2026-09-16 · v3.48.0': [
    '**The first screen got lighter again** — 23% less to download up front (362 → 278KB), and the speed score went from 89 to 94. Tables the home screen never uses (raid bosses, eggs, the sheet tier list, move changes) now arrive after the screen is drawn.',
    '**Opening one of those screens first shows a brief "loading" line** — usually the data is already there and it opens at once. Search re-indexes automatically when those tables arrive.',
  ],
  '2026-09-16 · v3.47.0': [
    '**The screen no longer goes blank on a bad data day** — if a source arrives empty or sharply shrunk, that one table is served from the previous day instead. Until now that screen simply went empty.',
    '**Sign-up approvals and My Pokémon are backed up weekly** — an operator mistake can now be undone. Backups are encrypted and never readable by anyone else.',
  ],
  '2026-09-16 · v3.46.0': [
    '**The first screen is noticeably faster** — 22% less to download up front, and the wait before the first text appears dropped by more than half on a slow connection.',
    '**Patch notes and the English dictionary load on demand** — the home screen never uses them, so they now follow afterwards.',
    '**Repeat visits are faster** — the rendering code is a separate file now, so an unchanged release is not downloaded again.',
  ],
  '2026-09-15 · v3.45.0': [
    '**The notice banner that appeared on arrival is gone** — it covered the bottom of the screen and got in the way of a first visit. You now land straight on the site.',
    '**Turning analytics off works exactly as before** — ☰ menu → analytics and storage settings, or the same entry at the bottom of the page. What is stored and what is sent is still written out in the privacy policy, and if you already turned it off it stays off.',
  ],
  '2026-09-15 · v3.44.0': [
    '**(Fix) Pokémon not yet in the game were being recommended against this week’s boss** — the "Suggested party" and "Recommended attackers" cards at the top of D-MAX were filled from rank 1 with entries that only exist in the game files. Recommendations now list **only what you can actually bring today**, and the "N total" count matches what you can see.',
    '**The home screen no longer jumps** — the whole page used to shift upward the moment it finished drawing.',
    '**The first screen loads a little faster** — the data is read a different way, so there is less waiting on a phone.',
  ],
  '2026-09-15 · v3.43.0': [
    '**Easier to find by search** — the title in search results is now "Pokémon GO Dynamax tier list · Max Battle deck · Pokédex" instead of leading with a brand name nobody knows yet. Titles get cut off after about 30 characters, and that opening was being spent on the name.',
    '**(Fix) The title collapsed to "moncamp" on the home screen** — search engines read the title after the page is drawn, so the longer one written into the page was disappearing a second later.',
    '**Visitors with JavaScript turned off now see what the site is** — it used to be a blank page. The screens are listed in plain text.',
  ],
  '2026-09-15 · v3.42.1': [
    '**(Fix) No visit statistics were being recorded at all** — the measurement ID pointed at a stream that no longer exists, so the analytics script never loaded. That is why nothing was logged even after v3.39.0 said it was on by default. The ID is corrected. Turning it off works the same way — [Turn off statistics] in the banner, or ☰ menu → statistics and storage settings.',
  ],
  '2026-09-15 · v3.42.0': [
    '**The home screen is reordered** — "What would you like to do?" now sits right under the greeting, so a first visit starts with **where to go**. The three "Strong right now" boards moved below it.',
  ],
  '2026-09-15 · v3.41.1': [
    '**(Polish) Rows marked not in GO stay blurred on hover** — brushing past one used to sharpen it, which made the marking almost meaningless. Tap to expand and the formula and grade are still readable.',
  ],
  '2026-09-15 · v3.41.0': [
    '**What an admin can do is now split** — approving sign-ups, revoking approval and appointing admins belong to the **root admin** alone. An appointed admin gets [👥 User management] in the ☰ menu to see who is using the service, and keeps trainer-code management and the D-MAX [not in GO] view.',
    'The menu name says what you can do — [🔑 Approvals] for the root admin, [👥 User management] for everyone else.',
    '**(Fix) Your own name appeared twice in the admin list** — the "you" row at the top and the list row overlapped, and the count was one too high.',
    '**(Fix) The root account showed up under "waiting for approval"** — it works without approval, so it should never have been listed as waiting.',
  ],
  '2026-09-15 · v3.40.0': [
    '**Admins can now be appointed from the screen** — ☰ menu → 🔑 Approvals, then press [Make admin] next to an approved member. They can then handle sign-up approvals and trainer codes with you.',
    '**The panel is split by role** — waiting / admins / approved friends. Who can do what is visible at a glance.',
    '**Only the root admin can appoint or remove** — if the power spread on its own there would be nobody left to undo it.',
    '**[not in GO] is now admin-only** — seeing what has not launched yet belongs to whoever runs the service.',
  ],
  '2026-09-15 · v3.39.0': [
    '**Visit analytics are on by default** — previously only people who pressed "Allow analytics" on the first-visit banner were counted. Most visitors pressed nothing, so there was no way to see which screens get used. Now a visit is counted on arrival, and **you can turn it off**.',
    '**Turning it off works the same way** — [Turn off analytics] on the first-visit banner, or ☰ menu → Analytics & storage settings. Once off, the analytics script is not loaded at all.',
    '**No ads and no location, as before** — all that is recorded is visits and which features get used. The privacy policy has been updated to match.',
    'Counting now starts **before** the screen finishes drawing — until now it started afterwards, so a quick visit left no record at all.',
  ],
  '2026-09-15 · v3.38.0': [
    '**[not in GO] is now for members** — seeing what has not launched yet is a signed-in perk. Without an account the checkbox is not shown at all, and no faded rows appear in the tables.',
    'Sign in and the control appears right away — no need to reload the screen.',
  ],
  '2026-09-15 · v3.37.0': [
    '**A [not in GO] checkbox** — top right of the D-MAX screen, just left of the deck button. It is **off by default**, so the tables show only what you can use today. Turn it on to also see entries whose data is registered but that have not launched.',
    '**When it is on, they are set further apart** — faded rows are pushed one step to the right, dimmed more, and slightly blurred. Hover one, or tap to expand it, and it sharpens so you can read it.',
    'Your choice stays on this device, so the screen looks the same next time you come back.',
  ],
  '2026-09-15 · v3.36.0': [
    '**Things that have not launched yet are shown faded** — the game files already carry data for Pokémon you cannot use yet. The D-MAX tables (all / attacker / tank) no longer drop them: they appear faded and marked **not in GO**, so you can see where one would land once it arrives.',
    '**The rankings do not shift** — faded rows get no rank number. Released entries stay numbered 1, 2, 3 … without a gap, and the 100% mark for grades is still the best released entry (so a faded row can go above 100%).',
    '**They stay out of deck building and recommendations** — a ranking can say "this is roughly where it would land", but a deck has to hold what you can actually bring today.',
    '**The Pokédex marks unreleased Megas too** — the chip used to be dropped entirely, so a species with no Mega looked the same as one whose Mega has not launched. It now shows as a dashed grey chip (Mega Camerupt).',
    '**(Fix) The Mega chip stacked its characters vertically in Pokédex rows** — on wide screens the row layout left it no room.',
  ],
  '2026-09-15 · v3.35.1': [
    '**(Hotfix) Animated sprites grew without stopping** — where a sprite is sized by its slot rather than by a fixed rule, such as the PvP deck builder, one sprite grew a little every 0.8 seconds until it covered the screen. The Little League deck showed it clearly.',
  ],
  '2026-09-15 · v3.35.0': [
    '**Tabs moved to their own full-width row right under the screen description** — the D-MAX axes, the raid Normal/All pair, the four PvP leagues and the Pok\u00e9dex generation chips all sit in the same place now, and the full width makes them easier to tap.',
    '**Only the tools and the view switch stay beside the title, pushed to the right** — title on the left, handles on the right, so your eye moves between two places instead of three.',
    '**\u201cGrid view\u201d and \u201cList view\u201d now read as words on phones too** — with only the icon there was no way to tell which state you were in and which one the tap would give you.',
    '**(Fix) Opening D-MAX as the first screen showed no tab row** — you had to navigate away and back for it to appear.',
    '**(Fix) Leaving D-MAX for the Pok\u00e9dex or Raid bosses left its tab row behind** on the new screen.',
  ],
  '2026-09-15 · v3.34.0': [
    '**Every screen control now sits in one row above the title** — D-MAX, Raid and Battle read the same way: what to look at, then the tools, then how to look at it.',
    '**The tool buttons moved up** — IV rank, PvP deck and the solo raid calculator were scattered in a row above the list. They now share the place the Max Battle deck builder uses.',
    '**(Fix) The button row was cut off on phones** — Battle/PvP has four controls, too many for one line, so the right edge was clipped. It now wraps to the next line instead.',
  ],
  '2026-09-15 · v3.33.0': [
    '**Easier to find by search** — the title in search results changed from \u201cmoncamp \u2014 what to raise, what to catch\u201d to \u201cPok\u00e9mon GO Dynamax tier list \u00b7 Max Battle decks \u00b7 Pok\u00e9dex\u201d. A title without the words people actually type cannot be found.',
    '**The opening line changed too** — \u201cDynamax tier lists live here.\u201d so a first-time visitor knows what this place is from the first line.',
    '**English searches reach us now** — the description and structured data carry the English terms as well (Dynamax, Gigantamax, Max Battle, Pok\u00e9dex).',
  ],
  '2026-09-15 · v3.32.0': [
    '**A Max Battle deck builder** — pick a boss and we pick the three to bring (two attackers and a tank). The [\U0001F9E9 Build a deck] button on the D-MAX screen opens it.',
    '**Any boss, not just this week\u2019s** — it starts on the current boss, but all eighteen types are one tap away. Useful for \u201cthat one is coming next week, what should I power up?\u201d',
    '**Every slot can be swapped** — [Swap] opens the candidates for that slot, so when you do not have the #1 pick you can drop in #2 or #3. The same species never fills two slots.',
    '**A [Dynamax only] filter** — leaves Gigantamax forms out, for when you have not caught one yet.',
    '**Decks travel as links** — send the address as it is and the other person sees the same deck.',
    '**The contact email address changed** — it appears at the foot of the screen and in the privacy policy and terms.',
  ],
  '2026-09-14 · v3.31.0': [
    '**Mega Evolution and Primal Reversion now show in the Pok\u00e9dex** — until now you had to open each entry to find out whether a species had a Mega. The list now carries a ⚡ Mega, Mega X·Y or Primal chip: 57 species with a Mega, 2 with a Primal Reversion (Kyogre and Groudon).',
    '**A [⚡ Mega · Primal] chip gathers them in one place** — it sits beside the generation chips. Those now toggle off on a second tap too; picking a generation used to leave no way back to the full list.',
    '**(Fix) Unreleased Megas were mixed in** — the game files carry stats for Megas that have not launched. Mega Camerupt was one, so it no longer gets a chip, and the evolution box marks it as not in GO.',
    '**(Fix) Primal Reversion was labelled Mega Evolution** — Kyogre and Groudon said "Can Mega Evolve", which is a different thing in the game. They now say "Can Primal Revert".',
  ],
  '2026-09-14 · v3.30.1': [
    '**(Fix) The (i) beside the tier list heading was floating in the wrong place** — on desktop it drifted to the middle between the title and the count on the right, and on phones it dropped onto its own line. It now sits right beside the title.',
    '**(Fix) On wide screens the reasoning box beside a card was only half the card\u2019s height** — it now matches the card.',
    '**Tap the (i) to open the note** — phones have no hover, so the tooltip never showed. Tapping now unfolds the same text under the heading; tap again to fold it.',
    '**(Fix) Card rank numbers restarted at 1 in every tier group** — on the Ground tab #2 Excadrill read \'1\' and #3 Rhydon read \'2\', contradicting the \'#2 among Ground\' line in the reasoning. Ranks now count across the whole tab.',
  ],
  '2026-09-14 · v3.30.0': [
    '**D-MAX tiers are now graded across every species** — until now a tier letter was decided within the tab you happened to be on, so the same Pokemon could read S in one tab and C in another. A letter is now fixed: S at 90% or more of the best score overall, A at 80%, B at 70%. Only the rank number is counted within the tab.',
    '**Bulk is now part of the tier score** — raw damage alone pushed single-stage species above fully evolved ones. A Max Battle is won by surviving through several Max phases, so Defense x HP is mixed in lightly as a fourth root. Rhyperior moving ahead of Excadrill is the result.',
    '**Every card explains its grade in two lines** — open a card and you get the score formula on one line, and the tier letter, the percentage of the best of all species and the rank within the tab on the next. The (i) beside the table heading spells out the full grading rule.',
  ],
  '2026-09-14 · v3.29.0': [
    '**The empty space beside tier cards on wide screens is fixed** — a tier with a single species left two cells empty while its reasoning block dropped below them. The reasoning now sits in that empty space, right beside the card.',
    '**Type chips no longer get cut off** — opening the detail panel narrowed the chip strip until half of the eighteen types hid behind a horizontal scroll, including the one you had selected. On wide screens the strip now wraps and shows them all.',
  ],
  '2026-09-14 · v3.28.3': [
    '**(Fix) Duraludon showed as Max Battle capable before its Dynamax released** — it had been listed as released by mistake, confused with the Gigantamax move data that sits in the game files. It is removed. It never appeared in the rankings.',
  ],
  '2026-09-14 · v3.28.2': [
    '**Dynamax Rhyhorn, Rhydon and Rhyperior are in** — released in today\u2019s Max Monday, the line now appears in the D-MAX tier list, attacker and tank rankings, and the Max Battle marks in the Pokédex. Rhyperior is the #1 attacker against Electric bosses, #2 against Fire and #5 against Rock, and a top tank against Poison and Electric bosses.',
  ],
  '2026-09-14 · v3.28.1': [
    '**Getting listed on Naver** — one line that lets Naver Search Advisor confirm who owns the site. Nothing changes on screen.',
  ],
  '2026-09-14 · v3.28.0': [
    '**Open to search engines** — with a domain of its own, the site is ready to be indexed. An index directive and structured data (site information) let Google and Naver find the front page. The preview address stays out of search as before.',
  ],
  '2026-09-14 · v3.27.1': [
    '**(Fix) Usage statistics were landing in the wrong place** — the analytics measurement ID pointed at another site under the same account. It now points at moncamp.kr. Only visits from people who consented are counted, as before.',
  ],
  '2026-09-14 · v3.27.0': [
    '**The service is now named moncamp** — yesterday\u2019s monlab lasted a day: no domain was available. The new address moncamp.kr is being prepared. Saved settings and accounts are unchanged.',
    '**App install (PWA) and offline reading keep working at the new address** — they were switched on for the old address only, so a plain move would have silently turned them off.',
  ],
  '2026-09-14 · v3.26.0': [
    '**The service is now called monlab** — logo, title, install name, share card and every notice say monlab. The address and your saved settings are unchanged.',
    '**Every small spot that stayed Korean in the KR/EN switch has been swept** — the sign-in prompt, locked-screen card, account card, the weakness/resistance headings and CP footnotes in the detail popup, D-MAX attacker/tank titles and notes, IV ranking, search-builder hint, consent banner, settings, move changes, the solo calculator and the My Pokémon editor. Nineteen screens and popups were opened in English and 172 leftovers fixed; only event names in the schedule stay Korean on purpose (it is the Korean server schedule).',
    '**Text swapped in after rendering is translated too** — places that only change an attribute on an existing element, like the theme button\u2019s spoken name, were out of reach. Attribute and text changes are now watched as well.',
    '**Dictionary keys that could never match are fixed** — nine keys ending in a space (such as "For now this is saved in this browser only.") never matched the engine, which trims before lookup, so those lines always stayed Korean.',
  ],
  '2026-09-13 · v3.24.0': [
    '**Search now tells you PvP or raids at a glance** — every Pokédex and search row carries two pills next to the name, [PvP 89] [PvE 59], with the stronger side highlighted. Same 0–100 scores as the Value screen.',
    '**The stat hexagon\u2019s Raid and PvP axes are fixed** — they used to be drawn from "does it make a top-30 table", so a base form like Swampert, whose Mega and Shadow are the ones ranked, had its Raid axis flat on the floor. They now use scores computed for every species (Swampert: Raid 59 · PvP 89).',
  ],
  '2026-09-13 · v3.23.0': [
    '**A lighter first screen** — the same 155KB of styles was shipped twice (a slip from reworking the loading screen three days ago). It ships once now: first-screen size 842 → 690KB.',
    '**No more unused web font** — since the pixel redesign nothing used Inter, yet every visit fetched one request plus four font files.',
    '**The Korean font no longer holds up rendering** — the first paint used to wait for the font CSS to arrive. It paints first and swaps the font in when it lands.',
  ],
  '2026-09-13 · v3.22.1': [
    '**The home screen is now one dashboard** — three quick links (Pokédex · Events · Raid bosses) next to the greeting, the three ranking blocks below, then the feature tiles in three columns. It fits one wide screen, and stacks in the same order on phones.',
    '**Each ranking leads with its #1 as a large sprite** — the first card in every block stands at 160px, with #2 and #3 as rows beneath. A colored top edge tells D-MAX, Raids and Useful-all-around apart.',
    '**Feature tiles became rows inside three cards** — What now · Who to bring · Who to raise, each card listing its screens. The grouping reads first, where nine loose tiles used to.',
  ],
  '2026-09-13 · v3.22.0': [
    '**Three rankings at once on the home screen** — the D-MAX tier list, raid attackers and \u0027useful all around\u0027, top 3 each, nine cards in all. Only the last one used to be here, so "what is strong in raids right now" meant opening another screen.',
    '**Cards lead with the artwork** — rank, name and a one-line reason (tier and Max Move type · DPS and TDO · how many places it is used). Tap a card for the full details, or [See all] in a block header for that ranking.',
    '**On wide screens the three blocks stand side by side** — easy to compare. On phones they stack, with three cards across each.',
  ],
  '2026-09-13 · v3.21.0': [
    '**\u0027Useful all around\u0027 now sits at the top of the home screen** — it used to come after all nine feature tiles, so answering "what should I raise" meant scrolling past them. It is right under the greeting now.',
    '**Each row reads in two lines** — the name first, where it is used underneath, and a [N places] badge on the right. Packed into one line, the tail used to wrap at random on narrow screens. Wide screens get two columns.',
    '**The feature tiles are grouped in three** — What now · Who to bring · Who to raise, in the same order as the \u2630 menu. The 01~09 numbers are gone; they implied an order that was never there.',
  ],
  '2026-09-13 · v3.20.0': [
    '**Animated sprites keep their original scale** — stretching every sprite to fill its box blew small Pokémon up more than 3× and left sizes all over the place. They now scale up **at most 2×**, so Bulbasaur reads smaller than Venusaur and the pixels stay crisp.',
    '**Large sprites still shrink to fit** — scaling down is smoothed, scaling up keeps the pixels sharp.',
  ],
  '2026-09-13 · v3.19.1': [
    '**Type badges no longer cover the sprite on the detail screen** — animated sprites reach higher than the still ones, so the top-left badges overlapped the head. The sprite is a bit smaller and sits lower; the badges moved up.',
  ],
  '2026-09-12 · v3.19.0': [
    '**Almost every Pokémon animates now** — only 949 species had animated sprites, so Gen 6+ and Mega/regional forms stood still. A second source (Pokémon Showdown) brings it to 1,151.',
    '**The 21 without one bob gently** — Gen 9 species like Ogerpon and Pecharunt have no public animation yet, so their still image breathes instead. Turning animated sprites off in Settings stops this too.',
  ],
  '2026-09-12 · v3.18.0': [
    '**Pokémon now animate** — the animated sprites that lived only on the detail screen are on by default across tier lists, the Pokédex and every list. The still image shows first and swaps in as the GIF arrives. Too heavy? Turn it off under **Settings → Animated sprites**.',
    '**Everything is open without signing in (for now)** — Events, Raid bosses, Eggs, Raid PvE, Battle PvP, Planner, My Pokémon and the Search builder. My Pokémon is stored in this browser and moves to your account when you sign in.',
    '**The sign-up invitation popup is gone** — nothing to pitch while everything is open.',
  ],
  '2026-09-12 · v3.17.1': [
    '**Try it briefly is now 2 hours per try** — 24 hours meant three tries were three days, and the reason to sign up arrived too late. Two hours is plenty for one sitting. Still three tries.',
  ],
  '2026-09-12 · v3.17.0': [
    '**Try it briefly now lasts 24 hours instead of 20 seconds** — 20 seconds was not enough to read a single screen. A day lets you actually use the tier lists and come back. The badge in the top-right now counts hours and minutes.',
    '**Still three tries** — three tries is three days. After that: "Time to sign up 🙂".',
  ],
  '2026-09-12 · v3.16.0': [
    '**Locked screens can be tried for 20 seconds without signing in** — tap [⏱ Try it briefly] on the lock notice and the screen opens while a badge in the top-right counts down. When time is up it locks again and the sign-in notice returns.',
    '**Three tries** — after the third, the button is replaced by "Time to sign up 🙂". Asking you to sign in to an approval-gated service before you have seen anything was the wrong order, so now we show first and ask after.',
  ],
  '2026-09-12 · v3.15.0': [
    '**The Pokémon you tapped in the Pokédex stays marked** — on wide screens only the right-hand panel changed and the list kept no trace, so you lost track of what you had opened. The row now keeps the same look as when you hover over it.',
    '**Tapping an evolution stage moves the list along** — open Venusaur from Bulbasaur and the list scrolls to and marks the Venusaur row as the panel changes. If it sits behind [More], the list expands that far.',
  ],
  '2026-09-12 · v3.13.0': [
    '**Stale guidance around the app is gone** — four spots still said "★ favorites are saved to your account", but favorites merged into My Pokémon back in v2.51.0. They now describe only what exists: My Pokémon, search strings and display settings.',
    '**[Go to My Pokémon →] left the planner home** — one screen had five doors to the same place. The summary card is for showing numbers. The "coming next" line at the bottom went too: a to-do list is not for users, and the search-string builder it promised already shipped.',
    '**Invisible leftovers were cleaned up** — the header tagline row and the old tab row were still in the markup and code. Nothing changes on screen; the first screen just gets that much lighter.',
  ],
  '2026-09-12 · v3.12.0': [
    '**Searching takes you straight to the Pokédex** — the 🔍 button, the search box up top and the `/` key all lead to the same place, and the popup is gone. When results live inside a popup, the handful of rows showing there read as "the results", so you never reach the Pokédex where all of them are.',
    '**Type chips moved into the Pokédex** — what you filtered by belongs next to the list it produced. Expand [Narrow by type] and pick up to two.',
    '**🏆 Usage rankings moved to the service home** — they used to live in the empty state of the search popup. "High across several rankings" is something you read before deciding which screen to open, so home is where it belongs.',
    '**Tap targets grew to finger size** — measuring every screen found buttons like [More] and [Copy] at 22px, about half a fingertip. Text sizes are unchanged; only the area you can hit grew.',
  ],
  '2026-09-07': [
    '📜 Terms of Service arrived and the Privacy Policy was heavily revised (☰ menu · footer) — what is stored where and for how long, processing by Firebase and Google Analytics and transfers abroad, no sign-ups under 14, the privacy officer, and a statement that location is never collected. On your next sign-in we ask once for consent and an age confirmation.',
    '🍪 On a first visit a bottom banner explains browser storage and asks consent for visit statistics (Google Analytics) — before you consent the analytics script is not even loaded, and you can change it or clear the offline cache any time from ☰ menu → Analytics and storage.',
    'You can delete your own account — ☰ menu → account card → Delete account. Favorites, My Pokémon, approval records, the sign-up request and the Google sign-in link all go at once (irreversible).',
    'The code is open source under MIT — LICENSE, NOTICE (data and images keep their own terms), CONTRIBUTING and SECURITY are in the repository. Rights notices show in the footer and at the bottom of every page (Pokémon GO is Scopely Explore, Inc.).',
    'The service is now called POGO PLAN — "what to raise and what to catch", in one place. URLs, installed apps, bookmarks and saved Pokémon are unchanged; only the home-screen icon name changes on your next install.',
    'Fixed artwork failing to appear on first open and needing a refresh — images load eagerly instead of lazily, retry twice on failure, and the loading screen stays until the first screen’s images are in (up to 2.5 s).',
    'Tabs are down to three: D-MAX · PvE · PvP — the IF tab’s solo raid calculator became the 🧮 button on the right of PvE, and PvP team building the 🃏 button on the right of PvP. They unfold in place and fold away on a second tap (team building reuses the PvP league toggle).',
    'The usage tab folded into the 🔍 search panel — leave the box empty for "🏆 Usage rankings" (Pokémon high in several lists), and every search result carries a "used in N places" badge.',
    'Left only one button per destination — removed the Pokédex, Matchups, Favorites and mode-switch rows from the ☰ menu, "Fill from the Pokédex" on the account card, "Split PvE · PvP" on the favorites card, and the planner home’s navigation buttons. Pokédex, Matchups and Favorites are on the tab row (📕 🧭 ★), the mode switch is the header badge, and sign-in is the header 👤.',
    'The 🌱 Planner mode is new — tap the badge beside the header intro (🌱 Planner ↔ 🔎 Pokédex) and the whole menu changes. The Pokédex answers "what is strong"; the planner answers "how do I raise what I have". It remembers the last mode, and the default is Pokédex mode, so nothing you use moves.',
    '🎒 My Pokémon — save what you actually own by species, form, Shadow status, level, IVs, moves, status (raising / done / for trade) and notes, to your account (approved accounts, synced across devices). You can save several of the same species, and CP is calculated from base stats × level × IVs. Enter the CP the game shows and it works out the level.',
    '⚖️ Compare two of the same species — tap [☐ Compare] on two and see current CP, IVs, max-level CP, the CP each reaches in Little / Great / Ultra (highest level under the cap) and moves side by side. It is a comparison of numbers, not a verdict.',
    'A ➕ button on the right of the detail popup — jump straight to adding the Pokémon you are looking at (Mega and Shadow forms included), pre-filled, when signed in.',
    'The D-MAX tab splits three ways: [All | Attacker | Tank] — All is the tier list by Max Move type, Attacker ranks Max attackers against a boss type, Tank ranks by EHP. Type chips below narrow each one.',
    'The ★ Favorites card can be collapsed — tap the heading and it folds, and the folded state is remembered.',
    'New typefaces — Montserrat for Latin and numbers, Pretendard for Korean.',
    'While artwork is loading you now see a grey skeleton instead of a blank, replaced by the image once it arrives.',
    'Tidied the Matchups screen — long names (Gigantamax ○○) and multiplier chips were wrapping and overlapping; line spacing was fixed.',
    'The 📅 schedule page (See details) gained category chips (All · Events · 5-star · Mega · D-MAX · Hour · Shadow) and a duration timeline — bars from start to end instead of calendar dots, so "what runs until when" reads at a glance. Picking a chip filters the calendar, timeline and list together, and the choice is remembered.',
    '"If this were a boss?" in the detail popup now distinguishes boss types — Dynamax and Gigantamax bosses list only Pokémon eligible for Max Battles, while ordinary, Legendary and Mega raid bosses (Primal Kyogre, say) recommend raid attackers with super-effective types from the whole roster (Mega and Shadow included).',
    'Removed nine unreleased regional forms from the D-MAX table (Galarian Articuno / Zapdos / Moltres, Hisuian Arcanine and Growlithe, Alolan Raichu, Galarian Darmanitan, Alolan and Galarian Meowth) — Gigantamax now matches the official 17.',
    'The 📅 schedule no longer empties out at the end of a month — confirmed October events are in (Harvest Festival, Pikachu’s Autumn Outing, Xerneas, Mega Victreebel, D-MAX Ursaluna, Shadow Thundurus). Rotations after 10/6 will be added as they are announced.',
    'A "used in N places" badge on ranking rows — how many top-30 lists a Pokémon makes across PvE, PvP and D-MAX. Tells you at a glance whether it is good only here or good everywhere (shown from 2, highlighted from 5).',
    'A [Attacker | Tank] toggle on the D-MAX tab — Tank ranks by HP × Defense ÷ incoming multiplier (EHP). This week’s boss card suggests a "2 attackers + 1 tank" party.',
  ],
  '2026-09-06': [
    '🔍 Search takes types as well — the panel became a card, and picking type chips or typing "water grass" gives you Pokémon of that combination. Mix them, like chip [Water] + "mega", and only Water Megas remain; "Matchup search" shows the full list.',
    'Matchup search gained a "Pokémon with this type combination" list — pick two types and you get exactly that combination (Mega and regional forms included), or a note if there are none.',
    'The back button behaves — with a detail popup or the ☰ menu open, your phone’s back button closes that first instead of leaving the site.',
    'Tapping POGO SEARCH in the header returns you home (the full D-MAX tab).',
    'Mega and Dynamax / Gigantamax badges and the artwork frame in the detail popup use the in-game icon colours — magenta for Max, purple and blue for Mega, crimson for Shadow.',
    'Usage statistics (GA) are linked to your sign-in identifier (uid) — so we can see which features are used by whom at a person level and match that against requests. Email and name are never sent; this is written into the privacy policy (menu → Privacy Policy).',
    'The 🧭 Matchup search is new (tab row 🧭 · menu) — pick one or two opponent types or enter a Pokémon name and you get double weaknesses, weaknesses and resistances plus recommended attackers (raid and Max) against that type, all on one screen. The type matchups in the detail popup link straight there.',
    'The detail popup marks double weaknesses (×2.56) and double resistances (×0.39) separately.',
    'Mega, Primal, Shadow, Dynamax and regional form labels before a name became small badges — only the species name is bold, which makes lists easier to scan.',
    'Gigantamax and Dynamax entries in the D-MAX table now differ by name (Gigantamax Cinderace · Dynamax Cinderace · Cinderace), and all three appear separately in search and usage.',
    'Filled in missing artwork — Mega Sharpedo, Mega Kangaskhan, Mega Medicham and other Pokédex Mega forms, plus 45 regional forms in the IF tab boss list and the full PvP rankings.',
    'Remembers the last tab, league and type chip you were on — reopen and you are back where you were (no more bouncing to D-MAX).',
    'A 🔗 share button in the detail popup — send the link and whoever receives it opens that Pokémon’s details directly (e.g. …/#/mon/150).',
    '📕 Pokédex and ★ Favorites shortcuts on the right of the tab row (when signed in).',
    'Search results show where and how high, like "Raids overall #1 · Master League #35".',
    '"Fill from ★ Favorites" in the IF tab’s solo calculator → verify my team — build a team from what you own in one tap.',
  ],
  '2026-09-05': [
    '★ Favorites became its own page (menu → ★) — split into [All | PvE | PvP | Other], with each row showing why it is there, like "Raids overall #1 Mega Y". The star is still one thing (owned) and the category is decided automatically from the rankings.',
    'If the category is wrong, set it yourself in the detail popup → ★ Favorites category (saved to your account only when it differs from the automatic value, with [Reset to automatic]).',
    'Armored Mewtwo uses its own artwork (the in-game icon) — instantly distinguishable from regular Mewtwo.',
    'Added Armored Mewtwo — it did not even appear by name before, and now shows up in the Pokédex, search and details. Its distinct base stats (182 Attack · 278 Defense · 214 HP, 3,603 CP at max level) and moves are shown correctly, with Psystrike marked as a legacy move.',
  ],
  '2026-09-04': [
    'The ⚔️ Move Changes screen is new (menu → ⚔️) — 27 move adjustments and 43 newly learnable moves for the 9/8 Twilight Trails season, with power figures. Affected Pokémon carry a "9/8 move ↑↓" badge on ranking rows, which disappears on its own once the date passes.',
    '▲▼ rank movement — Pokémon that moved two or more places on a data refresh show how far. It compares against the previous refresh and is a real result, not a prediction; it fades after two weeks.',
    'The detail popup also shows move changes affecting that Pokémon — so you can see straight away why a rank moved.',
    'A 🎯 catch CP table in the detail popup — to check a caught Pokémon against, it shows the 100% CP and the lowest CP (with the IV floor of 10) for each source: raid rewards (Lv20 normally, Lv25 in boosted weather) / Max Battles (fixed Lv20, no weather boost) / wild / max level.',
    'Species catchable in Max Battles are marked by whether they are Dynamax or Gigantamax.',
    'CP in the detail popup is split by situation — raid rewards (normal and weather-boosted) and wild spawns (normal and weather-boosted) shown separately.',
    'Pokémon with Mega or Primal evolutions show those forms in the evolution line; tap one for its details.',
    'Pokémon with both Mega X and Mega Y (Mewtwo, Charizard and so on) get a side-by-side table so the difference reads at a glance.',
  ],
  '2026-09-03': [
    'Added a loading screen — a loading view instead of a blank page while data is read.',
    '🔐 Google sign-in added (header 👤) — only friends approved by the admin. Sign in and the ★ in the Pokédex and detail popup saves Pokémon to your account, so they survive a new phone.',
    'The old ☆ (a star stored only on the device) and the "★ owned only" filter are replaced by account favorites and are gone.',
    'Trainer codes are now visible only to signed-in, approved friends (the menu item does not appear at all when signed out).',
    'IF tab rework — a collection of experiments: the solo raid calculator plus PvP team building ([+] slots for one to three opponents → suggested teams in an accordion, counters, and with all three filled an opponent breakdown and a type / move build guide).',
    'PvP team building: every counter says why it is a counter (what STAB it hits with and what it resists), and the GBL rule against duplicate species is applied (suggestions and counters de-duplicate by species).',
    'Three suggested PvP teams are new — drawn from the league meta without opponent input: Standard Core (weaknesses covering each other) · Anti-Meta (aimed at the top 10) · Type Spread, each with an explanation of why that combination. The opponent slots became "Custom team building".',
    'Pokédex: an [unreleased] tag on species not in the game, and a ⊞ two-column layout toggle.',
    'D-MAX tier list corrected — type tabs are based on attackers with a Max Move of that type, and dual STAB appears under both tabs (matching pogomate).',
    'Installable to your home screen (browser menu → Add to Home Screen) — it opens like an app and, once opened, works offline.',
    'Introduced the ☆ owned check (replaced by account favorites in v2.2.0).',
    'Added a CP calculator (menu → 🧮): search a Pokémon, set level and IV sliders, get CP and max-level CP.',
    'Trainer codes in the menu — a copy button copies them without spaces, ready to paste into Add Friend.',
    'A floating ↑ back-to-top button on long lists (it appears once you scroll far enough).',
    'Patch notes became a full page instead of a popup (menu → 🎉 Patch notes). A red dot on the ☰ button marks unread news.',
    'Schedule "See details" — a calendar plus the full month’s events (by category) on a full screen.',
    'Browser and phone back buttons work on pages, and links (#/schedule and so on) can be shared.',
    'Global Pokémon search added — the header 🔍 button; part of a name is enough, and forms are included.',
    'Maximum CP in the detail popup — max level (Lv50) · wild maximum (Lv30) · weather boosted (Lv35), at 100% IVs.',
    'Tapping an evolution in the detail popup moves to that Pokémon.',
    'A new right-hand menu (☰) — schedule, reference notes, patch notes and QA reports tidied into it, so the first screen goes straight to the tier list.',
    'New intro line: "What to raise, what to catch. It ends here."',
  ],
  '2026-09-02': [
    'The IF tab is new — a solo raid calculator built with a player who measured the real numbers (search a boss name → an elite team against it, revive cycling accounted for, a banner at the top if it is not possible).',
    'The popup close button now stays fixed as you scroll.',
    'D-MAX tier list basis changed to match pogomate (Attack × Max Move power × STAB, bulk not counted, Dynamax and Gigantamax separate).',
    'Counter suggestions added: five attackers in the tier list’s unfolded row and in the detail popup under "if this were a boss?".',
    'This week’s bosses moved to an accordion above the tabs, with five more recommended attackers at a time.',
    'D-MAX tier list: tap a row for why it landed there (score breakdown, moves, comparison within its type).',
    'This week’s boss card plus a top-5 attacker list at the top of the D-MAX tab.',
    'Schedule filled out: weekend Shadow raids added, and the Spotlight Hour weekday (Thursday) re-verified against sources.',
    'Renamed to POGO NOTE (a Pokémon notebook for our crowd).',
    'September schedule added: an accordion at the top plus a calendar view; tap a date for that day’s events.',
    'PvE tabs merged: Standard and All became a toggle inside one tab.',
    'Reference notes moved to a fixed accordion at the bottom of the screen.',
    'Dynamax is written as D-MAX.',
    'A QA / bug report (Notion) link added to the footer.',
  ],
  '2026-09-01': [
    'Added the Pokémon detail popup: evolutions, moves, matchups, base stats and where it is used.',
    'Tab rework: D-MAX first, the value-for-money tab removed.',
    'PvE tier lists by type for standard and Dynamax, and an improved usage UI.',
  ],
  '2026-09-08 · v2.30.0': [
    '**URLs match the menu names** — `#/rank/pve` → `#/pve`, `#/rank/max` → `#/dmax`, `#/plan` → `#/planner`. You can tell the screen from the address. **Links you already shared still work** — they are forwarded to the new address.',
    '**Screen names moved to the top of the body on phones too** — the top bar always holds the service name (POGO PLAN). Same rule as wide screens.',
    '**Tapping the logo goes to the service home** — the back button is unchanged.',
    'Added an invisible marker to each screen, so usage statistics know which screen is which (nothing to do with personal data).',
  ],
  '2026-09-08 · v2.29.2': [
    'The Pokédex view button became **[⊞ grid] · [☰ list]** — the button now states which view you are in. The old [1 column] / [2 columns] labels were simply wrong on wide screens, where it actually ran to three or four.',
  ],
  '2026-09-08 · v2.29.1': [
    '**Fixed the 🎒 My Pokémon list rendering broken** — desktop card rules were reaching into planner rows that share the same class names and centring the name. The name is back beside the artwork.',
    'In English, the schedule now states at the top that times are **Korean server time (KST)** — Pokémon GO events differ by region in both date and time.',
    'Fixed the sign-in copy — with the header 👤 gone, it now points to "My Page at the top of the ☰ menu".',
  ],
  '2026-09-08 · v2.29.0': [
    '**You can read the site in English** — tap [EN] in the top right and the whole interface switches. Pokémon, move, type and form names use the official English spellings (nothing invented). Your choice is remembered.',
    'Patch notes, the schedule, the privacy policy and the terms stay in Korean. The schedule mirrors Korean server announcements, and for the last two the Korean text is the one with legal force (a note to that effect appears at the top in English).',
    'Removed the 👤 button from the header — sign-in and your account live in one place, "👤 My Page" at the top of the ☰ menu. The KR/EN switch took the empty spot.',
  ],
  '2026-09-08 · v2.28.0': [
    '**Lists became cards on desktop** — D-MAX, Raids · PvE, PvP, Favorites, Raid Bosses and Egg Hatches all moved from stacked rows to three-column cards. Bigger artwork means you recognise who it is before reading the name.',
    'On wide screens the Pokédex opens as cards. If you prefer one column, tap [☰ 1 column] and it is remembered.',
    'Inside a card a thin line separates the artwork from the name, and the artwork sits on the same grey plate as the detail screen.',
    '**Fixed tapping a type in Types & Matchups doing nothing** — the multiplier table, the list of that type, and recommended attackers all come back immediately.',
    'Narrow screens (phones) are unchanged — rows are faster when you are scanning with a thumb.',
  ],
  '2026-09-08 · v2.27.0': [
    'Sharing a link now shows a preview card — paste the address into KakaoTalk or Discord and you get the service name with a pixel-art Poké Ball.',
    'Tightened security — a policy that makes the browser reject injected third-party scripts, and a size limit on stored data. Nothing changes in how you use the site.',
    'Easier to find in search (sitemap, descriptions, structured data). Large data files and images are blocked from crawlers.',
    'Entering a URL that does not exist shows an explanation and a link back to the first screen.',
  ],
  '2026-09-08 · v2.26.0': [
    '**Fixed scrolling being stuck on desktop** — with the cursor over the tab row (D-MAX · PvE · PvP), the wheel was consumed by the tab row instead of the page. The chip row, boss suggestion row and tables had the same problem and were fixed too.',
    'On desktop the top bar went back to holding the service name, and the current screen name moved to a header at the top of the body. The back button is unchanged (narrow screens as before).',
    'Viewing the Pokédex in two columns turns it into cards — bigger artwork, no truncated names. Wide screens run to three or four columns.',
    'Buttons respond when you hover or press them. They do not move, so your aim stays true, and on devices set to reduce motion only the colour changes.',
    'Removed an empty strip at the bottom of the screen left over from the old fixed bottom bar.',
  ],
  '2026-09-08 · v2.25.0': [
    'The ⚔️ Raid Bosses screen is here — bosses in rotation grouped by tier, with types, CP range, boosted weather and whether a shiny is possible. Tap a boss to go straight to its weaknesses and recommended attackers.',
    'The 🥚 Egg Hatches screen is here — what comes out of 2, 5, 7, 10 and 12 km eggs, by distance. Regional, Adventure Sync and gift eggs are marked separately, and you can ★ them into Favorites.',
    '🎒 My Pokémon now judges near-perfect IVs — comparing max-level CP shows how far a Pokémon actually is from a 100%, which a percentage alone hides. It reports only three steps (perfect, near-perfect, decent) and says nothing below that.',
    'Raid and egg data refresh automatically every day (source: LeekDuck). Region and events can make the real rotation differ.',
  ],
  '2026-09-08': [
    'Wider layouts on desktop and tablet — at 1024px and above the navigation list is always visible on the left, the body widens, and home cards lay out four per row. Narrow screens (phones) are unchanged.',
    'Unified colours, typefaces and button shapes that differed screen by screen — card colours splitting between grey and blue, missing faces for numbers and Latin text, and inconsistent button sizes.',
    'The D-MAX · PvE · PvP tab row is back — switch between the three without opening the menu or going home. The 📕 Pokédex, 🧭 Matchups and ★ Favorites shortcuts on the right stay too.',
    'Home feature cards use the same icons as the app (🎒 📕 🧭 ✨ ⚔️ 🃏 🌱 📅).',
    'Header buttons are icons again (🔍 search · 👤 account · ☰ menu). With the account button back in the header you can see your approval status at a glance. The one route home is "Service home" at the top of the ☰ menu.',
    'Pokémon details open as a popup card again (a sheet rising from the bottom on narrow screens). The search box matches.',
    'Enlarged the touch targets on buttons — the text size is unchanged, only the area grew.',
  ],
  '2026-09-08 · v2.21.0': [
    'Removed the feature tab row at the top; screens are now independent and reached from home. Back, home, search and menu sit in the same place on every screen.',
    'Search and details were rebuilt as full-width screens. Closing a detail keeps your search term and results. Expand the type filter when you need it.',
    'Improved zoom behaviour, opening details by keyboard, focus movement and return for the menu and search, touch targets and contrast.',
  ],
  '2026-09-08 (2)': [
    'The first screen is now the service home. Pick My Pokémon, Pokédex, Matchups, D-MAX, PvE, PvP, Planner or Schedule from the feature cards.',
    'Removed the duplicate search box and shortcut row under D-MAX. Search lives in the header 🔍, and each screen has a home button.',
  ],
  '2026-09-10 · v2.46.0': [
    '**Search results became cards** — larger artwork, with types and Pokédex number alongside. When names collide (Mudkip and Shadow Mudkip, say) you can tell them apart before picking.',
    '**The Pokédex list shows CP at 100%** — you can scan it from the list without opening the detail view. List mode also shows the generation.',
    '**A bigger detail popup header** — the artwork sits on a glowing plate, the name is larger, and the Pokédex number became a badge.',
    '**Generation chips are slimmer** — as filled pills they made the gap between rows look wide whenever they wrapped to two lines.',
    'Phone layouts are unchanged.',
  ],
  '2026-09-10 · v2.45.0': [
    '**Pokédex cards match the ranking cards** — the number became a badge in the top left, the artwork moved onto a glowing round plate, and the name got bigger. ★ Favorites, ⚔️ Raid Bosses and 🥚 Egg Hatches use the same card, so they changed too.',
    '**The glowing artwork plate actually shows now** — v2.45.0’s notes said it had been added to ranking cards in v2.43.0, but it never once rendered.',
    'Phone layouts are unchanged.',
  ],
  '2026-09-10 · v2.44.0': [
    '**Google sign-in works again** — the v2.27.0 security pass left one address out of the browser security policy (CSP) that sign-in needs, and sign-in had been blocked ever since. That was the cause of the `auth/internal-error` failures.',
    '**Account photos show** — the Google profile pictures on your account page and the approval screen were blocked for the same reason.',
    '**We tell you why sign-in failed** — failing on the way back from a redirect used to dump you on the signed-out screen with no explanation.',
    '**We tell you when a sign-up request could not be saved** — if it failed, nothing appeared on the admin screen and approval would never come, while the app only said "waiting for approval".',
  ],
  '2026-09-10 · v2.43.0': [
    '**Rankings became cards** (D-MAX · Raids · PvE · PvP) — the rank is a round badge, the score is large, and there is a glow beneath the artwork.',
    '**Each tier says what it means in one line** — S, A, B and C on their own tell a first-time reader nothing.',
    '**The reasoning is split in two** — the score formula on the left, "attackers to bring against this boss" on the right. It now unfolds under the card.',
  ],
  '2026-09-10 · v2.42.0': [
    '**A new design for wide screens (desktop and tablet)** — a search box in the top bar (the `/` key opens it too), plus a breadcrumb and one-line description on every screen. The service home became a banner and a five-column tile grid.',
    '**Colours follow a new palette** — brand green marks "where you are", and colours with fixed meanings (weakness, buff and nerf) use the same value on every screen. The dark theme moved to a deeper navy.',
    'Types in the Pokédex list show as **named pills** instead of dots (wide screens).',
    'Phone layouts are unchanged — only the colours follow the new palette.',
  ],
  '2026-09-09 · v2.41.0': [
    'Added an internal development screen — nothing visible changes in the app (preview builds only).',
  ],
  '2026-09-09 · v2.40.1': [
    '**Fixed the reference notes and trainer codes vanishing from the ☰ menu after resizing the window and back** — it showed up when resizing, rotating a tablet, or unfolding a foldable.',
  ],
  '2026-09-09 · v2.40.0': [
    '**The ☰ menu was redesigned** — three blocks for your account, the app, and information, with a screen icon and an arrow on every row. The screen you are on is marked in colour.',
    '**The view setting became a two-segment [list | grid] control** — replacing a single button whose meaning flipped on every press. Now you can see which view you are in and what else is available at a glance.',
    'In the Pokédex and Favorites the view button was mixed into the row of generation and category chips and easy to miss; it moved to its own row.',
  ],
  '2026-09-09 · v2.39.1': [
    '**Fixed re-signing-in after sign-out, again** — v2.39.0’s remedy (pause and retry) did not actually work, so it now switches from a popup to a redirect.',
  ],
  '2026-09-09 · v2.39.0': [
    '**Card grids on D-MAX, Raids · PvE, PvP, Raid Bosses and Egg Hatches pick their column count from the window width** — three on a tablet, four on a desktop, and fewer as the detail panel narrows the page.',
    '**The grid/list button moved to the right of the intro line** — it was easy to miss on the Raid Bosses and Egg Hatches screens.',
    'Tried to fix sign-in failing right after sign-out; actually fixed in v2.39.1.',
  ],
  '2026-09-09 · v2.38.0': [
    '**More room on desktop** — at 1440px and above the list and detail panel are larger. 1100-1439px (tablet) keeps its current size.',
    '**Fixed the detail panel looking glued to the list** — there is now real space between them.',
  ],
  '2026-09-09 · v2.37.0': [
    '**Grid/list switching on Favorites, Raid Bosses and Egg Hatches** — the [⊞ grid · ☰ list] button that only the Pokédex had is now on three more screens. Each remembers its own choice.',
    '**Tidied the ☰ menu on desktop** — it keeps your account, the reference notes and trainer codes; patch notes, QA reports, terms and the rest moved under the left-hand navigation.',
    'The ← back button is gone on desktop, where the left-hand navigation is always visible (narrow screens keep it).',
    'Widened the padding inside the detail panel — type matchup chips no longer touch the border.',
  ],
  '2026-09-09 · v2.36.0': [
    '**On desktop, Pokémon details open in a right-hand panel instead of a popup** — you can keep reading the list and step through several Pokémon in a row. It closes with ✕ or when you move to another screen.',
    'Phones and other narrow screens keep the popup.',
  ],
  '2026-09-09 · v2.35.0': [
    '**Types moved from beside the name to badges over the artwork** — small badges overlapping the top left of the picture. With two types they stack.',
    '**★ Favorites moved next to share and save** — actions about this Pokémon (share, save to my Pokémon, favorite) are now one row in the top right.',
    'Form names like Gigantamax moved off the species-name line onto their own line above it.',
  ],
  '2026-09-09 · v2.34.0': [
    '**The detail popup’s ✕ moved outside the card, to the top right** — nothing inside the card can overlap it now, whatever the layout. The backdrop is darker too, so the card reads clearly.',
    '**The CP-at-100% table can be collapsed** — the big number stays visible, and the raid, boosted and wild table unfolds on tap. It takes up less of the screen.',
  ],
  '2026-09-09 · v2.33.0': [
    '**Fixed the detail popup’s ✕ overlapping the share and save buttons and refusing to respond** — there is enough room above now that the two areas do not encroach on each other.',
  ],
  '2026-09-09 · v2.32.0': [
    '**The top of the Pokémon detail screen was rebuilt** — #Pokédex number, ★ favorite beside the name, and types as filled pills. Share and save-to-my-Pokémon are two round buttons in the top right.',
    'CP information became a large number card instead of a sentence — under the max-level CP, four figures for raid, boosted, wild and boosted-wild in a 2×2 table.',
    'The catch CP and CP calculator buttons became cards that open on tap, with a hint of accent colour on catch CP.',
  ],
  '2026-09-08 · v2.31.0': [
    '**Fixed names breaking mid-word in the raid boss list** — even short names competed with the condition text for one line and broke between characters. Name and condition are now stacked so each shows in full.',
    '**Unified the frame around Pokémon artwork** — the Pokédex, Favorites, Raid Bosses and Egg Hatches lists, plus evolution stages and recommended attackers in the detail popup, all use the same box. Earlier evolution stages have a frame too, which makes them easier to compare with the Pokémon you are looking at.',
  ],
  '2026-09-12 · v2.67.0': [
    '**Pokémon move now** — the large artwork on the detail screen is animated. 949 of 1,172 species have it; the rest (mostly gen 6 onward) stay still as before. Lists are deliberately left alone — animated sprites are 13× heavier, which would make the first Pokédex screen (100 of them) a 5 MB load.',
    '**Controls collapsed onto one row** — Battle · PvP is [tool] [league] … [other tool] on a single line, and Raid Bosses and Egg Hatches put the view toggle beside the intro. Each of those used to take a whole row.',
    '**The list/grid toggle got smaller** — a full-width bar became a small button at the right edge. On narrow screens only the ☰ ⊞ icons remain.',
    'Tweaked the meta tags so search engines index the site properly — search results now show a large preview image.',
  ],
  '2026-09-12 · v2.66.0': [
    '**Every tool has its own URL** — [🃏 Team Builder], [🧬 IV Ranking] and [🧮 Solo Calculator] are screens now. Back returns you to the ranking, and a link opens the same tool for whoever you send it to.',
    '**IV Ranking follows the league you picked above** — the league segment at the top and the league tabs in the ranking used to run independently, so picking Great up top could leave Little below. [Team Builder] moved to the right.',
    '**The divider moved below the filter row** — title, subtitle and filters are one unit (the page header), and what is under the line is the result.',
    '**★ Favorites has one entry point, in the header** — the [★ Favorites N] chip is gone from the Pokédex. The generation chips on that row filter the list in place, and only this chip sent you to another screen.',
    '**My Pokémon is back in the menu** — indented one step under the planner. The in-screen tab row is gone; navigation is the left menu’s job.',
    '**Events and Raid Bosses have separate jobs** — the calendar answers "when", the Raid Bosses screen answers "what right now". They read different sources and can legitimately name different bosses.',
    'Hid the 🔍 button on wide screens — the search bar right beside it does the same thing. The Pokédex search box now says "Filter this list" so its role is clear.',
  ],
  '2026-09-12 · v2.65.0': [
    '**The menu is grouped by what you are trying to do** — [What now], [Who to bring] and [My Pokémon]. Which feature counts as "main" depends on what you are doing that day. Home tiles follow the same order.',
    '**PvP IV Ranking splits left and right on wide screens** — inputs on the left, results on the right. The top 10 for each league shows all three side by side instead of behind tabs (narrow screens keep the tabs).',
    '**The Pokédex search box moved up beside the title** — it was taking a whole row and pushing the list down by that much.',
    '**There is a divider under each screen title** — whitespace alone made the title, subtitle and body read as one block. Tighter above, looser below, with a line between, so header and body separate at a glance.',
    'Reworked the planner’s next-step cards — four of the five pointed at the same place. Added routes into Box Cleanup and PvP IV Ranking.',
  ],
  '2026-09-12 · v2.64.0': [
    '**★ Favorites moved from a card at the top of the screen to a header button** — even collapsed it took a good inch and pushed the list down. Tap ★ up top and it opens as a popup, in the same place on every screen.',
    '**The ☰ menu is split into [Main] and [Extras]** — ten rows in one block meant scanning from the start every time to find what you actually use.',
    '**Battle · PvP is laid out in reading order** — ① pick a league ② narrow by type ③ build a team or check IV ranks. [Team Builder] used to sit on the league row, catching your eye before you had even chosen a league.',
    '**Every screen has a one-line description** — on narrow screens only the title showed, so you knew where you were but not what the screen was for.',
  ],
  '2026-09-12 · v2.63.0': [
    '**The 🧭 Types & Matchups screen is retired** — opening any Pokémon already showed the same weakness and resistance table. One screen fewer, a shorter menu. Links you shared before (#/types) now land on the Pokédex.',
    '**🧬 PvP IV Ranking moved inside Battle · PvP** — the [🧬 IV Ranking] button next to [🃏 Team Builder] unfolds it in place. "How does mine rank" is a thought you have while reading league ranks, so you should not have to change screens.',
  ],
  '2026-09-11 · v2.62.0': [
    '**You can pick a league in 🧬 PvP IV Ranking** — it used to show the top 10 of whichever single league was most useful. Little, Great and Ultra now have their own tabs, so you can see what to aim for in each (Master has no CP cap, so no ranking).',
    'Redrew the selected-Pokémon card — the name and base stats ran together on one line and are now stacked, with the spacing above tidied up.',
  ],
  '2026-09-11 · v2.61.0': [
    '**🧬 PvP IV Ranking is here (experimental)** — enter a species and its IVs and it tells you where it ranks in Little, Great and Ultra, and which league it is worth using in.',
    '**A 100% Pokémon is not rank 1 in PvP** — with a CP cap, lower Attack lets you push the level higher under the same CP. That is why spreads like 0/15/15 often come out on top.',
    '**Opening a Pokémon that appears in PvP ranks also shows "the IVs you want for PvP"** — the CP at 100% above it is a raid figure and was no use in PvP.',
    'Eggs, raids and research never roll below 10, and Shadow never below 6. Tell it where you got the Pokémon and it ranks only within that range.',
    'Master League has no CP cap, so higher IVs are simply better — we do not rank it.',
    '**The D-MAX · PvE · PvP tab row and the 📕 🧭 ★ shortcuts are gone** — the left menu has the same rows, so there were two sets of doors to the same places.',
    '**Types & Matchups opens with Normal selected** — the first screen was empty with nothing chosen.',
  ],
  '2026-09-11 · v2.60.1': [
    '**Fixed a Pokémon staying pinned on the right after you left the screen** — on wide screens, opening a Pokémon from the Pokédex and then going to the service home left the old card attached, squashing the page.',
  ],
  '2026-09-11 · v2.60.0': [
    '**One voice across the app** — formal and casual Korean endings were mixed screen by screen. Around 120 pieces of copy were unified to the friendlier form (terms, privacy policy and copyright notices are left as they are).',
    '**Shortened the notice on screens that need a sign-in** — each screen spelled out at length why sign-in was required, running to three lines. When you are blocked the only thing you can do is sign in, and a wall of text keeps you from reaching the button.',
    '**Fixed Korean particles like "레이드 · PvE은"** — screen names ending in non-Korean characters always got the wrong particle.',
  ],
  '2026-09-11 · v2.59.0': [
    '**Lists lay out several per row on wide screens** — five at 1920, dropping to four, three, two and one as the window narrows. Before, even wide screens put one per row and left the right half empty.',
    'Pokédex, Raid Bosses, Egg Hatches, Favorites, D-MAX, Raids · PvE and Battle · PvP all follow the same rule — column counts used to differ screen by screen.',
    'Pokédex rows in [list] view become two lines — a name line and a CP · type line. That stops names from breaking one character per line when the column gets narrow.',
    'Opening the detail panel narrows the body, so the column count drops with it.',
  ],
  '2026-09-11 · v2.58.0': [
    '**🔎 Search Builder is here** — tap conditions and it builds a string you can paste straight into the in-game search. Start from a Box Cleanup, Worth Raising or For Trading preset, then add and remove from there.',
    'Tap a condition once for **+include**, again for **-exclude**, and once more to clear it. Pick several types and they are joined with "or".',
    'Your picks stay in this browser, so you can go back and forth with the game and reuse them.',
    'Syntax that only works in some game versions (candy counts and the like) is deliberately left out, so we never hand you a string that does not work.',
  ],
  '2026-09-11 · v2.56.0': [
    '**Fixed a detail popup opened from a shared link refusing to close on ✕** — closing it re-read the same URL and immediately reopened it. Opening from a list always closed fine; this only happened when you arrived by link.',
    'Centred the [Sign in with Google] and [Later] buttons in the sign-in notice.',
  ],
  '2026-09-11 · v2.55.0': [
    '**The [Attacker] tab on D-MAX shows that type’s tier list alongside** — pick a type and you get the tier list for Pokémon whose Max Move is that type above, and attackers against bosses of that type below. Only the lower one showed before, so seeing raise candidates meant going back to [All].',
    'The two tables look at the same type from different angles, so the line-ups differ — each header says how.',
  ],
  '2026-09-10 · v2.53.0': [
    '**Egg lists now split by where the egg came from** — grouping by distance alone mixed five Adventure Sync-only species into the 5 km pool, which you will never get walking (3 real entries looked like 8). 10 km had the same problem (7 looked like 12), and 7 km lumped together two different pools for friend gifts and Route gifts.',
    '5 km, 5 km Adventure Sync, 7 km friend gifts, 7 km Route gifts, 10 km and 10 km Adventure Sync are now separate. 1 km, which was stuck at the bottom, moved to the front.',
    '**D-MAX, Raids · PvE and Battle · PvP went back to lists on narrow screens** — two-column cards fit only two Pokémon per screen. Wide screens keep the cards.',
    'The detail popup on phones no longer covers nearly the whole screen — you can see a strip of the page behind it.',
  ],
  '2026-09-10 · v2.52.0': [
    '**Enlarging text in your browser now scales the whole layout** — only the letters used to grow while padding, buttons and cards stayed put, so the screen got cramped. Spacing and buttons grow along with it (dividers stay thin).',
    '**Only one [why this tier] opens at a time** — tapping several stacked the explanations and you could not tell whose was whose. Opening one now closes the last.',
    'Centred the [Agree and sign in] button on the consent screen and gave it room above and below.',
  ],
  '2026-09-10 · v2.51.0': [
    '**Tapping a locked screen brings up an explanation** — it used to just open the ☰ menu and leave you to work out what to press.',
    '**We tell you it is approval-based before you sign in** — the three steps are laid out up front: sign in, wait for approval, then use it.',
  ],
  '2026-09-10 · v2.50.0': [
    '**Fixed egg pools and raid bosses changing while your screen did not** — an app installed to the home screen stays alive once opened, so it kept showing whatever data it first received, days later. It now tells you at the bottom when newer data is available.',
    'Nothing changes until you tap [Refresh] in that notice — we will not swap the screen out from under you.',
    'The dev preview is rebuilt daily too.',
  ],
  '2026-09-10 · v2.49.0': [
    '**Fixed My Pokémon rows being enormous on wide screens** — one card took up nearly the whole width. Number, artwork, name, CP, moves and buttons now sit on one row.',
    '**Raids · PvE, Battle · PvP, Events, Raid Bosses and Egg Hatches need a sign-in too** — a lock appears on the menu row and home tile, and entering by URL brings up the sign-in notice.',
    'Pokédex, Types & Matchups and D-MAX stay usable without signing in.',
    '**Fixed the lock screen persisting after sign-in when you arrived by URL** — the screen is redrawn once sign-in finishes.',
  ],
  '2026-09-10 · v2.48.0': [
    '**Fixed sign-in failing in the installed app (PWA)** — only the installed app used a different method (redirect), and that path can no longer carry account details back in current browsers. The installed app now uses the same popup as the browser.',
    '**We tell you why when sign-in breaks off midway** — you used to land back on the sign-in screen with no explanation.',
  ],
  '2026-09-10 · v2.47.0': [
    '**"My Pokémon" and "Planner" in the menu became one** — two doors to two tabs of the same screen was confusing. There is now one 🌱 Planner entry with tabs inside (old bookmarks still work).',
    '**The progress screen was rebuilt** — an intro banner, how many Pokémon you have and their status counts, five steps under "what should I do right now?", and the four you added most recently.',
    '**The My Pokémon list became cards** — number, artwork, name, types, level with an IV bar, CP and main moves each get their own place.',
    '**The same-species comparison now ends with a conclusion** — two cards line up above the table, and a line below says which is better and why. Where a table alone cannot decide (Shadow versus normal, say), it says so.',
    '**Search results in the add dialog show types and Pokédex numbers** — the same row as the header search.',
    '**The planner needs a sign-in** — it saves your Pokémon to your account, so before signing in the menu row and home tile carry a lock and tapping them leads to the sign-in notice. The Pokédex, rankings and calculators stay open to everyone.',
    '**Fixed Compare doing nothing when tapped** — picking a different species now explains why right above the list. The message used to sit at the very bottom, off-screen.',
    '**You can choose light or dark yourself** — the ☀️🌙 button in the top bar on wide screens, or "Theme" in the ☰ menu on phones. Following your device setting is still there.',
    '**Your account remembers the choice** — sign in and other devices open the same way. Without signing in it still persists in this browser.',
  ],
  '2026-09-12 · v3.11.0': [
    '**Patch notes are in English now** — this page used to stay in Korean whichever language you picked. Everything from the v3 line is translated; older entries still show their Korean text.',
    '**The English translation had holes** — menu section names, screen descriptions, planner copy and the tier-list footnotes were still Korean. We went through fifteen screens in English and filled in what was missing. Event titles and the terms pages stay Korean on purpose: they mirror the Korean server and the Korean text is the one that counts.',
    '**The theme button only flips light ↔ dark now** — it used to cycle three states, so you could never tell what the next tap would do. "Follow system setting" moved to the new **Settings** screen, where you pick it once and leave it.',
    '**Your theme choice is saved to your account** — sign in and every device opens the same way.',
    '**Bold text in patch notes is actually bold** — the `**` marks were showing as literal asterisks.',
  ],
  '2026-09-12 · v3.10.0': [
    '**The search box is back inside the Pokédex** — narrow your results one letter at a time, right where the results are. The 🔍 search at the top no longer draws results itself; it takes your conditions and hands you over to the Pokédex, so the same list is never drawn in two places.',
    '**Tier cards now come two to a row on phones** — one per row meant you could not fit two Pokémon on a screen. Same layout as the Pokédex grid.',
    '**Cards are 15% smaller** — a single card was eating half the screen, so one scroll showed one row.',
    '**Buttons like [Standard|All] stay on one horizontal row on narrow screens** — stacking them doubled the height of the page header. They now get their own line under the title, which leaves plenty of room side by side.',
    '**New list icon on the view toggle** — it was identical to the ☰ menu button in the top right, which made you wonder whether it was another menu.',
    '**Battle · PvP got the view toggle too** — it is the same kind of tier list, but it was the one screen you could not switch back to rows.',
  ],
  '2026-09-12 · v3.9.1': [
    '**(Bug) The view toggle on Raids · PvE and D-MAX did nothing** — the icon flipped but the list never changed. The rule that draws cards outweighed the rule meant to undo it, so whichever you picked you got cards. It had never once worked since we added it.',
    '**Card view works on phones now** — cards only existed on wide screens before, so on a phone the button had nothing to change. You now get one large card per row, just like the Pokédex grid.',
    'What you see on first open is unchanged — rows on a phone, cards on a computer. Pick one and that screen remembers it.',
  ],
  '2026-09-12 · v3.9.0': [
    '**Searching takes you to the Pokédex** — press Enter in the search box or tap [See in Pokédex]. Until now results lived in a small panel off to the side, and there was no way to see past the eighth row. The Pokédex shows all of them, with the list/grid toggle and generation chips you already use.',
    'The search URL is a link — send it to a friend or bookmark it and the same results open again.',
    '**(Bug) Type chips did not filter anything** — tapping [Water] left the list untouched and the header read "2,614 Water types". The calculation disappeared along with the matchup-search screen we retired.',
    '**(Bug) The result count stopped at eight** — we only looked up eight and then reported that as the total. You now get the real number, like "232 matches for 리자".',
    'Search results include Mega, Shadow and Dynamax forms, and tapping one opens that form.',
  ],
  '2026-09-12 · v3.8.3': [
    '**(Bug) The view toggle would not respond** — on iPhone, tapping [list · grid] did nothing. The dot icon is an SVG, so the tap landed on one small rectangle inside the icon rather than on the button. Icons no longer take taps; what you press is always the button.',
    '**(Bug) Vertical scrolling stuttered** — the dotted background was painted on a fixed panel covering the screen, so it had to be repainted every time the page moved. The dots now scroll with the page, and the drifting Poké Balls appear only on tablets and computers.',
  ],
  '2026-09-12 · v3.8.2': [
    '**(Bug) The string you built in Search Builder was invisible** — scrolling tucked the result box behind the top bar, leaving only the [Copy] [Clear] row. The box was pinned so it would always be visible, and the one thing it was hiding was the string itself.',
    '**Spacing in Search Builder was reset** — a heading now sits close to its own conditions, and groups sit further apart. All three gaps used to be nearly identical, so you could not see where one group ended.',
    'Dropped the opening sentence of the intro, which repeated the screen subtitle.',
    'The emoji on [Box cleanup], [For trading] and [Copy] are dot icons now.',
  ],
  '2026-09-12 · v3.8.1': [
    '**Type badges on the detail screen sit in one horizontal row** — with two types they stacked and covered the left side of the artwork top to bottom. Horizontally they only graze the empty space above it.',
  ],
  '2026-09-12 · v3.8.0': [
    '**[list · grid] is a single button** — tap it and it flips, the same way the theme (🌗) button works. The icon and colour show which view you are in, and the button name spells out "this now · tap for that".',
    'Two segments were taking up as much room as the screen title. On narrow screens we had to strip the labels and keep only icons just to fit.',
    'Your choice is still remembered per screen, exactly as before.',
  ],
  '2026-09-12 · v3.7.1': [
    '**Text is one dot thicker** — it was thin and hard to read. Pixel fonts have no bold face, so we get the weight by stamping each stroke one cell to the side. It stays crisp instead of smearing.',
    '**The two buttons on the right of Raids · PvE are stacked** — [Standard|All] and [list|grid] side by side pushed the screen title onto two lines.',
    '**The four leagues in Battle · PvP are laid out 2×2** — they would not fit on one row on a narrow screen.',
    'Section headings and the note beside them were being clipped from both sides; the note now drops to the next line.',
    'The emoji on the tool buttons (IV Ranking · Team Builder · Solo Calculator) are dot icons now.',
  ],
  '2026-09-12 · v3.7.0': [
    '**The key colour is Poké Ball red** — that exact red. Selection marks, links and the menu item you are on all use it.',
    '**The app icon is a filled Poké Ball** — it used to be a white outline, but this is the picture that sits on your home screen, so it has to read at a glance. Red on top, white below, black band across the middle, just like the original.',
    '**The link preview card changed too** — that is the image that shows up when you paste a link into KakaoTalk or Discord. The palette had changed twice and this one image was still stuck on the old green.',
    'Red moving in meant two colours had to move out — **weakness and nerf marks** went to a darker crimson, and **Mega / Legendary / S-tier marks** went blue, so neither gets confused with a selection.',
  ],
  '2026-09-12 · v3.6.1': [
    '**The background is softened** — a crisp dot grid showed straight through the text and made it hard to read. The dots now have blurred edges at a lower opacity, and the large Poké Balls are blurred.',
    '**Text really looks like pixels now** — headings and Pokémon names were given extra weight, but pixel fonts have no bold face, so the browser was re-drawing the strokes itself. That smeared the dots into a blurry sans-serif.',
    '**Subtitles and notes went up one step** — at 11-12px they did not register. Small trailing text went the other way, with tighter line spacing so it reads as one block.',
    '**Every remaining rounded corner is gone** — cards and pill badges on the detail screen, the artwork plate (a full circle on wide screens), the calendar date cells and so on.',
    'Removed an empty line above the home title, and turned the emoji inside paragraphs into dot icons.',
  ],
  '2026-09-12 · v3.6.0': [
    '**The whole interface is pixel art** — everything this site shows you (the Pokémon) is pixel art, and only the shell was smooth. Galmuri for the typeface, square corners, shadows that step instead of fade.',
    '**Every icon was redrawn as pixels** — the emoji in the menu, on home tiles and on buttons are now drawings on a 12-cell grid. Unlike emoji, which look different on every device, these look the same everywhere.',
    '**Poké Balls drift across the background** — two large ones move very slowly above the dot grid. If you have [Reduce motion] on, they stay still.',
    '**The loading screen is pixel art too** — a Poké Ball rocking side to side, the way it does after a throw.',
    'We took out the search-engine indexing tags for now — the preview card you get when you paste a link is unchanged.',
  ],
  '2026-09-12 · v3.5.0': [
    '**Removed the search box inside the Pokédex** — two input fields that looked identical to the header search sat on one screen. Find Pokémon with the search at the top; the generation chips still filter the list.',
    '**D-MAX got the [list · grid] toggle** — on wide screens the tier list was cards only, and now you can put it back to rows.',
    '**The gap between [This week\'s bosses] and the type filter on D-MAX is 8px** — it was 32px. The two read as one unit ("what is in rotation this week → which of those do I want"), so there was no reason for the distance.',
  ],
  '2026-09-12 · v3.4.0': [
    '**★ Favorites is on hold** — you could add things but there was nothing to do with them afterwards. "So what do I raise" is the planner\'s job, so rather than leave a half-finished feature standing we will rebuild it once it has a purpose. **Nothing saved to your account was deleted** — it comes back as it was.',
    'Fixed the [My Pokémon] row in the menu, which was indented — in a list where every row carries an arrow, one indented row just looks misaligned.',
  ],
  '2026-09-12 · v3.3.0': [
    '**Raids · PvE is laid out again** — [Standard · All] moved up beside the title, and a [list · grid] toggle joined it. On wide screens the ranking was cards only; now you can put it back to rows.',
    '**The type filter starts open** — collapsed, the main path through this screen (narrowing by type) took one extra tap to find. Collapse it and it stays collapsed.',
    '**The 🧮 Solo Calculator moved below the type filter** — it is the step you reach after choosing what to look at, when the question becomes "can I do this alone".',
  ],
  '2026-09-12 · v3.2.0': [
    '**D-MAX\'s [All · Attacker · Tank] and the PvP leagues moved beside the title too** — those are three different rankings, and changing league changes the whole screen, so they belong where the screen says what it is showing, not in a row of list filters.',
    '**(Fix) Controls from the previous screen stayed behind** — going from Egg Hatches to D-MAX left [list · grid] sitting there. The slot is now reset on every screen change.',
    '**(Fix) Opening D-MAX directly** left the axis segment unable to find its place; fixed.',
  ],
  '2026-09-12 · v3.1.0': [
    '**The list/grid toggle moved up beside the screen title** — it was taking a whole row above the list, but the view applies to the entire screen rather than to one list, so it belongs at the title\'s height. Pokédex, Raid Bosses, Egg Hatches and Favorites all use that same spot.',
  ],
  '2026-09-12 · v3.0.0': [
    '**A new design system** — the background and the cards swapped. It used to be grey cards on white; now it is white cards on a slightly recessed background. In a site whose lists are stacks of cards, the cards have to be brighter than the ground to read as sitting on top of it.',
    '**The brand colour moved from green to indigo** — green now belongs to the Grass type alone. That also ends the confusion of selections and Grass sharing a colour.',
    '**New typefaces** — Inter for body text (Pretendard stays for Korean), and a monospace face for numbers like CP, ranks and IVs so the digits line up vertically. Scanning a list is much easier.',
    'The dark background moved from deep navy to ink black — a black with the faintest purple cast, so colours on top of it do not go muddy.',
    '**The view toggle found its place** — on Favorites it had slipped to the bottom left; it is fixed and now sits on the same row as the category chips.',
  ],
};
