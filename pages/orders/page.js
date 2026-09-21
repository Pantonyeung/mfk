import {
  ORDER_HISTORY_STORAGE_KEY,
  ORDER_STORAGE_KEY,
  DINE_STORAGE_KEY,
  TERMINAL_ID_STORAGE_KEY,
  PRINTER_STORAGE_KEY,
  readJSON,
  writeJSON,
} from "../../shared/store.js";
import { normalizeTerminalId } from "../../shared/operations.js";
import { money, escapeHtml } from "../../shared/components.js";
import { getChannelPolicy } from "../checkout/checkout-domain.js";
import {
  applyOrderFilters,
  cancelOrder,
  changeOrderPayment,
  partiallyCancelItem,
  queueReprint,
  isHistory,
  archiveExpiredOrders,
  reconcilePayment,
  flagPaymentIssue,
} from "./orders-domain.js";
import {defaultPrinterState,importExternalPrintJobs,createPrintJobs} from "../more/print-domain.js";
import {renderGlobalStatusBar,renderBottomNav} from "../../shared/shell.js";
import {activeDineOrderIdentities,latestOrderDisplayNumber,orderDisplayNumber} from "../../shared/order-identity.js";
const app = document.getElementById("app"),
  terminalId = normalizeTerminalId(
    localStorage.getItem(TERMINAL_ID_STORAGE_KEY) || "SMT",
  ),
  now = Date.now();
const demo = [
  {
    id: "P0053",
    group: "onsite",
    source: "現場",
    status: "running",
    acceptedAt: now - 19 * 60000,
    itemCount: 2,
    amount: 88,
    paymentMethod: "現金",
    paymentStatus: "已付款",
    printStatus: "正常",
    items: [
      { name: "招牌牛肉滑蛋飯", qty: 1, total: 70 },
      { name: "凍檸茶", qty: 1, total: 18 },
    ],
  },
  {
    id: "P0054",
    group: "owned",
    source: "電話／WhatsApp",
    status: "running",
    acceptedAt: now - 11 * 60000,
    itemCount: 2,
    amount: 76,
    paymentMethod: "待核實",
    paymentStatus: "付款待核實",
    reconciliationStatus: "pending",
    printStatus: "正常",
    contact: "陳先生",
    phone: "85261234567",
    items: [
      { name: "叉燒飯", qty: 1, total: 58 },
      { name: "凍檸茶（少甜）", qty: 1, total: 18 },
    ],
  },
  {
    id: "P0059",
    group: "platform",
    source: "Keeta",
    status: "running",
    acceptedAt: now - 18 * 60000,
    itemCount: 2,
    amount: 90,
    paymentMethod: "平台已付",
    paymentStatus: "平台已付",
    printStatus: "異常",
    items: [
      { name: "自選便當", qty: 1, total: 72 },
      { name: "飲品", qty: 1, total: 18 },
    ],
  },
  {
    id: "P0060",
    group: "platform",
    source: "Foodpanda",
    status: "running",
    acceptedAt: now - 12 * 60000,
    itemCount: 2,
    amount: 82,
    paymentMethod: "平台已付",
    paymentStatus: "平台已付",
    printStatus: "正常",
    items: [
      { name: "飯團套餐", qty: 1, total: 64 },
      { name: "飲品", qty: 1, total: 18 },
    ],
  },
];
let orders = readJSON(ORDER_HISTORY_STORAGE_KEY, []);
if (!orders.length) orders = demo;
orders = archiveExpiredOrders(orders, Date.now());
writeJSON(ORDER_HISTORY_STORAGE_KEY, orders);
let selectedId = "",
  modal = "",
  notice = "",
  filters = { view: "active", source: "all", exception: "" },
  cancelMode = false,
  cancelDraft = {},
  editSource = "",
  editPayment = "";
const groups = [
    ["onsite", "現場"],
    ["owned", "自有渠道"],
    ["platform", "外賣平台"],
  ],
  sources = ["現場", "電話／WhatsApp", "磨飯 App", "Keeta", "Foodpanda"];
