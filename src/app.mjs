import { layouts, wards, propertySamples, years } from "./data.mjs";
import {
  buildInvestmentComment,
  calculateInvestmentMetrics,
  round
} from "./calculations.mjs";

const state = {
  ward: "all",
  station: "all",
  layouts: new Set(["1K", "1DK", "1LDK"]),
  rentMax: 240000,
  ageMax: 25,
  walkMax: 12,
  selectedPropertyId: null,
  live: {
    loading: true,
    apiKeyConfigured: false,
    message: "接続確認中です",
    transactions: [],
    appraisals: [],
    updatedAt: null
  },
  simulator: {
    purchasePrice: 30000000,
    purchaseCosts: 1800000,
    equity: 7500000,
    loanPrincipal: 24000000,
    annualInterestRatePct: 1.7,
    loanYears: 35,
    monthlyRent: 120000,
    occupancyRatePct: 94,
    operatingExpenses: 260000
  }
};

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

const compactYen = (value) => `${Math.round(value / 10000).toLocaleString("ja-JP")}万円`;
const pct = (value) => Number.isFinite(value) ? `${round(value, 2).toFixed(2)}%` : "-";

const q = (selector) => document.querySelector(selector);
const mapZoom = 12;
const glossaryTerms = {
  "表面利回り": "英: Gross yield。家賃だけで見るざっくり収益率。経費やローン返済は含みません。",
  "実質利回り": "英: Net yield。家賃から経費を引いて見る、現実に近い収益率です。",
  "NOI": "英: Net Operating Income。家賃収入から運営費を引いた利益です。ローン返済前の数字です。",
  "年間CF": "英: Annual cash flow。1年間で最終的に手元に残るお金です。",
  "CF": "英: Cash flow。お金の出入り。ここではローン返済後に残るお金です。",
  "CCR": "英: Cash on Cash Return。自分で出したお金に対するリターン率です。",
  "DCR": "英: Debt Coverage Ratio。ローン返済にどれだけ余裕があるかを示します。1.2未満は注意です。",
  "ローン": "英: Loan。銀行などから借りるお金です。",
  "元利均等返済": "英: Level payment。毎月の返済額がほぼ同じになるローン返済方法です。",
  "金利": "英: Interest rate。借りたお金にかかる利息の割合です。",
  "返済期間": "英: Loan term。ローンを何年で返すかです。",
  "自己資本": "英: Equity。自分で用意するお金です。頭金に近い意味です。",
  "借入金額": "英: Loan amount。銀行などから借りる金額です。",
  "購入諸費用": "英: Purchase costs。物件価格とは別にかかる手数料や税金などです。",
  "年間運営費": "英: Operating expenses。管理費、修繕費、税金など毎年かかる費用です。",
  "稼働率": "英: Occupancy rate。部屋が埋まっている割合です。低いほど空室が多い状態です。",
  "空室率": "英: Vacancy rate。部屋が空いている割合です。高いほど家賃収入が減ります。",
  "感度分析": "英: Sensitivity analysis。金利や空室が変わった時に結果がどう変わるかを見る表です。",
  "家賃相場": "英: Rent market price。地域や間取りごとの家賃の目安です。",
  "地価": "英: Land price。土地の価格です。",
  "路線価": "英: Roadside land value。相続税などの計算に使われる道路沿いの土地評価額です。",
  "ヒートマップ": "英: Heatmap。数値の高低を色の濃さで見せる地図です。",
  "ピン": "英: Map pin。地図上の物件や地点を示す印です。",
  "間取り": "英: Floor plan。1K、1LDKなど部屋の構成です。",
  "専有面積": "英: Private floor area。自分が使える部屋部分の広さです。",
  "築年数": "英: Building age。建物が建ってから何年たったかです。",
  "駅徒歩": "英: Walking minutes from station。駅から歩いて何分かの目安です。",
  "CSV": "英: Comma-Separated Values。Excelなどで開ける表データ形式です。",
  "PDF": "英: Portable Document Format。印刷しやすい文書ファイル形式です。",
  "API": "英: Application Programming Interface。他のサービスからデータを受け取るための窓口です。",
  "APIキー": "英: API key。APIを使うための合言葉のような文字列です。公開してはいけません。",
  "PWA": "英: Progressive Web App。Webサイトをスマホアプリのようにホーム画面へ追加できる仕組みです。",
  "国土交通省": "英: Ministry of Land, Infrastructure, Transport and Tourism。日本の土地や不動産情報を扱う省庁です。",
  "不動産情報ライブラリ": "国土交通省が提供する、不動産や地価などの公開情報サービスです。",
  "取引価格情報": "実際に売買された不動産価格の公的な調査情報です。リアルタイムではありません。",
  "鑑定評価書": "専門家が土地などの価値を評価した資料です。"
};
const glossaryMatcher = new RegExp(Object.keys(glossaryTerms).sort((a, b) => b.length - a.length).map(escapeRegExp).join("|"), "g");
let glossaryQueued = false;

