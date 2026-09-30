# MFK SMM UI Forensic Audit

STATUS: `CANONICAL AUDIT EVIDENCE`  
CANONICAL_PRODUCT_BASE: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
LIVE_MAIN_AT_PUBLISH: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
AUDIT_MODE: `READ-ONLY FORENSIC`  
PORT: `SMM`  
SOURCE_REFERENCES: SMM historical UI package, briefs, screenshots, and current code evidence inventoried below; Figma remains `UNKNOWN`.  
IMPLEMENTATION_AUTHORITY: `NONE`

Audit date: 2026-09-30  
Mode: `AUDIT / PLANNING ONLY`  
Port: `SMM` (`v2smm/**`)  
Canonical product base: `4c8642d4ec84792de88f00163ce99e3005b8354a`

## 1. Audit boundary

- SMM is a trusted staff assistive PWA. SMT/Store Kernel remain the formal order, pricing, sellability, payment, printing, and dining authorities.
- The audit reads every current implementation family: gate/auth, navigation, order entry, configuration, cart, checkout, submit certainty, queue, orders, dining, More, shared states, runtime ports, persistence, CSS, and tests.
- This audit does not reinterpret Stage numbers as canonical backend states.
- Figma source is unavailable: no Figma file/node identifier is in the package. Local boards are the only design evidence.

## 2. Reference inventory

Package: `MFK_SMM_UI_完整設計包_2026-09-26.zip`  
Archive status: 37 files. The Desktop extracted folder contains only three Markdown files; the ZIP is the complete inventory. The archive was inventoried before use.

