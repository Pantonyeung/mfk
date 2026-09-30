# MFK Customer Public Stage

Provider: Cloudflare Pages
Project: `mfk-customer-stage`
Production branch metadata: `stage`
Expected fixed URL: `https://mfk-customer-stage.pages.dev`
Source branch: `stage/MFK/CUSTOMER-PUBLIC`

Rule:
- This branch is the public cumulative Customer preview lane.
- Each new Customer stage candidate is promoted here for Owner review.
- The public URL stays the same while content updates.
- This branch is NOT production.
- Main / production merge remains separately gated by Owner stage confirmation.

Required GitHub repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Trigger: 2026-10-01 initial public deployment requested by Owner.
