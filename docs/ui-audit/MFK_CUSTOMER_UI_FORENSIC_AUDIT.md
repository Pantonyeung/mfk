# MFK Customer UI Forensic Audit

STATUS: `CANONICAL AUDIT EVIDENCE`  
CANONICAL_PRODUCT_BASE: `4c8642d4ec84792de88f00163ce99e3005b8354a`  
LIVE_MAIN_AT_PUBLISH: `a9e8be640e5975b93e0a8e5a2f2cc3f18196c047`  
AUDIT_MODE: `READ-ONLY FORENSIC`  
PORT: `CUSTOMER`  
SOURCE_REFERENCES: Customer historical UI package, briefs, screenshots, and current code evidence inventoried below; Figma remains `UNKNOWN`.  
IMPLEMENTATION_AUTHORITY: `NONE`

Audit date: 2026-09-30  
Mode: `AUDIT / PLANNING ONLY`  
Port: `CUSTOMER` (`v2customer/**`)  
Canonical product base: `4c8642d4ec84792de88f00163ce99e3005b8354a`

## 1. Audit boundary

- Customer is a mobile-first PWA/Web journey. It is not formal pricing, sellability, coupon-redemption, payment-confirmation, fulfillment, or order authority.
- Old package text explicitly says generated mockups are visual/scenario references and that the Product Brief, tokens, Component Spec, canonical catalog/config/order readback are controlling.
- Mockup prices, addresses, hours, typos, and AI-generated state copy are non-canonical.
- Figma componentization was described as ready, but no Figma file URL/key/node was supplied. Figma evidence remains `UNKNOWN`; no Figma file was created or modified.

## 2. Reference inventory

Package: `MFK_Customer_UI_完整設計包_2026-09-26.zip`  
Archive status: 80 files. ZIP and extracted folder contain the same file set. `00_SHA256_檔案清單.tsv` is present. All material is dated/versioned around 2026-09-26 unless stated otherwise.

