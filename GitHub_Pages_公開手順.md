# GitHub PagesでHTTPS URLを作る手順

## 目標URL

```text
https://jsawayama.github.io/real-estate-analyzer/
```

## 1. GitHubでリポジトリを作る

- GitHubにログインする
- 右上の `+` を押す
- `New repository` を押す
- Repository name に `real-estate-analyzer` と入力
- `Public` を選ぶ
- `Create repository` を押す

## 2. ファイルをアップロードする

- 作成した `real-estate-analyzer` リポジトリを開く
- `uploading an existing file` を押す
- このフォルダ内のファイル一式をアップロードする
- `Commit changes` を押す

## 3. GitHub Pagesを有効にする

- リポジトリ上部の `Settings` を押す
- 左メニューの `Pages` を押す
- `Build and deployment` の `Source` を `Deploy from a branch` にする
- `Branch` を `main` にする
- フォルダは `/ (root)` を選ぶ
- `Save` を押す

## 4. 公開URLを確認する

- 数分待つ
- `Pages` 画面に表示されるURLを開く
- 通常は次のURLになります

```text
https://jsawayama.github.io/real-estate-analyzer/
```

## 5. スマホに入れる

### Android

- Chromeで公開URLを開く
- 右上のメニューを押す
- `アプリをインストール` または `ホーム画面に追加` を押す

### iPhone

- Safariで公開URLを開く
- 共有ボタンを押す
- `ホーム画面に追加` を押す

## 注意

- GitHub PagesではPythonバックエンドは動きません
- そのため、国土交通省APIの実データ接続はRenderなどのサーバー公開に移す必要があります
- スマホにホーム画面追加する目的なら、GitHub PagesのHTTPS URLで対応できます