function init() {
  renderFilters();
  renderSimulatorInputs();
  renderAll();
  bindActions();
  window.addEventListener("resize", () => renderMap());
  bindGlossaryInteractions();
  registerServiceWorker();
  refreshLiveData();
}

function renderAll() {
  renderFilterLabels();
  renderMap();
  renderPropertyDetail();
  renderMetrics();
  renderLandTrend();
  renderSensitivity();
  renderLiveData();
  queueGlossaryEnhance();
}

async function refreshLiveData() {
  state.live.loading = true;
  renderLiveData();
  try {
    const health = await fetchJson("/api/health");
    state.live.apiKeyConfigured = Boolean(health.apiKeyConfigured);
    if (!health.apiKeyConfigured) {
      state.live.loading = false;
      state.live.message = "APIキー未設定です。server.py に REINFOLIB_API_KEY を設定すると実データ取得に切り替わります。";
      state.live.transactions = [];
      state.live.appraisals = [];
      renderLiveData();
      return;
    }

    const ward = state.ward === "all"
      ? wards.find((item) => item.id === "shinjuku")
      : wards.find((item) => item.id === state.ward);
    const city = ward?.code || "13104";
    const [transactions, appraisals] = await Promise.all([
      fetchJson(`/api/transactions?priceClassification=01&year=2025&quarter=4&area=13&city=${city}&language=ja`),
      fetchJson("/api/appraisals?year=2026&area=13&division=00&language=ja")
    ]);
    state.live.loading = false;
    state.live.message = `${ward?.name || "新宿区"}の不動産取引価格情報と、東京都の住宅地鑑定評価書情報を取得しました。`;
    state.live.transactions = transactions.data || [];
    state.live.appraisals = appraisals.data || [];
    state.live.updatedAt = new Date();
  } catch (error) {
    state.live.loading = false;
    state.live.message = error.message;
    state.live.transactions = [];
    state.live.appraisals = [];
  }
  renderLiveData();
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function queueGlossaryEnhance() {
  if (glossaryQueued) return;
  glossaryQueued = true;
  requestAnimationFrame(() => {
    glossaryQueued = false;
    enhanceGlossary(q(".workspace"));
  });
}

function enhanceGlossary(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !glossaryMatcher.test(node.nodeValue)) {
        glossaryMatcher.lastIndex = 0;
        return NodeFilter.FILTER_REJECT;
      }
      glossaryMatcher.lastIndex = 0;
      const parent = node.parentElement;
      if (!parent || parent.closest("button, a, input, select, textarea, script, style, .term-help")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const fragment = document.createDocumentFragment();
    const text = node.nodeValue;
    let lastIndex = 0;
    text.replace(glossaryMatcher, (match, offset) => {
      if (offset > lastIndex) fragment.append(document.createTextNode(text.slice(lastIndex, offset)));
      fragment.append(createTermHelp(match));
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) fragment.append(document.createTextNode(text.slice(lastIndex)));
    node.replaceWith(fragment);
    glossaryMatcher.lastIndex = 0;
  });
}

function createTermHelp(term) {
  const wrapper = document.createElement("span");
  wrapper.className = "term-help";
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "button");
  wrapper.setAttribute("aria-label", `${term}の説明`);
  wrapper.dataset.term = term;
  wrapper.innerHTML = `${term}<span class="term-mark" aria-hidden="true">?</span><span class="term-tooltip">${glossaryTerms[term]}</span>`;
  return wrapper;
}