| FILE | PORT | TYPE | DATE / VERSION | PURPOSE | SCREENS COVERED | FEATURES COVERED | CONFIDENCE | NOTES |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `00_檔案索引_README.txt` | CUSTOMER | Text | 2026-09-26 | Package index | all | precedence, folder map | High | Says mockup data is non-canonical |
| `00_SHA256_檔案清單.tsv` | CUSTOMER | TSV | 2026-09-26 | Integrity manifest | all files | hashes | High | Inventory/integrity only |
| `01_Brief/MFK_客戶端_Owner需求_V1.1_FINAL_2026-09-26(1).txt` | CUSTOMER | Text | V1.1 FINAL | Owner requirements | UI0–UI10 | complete journey, authority, edge cases | High | Primary old product evidence |
| `01_Brief/MFK_客戶端_Product_Brief_V1.1_FINAL_2026-09-26(1).txt` | CUSTOMER | Text | V1.1 FINAL | Product brief | UI0–UI10 | journey, membership, order certainty | High | Primary old product evidence |
| `01_Brief/MFK_客戶端_Final_Gap_Audit_R4_CLOSED_2026-09-26(1).txt` | CUSTOMER | Text | R4 CLOSED | Product gap closure | cross-cutting | identity, seeds, proof, coupon fallback | High | Product intent, not current-code proof |
| `02_UI_Spec/MFK_Customer_UI_Component_Spec_V1.md` | CUSTOMER | Markdown | V1 | Component contract | all | shell, discovery, checkout, order, member | High | Old UI system contract |
| `02_UI_Spec/MFK_Customer_UI_Consistency_Audit_V1_2026-09-26.md` | CUSTOMER | Markdown | V1 | Consistency audit | UI0–UI10 | state/copy/navigation locks | High | Explicitly rejects direct mockup implementation |
| `02_UI_Spec/MFK_Customer_UI_Frontend_Handoff_V1_2026-09-26.md` | CUSTOMER | Markdown | V1 | Frontend handoff | routes UI0–UI10 | data/mutation boundaries and E2E | High | Says `NOT YET IMPLEMENTED`; now historical |
| `02_UI_Spec/MFK_Customer_Design_Tokens_V1.json` | CUSTOMER | JSON | V1.0 | Token source | all | navy/orange/warm background/type/spacing/motion | High | Visual reference only |
| `02_UI_Spec/Stage0_啟動動畫規格_V1.md` | CUSTOMER | Markdown | V1 | Motion contract | UI0 | first/returning/reduced-motion launch | High | Two CTA only |
| `02_UI_Spec/MFK_Customer_UI_System_V1_Handoff_Board.png` | CUSTOMER | PNG board | V1 | UI system board | all | tokens/components | High | Board, not data authority |
| `03_效果圖/正式命名版本/mofun_customer_logo_v1.png` | CUSTOMER | PNG asset | V1 | Brand lockup | shell/launch | logo | High | Asset only |
| `03_效果圖/正式命名版本/mofun_customer_app_icon_v1.png` | CUSTOMER | PNG asset | V1 | App icon | launch/PWA | icon | High | Asset only |
| `03_效果圖/正式命名版本/磨飯暖心品牌標誌.png` | CUSTOMER | PNG concept | 2026-09-26 | Brand concept | shell | logo/mascot | Medium | Visual proposal |
| `03_效果圖/正式命名版本/磨飯品牌啟動體驗設計板.png` | CUSTOMER | PNG board | 2026-09-26 | Launch proposal | UI0 | brand entry | High | Scenario reference |
| `03_效果圖/正式命名版本/磨飯品牌_app_入門體驗設計板.png` | CUSTOMER | PNG board | 2026-09-26 | Entry proposal | UI0/UI1 | launch/home transition | Medium | Scenario reference |
| `03_效果圖/正式命名版本/stage0_launch_animation_storyboard_v1.png` | CUSTOMER | PNG board | V1 | Motion storyboard | UI0 | male/female launch, CTAs | High | Timing governed by spec |
| `03_效果圖/正式命名版本/磨飯_stage_1_首頁品牌展示.png` | CUSTOMER | PNG board | Stage 1 | Home proposal | UI1 | hero, status, Top 6, shortcuts | High | Mock data non-canonical |
| `03_效果圖/正式命名版本/暖米色美食_app_首頁展示板.png` | CUSTOMER | PNG board | 2026-09-26 | Home visual direction | UI1 | warm food-first composition | Medium | Alternative composition |
| `03_效果圖/正式命名版本/磨飯_more_fun_點單探索介面.png` | CUSTOMER | PNG board | Stage 2 | Browse proposal | UI2 | category, featured/small cards | High | Product truth still canonical |
| `03_效果圖/正式命名版本/stage2_order_discovery_female_v1.png` | CUSTOMER | PNG board | V1 | Browse storyboard | UI2 | browse/search/zero result | High | Female accent is decorative only |
| `03_效果圖/正式命名版本/磨飯_美好日常點餐體驗.png` | CUSTOMER | PNG board | 2026-09-26 | Journey concept | UI1–UI4 | browse/configure/cart | Medium | Composite reference |
| `03_效果圖/正式命名版本/磨飯_app_視覺系統規範海報.png` | CUSTOMER | PNG board | 2026-09-26 | Visual system | all | tokens/components | High | System reference |
| `03_效果圖/正式命名版本/stage5_safe_submit_waiting_female_v1.png` | CUSTOMER | PNG board | V1 | Submit/wait storyboard | UI5 | certainty/waiting | High | Female decorative accent |
| `03_效果圖/正式命名版本/stage5_safe_submit_waiting_male_v1.png` | CUSTOMER | PNG board | V1 | Submit/wait storyboard | UI5 | certainty/waiting | High | Same UI system |
| `03_效果圖/正式命名版本/stage6_store_confirmation_tracking_female_v1.png` | CUSTOMER | PNG board | V1 | Fulfillment storyboard | UI6 | accepted/preparing/delayed/ready | High | Corrected Stage 6 |
| `03_效果圖/正式命名版本/stage6_store_confirmation_tracking_male_v1.png` | CUSTOMER | PNG board | V1 | Fulfillment storyboard | UI6 | accepted/preparing/delayed/ready | High | Corrected Stage 6 |
| `03_效果圖/正式命名版本/stage7_pickup_handover_complete_female_v1.png` | CUSTOMER | PNG board | V1 | Pickup storyboard | UI7 | arrival/verify/handover/complete | High | Ready ≠ Completed |
| `03_效果圖/正式命名版本/stage7_pickup_handover_complete_male_v1.png` | CUSTOMER | PNG board | V1 | Pickup storyboard | UI7 | arrival/verify/handover/complete | High | Same UI system |
| `03_效果圖/正式命名版本/stage8_order_history_reorder_female_v1.png` | CUSTOMER | PNG board | V1 | History storyboard | UI8 | history/reorder/repair | High | Reorder copies intent |
| `03_效果圖/正式命名版本/stage8_order_history_reorder_male_v1.png` | CUSTOMER | PNG board | V1 | History storyboard | UI8 | history/reorder/repair | High | Same UI system |
| `03_效果圖/正式命名版本/stage9_member_memory_female_v1.png` | CUSTOMER | PNG board | V1 | Member storyboard | UI9 | seeds/coupons/badges/preferences | High | Accent only |
| `03_效果圖/正式命名版本/stage9_member_memory_male_v1.png` | CUSTOMER | PNG board | V1 | Member storyboard | UI9 | seeds/coupons/badges/preferences | High | Same UI system |
| `03_效果圖/正式命名版本/stage10_account_recovery_support_female_v1.png` | CUSTOMER | PNG board | V1 | Account/support storyboard | UI10 | recovery/temp password/support | High | Some actions are unconnected today |
| `03_效果圖/正式命名版本/stage10_account_recovery_support_male_v1.png` | CUSTOMER | PNG board | V1 | Account/support storyboard | UI10 | account/PWA/notification | High | Same UI system |
| `03_效果圖/歷史與探索版本/stage6_store_confirm_fulfillment_female_v1.png` | CUSTOMER | PNG superseded | early | Historical Stage 6 | UI6 | fulfillment concept | High | Superseded by tracking board |
| `03_效果圖/歷史與探索版本/stage6_store_confirm_fulfillment_male_v1.png` | CUSTOMER | PNG superseded | early | Historical Stage 6 | UI6 | fulfillment concept | High | Superseded by tracking board |
| `03_效果圖/歷史與探索版本/a_clean_marketing_ui_presentation_board_of_an_app.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | presentation concept | Low | Unknown stage; no direct implementation |
| `03_效果圖/歷史與探索版本/a_clean_warm_modern_app_ui_concept_poster_in_a_s.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | warm visual concept | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_ui_ux_presentation_poster_on_a_beige_backg.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | beige UI concept | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_infographic_ui_mockup_image_with_a_warm.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | UI infographic | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_ui_ux_design_presentation_image_a_pastel.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | pastel UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_modern_logo_branding_graphic_on_a_white_b.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | brand | logo direction | Low | Not a selected asset |
| `03_效果圖/歷史與探索版本/a_clean_modern_ui_ux_concept_board_for_a_mobile_a.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | mobile UI concept | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_ui_ux_design_presentation_poster_flat_lig.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | flat UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_wide_clean_ui_ux_presentation_mockup_poster_wit.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | wide storyboard | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/wide_infographic_app_mockup_presentation_in_a_clea.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | app infographic | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/wide_clean_ui_ux_presentation_mockup_image_with_a.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | wide UI concept | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_minimalist_logo_brand_image_on_a_white_ba.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | brand | logo direction | Low | Not selected |
| `03_效果圖/歷史與探索版本/a_wide_clean_ui_ux_design_mockup_image_of_a_mobile.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | mobile storyboard | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/wide_infographic_poster_ui_design_presentation_i.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | UI infographic | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_flat_pastel_ui_ux_storyboard_poster_in_a.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | pastel storyboard | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_wide_banner_style_ui_ux_presentation_image_clea.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | banner/UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_wide_clean_pastel_ui_ux_mockup_infographic_of.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | pastel infographic | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_ui_ux_presentation_mockup_image_with_a_lig.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | light UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_professional_ui_ux_presentation_board_d.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | professional UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_infographic_ui_design_presentation_image.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | UI infographic | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/wide_infographic_style_ui_design_mockup_image_cle.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | wide UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_ui_ux_presentation_poster_showing_two_side.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | male/female variants | Low | One system only; accents differ |
| `03_效果圖/歷史與探索版本/a_wide_clean_modern_ui_ux_design_presentation_po.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | modern UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_wide_clean_pastel_ui_ux_concept_poster_design.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | pastel UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/wide_clean_ui_ux_presentation_board_in_pastel_cre.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | pastel UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_minimalist_logo_branding_image_on_a_white.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | brand | logo direction | Low | Not selected |
| `03_效果圖/歷史與探索版本/a_clean_ui_ux_mockup_poster_for_a_mobile_app_stag.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | staged journey | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_modern_ui_ux_presentation_board_flat_pas.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | flat pastel UI | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_wide_infographic_poster_ui_ux_design_presentatio.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | wide infographic | Low | Unknown stage |
| `03_效果圖/歷史與探索版本/a_clean_modern_ui_ux_presentation_mockup_in_a_pas.png` | CUSTOMER | PNG exploration | 2026-09-26 | Generated exploration | mixed | pastel UI mockup | Low | Unknown stage |
| `04_品牌與IP原始素材/AA9C700D-7045-4071-8BAE-22CABFD10FC1(1).jpeg` | CUSTOMER | JPEG source | 2026-09-26 | Product/brand source | mixed | raw visual asset | Medium | Filename has no semantic manifest mapping |
| `04_品牌與IP原始素材/B3D808D8-931D-4FC7-8259-B5C1BF3934E2.jpeg` | CUSTOMER | JPEG source | 2026-09-26 | Product/brand source | mixed | raw visual asset | Medium | Asset only |
| `04_品牌與IP原始素材/B52CF169-FEFB-4D5D-88A1-1CDBC3CE49D4.png` | CUSTOMER | PNG source | 2026-09-26 | Product/brand source | mixed | raw visual asset | Medium | Asset only |
| `04_品牌與IP原始素材/IMG_4585.jpeg` | CUSTOMER | JPEG source | 2026-09-26 | Product/brand source | mixed | raw visual asset | Medium | Asset only |
| `04_品牌與IP原始素材/IMG_5084.jpeg` | CUSTOMER | JPEG source | 2026-09-26 | Product/brand source | mixed | raw visual asset | Medium | Asset only |
| `04_品牌與IP原始素材/IMG_8155(1).png` | CUSTOMER | PNG source | 2026-09-26 | Product/brand source | mixed | raw visual asset | Medium | Asset only |
| `05_UI參考素材/IMG_1850(2).webp` | CUSTOMER | WEBP reference | 2026-09-26 | External inspiration | mixed | mobile UI | Low | Not MFK contract |
| `05_UI參考素材/IMG_1851(1).webp` | CUSTOMER | WEBP reference | 2026-09-26 | External inspiration | mixed | mobile UI | Low | Not MFK contract |
| `05_UI參考素材/IMG_1852(2).webp` | CUSTOMER | WEBP reference | 2026-09-26 | External inspiration | mixed | mobile UI | Low | Not MFK contract |
| `05_UI參考素材/IMG_1853(2).webp` | CUSTOMER | WEBP reference | 2026-09-26 | External inspiration | mixed | mobile UI | Low | Not MFK contract |
| `05_UI參考素材/IMG_1854(1).webp` | CUSTOMER | WEBP reference | 2026-09-26 | External inspiration | mixed | mobile UI | Low | Not MFK contract |
| `05_UI參考素材/IMG_1855(2).webp` | CUSTOMER | WEBP reference | 2026-09-26 | External inspiration | mixed | mobile UI | Low | Not MFK contract |
| `05_UI參考素材/IMG_1856(2).webp` | CUSTOMER | WEBP reference | 2026-09-26 | External inspiration | mixed | mobile UI | Low | Not MFK contract |