| FILE | PORT | TYPE | DATE / VERSION | PURPOSE | SCREENS COVERED | FEATURES COVERED | CONFIDENCE | NOTES |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `README_先睇呢份.md` | SMM | Markdown | 2026-09-26 | Package entry | all | precedence and scope | High | Read first |
| `FILE_INDEX.md` | SMM | Markdown | 2026-09-26 | File index | all | asset/board map | High | Index only |
| `01_Product_Brief/MFK_SMM_PRODUCT_BRIEF_V1_2026-09-26.md` | SMM | Markdown | V1, 2026-09-26 | Product brief | Stage 0–9/X | staff intent and authority | High | Primary old product reference |
| `04_Final_Implementation_UI_Spec/MFK_SMM_FINAL_IMPLEMENTATION_UI_SPEC_V1_2026-09-26.md` | SMM | Markdown | V1, 2026-09-26 | UI contract | Stage 0–9/X | routes, states, responsive | High | Subordinate to current product behavior |
| `00_來源素材/品牌與IP/01_磨飯_原始Logo.png` | SMM | PNG | 2026-09-26 | Brand source | shell | logo | High | Asset only |
| `00_來源素材/品牌與IP/02_IP_藍髮角色_三視圖.jpeg` | SMM | JPEG | 2026-09-26 | IP source | onboarding/help | blue mascot | High | Asset only |
| `00_來源素材/品牌與IP/03_IP_紫髮角色_三視圖.jpeg` | SMM | JPEG | 2026-09-26 | IP source | onboarding/help | purple mascot | High | Asset only |
| `00_來源素材/UI參考/IMG_1850(3).webp` | SMM | WEBP reference | 2026-09-26 | External visual reference | mixed | general mobile UI | Low | Inspiration only |
| `00_來源素材/UI參考/IMG_1851(2).webp` | SMM | WEBP reference | 2026-09-26 | External visual reference | mixed | general mobile UI | Low | Inspiration only |
| `00_來源素材/UI參考/IMG_1852(3).webp` | SMM | WEBP reference | 2026-09-26 | External visual reference | mixed | general mobile UI | Low | Inspiration only |
| `00_來源素材/UI參考/IMG_1853(3).webp` | SMM | WEBP reference | 2026-09-26 | External visual reference | mixed | general mobile UI | Low | Inspiration only |
| `00_來源素材/UI參考/IMG_1854(2).webp` | SMM | WEBP reference | 2026-09-26 | External visual reference | mixed | general mobile UI | Low | Inspiration only |
| `00_來源素材/UI參考/IMG_1855(3).webp` | SMM | WEBP reference | 2026-09-26 | External visual reference | mixed | general mobile UI | Low | Inspiration only |
| `00_來源素材/UI參考/IMG_1856(3).webp` | SMM | WEBP reference | 2026-09-26 | External visual reference | mixed | general mobile UI | Low | Inspiration only |
| `02_品牌與視覺探索_效果圖/01_品牌Logo與Slogan_初稿.png` | SMM | PNG exploration | 2026-09-26 | Brand exploration | shell | logo/slogan | Low | Not selected final |
| `02_品牌與視覺探索_效果圖/02_品牌Logo與Slogan_UI方向稿.png` | SMM | PNG exploration | 2026-09-26 | Brand exploration | shell | logo/slogan/UI | Medium | Motifs only |
| `02_品牌與視覺探索_效果圖/03_視覺規範探索_A.png` | SMM | PNG exploration | 2026-09-26 | Visual exploration | mixed | colour/card system | Low | Incompatible alternatives exist |
| `02_品牌與視覺探索_效果圖/04_視覺規範探索_B.png` | SMM | PNG exploration | 2026-09-26 | Visual exploration | mixed | colour/card system | Low | Do not combine wholesale |
| `02_品牌與視覺探索_效果圖/05_視覺規範探索_C.png` | SMM | PNG exploration | 2026-09-26 | Visual exploration | mixed | colour/card system | Low | Do not combine wholesale |
| `02_品牌與視覺探索_效果圖/06_視覺規範探索_D.png` | SMM | PNG exploration | 2026-09-26 | Visual exploration | mixed | colour/card system | Low | Do not combine wholesale |
| `02_品牌與視覺探索_效果圖/07_視覺規範探索_E.png` | SMM | PNG exploration | 2026-09-26 | Visual exploration | mixed | colour/card system | Low | Do not combine wholesale |
| `02_品牌與視覺探索_效果圖/08_視覺規範探索_F.png` | SMM | PNG exploration | 2026-09-26 | Visual exploration | mixed | colour/card system | Low | Do not combine wholesale |
| `03_Stage_UI_效果圖_CURRENT/SMM_Stage_0-X_全流程總覽.png` | SMM | PNG board | current, 2026-09-26 | Flow overview | all | journey and stage map | High | Stage labels are design navigation only |
| `03_Stage_UI_效果圖_CURRENT/Stage_0_啟動_登入_連線.png` | SMM | PNG board | current, 2026-09-26 | Screen proposal | Stage 0 | splash, auth, recovery | High | Current runtime is richer |
| `03_Stage_UI_效果圖_CURRENT/Stage_1_點單.png` | SMM | PNG board | current, 2026-09-26 | Screen proposal | Stage 1 | menu/order entry | High | Presentation source |
| `03_Stage_UI_效果圖_CURRENT/Stage_2_商品客製_真實比例版.png` | SMM | PNG board | current, 2026-09-26 | Screen proposal | Stage 2 | product/options/combo | High | Corrected geometry |
| `03_Stage_UI_效果圖_CURRENT/Stage_3_購物草稿.png` | SMM | PNG board | current, 2026-09-26 | Screen proposal | Stage 3 | cart/repair | High | Local non-authoritative draft |
| `03_Stage_UI_效果圖_CURRENT/Stage_4_結帳.png` | SMM | PNG board | current, 2026-09-26 | Screen proposal | Stage 4 | service/tender/dining target | High | No payment execution |
| `03_Stage_UI_效果圖_CURRENT/Stage_5_提交正式訂單_V1.png` | SMM | PNG board | V1, 2026-09-26 | Prior current concept | Stage 5 | submit states | Medium | V2 is preferred |
| `03_Stage_UI_效果圖_CURRENT/Stage_5_提交正式訂單_V2.png` | SMM | PNG board | V2, 2026-09-26 | Screen proposal | Stage 5 | submit certainty/readback | High | Preferred Stage 5 visual |
| `03_Stage_UI_效果圖_CURRENT/Stage_6_待處理.png` | SMM | PNG board | current, 2026-09-26 | Screen proposal | Stage 6 | work queue | High | Command assumptions require current-code check |
| `03_Stage_UI_效果圖_CURRENT/Stage_7_訂單管理.png` | SMM | PNG board | current, 2026-09-26 | Screen proposal | Stage 7 | orders/search/history | High | Current is read-only |
| `03_Stage_UI_效果圖_CURRENT/Stage_8_堂食管理_修正版.png` | SMM | PNG board | corrected, 2026-09-26 | Screen proposal | Stage 8 | table/waiting/read-only clear | High | Corrected board |
| `03_Stage_UI_效果圖_CURRENT/Stage_9_更多工具_概念稿.png` | SMM | PNG concept | concept, 2026-09-26 | Screen proposal | Stage 9 | More hub | Medium | Current tool set is broader |
| `03_Stage_UI_效果圖_CURRENT/Stage_X_共用狀態系統.png` | SMM | PNG board | current, 2026-09-26 | State system | all | loading/empty/offline/stale/partial/unknown/error | High | Preserve semantic separation |
| `99_已作廢_參考/Stage_2_商品客製_舊版_手機比例變形.png` | SMM | PNG superseded | obsolete | Rejected | Stage 2 | distorted layout | High | `DROP` |
| `99_已作廢_參考/Stage_8_錯誤版本_我的記憶_禁止採用.png` | SMM | PNG wrong scope | obsolete | Rejected | Customer memory | customer member concept | High | `DROP`; wrong port |