function bindGlossaryInteractions() {
  document.addEventListener("click", (event) => {
    const term = event.target.closest(".term-help");
    document.querySelectorAll(".term-help.open").forEach((item) => {
      if (item !== term) item.classList.remove("open");
    });
    if (!term) return;
    term.classList.toggle("open");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll(".term-help.open").forEach((item) => item.classList.remove("open"));
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderFilters() {
  const wardSelect = q("#ward-filter");
  wardSelect.innerHTML = `<option value="all">全エリア</option>` +
    wards.map((ward) => `<option value="${ward.id}">${ward.name}</option>`).join("");
  wardSelect.value = state.ward;

  const stationSelect = q("#station-filter");
  stationSelect.innerHTML = `<option value="all">全駅</option>` +
    wards.map((ward) => `<option value="${ward.station}">${ward.station}</option>`).join("");

  const layoutFilter = q("#layout-filter");
  layoutFilter.innerHTML = layouts.map((layout) => `
    <button type="button" class="${state.layouts.has(layout) ? "active" : ""}" data-layout="${layout}">
      ${layout}
    </button>
  `).join("");

  wardSelect.addEventListener("change", (event) => {
    state.ward = event.target.value;
    state.selectedPropertyId = null;
    renderAll();
    refreshLiveData();
  });
  stationSelect.addEventListener("change", (event) => {
    state.station = event.target.value;
    state.selectedPropertyId = null;
    renderAll();
  });
  layoutFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-layout]");
    if (!button) return;
    const layout = button.dataset.layout;
    if (state.layouts.has(layout)) {
      if (state.layouts.size > 1) state.layouts.delete(layout);
    } else {
      state.layouts.add(layout);
    }
    renderFilters();
    renderAll();
  });

  [
    ["#rent-max", "rentMax"],
    ["#age-max", "ageMax"],
    ["#walk-max", "walkMax"]
  ].forEach(([selector, key]) => {
    q(selector).addEventListener("input", (event) => {
      state[key] = Number(event.target.value);
      state.selectedPropertyId = null;
      renderAll();
    });
  });
}

function renderFilterLabels() {
  q("#rent-max").value = state.rentMax;
  q("#age-max").value = state.ageMax;
  q("#walk-max").value = state.walkMax;
  q("#rent-max-label").textContent = compactYen(state.rentMax);
  q("#age-max-label").textContent = `${state.ageMax}年`;
  q("#walk-max-label").textContent = `${state.walkMax}分`;
}

function getFilteredProperties() {
  return propertySamples.filter((property) => {
    const ward = wards.find((item) => item.id === property.wardId);
    return (state.ward === "all" || property.wardId === state.ward) &&
      (state.station === "all" || ward.station === state.station) &&
      state.layouts.has(property.layout) &&
      property.rent <= state.rentMax &&
      property.age <= state.ageMax &&
      property.walk <= state.walkMax;
  });
}

function renderMap() {
  const map = q("#rent-map");
  const filtered = getFilteredProperties();
  const selectedWard = state.ward === "all" ? null : state.ward;
  const activeWard = selectedWard ? wards.find((ward) => ward.id === selectedWard) : null;
  const center = activeWard ? { lat: activeWard.lat, lng: activeWard.lng } : { lat: 35.6812, lng: 139.7671 };
  const width = map.clientWidth || 760;
  const height = map.clientHeight || 470;
  const topLeft = getTopLeftWorld(center, width, height, mapZoom);
  const allRents = wards.flatMap((ward) => Object.values(ward.rent));
  const minRent = Math.min(...allRents);
  const maxRent = Math.max(...allRents);

  const tiles = wards.map((ward) => {
    const activeLayouts = [...state.layouts];
    const avgRent = activeLayouts.reduce((sum, layout) => sum + ward.rent[layout], 0) / activeLayouts.length;
    const heat = (avgRent - minRent) / (maxRent - minRent);
    const intensity = Math.round(heat * 100);
    const active = selectedWard === null || selectedWard === ward.id;
    const point = latLngToScreen(ward.lat, ward.lng, topLeft, mapZoom);
    return `
      <button class="heat-tile ${active ? "" : "muted"}" data-ward="${ward.id}"
        style="left:${point.x - 54}px; top:${point.y - 31}px; --heat:${intensity}%"
        aria-label="${ward.name} ${compactYen(avgRent)}">
        <strong>${ward.name}</strong>
        <span>${compactYen(avgRent)}</span>
      </button>
    `;
  }).join("");

  const pins = filtered.map((property) => {
    const point = latLngToScreen(property.lat, property.lng, topLeft, mapZoom);
    return `
      <button class="pin ${state.selectedPropertyId === property.id ? "selected" : ""}"
        data-property="${property.id}"
        style="left:${point.x}px; top:${point.y}px"
        aria-label="${property.id} ${property.layout} ${yen.format(property.rent)}">
        <span></span>
      </button>
    `;
  }).join("");

  map.innerHTML = `
    <div class="tile-layer" aria-hidden="true">${renderTileLayer(center, width, height, mapZoom)}</div>
    ${tiles}
    ${pins}
    <div class="map-provider">
      <a href="${googleMapsUrl(center.lat, center.lng)}" target="_blank" rel="noopener">Google Maps</a>
    </div>
    <div class="map-legend">
      <span>低</span>
      <i></i>
      <span>高</span>
    </div>
  `;
  q("#result-count").textContent = `${filtered.length}件`;

  map.querySelectorAll("[data-ward]").forEach((button) => {
    button.addEventListener("click", () => {
      state.ward = button.dataset.ward;
      q("#ward-filter").value = state.ward;
      renderAll();
    });
  });
  map.querySelectorAll("[data-property]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPropertyId = button.dataset.property;
      renderMap();
      renderPropertyDetail();
    });
  });
}