Inventory note: historical/exploration filenames are generic outputs and cannot be mapped to a stage with high confidence. The SHA manifest, not filenames, is the integrity source.

## 3. Current implementation audit

### Navigation and routing

- Current primary views: `home`, `menu`, `cart`, `orders`, and `more` (labelled `會員`).
- Fixed five-item navigation is `首頁 / 點單 / 記憶罐 / 訂單 / 會員`, with Memory Jar centered.
- Current routes: `/`, `/menu`, `/memory-jar`, `/checkout/contact`, `/checkout/payment`, `/checkout/review`, `/submit/:submissionId`, `/orders`, `/orders/:orderId/waiting`, `/orders/:orderId`, `/member`, `/member/account`, and `/support/account-recovery`.
- Launch is an overlay on eligible entry routes rather than a standalone `/launch` route. Browser history/popstate is handled manually.

### Components and presentation

- UI0: `LaunchOverlay` with first/returning/reduced-motion behavior and two CTAs.
- UI1/UI2: `Stage1Home` and `Stage2Menu` with food media, store/order context, search, category, featured cards, sold-out and zero-result states.
- UI3: `ProductSheet` uses exact variation/option/combo identifiers and progressive configuration.
- UI4: `CartView` plus `CheckoutUi4View` split Memory Jar from contact/payment/review routes.
- UI5–UI8: dedicated submit, fulfillment, pickup, and history/reorder components.
- UI9/UI10: member projections plus account/recovery/support presentation. Credential creation/reset remains disabled where no proven interface exists.
- Current screenshot evidence covers 19 R2 captures: Home, Menu, Product steps, empty/populated Jar, Checkout, pending/UNKNOWN, preparing, ready pickup, history, member states, Android, reduced-motion, and keyboard focus.

