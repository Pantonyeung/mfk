# MFK Customer Handoff｜2026-09-26｜Memory Jar Checkout V1

## Owner Requirements Captured
- Cart entry shows fixed 1–4 stepper with completion status.
- Product lines support quantity +/- and edit.
- Total quantity / total price.
- Contact data captured once and reused; deeper edit under More/Edit.
- Recommendations continue at cart summary.
- Payment: cash or electronic.
- Electronic payment methods have QR codes; enlarge/save/screenshot.
- Payment screenshot upload is checkout-session scoped; leaving requires re-selection.
- Submit shows progress.
- Up to 3 attempts to SMT.
- After 3 unsuccessful attempts, switch to WhatsApp manual ordering.
- WhatsApp uses predefined template.

## Safety Contracts Added
1. Three attempts = one submissionId / idempotencyKey, never three Orders.
2. Screenshot = payment evidence only, never automatic PAID truth; scope it to one submission and detect duplicate evidence reuse by hash/fingerprint.
3. Before WhatsApp fallback: stop all auto-submit/retry.
4. WhatsApp fallback must carry a manual fallback reference.
5. No formal pickup/display code before SMT creates Formal Order.
6. If submit state remains UNKNOWN, template tells staff to search fallback/submission reference before manual entry.

## Recommended 4 Steps
1 商品確認
2 聯絡與取餐
3 付款
4 提交／確認

## Existing Architecture Alignment
- Customer fallback should be terminate-and-forward with zero delayed auto-submit.
- Customer phone preservation is an identified Customer UI requirement.
- Checkout must revalidate quote/availability/contact.
- Timeout uses same-key retry/readback and must not create a second Order.

## Milestones
CUSTOMER_MEMORY_JAR_CHECKOUT_V1_DRAFT_LOCKED
CUSTOMER_MANUAL_PAYMENT_PROOF_V1_DRAFT_LOCKED
CUSTOMER_SMT_3_ATTEMPT_FALLBACK_V1_DRAFT_LOCKED
CUSTOMER_WHATSAPP_TERMINATE_FORWARD_V1_DRAFT_LOCKED