function renderTileLayer(center, width, height, zoom) {
  const topLeft = getTopLeftWorld(center, width, height, zoom);
  const firstTileX = Math.floor(topLeft.x / 256);
  const firstTileY = Math.floor(topLeft.y / 256);
  const lastTileX = Math.floor((topLeft.x + width) / 256);
  const lastTileY = Math.floor((topLeft.y + height) / 256);
  const maxTile = 2 ** zoom;
  const tiles = [];
  for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
    for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
      if (tileY < 0 || tileY >= maxTile) continue;
      const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;
      tiles.push(`
        <img class="map-tile"
          src="https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png"
          style="left:${tileX * 256 - topLeft.x}px; top:${tileY * 256 - topLeft.y}px"
          alt="">
      `);
    }
  }
  return `${tiles.join("")}<a class="osm-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>`;
}

function getTopLeftWorld(center, width, height, zoom) {
  const centerPoint = project(center.lat, center.lng, zoom);
  return {
    x: centerPoint.x - width / 2,
    y: centerPoint.y - height / 2
  };
}

function latLngToScreen(lat, lng, topLeft, zoom) {
  const point = project(lat, lng, zoom);
  return {
    x: point.x - topLeft.x,
    y: point.y - topLeft.y
  };
}

function project(lat, lng, zoom) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  };
}

function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function renderPropertyDetail() {
  const detail = q("#property-detail");
  const filtered = getFilteredProperties();
  const selected = propertySamples.find((property) => property.id === state.selectedPropertyId) || filtered[0];
  if (!selected) {
    detail.innerHTML = `<p class="empty">条件に一致する物件がありません。</p>`;
    return;
  }
  const ward = wards.find((item) => item.id === selected.wardId);
  detail.innerHTML = `
    <div>
      <p class="eyebrow">Property sample</p>
      <h3>${selected.id} / ${ward.name}</h3>
    </div>
    <dl>
      <div><dt>間取り</dt><dd>${selected.layout}</dd></div>
      <div><dt>専有面積</dt><dd>${selected.area}平米</dd></div>
      <div><dt>賃料</dt><dd>${yen.format(selected.rent)}</dd></div>
      <div><dt>築年数</dt><dd>${selected.age}年</dd></div>
      <div><dt>駅徒歩</dt><dd>${selected.walk}分</dd></div>
    </dl>
    <a class="map-link" href="${googleMapsUrl(selected.lat, selected.lng)}" target="_blank" rel="noopener">Googleマップでこの地点を開く</a>
  `;
}

const simFields = [
  ["purchasePrice", "物件価格", 10000000, 120000000, 1000000, "yen"],
  ["purchaseCosts", "購入諸費用", 0, 8000000, 100000, "yen"],
  ["equity", "自己資本", 1000000, 60000000, 500000, "yen"],
  ["loanPrincipal", "借入金額", 0, 100000000, 500000, "yen"],
  ["annualInterestRatePct", "金利", 0, 6, 0.1, "pct"],
  ["loanYears", "返済期間", 1, 45, 1, "year"],
  ["monthlyRent", "月額家賃", 40000, 600000, 10000, "yen"],
  ["occupancyRatePct", "稼働率", 70, 100, 1, "pct"],
  ["operatingExpenses", "年間運営費", 0, 4000000, 50000, "yen"]
];