### Runtime, product behavior, and persistence

- `runtime.ts` accepts an injected port and otherwise installs the authorized cloud Customer port.
- `cloud-runtime.ts` directly reads Customer snapshots, uploads payment evidence, probes SMT availability, submits one stable order intent, and reads back the same submission. Formal order authority remains downstream.
- Submission has synchronous locking, stable submission/idempotency identity, bounded connectivity checks, `UNKNOWN` readback, and no background/reconnect resubmit.
- Payment screenshots are evidence only and are removed from durable checkout persistence and invalidated by cart changes.
- `persistence.ts` stores cart, contact/payment method (not payment evidence), pending intents, and preferences under `mfk:customer:workspace:v1` as `LOCAL_NON_AUTHORITATIVE`.
- Current display quote is produced from published menu price facts by `local-quote.ts`; the port also defines a canonical quote endpoint, but `App.tsx` does not call `quoteCart`. This is a product/authority review item, not a UI-stage change.
- Reorder copies intent into a new cart, revalidates current menu facts, and repairs only affected lines.

### Loading, empty, error, offline, stale, unknown, and permissions

- Global and screen components distinguish `LOADING`, `READY`, `EMPTY`, `ERROR`, `OFFLINE/NOT_CONNECTED`, `STALE/PARTIAL`, and transaction `UNKNOWN`.
- UI6–UI8 have explicit state mapping and preserve loaded read-only data in degraded states.
- Customer UI exposes no staff permission model. Member/account mutations fail closed where the canonical credential service is absent.
- Notification permission is requested only after an explicit Customer click; membership does not imply marketing consent.