## 3. Current implementation audit

### Navigation and screen composition

- `App.tsx` has five primary views: `order`, `work`, `orders`, `dine`, `more`.
- Fixed bottom navigation labels are `點單 / 待處理 / 訂單 / 堂食 / 更多`.
- Stage 1–4 are composed through OrderView, ProductSheet, CartSheet, and Checkout within the app; Stage 5 is a full-screen submission/result surface; Stages 6–9 and X are separate components.
- There is no browser route table for primary views; active view is local application state persisted as a non-authoritative preference.

### Runtime, auth, and persistence

- `main.tsx` installs `createPwaRuntimePort()` into the stable `MFK_SMM_PORT_V1` boundary.
- `pwa-runtime.ts` supports LAN-first then Internet fallback for snapshots/order transport and has an existing SMT-backed `fulfillOrder` path for `ACCEPT` and `READY`.
- `StageZeroGate` handles splash, bounded Internet/LAN probing, staff login, trusted-session offline entry, and LAN pairing. The UI acceptance bypass is restricted to explicit acceptance/local conditions.
- Staff authentication uses a PBKDF2/HMAC challenge and stores a trusted session in `mfk.smm.staff-session.v2`.
- `persistence.ts` stores cart, note, pending intents, active view, service/tender, and dining target under `mfk:smm:workspace:v1` as `LOCAL_NON_AUTHORITATIVE`.
- Request-storm containment uses a shared single-flight refresh. Refresh occurs on initial load, explicit refresh, online, pageshow, visibility, transaction readback, and post-command readback; there is no normal polling loop.

### Behavior and authority

- Formal order submission is wired to SMT with stable submission/idempotency identity and readback-first `UNKNOWN` handling.
- Stage 6 currently permits only `ACCEPT` and `READY` through the SMT runtime; delay/help/cancel remain disabled. This is real current behavior even though `capabilities.json` still says `FULFILLMENT_COMMAND: NOT_WIRED`.
- Stage 7 is read-only; status controls remain delegated to SMT.
- Stage 8 can prepare a local dining target and return to the normal order journey. Checkout and clear-table mutations remain disabled/delegated.
- Stage 9 is read/review focused: staff, connection, channels, business day, capacity, reporting, refunds, printing, diagnostics, and pending submission readback.
- `README.md` and parts of the capability registry lag the exact-base runtime. This is documentation/product-contract drift, not evidence that the runtime path is absent.

### States, responsive behavior, and permissions

