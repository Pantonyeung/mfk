# MFK Customer UI0 R2 Opening Video R1

STATUS: IMPLEMENTATION CANDIDATE / NOT PUBLIC GREEN
BASE_MAIN: cf923ba073420c17356305e807c3bdb8404fbc71
SCREEN_ID: CUSTOMER_UI0

SOURCE_PROVENANCE:
- Cloudflare R2 bucket: mfk-customer-payment-evidence
- object: ip/e788f78a-6345-45fa-8d87-467699aa5795.mp4
- type: video/mp4
- Owner screenshot evidence: 2026-09-29

IMPLEMENTATION:
- UI0 consumes same-origin /media/customer-ui0-opening.mp4.
- Private R2 bucket is NOT made public.
- Existing static Stage0 scene remains fallback for asset delivery failure.
- prefers-reduced-motion skips video and uses existing static reduced-motion composition.
- No Order/Pricing/Cart/Payment/Fulfillment authority change.

CURRENT_FIRST_BREAK:
PRIVATE_R2_OBJECT_NOT_YET_BOUND_TO_EXISTING_CUSTOMER_PUBLIC_DELIVERY_PATH

Required deployment binding:
/media/customer-ui0-opening.mp4 -> R2 mfk-customer-payment-evidence/ip/e788f78a-6345-45fa-8d87-467699aa5795.mp4

Do not claim PUBLIC_GREEN until same-origin public readback returns video/mp4 and real 390/360 acceptance passes.