const sourceIcon = { "現場": "⌂", "電話／WhatsApp": "☎", "磨飯 App": "✦", Keeta: "K", Foodpanda: "F" };
const sourceLabel = value => value === "all" ? "全部來源" : `${sourceIcon[value] || "•"} ${value}`;
function archiveAndRender(){
  const next=archiveExpiredOrders(orders,Date.now());
  const changed=next.some((order,index)=>order!==orders[index]);
  if(!changed)return;
  orders=next;
  writeJSON(ORDER_HISTORY_STORAGE_KEY, orders);
  render();
}
setInterval(archiveAndRender, 60_000);
const minutes = (o) =>
    Math.max(
      0,
      Math.floor((Date.now() - Number(o.acceptedAt || Date.now())) / 60000),
    ),
  visible = () => applyOrderFilters(orders, filters);
function persist(updated, message) {
  orders = orders.map((o) => (o.id === updated.id ? updated : o));
  writeJSON(ORDER_HISTORY_STORAGE_KEY, orders);
  let printState=readJSON(PRINTER_STORAGE_KEY,null)||defaultPrinterState();
  const latest=updated.printJobs?.at(-1);
  if(latest?.documents?.length){
    const documents=latest.documents.map(value=>String(value).includes('標籤')?'label':String(value).includes('打包')?'packing':String(value).includes('小票')?'receipt':'production');
    printState=createPrintJobs(updated,printState,{now:latest.createdAt||Date.now(),documents,isReprint:true});
  }else printState=importExternalPrintJobs(printState,{orders:[updated]});
  writeJSON(PRINTER_STORAGE_KEY,printState);
  modal = "";
  cancelMode = false;
  cancelDraft = {};
  notice = message;
  render();
}
function orderCard(o) {
  return `<button class="order-card ${selectedId === o.id ? "selected" : ""}" data-action="select-order" data-id="${o.id}"><header><span><small>${escapeHtml(o.source)}</small><strong>${escapeHtml(orderDisplayNumber(o))}</strong></span><b>${isHistory(o) ? statusLabel(o) : minutes(o) + "分鐘"}</b></header><div><span>${o.itemCount} 件</span><strong>${money(o.amount)}</strong></div><footer><span>${escapeHtml(o.paymentMethod)}</span><span class="${o.printStatus === "異常" ? "bad" : "ok"}">打印${escapeHtml(o.printStatus)}</span></footer></button>`;
}
const statusLabel = (o) => (o.status === "cancelled" ? "已取消" : "已完成");
function lane(key, title) {
  const rows = visible()
    .filter((o) => o.group === key)
    .sort((a, b) => Number(b.acceptedAt) - Number(a.acceptedAt));
  return `<section class="lane"><header><div><strong>${title}</strong><small>${filters.view === "history" ? "歷史" : "進行中"} ${rows.length} ｜ 異常 ${rows.filter((o) => o.printStatus === "異常" || String(o.paymentStatus).includes("待")).length}</small></div><b>${money(rows.reduce((n, o) => n + Number(o.amount || 0), 0))}</b></header><div class="lane-scroll">${rows.length ? rows.map(orderCard).join("") : '<p class="empty-row">沒有符合條件的訂單</p>'}</div></section>`;
}
function cancelSummary(o) {
  let count = 0,
    amount = 0;
  Object.entries(cancelDraft).forEach(([index, qty]) => {
    const item = o.items[Number(index)],
      unit = Number(item?.total || 0) / Math.max(1, Number(item?.qty) || 1);
    count += qty;
    amount += unit * qty;
  });
  return {
    count,
    amount,
    newTotal: Math.max(0, Number(o.amount || 0) - amount),
  };
}
function itemRow(x, index) {
  const selected = cancelDraft[index] || 0;
  return `<article class="${cancelMode ? "cancel-mode" : ""}">${cancelMode ? `<button class="cancel-step minus" data-action="cancel-minus" data-index="${index}" ${selected >= x.qty ? "disabled" : ""}>−</button>` : ""}<span>${escapeHtml(x.name)} ×${x.qty}${x.cancelledQty ? ` <em>已取消 ×${x.cancelledQty}</em>` : ""}</span>${cancelMode ? `<span class="cancel-count">取消 ${selected}</span><button class="cancel-step" data-action="cancel-plus" data-index="${index}" ${selected <= 0 ? "disabled" : ""}>＋</button>` : `<b>${money(x.total)}</b>`}</article>`;
}
function detail() {
  const o = orders.find((x) => x.id === selectedId);
  if (!o) return '<aside class="detail empty">請選擇一張訂單</aside>';
  const summary = cancelSummary(o),
    pending = String(o.paymentStatus).includes("待");
  return `<aside class="detail"><header><div><small>${escapeHtml(o.source)}</small><h2>${escapeHtml(orderDisplayNumber(o))}</h2></div><span>${isHistory(o) ? statusLabel(o) : minutes(o) + " 分鐘"}</span></header><div class="meta"><span>付款方式<b>${escapeHtml(o.paymentMethod)}</b></span><span>付款狀態<b>${escapeHtml(o.paymentStatus)}</b></span><span>操作終端<b>${escapeHtml(o.checkoutTerminalId || "待同步")}</b></span></div><div class="items">${(o.items || []).map(itemRow).join("")}</div>${cancelMode ? `<div class="cancel-preview"><span>取消 ${summary.count} 件 · ${money(summary.amount)}</span><b>新總額 ${money(summary.newTotal)}</b></div>` : `<div class="total"><span>訂單總額</span><b>${money(o.amount)}</b></div>`}<div class="detail-actions">${isHistory(o) ? '<button data-action="timeline">查看操作紀錄</button>' : cancelMode ? '<button data-action="cancel-mode-exit">返回</button><button class="danger" data-action="cancel-review" ' + (!summary.count ? "disabled" : "") + ">確認取消</button>" : `${pending ? '<button class="primary" data-action="reconcile-open">付款待核實</button>' : ""}<button data-action="change-payment">換渠道／付款方式</button><button data-action="reprint">重印</button><button data-action="partial-cancel">部分取消</button><button class="danger" data-action="reverse-open">反結帳</button>`}</div></aside>`;
}
const overlay = (content) =>
  `<div class="scrim"></div><section class="reverse-card">${content}</section>`;