- `StageXState` separates `LOADING`, `EMPTY`, `OFFLINE`, `STALE`, `PARTIAL`, `UNKNOWN`, and `ERROR`.
- CSS targets the 440×956 class and a 360×780 minimum, uses a 520px shell, fixed bottom navigation, safe areas, touch targets, focus styles, and reduced-motion rules.
- Staff session role is displayed, but frontend command visibility is not a complete permission matrix. Runtime/backend authorization remains controlling.
- Existing evidence covers Stage 7/8/9/X at 360×780 and 440×956. Other stages are supported by source/tests rather than a complete current screenshot set.

### Tests read

- Stage-specific tests cover Stage 0 through Stage 7, including auth, combo, cart repair, checkout, submit certainty, queue commands, and read-only order history.
- `dual-path-pwa.test.mjs` covers LAN/Internet behavior.
- `request-storm-containment.test.mjs` covers single-flight refresh and no automatic retry loop.
- `wave2-source-fidelity.test.mjs` and visual-evidence tests cover Stage 7–9/X and authority locks.
- Tests are evidence of source contracts, not a new live/physical acceptance.

## 4. OLD vs CURRENT vs TARGET matrix

| SCREEN / CAPABILITY | OLD REFERENCE | CURRENT IMPLEMENTATION | FUNCTIONAL DIFFERENCE | VISUAL DIFFERENCE | IA DIFFERENCE | OLD-ONLY IDEA | CURRENT-ONLY CAPABILITY | AUTHORITY / PRODUCT RISK | EVIDENCE | CLASSIFICATION |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stage 0 access | Splash/login/connection/recovery | Real dual-path probe, LAN pairing, staff auth, trusted offline entry | Current is substantially richer | Old board offers visual composition | Same gate before app | simpler narrative | real session and network recovery | Never weaken auth/bypass limits | Stage 0 board; `StageZero.tsx`, `pwa-staff.ts` | KEEP CURRENT |
| Shell / nav | Fixed five tabs | Same five destinations | Equivalent | Current blue/navy system is already close | Same | mascot/brand motif | queue/draft badges | Do not change primary task routing | Stage 1 board; `App.tsx` | RESTORE VISUAL IDEA |
| Stage 1 order browse | Food-first category/search grid | Canonical menu, sold-out disabled, search/zero-result | Current has real data/fallback states | Old hierarchy is more consistently art-directed | Same Order destination | more branded zero-state art | canonical media fallback | No availability/price ownership | board; OrderView | RESTORE VISUAL IDEA |
| Stage 2 configure | Progressive product/options/combo | Exact ID-based variations/options/combo validation | Current is more explicit and canonical | Old step anatomy is clearer | Modal/sheet under Order | decorative progress treatment | exact combo metadata and repair | No name/category/price heuristics | board; ProductSheet, selection | RESTORE UX IDEA |
| Stage 3 cart | Review/edit/repair draft | Durable local non-authoritative cart with line attention | Current supports precise repair | Old card density is calmer | Sheet rather than primary nav | visual summary treatment | line-scoped repair and persisted note | Do not silently accept current prices | board; CartSheet, stage3 helpers | RESTORE UX IDEA |
| Stage 4 checkout | Service/tender/final review | Same, including dining target validation | Current has richer validation | Old summary hierarchy is clearer | Merged into CartSheet flow | stronger review stepper | canonical table projection | No payment execution or dining mutation | board; stage4 helpers | RESTORE UX IDEA |
| Stage 5 submit | DRAFT/PENDING/CONFIRMED/REJECTED/UNKNOWN | Stable identity, synchronous lock, readback-only UNKNOWN | Current is production-seam aware | Current V2 art already close to board | Full-screen overlay | result art and calm copy | LAN/cloud transport and pending persistence | Never add resend/reconnect loop | V2 board; `Stage5Submit.tsx`, transport | KEEP CURRENT |
| Stage 6 work queue | Priority queue and actions | Canonical list/detail plus SMT-backed ACCEPT/READY | Current has real commands beyond old brief registry wording | Current is already close to board | Same Work tab | some action affordances | connected ACCEPT/READY readback | Registry/permission drift; other commands forbidden | board; `Stage6Queue.tsx`, runtime | NEEDS OWNER DECISION |
| Stage 7 orders | Active/history/search/detail | Read-only active/history/source/status/date/search | Current is more complete | Existing evidence follows board | Same Orders tab | none material | phone search when projected, full filters | Must remain read-only | board; `Stage7Orders.tsx` | KEEP CURRENT |
| Stage 8 dining | Table overview/detail/waiting/clear review | Same; order entry returns to normal flow; clear/checkout disabled | Current distinguishes local target vs mutations | Existing evidence closely follows corrected board | Same Dine tab | richer illustrations | custody for removed tables | No clear-table or bill mutation | corrected board; `Stage8Dine.tsx` | KEEP CURRENT |
| Stage 9 More | Concept hub | Expanded operational read/review hub | Current has more connected projections | Current is more utilitarian | Same More destination | branded card rhythm | capacity/reporting/refunds/pending readback | Do not smuggle sellability/print/refund commands | concept board; `Stage9More.tsx` | RESTORE VISUAL IDEA |
| Stage X | Seven explicit state boards | Seven explicit state component | Equivalent semantics | Current has dedicated assets at two viewports | Cross-cutting | visual asset language | integrated real recovery callbacks | UNKNOWN must remain readback-only | board; `StageXState.tsx` | KEEP CURRENT |
| Permissions | Trusted staff context implied | Session and role available; command visibility not a full permission matrix | Current backend/runtime is controlling | Old does not specify a complete matrix | Cross-cutting | none | real staff challenge/session | Frontend must not invent grants | brief; `pwa-staff.ts` | NEEDS OWNER DECISION |
| Superseded Stage 2 | Distorted product screen | Not used | Correctly removed | Geometry is invalid | Obsolete | none | current responsive layout | Reintroduces layout defects | superseded board | DROP |
| Wrong Stage 8 My Memory | Customer member experience | Not in SMM | Correctly absent | Wrong brand context | Wrong port | customer loyalty | none | Scope/authority violation | superseded board | DROP |