### Current documentation drift

- `v2customer/README.md` and `docs/R2-ACCEPTANCE.md` still describe an injection-only, no-direct-fetch, all-commands-not-wired product.
- Exact-base source contains `cloud-runtime.ts`, direct Customer endpoints, payment-evidence upload, and `SUBMIT_ORDER_COMMAND: SOURCE_WIRED_NOT_DEPLOYED`.
- `capabilities.json` also contains numerous older `PRODUCT_READY_NOT_CONNECTED` descriptions that do not fully reflect the exact-base runtime.
- This is recorded as product/documentation contract drift. No product document or runtime is changed in a UI audit.

### Tests read

- Tests cover exact combo IDs, published projections, source fidelity, five-nav, UI0–UI10, cart/checkout/payment evidence, submit certainty, fulfillment/pickup separation, history/reorder, responsive/accessibility, and authority boundaries.
- `migration.test.mjs` explicitly asserts the authorized cloud bridge, local published price calculation, stable submission/readback, bounded preflight, and fail-closed submit.
- Tests are source evidence only; this audit does not claim a new build, live, device, payment, or physical acceptance.

## 4. OLD vs CURRENT vs TARGET matrix

| SCREEN / CAPABILITY | OLD REFERENCE | CURRENT IMPLEMENTATION | FUNCTIONAL DIFFERENCE | VISUAL DIFFERENCE | IA DIFFERENCE | OLD-ONLY IDEA | CURRENT-ONLY CAPABILITY | AUTHORITY / PRODUCT RISK | EVIDENCE | CLASSIFICATION |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UI0 Launch | Logo/IP story, first/returning/reduced motion, two CTAs | Same functional model as overlay | Current is implemented and fail-safe | Current assets/composition differ from some boards | Overlay instead of `/launch` | richer food interaction storyboard | session variant and proven reduced-motion fallback | Must not gate data readiness | Stage0 spec/board; `LaunchOverlay` | KEEP CURRENT |
| Shell / nav | Navy/orange/warm five-nav system | Same five labels and center Jar; current mixed purple/green/orange styling | Equivalent navigation | Current visual system differs materially | Same IA | unified old tokens | active-order/cart badges and route continuity | Do not reset cart or change routes | tokens/board; nav components | RESTORE VISUAL IDEA |
| UI1 Home | Brand storefront, hero, announcement, Top 6, three shortcuts | Store/order-context home, hero, recommendations, shortcuts | Current adds active-order context and current projections | Old is warmer, more brand-led; current is more operational | Same Home | explicit old Top 6 visual rhythm | current active-order priority | Closed store may browse/build but not commit | Stage 1 boards; `Stage1Home` | RESTORE UX IDEA |
| UI2 Browse | One featured large card per category plus small cards | Implemented category/search/featured/small/sold-out flow | Broadly equivalent | Current product photography and denser chrome | Same Menu | old navy/orange styling | zero-result repair and canonical fallbacks | No local availability truth | Stage 2 board; `Stage2Menu` | KEEP CURRENT |
| UI3 Configure | Hero→combo→required→optional→qty→recommend→summary→add | Progressive exact-ID configuration sheet | Current is more explicit and canonical | Current wizard is more utilitarian | Same product detail, modal presentation | old continuous detail rhythm | exact combo pools and line edit reuse | No combo/name/price heuristics | Component Spec; ProductSheet/tests | KEEP CURRENT |
| UI4 Memory Jar | Four-step checkout control centre | Jar separated from contact/payment/review routes | Current splits cart from checkout routes | Current purple jar motif differs from old warm system | SPLIT | old unified stepper rhythm | payment evidence invalidation and line repair | UI must not confirm payment or redeem coupon | specs; Cart/Checkout components | RESTORE UX IDEA |
| Electronic payment | QR + screenshot evidence, not paid truth | Implemented channel QR/evidence upload and fail-closed validation | Current has live upload seam | Presentation broadly aligned | Payment route within UI4 | coupon/payment combined examples | transient evidence lifecycle | Screenshot ≠ payment confirmation | brief; checkout/cloud runtime | KEEP CURRENT |
| Coupon | Eligible selection, redeem only after formal success, fallback hold edge case | Projection types/member coupon display; no complete checkout coupon lifecycle in UI | Old product scope exceeds current implementation | Old boards show richer coupon treatment | Coupon spans member/checkout | apply/hold/release flow | honest absence in checkout | Pricing/redeem/fallback authority is Level C | brief vs current code | NEEDS OWNER DECISION |
| UI5 Submit / waiting | Three attempts/same identity, delivered then waiting, WhatsApp fallback | Stable one intent, bounded preflight, readback-only UNKNOWN, WhatsApp handoff | Current implementation semantics differ from narrative “3 tries” but preserve single identity | Current is more restrained | Submit and waiting are separate routes | richer elapsed/wait visuals | direct cloud bridge and pending persistence | No background/reconnect submit | Stage 5 boards; App/cloud runtime | KEEP CURRENT |
| UI6 Fulfillment | accepted/preparing/delayed/ready | Dedicated canonical projection/read-only refresh | Equivalent projection | Old boards use stronger mascot/timeline storytelling | Waiting route transitions to pickup | richer stage illustration | real state/freshness mapping | Refresh must never submit | Stage 6 board; component | RESTORE VISUAL IDEA |
| UI7 Pickup | Ready→arrived→verified→handed-over→completed | Dedicated read-only pickup projection and help path | Current shows canonical state only; no Customer completion mutation | Old boards have stronger identity panel | Order detail route | detailed handover story | real safe help/degraded handling | Ready ≠ Completed; no Customer mutation | Stage 7 boards; component | RESTORE VISUAL IDEA |
| UI8 History / reorder | Read-only history; copy intent/current validation/repair | Implemented current/history/detail/copy/repair | Broadly equivalent | Current is more editorial/purple | Same Orders destination, segmented | old card/timeline system | current line-scoped repair | Never reopen old order or reuse old price | Stage 8 boards; history/reorder code | KEEP CURRENT |
| UI9 Member / memory | Seeds, coupons, favorites, saved orders, preferences, badges | Read-only member/seeds/coupons/badges/preferences plus recent reorder; activation disabled | Old includes mutations/collections not fully connected | Current is more editorial and less orange/navy | Same Member tab | full favorite/saved-template management | pending submission support and honest disconnected modules | Member/loyalty truth is Level C | Stage 9 boards; MemberView | NEEDS OWNER DECISION |
| UI10 Account / support | Phone+password, manual WhatsApp recovery, temp password, PWA/notification | Account/recovery routes; mutation disabled; explicit WhatsApp; PWA guide and notification permission | Current intentionally stops before credential mutation | Old looks end-to-end complete | Separate secondary routes under Member | activation/temp-password completion | fail-closed copy | Do not invent credential service or OTP | Stage 10 boards; `customer-ui10.tsx` | KEEP CURRENT |
| Responsive / accessibility | 390 baseline, tablet/desktop guidance, 44px/AA/reduced motion | Mobile-first, 360/390/412 evidence, fixed nav, focus/reduced motion | Current mobile proof stronger; tablet/desktop proof limited | Old is storyboard-only | Cross-cutting | tablet split-view suggestion | real dialog focus return and gestures | Do not use scaling tricks | handoff; CSS/tests/evidence | RESTORE VISUAL IDEA |
| Historical/generated boards | Many incompatible/unknown concepts | Not used as contracts | Correctly excluded | Wide stylistic variance | Unknown | isolated motifs | none | Mock copy/data may be false | exploration folder | DROP |