function renderSimulatorInputs() {
  q("#sim-inputs").innerHTML = simFields.map(([key, label, min, max, step, unit]) => `
    <label class="sim-field">
      <span>${label}</span>
      <input class="sim-number" data-sim-number="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${state.simulator[key]}">
      <input class="sim-range" data-sim-range="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state.simulator[key]}">
      <small data-sim-label="${key}">${formatUnit(state.simulator[key], unit)}</small>
    </label>
  `).join("");

  q("#sim-inputs").addEventListener("input", (event) => {
    const key = event.target.dataset.simNumber || event.target.dataset.simRange;
    if (!key) return;
    state.simulator[key] = Number(event.target.value);
    syncSimulatorField(key);
    renderMetrics();
    renderSensitivity();
  });
}

function syncSimulatorField(key) {
  document.querySelectorAll(`[data-sim-number="${key}"], [data-sim-range="${key}"]`).forEach((input) => {
    input.value = state.simulator[key];
  });
  const field = simFields.find((item) => item[0] === key);
  q(`[data-sim-label="${key}"]`).textContent = formatUnit(state.simulator[key], field[5]);
}

function formatUnit(value, unit) {
  if (unit === "yen") return compactYen(value);
  if (unit === "pct") return `${value}%`;
  return `${value}年`;
}

function renderMetrics() {
  try {
    const metrics = calculateInvestmentMetrics(state.simulator);
    const cards = [
      ["表面利回り", pct(metrics.grossYield), "年間家賃収入 ÷ 物件価格"],
      ["実質利回り", pct(metrics.netYield), "税引き前、運営費控除後"],
      ["NOI", compactYen(metrics.noi), "年間家賃 x 稼働率 - 運営費"],
      ["年間CF", compactYen(metrics.annualCashFlow), "NOI - 年間返済額"],
      ["CCR", pct(metrics.ccr), "年間CF ÷ 自己資本"],
      ["DCR", Number.isFinite(metrics.dcr) ? round(metrics.dcr, 2).toFixed(2) : "-", "NOI ÷ 年間返済額"],
      ["月次返済", yen.format(metrics.monthlyLoanPayment), "元利均等返済"]
    ];
    q("#metrics").innerHTML = cards.map(([label, value, help]) => `
      <article class="metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${help}</small>
      </article>
    `).join("");
    q("#investment-grade").textContent = buildInvestmentComment(metrics);
    q("#investment-grade").className = `grade ${metrics.dcr < 1.2 || metrics.annualCashFlow < 0 ? "warn" : "good"}`;
  } catch (error) {
    q("#metrics").innerHTML = `<p class="empty">${error.message}</p>`;
    q("#investment-grade").textContent = "入力値を確認";
    q("#investment-grade").className = "grade warn";
  }
  queueGlossaryEnhance();
}

