# MFK Admin

`v2admin/` 係 MFK 獨立 Admin Control Plane。

## Current state

- Product: MFK Admin
- Runtime: independent web app
- Domain wiring: NOT_WIRED
- Live mutation: OFF
- Live read: OFF
- SMT transaction execution: NO

## Authority

Owner 決定規則。

Admin 將規則變成：
Draft → Validate → Publish → Active Revision。

SMT 只執行已發布規則。

## Current scope

今階段只整理 Admin 自己嘅：
- Shell
- Navigation
- Capability registry
- Page/workflow structure
- Authority boundary

未開始跨 Port live wiring。

任何未接駁功能都必須明確顯示 NOT_WIRED，禁止假成功。
