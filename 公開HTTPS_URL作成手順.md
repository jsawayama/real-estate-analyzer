# 公開HTTPS URL作成手順

## 目的

スマホにホーム画面追加できるように、アプリを `https://...` の公開URLで見られる状態にします。

## Renderで公開する手順

- GitHubアカウントを用意する
- このアプリ一式をGitHubリポジトリにアップロードする
- Renderにログインする
- `New` から `Blueprint` または `Web Service` を選ぶ
- GitHubリポジトリを選ぶ
- `render.yaml` を使ってサービスを作成する
- 環境変数 `REINFOLIB_API_KEY` に、国土交通省 不動産情報ライブラリAPIキーを設定する
- デプロイを実行する
- Renderが発行する `https://サービス名.onrender.com` のURLを開く
- スマホでそのURLを開き、ホーム画面に追加する

## 公開時の注意

- APIキーは画面側に書かない
- APIキーはRenderの環境変数にだけ設定する
- 公開URLはHTTPSであることを確認する
- 不動産情報ライブラリの利用規約とクレジット表示を確認する
- Google Mapsをアプリ内に埋め込む場合はGoogle Maps PlatformのAPIキーと請求設定が必要

## App Store配布手順

- Apple Developer Programに登録する
- iPhoneアプリ化の方式を決める
- PWAをそのまま使う場合は、App Store配布ではなくSafariの「ホーム画面に追加」を使う
- App Storeに出す場合は、React Native / Expo または Flutter などでネイティブアプリ化する
- XcodeでiOSアプリをビルドする
- Bundle ID、アプリアイコン、アプリ名、権限説明を設定する
- App Store Connectで新規アプリを作成する
- スクリーンショット、説明文、プライバシーポリシーURL、サポートURLを登録する
- TestFlightで内部テストを行う
- App Reviewに提出する
- 審査通過後、公開日を設定してリリースする

## Google Play配布手順

- Google Play Consoleの開発者アカウントを作成する
- Androidアプリ化の方式を決める
- PWAを使う場合はTrusted Web Activity、またはCapacitorなどでAndroidアプリ化する
- Android Studioで署名付きAABファイルを作成する
- Play Consoleで新規アプリを作成する
- アプリ名、説明文、カテゴリ、連絡先、プライバシーポリシーURLを登録する
- データセーフティ、コンテンツレーティング、対象ユーザーを設定する
- スクリーンショットとアプリアイコンを登録する
- 内部テストまたはクローズドテストを行う
- 製品版リリースを作成する
- Googleの審査通過後、公開する
