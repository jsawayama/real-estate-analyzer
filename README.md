# 不動産投資アナライザー

東京主要区のマーケット確認、国土交通省API連携、収益シミュレーターをまとめたWebアプリです。

## 実行

国土交通省 不動産情報ライブラリ API を使う場合は、先にAPI利用申請を行い、発行されたキーを環境変数に設定します。

```powershell
$env:REINFOLIB_API_KEY="発行されたAPIキー"
& "C:\Users\sawayamajunichi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" server.py
```

ブラウザで `http://localhost:4175` を開きます。

## テスト

```powershell
npm test
```

Node.js 標準の `node:test` で収益計算ロジックを検証します。

## 実装範囲

- 国土交通省 不動産情報ライブラリ API のサーバー側プロキシ
- 市区町村一覧、不動産価格、鑑定評価書情報の取得口
- APIキーをブラウザに出さない構成
- OpenStreetMapタイルを使った実座標ベースの地図表示
- 物件地点をGoogleマップで開くリンク
- エリア別マーケット表示と物件ピン
- 専門用語のタップ/ホバー解説
- PWA対応。スマートフォンのホーム画面に追加できます。
- 間取り、賃料、築年数、駅徒歩によるフィルター
- 地価推移グラフと比較表示
- 表面利回り、実質利回り、NOI、CF、CCR、DCR、元利均等返済
- 空室率と金利の感度分析
- CSV出力、印刷/PDF保存

## API接続の方針

国土交通省APIはブラウザから直接呼びません。`server.py` が `Ocp-Apim-Subscription-Key` ヘッダーを付けてAPIを呼び、30分キャッシュします。

家賃相場は不動産情報ライブラリ単体では直接取得できないため、実運用では民間賃貸API、社内データ、CSV取り込みのいずれかが必要です。

公示地価、基準地価、路線価は年次更新のため、UI上ではリアルタイムではなく「データ更新日つきの公的統計」として扱います。

## 地図連携

現在の画面内地図は OpenStreetMap の地図タイルを使い、物件ピンは緯度経度で配置しています。各物件の詳細から Googleマップを開けます。

Google Maps JavaScript API をアプリ内に直接埋め込む場合は、Google Maps Platform のAPIキーと課金設定が必要です。実装時はブラウザ用APIキーにHTTPリファラー制限を設定してください。

## 専門用語ヘルプ

画面内の専門用語には小さな `?` が付きます。PCではマウスを重ねると説明が出ます。スマートフォンでは用語をタップすると説明が出ます。

## スマートフォンへの追加

このアプリはPWAとして動作します。

Android Chromeでは、ブラウザメニューから「ホーム画面に追加」または「アプリをインストール」を選びます。

iPhone Safariでは、共有ボタンから「ホーム画面に追加」を選びます。

App StoreやGoogle Playで配布するネイティブアプリにする場合は、React Native / Expo または Flutter への移植、ストア審査、署名、配布設定が別途必要です。

## 公式情報

- 不動産情報ライブラリ API操作説明: https://www.reinfolib.mlit.go.jp/help/apiManual/
- XIT001 不動産価格情報取得API: https://www.reinfolib.mlit.go.jp/help/apiManual/xit001/
- XIT002 都道府県内市区町村一覧取得API: https://www.reinfolib.mlit.go.jp/help/apiManual/xit002/
- XCT001 鑑定評価書情報API: https://www.reinfolib.mlit.go.jp/help/apiManual/xct001/
- Google Maps URLs: https://developers.google.com/maps/documentation/urls/guide
- Google Maps JavaScript API Usage and Billing: https://developers.google.com/maps/documentation/javascript/usage-and-billing
- OpenStreetMap Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