## 5. Screen map

| OLD SCREEN | CURRENT EQUIVALENT | MAP | TARGET DECISION |
| --- | --- | --- | --- |
| UI0 Launch `/launch` concept | `LaunchOverlay` on `/` or `/member` entry | RENAMED | Keep overlay behavior; salvage approved brand motion only |
| UI1 Home | `/` `Stage1Home` | SAME | Preserve active-order/store behavior; improve brand hierarchy |
| UI2 Browse | `/menu` `Stage2Menu` | SAME | Keep current functionality and source-fidelity geometry |
| UI3 Configure | `ProductSheet` dialog | SAME | Keep exact canonical configuration semantics |
| UI4 Memory Jar | `/memory-jar` `CartView` | SPLIT | Keep split architecture; refine Jar presentation |
| UI4 Contact / Payment / Review | three `/checkout/*` routes | SPLIT | Keep routes and validation; restore one coherent visual journey |
| UI5 Submit | `/submit/:submissionId` | SAME | Keep stable identity and result semantics |
| UI5 Waiting | `/orders/:orderId/waiting` | SPLIT | Keep read-only waiting/readback |
| UI6 Store fulfillment | `StoreFulfillmentUi6View` | SAME | Keep canonical projection; visual salvage only |
| UI7 Pickup | `/orders/:orderId` `PickupCompleteUi7View` | SAME | Keep read-only separation of states |
| UI8 History / reorder | `/orders` `HistoryReorderUi8View` | SAME | Keep current revalidation/repair |
| UI9 Member / memory | `/member` `MemberView` | SAME | Keep honest projections; product review missing mutations |
| UI10 Account | `/member/account` | SAME | Keep fail-closed credential UI |
| UI10 Recovery / support | `/support/account-recovery` | SAME | Keep explicit WhatsApp/manual recovery |
| Early Stage 6 fulfillment | none as authority | OBSOLETE | Drop superseded concepts |
| Accidental/unknown Stage 11 and generic boards | none | UNKNOWN | Do not implement without mapped evidence |

## 6. Audit conclusion

- The current Customer port is not “not implemented”; it is a broad, connected journey at the exact base. The old package remains valuable for brand/tokens and stage storytelling, not as runtime truth.
- Current five-nav, routes, stable intent, readback, payment-evidence handling, exact combo configuration, fulfillment semantics, and local non-authoritative persistence must be preserved.
- Quote authority/documentation registry drift and member/coupon mutation gaps require Product Review. They must not be hidden inside visual PRs.
- No product code, implementation branch, PR, merge, deploy, or OTA was produced.
