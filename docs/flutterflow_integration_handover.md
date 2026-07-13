# 共有用ドキュメント：Webアプリ（カメラ機能）のFlutterFlow統合について

本番環境のNext.jsアプリ（HTTPS / Firebase Hosting等）内でカメラ機能を動作させるため、FlutterFlow側で以下のいずれかのアプローチによる実装をお願いします。

標準のWebViewウィジェットはセキュリティ仕様上、Web側からのカメラアクセス要求（getUserMedia）を自動でネイティブの権限リクエストに変換しないため、カメラが起動しません。これを解決するための3つの選択肢と、それぞれの制約・回避策をまとめました。

---

## 1. 統合アプローチと制約事項

### アプローチ1：カスタムWebViewウィジェット（アプリ内完結）
`flutter_inappwebview` パッケージを利用し、権限要求をプログラムで明示的に許可するカスタムウィジェットを作成してNext.jsを読み込みます。最もシームレスなUXを提供できるため、予算が許すならこの方法が第一候補です。

**実装方法:**
1. Custom Widgetを作成し、Pubspec Dependenciesに `flutter_inappwebview` と `permission_handler` を追加。
2. Widgetのコード内で `onPermissionRequest` をフックし、`PermissionResponseAction.GRANT` を返す処理を記述する。
3. 「App Details > Permissions」でネイティブのカメラ権限（iOS/Android）をオンにする。

> [!IMPORTANT]
> **前提条件:** このアプローチを実装するには、Pubspec Dependenciesを利用するため**有料プラン（Standard以上）への加入**が必要です。

### アプローチ2：標準ブラウザ遷移 ＋ Deep Link（自動帰還）
WebViewを諦め、OSの標準ブラウザ（Safari/Chrome）でNext.jsを開き、処理完了後にURLスキームを用いてFlutterFlowアプリに自動で戻す方法です。

**実装方法:**
1. 対象のボタンに **Launch URL** アクションを設定し、Next.jsのURLを開く。
2. FlutterFlowの「App Settings > Routing & Deep Linking」でカスタムURLスキーム（例: `myapp://`）を設定。
3. Next.js側で処理完了時、JavaScriptで `window.location.href = "myapp://myapp.com/home"` のようにリダイレクトを実行し、アプリを前面に呼び戻す。

> [!NOTE]
> **StudyHelper（Web開発側）への連携について:**
> このアプローチを採用する場合、FlutterFlow側で設定した **Deep LinkのURL** を事前にStudyHelper（Web開発チーム）までお伝えください。Next.jsアプリ側にリダイレクト処理として組み込みます。（※あるいは、事前の組み込みではなくURLパラメータの１つとして `deeplink=myapp://...` のように引き渡す仕様にご調整いただくことも可能です）

> [!IMPORTANT]
> **前提条件:** App Settingsから「Routing & Deep Linking」を設定するため、**有料プランへの加入**が必要です。

> [!NOTE]
> **UXの仕様:** Webからアプリに戻る際、OSレベルで「"〇〇"で開きますか？」という確認ダイアログが必ず表示されます。

### アプローチ3：標準ブラウザ遷移（手動帰還）
最もシンプルで、FlutterFlow側の技術的ハードルがゼロの方法です。ブラウザで開きっぱなしにし、ユーザー自身にアプリへ戻ってもらいます。
プランの制約に関係なく実装可能です。

**実装方法:**
1. 対象のボタンに **Launch URL** アクションを設定し、Next.jsのURLを開く。

> [!WARNING]
> **制約事項:** Next.js側でカメラを使った処理が終わった後、ユーザーはブラウザ画面に取り残されます。自分でタスク切り替え（またはiOS左上の「戻る」ボタン）を使ってアプリに戻る必要があります。

> [!TIP]
> **回避策:** Next.js側の完了画面のUIを工夫し、「処理が完了しました。この画面を閉じて、アプリに戻ってください」と視覚的に大きく誘導する。

---

## 2. Next.js側（Webエンジニア）からの見解

Web側のカメラ処理自体はHTTPS環境で正常に動作しています。  
アプローチ1および2はFlutterFlowの有料プランが前提条件となります。

状況に合わせて、**有料プランであれば「アプローチ1」**、**そうでない場合は「アプローチ3」**等をご選択いただき実装をお願いします。

---

## 3. Webアプリ呼び出し時の技術仕様 (URLパラメータ等)

FlutterFlowの上記どのアプローチを採用する場合でも、Webアプリ（Next.js）を開く際（Launch URL 等）に以下のパラメータを引き渡す必要があります。

**ベースURL:** `https://spiral-turn-footcalc.web.app/`

### 必須のQueryパラメータ
FlutterFlowからの遷移であることを明示し、撮影画像の紐付けを行うために以下のパラメータを含むURLを生成してください。

*   `from=ff`
    *   このパラメータがある場合、Next.js側は「FlutterFlowからのアクセス」と認識し、処理完了時のハンドリング（WebView向けメッセージの送信など）を切り替えます。
*   `orderid`
    *   FlutterFlow側で管理しているオーダーID
*   `userid` (または `userId`)
    *   ユーザー識別用ID
*   `uploadid` (または `upload_id`)
    *   今回のアップロードを識別するID

### （オプション）認証トークンの引き継ぎ
サインイン済みのセッションをWeb側に引き継ぎたい場合は、URLの**ハッシュ（フラグメント）**としてトークンを渡す設計になっています。

`#access_token=[ACCESS_TOKEN]&refresh_token=[REFRESH_TOKEN]`

### 呼び出しURLの最終的な形式の例
```text
https://spiral-turn-footcalc.web.app/?from=ff&orderid=12345&userid=user-abc&uploadid=upload-xyz
```

### WebViewにおける完了ハンドリング (アプローチ1の場合)
アプローチ1を採用して flutter_inappwebview 等でWebView表示した場合、Next.js側で画像のアップロードが完了すると以下のメッセージがPostMessageとして送出されます。

```json
{
  "success": true,
  "message": "upload complete"
}
```
WebViewウィジェットの `onWebViewCreated` などで `ff_webview_handler` などのJavaScriptハンドラを登録しておけば、このメッセージを受け取ってFlutterFlow側で画面遷移やダイアログ表示に繋げることが可能です。