function paymentModal(o) {
  const policy = getChannelPolicy(editSource);
  return `<label>渠道</label><div class="option-grid">${sources.map((x) => `<button data-action="edit-source" data-value="${x}" class="${x === editSource ? "active" : ""}">${x}</button>`).join("")}</div>${policy.requiresPaymentMethod ? `<label>付款方式</label><div class="option-grid">${policy.paymentMethods.map((x) => `<button data-action="edit-payment" data-value="${x}" class="${x === editPayment ? "active" : ""}">${x}</button>`).join("")}</div>` : '<p class="notice">此渠道不預先選付款方式，會按正式狀態進入待核實或平台已付。</p>'}<footer><button data-action="close-modal">返回</button><button class="primary" data-action="save-payment">儲存更改</button></footer>`;
}
function whatsappLink(o) {
  const phone = String(o.phone || o.channelData?.phone || "").replace(
    /\D/g,
    "",
  );
  const message = `你好，呢度係磨飯。訂單 ${orderDisplayNumber(o)} 嘅付款資料需要你協助核對，麻煩回覆付款截圖或相關資料，謝謝。`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
function paymentProof(o) {
  const proof = o.paymentProof || o.proof;
  return proof
    ? `<button class="payment-proof" data-action="enlarge-proof"><img src="${escapeHtml(proof)}" alt="付款證明"><span>按下放大付款證明</span></button>`
    : `<label class="payment-proof empty"><strong>尚未收到付款證明</strong><span>按此上載客人付款圖片</span><input type="file" accept="image/*" data-payment-proof hidden></label>`;
}
function reconciliationModal(o, head) {
  const whatsapp = whatsappLink(o);
  const reasons = [
    "截圖不清楚",
    "金額不相符",
    "付款紀錄未找到",
    "付款方式不明",
  ];
  return overlay(
    head("付款待核實") +
      `<div class="reconciliation-layout"><section class="reconciliation-main"><div class="reconcile-summary"><span>${escapeHtml(o.source)}</span><b>${money(o.amount)}</b><small>${escapeHtml(o.channelData?.note || "未有備註")}</small></div><label>實際付款方式</label><div class="option-grid">${["現金付款", "FPS／轉數快", "PayMe", "AlipayHK", "WeChat Pay HK"].map((x) => `<button data-choice="reconcile-payment" data-value="${x}">${x}</button>`).join("")}</div><label>實際已付金額</label><input class="modal-input" data-reconcile-amount type="number" value="${o.amount}"><label>付款證明</label>${paymentProof(o)}<label>問題快選（可略過）</label><div class="issue-quick">${reasons.map((x) => `<button data-choice="issue-reason" data-value="${x}">${x}</button>`).join("")}</div><textarea class="modal-input" data-reconcile-issue placeholder="其他問題，可留空"></textarea><label class="notify-check"><input type="checkbox" data-notify-customer> 同時通知客戶</label></section><aside class="whatsapp-qr"><strong>WhatsApp QR Code</strong><p>掃描後直接開啟客人對話及預設訊息。</p><div class="qr-code" data-qr="${escapeHtml(whatsapp)}"></div><a href="${escapeHtml(whatsapp)}" target="_blank" rel="noopener">在此裝置開啟 WhatsApp</a></aside></div><div class="reconcile-actions"><button data-action="reconcile-hold">保留待處理</button><button class="danger" data-action="reconcile-issue">資料有問題</button><button class="primary" data-action="reconcile-success">核實成功</button></div>`,
  );
}
function modalHtml() {
  const o = orders.find((x) => x.id === selectedId);
  if (!modal || !o) return "";
  const head = (t) =>
    `<header><div><small>訂單 ${escapeHtml(orderDisplayNumber(o))}</small><strong>${t}</strong></div><button data-action="close-modal">×</button></header>`;
  if (modal === "reverse")
    return overlay(
      head("反結帳") +
        '<button class="choice danger" data-action="cancel-order"><strong>整單取消</strong><span>保留在歷史訂單，不打印</span></button><button class="choice" data-action="reuse-order"><strong>反結帳並重用</strong><span>原有商品載入點單頁</span></button><footer><button data-action="close-modal">返回</button></footer>',
    );
  if (modal === "payment")
    return overlay(head("更改渠道／付款方式") + paymentModal(o));
  if (modal === "source")
    return overlay(head("選擇訂單來源") + `<div class="source-picker">${["all", ...sources].map((value) => `<button data-action="choose-source" data-value="${value}" class="${filters.source === value ? "active" : ""}">${sourceLabel(value)}</button>`).join("")}</div><footer><button data-action="close-modal">返回</button></footer>`);
  if (modal === "reconcile") return reconciliationModal(o, head);
  if (modal === "confirm-partial") {
    const s = cancelSummary(o);
    return overlay(
      head("確認取消") +
        `<p class="cancel-confirm">取消 ${s.count} 件，共 ${money(s.amount)}<br>新訂單總額 ${money(s.newTotal)}</p><footer><button data-action="close-modal">返回</button><button class="danger" data-action="confirm-partial">確認取消</button></footer>`,
    );
  }
  if (modal === "reprint")
    return overlay(
      head("選擇重印文件") +
        '<div class="check-list">' +
        ["製作單", "打包單", "飯糰標籤", "其他標籤", "收據"]
          .map(
            (x) =>
              `<label><input type="checkbox" name="document" value="${x}">${x}</label>`,
          )
          .join("") +
        '</div><footer><button data-action="close-modal">返回</button><button class="primary" data-action="confirm-reprint">加入打印隊列</button></footer>',
    );
  if (modal === "timeline")
    return overlay(
      head("操作紀錄") +
        `<div class="timeline">${
          (o.audit || []).length
            ? (o.audit || [])
                .slice()
                .reverse()
                .map(
                  (x) =>
                    `<p><b>${escapeHtml(x.type)}</b><span>${escapeHtml(x.terminalId || "系統")} · ${new Date(x.at).toLocaleString("zh-HK")}</span></p>`,
                )
                .join("")
            : "<p>暫時未有操作紀錄</p>"
        }</div><footer><button data-action="close-modal">返回</button></footer>`,
    );
  return "";
}
function render() {
  const shown = visible();
  if (!shown.some((o) => o.id === selectedId)) selectedId = shown[0]?.id || "";
  const p = orders.filter(
      (o) => !isHistory(o) && String(o.paymentStatus).includes("待"),
    ).length,
    b = orders.filter((o) => !isHistory(o) && o.printStatus === "異常").length,
    h = orders.filter(isHistory).length;
  const activeCount=orders.filter((o)=>!isHistory(o)).length;
  const statusbar=renderGlobalStatusBar({terminalId,operationLabel:"接單中",lastOrder:latestOrderDisplayNumber([...orders,...activeDineOrderIdentities(readJSON(DINE_STORAGE_KEY,null))]),rightActions:`<button class="top-btn" data-action="show-active">進行中 ${activeCount}</button><button class="top-btn" data-action="show-history">歷史訂單 ${h}</button>`});
  app.innerHTML = `<main>${statusbar}<section class="workspace"><header class="page-head"><div><h1>訂單</h1><p>所有操作會即時顯示結果並保存紀錄。</p></div><button data-action="cycle-source">來源：${{ all: "全部", onsite: "現場", owned: "自有渠道", platform: "外賣平台" }[filters.source]}</button><button data-action="filter-payment" class="${filters.exception === "payment" ? "active" : ""}">付款待核實 ${p}</button><button data-action="filter-print" class="${filters.exception === "print" ? "active" : ""}">打印異常 ${b}</button><button data-action="clear-filter">清除篩選</button></header><section class="stats"><button data-action="show-active">進行中訂單<b>${activeCount}</b></button><button data-action="filter-payment">付款待核實<b>${p}</b></button><button data-action="filter-print">打印異常<b>${b}</b></button><button data-action="show-history">歷史訂單<b>${h}</b></button></section><section class="orders-layout">${detail()}<div class="lanes">${groups.map((g) => lane(...g)).join("")}</div></section></section>${renderBottomNav("orders",{badges:{orders:activeCount}})}</main>${modalHtml()}<div id="toast" class="toast ${notice ? "show" : ""}">${escapeHtml(notice)}</div>`;
  const sourceButton = document.querySelector('[data-action="cycle-source"]');
  if (sourceButton) sourceButton.textContent = `來源：${sourceLabel(filters.source)}`;
  if (notice)
    setTimeout(() => {
      notice = "";
      render();
    }, 1800);
  document.querySelectorAll("[data-qr]").forEach((node) => {
    if (typeof window.qrcode !== "function") return;
    const qr = window.qrcode(0, "M");
    qr.addData(node.dataset.qr);
    qr.make();
    node.innerHTML = qr.createImgTag(5, 8, "WhatsApp QR Code");
  });
}
function handle(b) {
  const a = b.dataset.action,
    o = orders.find((x) => x.id === selectedId);
  if(a==="shell-navigate"){
    const route=b.dataset.route;
    if(route!=="orders")parent.postMessage({type:"morefun:navigate",route},"*");
    return;
  } else if (a === "select-order") {
    selectedId = b.dataset.id;
    cancelMode = false;
    cancelDraft = {};
  } else if (a === "navigate-order")
    parent.postMessage({ type: "morefun:navigate", route: "order" }, "*");
  else if (a === "navigate-dine")
    parent.postMessage({ type: "morefun:navigate", route: "dine" }, "*");
  else if (a === "navigate-soldout")
    parent.postMessage({ type: "morefun:navigate", route: "soldout" }, "*");
  else if (a === "navigate-more")
    parent.postMessage({ type: "morefun:navigate", route: "more" }, "*");
  else if (a === "show-active") {
    filters.view = "active";
    filters.exception = "";
  } else if (a === "show-history") {
    filters.view = "history";
    filters.exception = "";
  } else if (a === "cycle-source") modal = "source";
  else if (a === "choose-source") {
    filters.source = b.dataset.value === "all" ? "all" : b.dataset.value;
    modal = "";
  }
  else if (a === "filter-payment") {
    filters.view = "active";
    filters.exception = filters.exception === "payment" ? "" : "payment";
  } else if (a === "filter-print") {
    filters.view = "active";
    filters.exception = filters.exception === "print" ? "" : "print";
  } else if (a === "clear-filter")
    filters = { view: "active", source: "all", exception: "" };
  else if (a === "reverse-open") modal = "reverse";
  else if (a === "change-payment") {
    editSource = o.source;
    editPayment = o.paymentMethod;
    modal = "payment";
  } else if (a === "edit-source") {
    editSource = b.dataset.value;
    editPayment = getChannelPolicy(editSource).paymentMethods[0] || "";
  } else if (a === "edit-payment") editPayment = b.dataset.value;
  else if (a === "save-payment")
    return persist(
      changeOrderPayment(
        o,
        { source: editSource, paymentMethod: editPayment },
        terminalId,
      ),
      orderDisplayNumber(o) + " 渠道及付款狀態已更新",
    );
  else if (a === "reconcile-open") modal = "reconcile";
  else if (a === "reconcile-hold") modal = "";
  else if (a === "reconcile-success") {
    const method = app.querySelector('[data-choice="reconcile-payment"].active')
        ?.dataset.value,
      amount = Number(app.querySelector("[data-reconcile-amount]")?.value) || 0;
    if (!method) {
      notice = "請選擇實際付款方式";
    } else
      return persist(
        reconcilePayment(
          o,
          { paymentMethod: method, paidAmount: amount },
          terminalId,
        ),
        orderDisplayNumber(o) + " 已核實付款",
      );
  } else if (a === "reconcile-issue") {
    const reason =
        app.querySelector('[data-choice="issue-reason"].active')?.dataset
          .value ||
        app.querySelector("[data-reconcile-issue]")?.value.trim() ||
        "付款資料需要跟進",
      notifyCustomer = app.querySelector("[data-notify-customer]")?.checked;
    return persist(
      flagPaymentIssue(o, { reason, notifyCustomer }, terminalId),
      notifyCustomer
        ? "已記錄問題並加入通知客戶隊列"
        : "已記錄問題並保留待處理",
    );
  } else if (a === "reprint") modal = "reprint";
  else if (a === "partial-cancel") {
    cancelMode = true;
    cancelDraft = {};
  } else if (a === "cancel-mode-exit") {
    cancelMode = false;
    cancelDraft = {};
  } else if (a === "cancel-minus") {
    const i = Number(b.dataset.index),
      max = Number(o.items[i]?.qty) || 0;
    cancelDraft[i] = Math.min(max, (cancelDraft[i] || 0) + 1);
  } else if (a === "cancel-plus") {
    const i = Number(b.dataset.index);
    cancelDraft[i] = Math.max(0, (cancelDraft[i] || 0) - 1);
  } else if (a === "cancel-review") modal = "confirm-partial";
  else if (a === "confirm-partial") {
    let updated = o,
      count = 0;
    Object.entries(cancelDraft).forEach(([i, qty]) => {
      if (qty) {
        updated = partiallyCancelItem(updated, Number(i), qty, terminalId);
        count += qty;
      }
    });
    return persist(
      updated,
      orderDisplayNumber(o) + " 已部分取消 " + count + " 件；不會自動打印",
    );
  } else if (a === "confirm-reprint") {
    const docs = [
      ...app.querySelectorAll('input[name="document"]:checked'),
    ].map((x) => x.value);
    if (!docs.length) notice = "請先選擇打印文件";
    else
      return persist(
        queueReprint(o, docs, terminalId),
        orderDisplayNumber(o) + " 已加入打印隊列",
      );
  } else if (a === "cancel-order")
    return persist(
      cancelOrder(o, terminalId),
      "已取消 " + orderDisplayNumber(o) + "，可在歷史訂單查看",
    );
  else if (a === "reuse-order") {
    writeJSON(ORDER_STORAGE_KEY, {
      cart: (o.items || [])
        .filter((x) => x.qty > 0)
        .map((x, i) => ({
          lineId: "reuse-" + o.id + "-" + i,
          productId: x.productId || "",
          name: x.name,
          image: x.image || "",
          qty: x.qty || 1,
          unitPrice: Number(x.total || 0) / Math.max(1, x.qty || 1),
          total: Number(x.total || 0),
          options: x.options || {},
          required: [],
          drinkSlots: 0,
          drinkAssignments: [],
          createdOrder: i,
        })),
      reuse: {
        orderId: o.id,
        startedByTerminalId: terminalId,
        startedAt: Date.now(),
      },
      category: "全部",
    });
    persist(
      cancelOrder({ ...o, status: "reopened" }, terminalId),
      orderDisplayNumber(o) + " 已反結帳並載入點單頁",
    );
    parent.postMessage({ type: "morefun:navigate", route: "order" }, "*");
    return;
  } else if (a === "timeline") modal = "timeline";
  else if (a === "close-modal") modal = "";
  render();
}
app.addEventListener("click", (e) => {
  const choice = e.target.closest("[data-choice]");
  if (choice) {
    app
      .querySelectorAll(`[data-choice="${choice.dataset.choice}"]`)
      .forEach((x) => x.classList.remove("active"));
    choice.classList.add("active");
    return;
  }
  const button = e.target.closest("[data-action]");
  if (button) handle(button);
});
app.addEventListener("change", (e) => {
  const input = e.target.closest("[data-payment-proof]");
  if (!input?.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = () => {
    const order = orders.find((x) => x.id === selectedId);
    if (!order) return;
    orders = orders.map((x) =>
      x.id === order.id
        ? {
            ...order,
            paymentProof: String(reader.result),
            audit: [
              ...(order.audit || []),
              { type: "payment_proof_uploaded", terminalId, at: Date.now() },
            ],
          }
        : x,
    );
    writeJSON(ORDER_HISTORY_STORAGE_KEY, orders);
    notice = orderDisplayNumber(order) + " 已上載付款證明";
    modal = "reconcile";
    render();
  };
  reader.readAsDataURL(input.files[0]);
});
render();