function renderLiveData() {
  const badge = q("#live-badge");
  const status = q("#api-status");
  const summary = q("#live-summary");
  const table = q("#live-table");
  if (!badge || !summary || !table) return;

  if (state.live.loading) {
    badge.textContent = "取得中";
    status.textContent = "実API確認中";
    summary.innerHTML = `<p>国土交通省APIへの接続状態を確認しています。</p>`;
    table.innerHTML = "";
    queueGlossaryEnhance();
    return;
  }

  if (!state.live.apiKeyConfigured) {
    badge.textContent = "設定待ち";
    status.textContent = "APIキー未設定";
    summary.innerHTML = `
      <p><strong>実アプリとして使うにはAPIキーが必要です。</strong></p>
      <p>不動産情報ライブラリのAPI利用申請後、サーバー起動前に <code>REINFOLIB_API_KEY</code> を設定してください。APIキーはブラウザ側には出しません。</p>
      <p>家賃相場は公的APIだけでは直接取得できないため、民間賃貸APIまたは自社CSV取り込みの接続が必要です。</p>
    `;
    table.innerHTML = "";
    queueGlossaryEnhance();
    return;
  }

  badge.textContent = "接続済み";
  status.textContent = "国交省API接続済み";
  const count = state.live.transactions.length;
  const appraisalCount = state.live.appraisals.length;
  summary.innerHTML = `
    <p><strong>${count}件</strong> の不動産取引価格情報、<strong>${appraisalCount}件</strong> の鑑定評価書情報を取得しました。</p>
    <p>${escapeHtml(state.live.message)}</p>
    <p>出典: 国土交通省 不動産情報ライブラリ。取得データは加工して表示しています。</p>
  `;

  const rows = state.live.transactions.slice(0, 12).map((record) => {
    const municipality = record.Municipality || record.municipality || "";
    const district = record.DistrictName || record.districtName || "";
    const type = record.Type || record.type || "";
    const price = Number(record.TradePrice || record.tradePrice || 0);
    const area = record.Area || record.area || "";
    const period = record.Period || record.period || record.TradePeriod || "";
    return `
      <tr>
        <td>${escapeHtml(municipality)}</td>
        <td>${escapeHtml(district)}</td>
        <td>${escapeHtml(type)}</td>
        <td class="number">${price ? yen.format(price) : "-"}</td>
        <td class="number">${escapeHtml(area)}</td>
        <td>${escapeHtml(period)}</td>
      </tr>
    `;
  }).join("");
  table.innerHTML = rows
    ? `<table><thead><tr><th>市区町村</th><th>地区</th><th>種類</th><th>取引価格</th><th>面積</th><th>時期</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p class="empty" style="padding:12px">指定条件ではデータがありません。年・四半期・エリア条件を変えてください。</p>`;
  queueGlossaryEnhance();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function renderLandTrend() {
  const selected = state.ward === "all" ? wards.slice(0, 3) : wards.filter((ward) => ward.id === state.ward);
  const values = selected.flatMap((ward) => ward.land);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 720;
  const height = 280;
  const pad = 36;
  const colors = ["#0f766e", "#b45309", "#4f46e5"];
  const polylines = selected.map((ward, index) => {
    const points = ward.land.map((value, i) => {
      const x = pad + (i / (years.length - 1)) * (width - pad * 2);
      const y = height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2);
      return `${x},${y}`;
    }).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${colors[index]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
  }).join("");
  const yearLabels = years.map((year, i) => {
    const x = pad + (i / (years.length - 1)) * (width - pad * 2);
    return `<text x="${x}" y="${height - 8}" text-anchor="middle">${year}</text>`;
  }).join("");
  q("#land-chart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" />
      ${polylines}
      ${yearLabels}
    </svg>
  `;
  q("#trend-list").innerHTML = selected.map((ward, index) => {
    const first = ward.land[0];
    const last = ward.land.at(-1);
    const change = ((last - first) / first) * 100;
    return `
      <article>
        <i style="background:${colors[index]}"></i>
        <h3>${ward.name}</h3>
        <p>${last}万円/坪</p>
        <strong>${pct(change)}</strong>
      </article>
    `;
  }).join("");
}

function renderSensitivity() {
  const base = state.simulator;
  const vacancyRates = [5, 10, 15, 20, 25];
  const rates = [1.0, 1.5, 2.0, 2.5, 3.0];
  const rows = vacancyRates.map((vacancy) => {
    const cells = rates.map((rate) => {
      const metrics = calculateInvestmentMetrics({
        ...base,
        annualInterestRatePct: rate,
        occupancyRatePct: 100 - vacancy
      });
      const tone = metrics.annualCashFlow < 0 ? "bad" : metrics.dcr < 1.2 ? "mid" : "good";
      return `<td class="${tone}">${compactYen(metrics.annualCashFlow)}</td>`;
    }).join("");
    return `<tr><th>${vacancy}%</th>${cells}</tr>`;
  }).join("");
  q("#sensitivity-chart").innerHTML = `
    <table>
      <caption>年間CFの変動</caption>
      <thead><tr><th>空室率＼金利</th>${rates.map((rate) => `<th>${rate}%</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function bindActions() {
  q("#reset-filters").addEventListener("click", () => {
    state.ward = "all";
    state.station = "all";
    state.layouts = new Set(["1K", "1DK", "1LDK"]);
    state.rentMax = 240000;
    state.ageMax = 25;
    state.walkMax = 12;
    state.selectedPropertyId = null;
    renderFilters();
    renderAll();
  });
  q("#export-csv").addEventListener("click", () => {
    const metrics = calculateInvestmentMetrics(state.simulator);
    const rows = [
      ["項目", "値"],
      ["表面利回り", pct(metrics.grossYield)],
      ["実質利回り", pct(metrics.netYield)],
      ["NOI", Math.round(metrics.noi)],
      ["年間CF", Math.round(metrics.annualCashFlow)],
      ["CCR", pct(metrics.ccr)],
      ["DCR", Number.isFinite(metrics.dcr) ? round(metrics.dcr, 2) : ""]
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "investment-simulation.csv";
    link.click();
    URL.revokeObjectURL(url);
  });
  q("#print-report").addEventListener("click", () => window.print());
}

init();
