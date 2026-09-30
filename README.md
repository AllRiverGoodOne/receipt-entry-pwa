# iPhone領収書入力PWA

## iPhoneでの利用

本番PWAはGitHub Pagesから公開する。

- 公開予定URL：`https://allrivergoodone.github.io/receipt-entry-pwa/`
- GitHubリポジトリ：`receipt-entry-pwa`（公開）
- Pagesサイト：公開HTTPS

Safariで公開URLを開いてホーム画面へ追加する。初回読み込み後は、Service Workerによりアプリ本体をiPhone内へ保持する。通常利用ではPC上の配信サーバーを使用しない。

GitHub Pagesには `pwa-apps.json` で許可したPWA実行ファイルだけを公開する。仕様書、証明書、テスト、配信スクリプトはPagesサイトへ含めない。

## PCブラウザでのローカル起動

このフォルダで次を実行する。

```powershell
python -m http.server 4173
```

PCブラウザでは `http://localhost:4173/` を開く。Service Workerとホーム画面追加はHTTPSまたはlocalhostで確認する。

## 自動テスト

```powershell
npm test
npm run build
```

## 現在の範囲

- 読み取りショートカットとのx-callback-url往復
- JSONとMarkdownコードフェンス付きJSONの解析
- 領収書内容、税率別明細、勘定科目、取引先の編集
- 過去データに基づく候補表示
- 必須項目と明細合計の検証
- 編集中データの端末内保持
- 保存ショートカットへの確定JSON受け渡し
- Web App ManifestとService Worker

OneDrive保存、PC停止後の起動、ホーム画面からショートカットへの往復は、公開後にiPhone実機で確認する。