## 5. Screen map

| OLD SCREEN | CURRENT EQUIVALENT | MAP | TARGET DECISION |
| --- | --- | --- | --- |
| Stage 0 Splash/Login/Connection | `StageZeroGate` family | SAME | Keep current auth/recovery behavior; only visual refinement later |
| Stage 1 Order | `OrderView` + `order` tab | SAME | Keep data/availability; salvage visual hierarchy |
| Stage 2 Configure | `ProductSheet` | SAME | Keep exact canonical IDs/validation; salvage progressive hierarchy |
| Stage 3 Cart | `CartSheet` cart state | SAME | Keep local non-authoritative draft and line repair |
| Stage 4 Checkout | `CartSheet` checkout state | MERGED | Keep merged behavior; refine review hierarchy only |
| Stage 5 Submit | `Stage5SubmitView` | SAME | Keep stable identity/readback; current V2 is baseline |
| Stage 6 Queue | `Stage6QueueView` + `work` tab | SAME | Preserve actual ACCEPT/READY behavior pending Product Review alignment |
| Stage 7 Orders | `Stage7OrdersView` | SAME | Keep read-only behavior |
| Stage 8 Dining | `Stage8DineView` | SAME | Keep read projections and disabled mutations |
| Stage 9 More | `Stage9MoreView` | SAME | Preserve current tool set; salvage grouping/visual rhythm |
| Stage X states | `StageXState` + inline state banners | SPLIT | Keep semantics; visually normalize without merging states |
| Old My Memory | none | OBSOLETE | Drop; Customer port only |

## 6. Audit conclusion

- Current SMM already implements most of the old journey and substantial source fidelity. Salvage is refinement, not a rewrite.
- Exact-base behavior, especially staff auth, dual-path runtime, stable submission identity, ACCEPT/READY, and readback, must remain unchanged in UI stages.
- The mismatch between Stage 6 runtime/tests and `capabilities.json`/older brief language requires Product Review, not a UI patch.
- No product code, implementation branch, PR, merge, deploy, or OTA was produced.
