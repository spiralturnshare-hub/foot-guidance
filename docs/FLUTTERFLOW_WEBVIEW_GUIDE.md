# FlutterFlow WebView 連携実装ガイド

このドキュメントは、FlutterFlow (FF) アプリ内で足画像撮影用の Next.js Webアプリケーション（WebView経由）を正しく動作させ、アップロード完了を検知するための実装手順をまとめたものです。

## 1. 事前準備 (Supabase セッションの取得)

Next.js 側でアップロード処理を正しく行うためには、現在 FlutterFlow でログイン中のユーザーの Supabase 認証セッション（`access_token` と `refresh_token`）を Web 側に渡す必要があります。

これを行うために、FlutterFlow 上で Custom Action を作成し、カレントセッションを取得するロジックを実装してください。

**Custom Action の作成例 (Dart):**
```dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<String> getSupabaseSessionHash() async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) {
    return ''; // 未ログイン時
  }
  
  final accessToken = session.accessToken;
  final refreshToken = session.refreshToken ?? '';
  
  // URLのフラグメント（ハッシュ）形式で返す
  return 'access_token=$accessToken&refresh_token=$refreshToken';
}
```

## 2. URL の生成ロジック

WebViewに渡す Web アプリの URL を動的に構築します。
以下の要素を結合して最終的な URL を作成してください。

*   **ベース URL**: `https://[デプロイされたNext.jsのドメイン]/`
*   **クエリパラメータ**:
    *   `from=ff`: FFモジュールからのアクセスであることを明示（**必須**）
    *   `orderid`: 現在のオーダーID（ UUID 等。**必須**）
    *   `upload_id`: 連携先である `uploads` テーブルの親レコードID（ UUID 等。**必須**）
    *   `name`: 対象者の表示名またはお名前
*   **フラグメント**:
    *   `#` から始まり、セッション情報を含める（ステップ1で生成されたもの）

**URL 生成例:**
`https://example.com/?from=ff&orderid={order_id}&upload_id={upload_id}&name={name}#access_token=...&refresh_token=...`

*(※ パラメータ文字列は必要に応じて URL エンコードを行ってください)*

## 3. WebView ウィジェットの構成

FlutterFlow の画面上に **WebView Widget** を配置し、以下の通りに設定します。

### 3.1 プロパティ設定
*   **URL**: ステップ2で生成した動的 URL を設定します。
*   **Javascript Enable**: オン (デフォルトでオンです。Next.js アプリの動作およびカメラ機能に必須です)。

### 3.2 カメラおよびファイルアクセス権限（iOS / Android 要件）
WebView 内で `Intents / Permissions` を要求する場合があるため、FlutterFlow の **App Settings -> Permissions** にて以下が登録・有効化されていることを確認してください。
*   `Camera Permission` (NSCameraUsageDescription)
*   `Photo Library Permission` (任意ではありますが、OSによってはアップロード時に必要になる場合があります)

*(※ WebView 内部から直接カメラを起動するため、FF 側のアクションで事前にカメラパーミッションを要求するアクション (`Request Permissions`) をWebView表示前に挟んでおくと非常にスムーズです)*

## 4. WebView 側からのメッセージ（アップロード完了）検知

Next.js アプリ側では、画像の保存や Supabase へのアップロードが完了したタイミングで、以下の JavaScript メッセージを WebView のホスト（FFアプリ）へ投げます。

```javascript
// Next.js 側で発行されるメッセージ
window.ff_webview_handler.postMessage(JSON.stringify({ success: true, message: "upload complete" }));
```

このメッセージを FlutterFlow 側で受け取るために、FlutterFlow 側で WebView を実装する際は JavaScript チャンネル等のハンドリング機能を用いる必要があります。
現状の無償版 / GUI 標準コンポーネントでは、 `postMessage` を直接検知する標準機能がないため、**Custom Widget** として WebView をラップし、`javascriptChannels` に `ff_webview_handler` を登録する方法が推奨されます。

**Custom Widget (WebView) の実装例:**

```dart
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:convert';

class CustomCameraWebView extends StatefulWidget {
  const CustomCameraWebView({
    Key? key,
    this.width,
    this.height,
    required this.url,
    required this.onUploadComplete,
  }) : super(key: key);

  final double? width;
  final double? height;
  final String url;
  final Future<dynamic> Function() onUploadComplete; // FF側からのコールバック

  @override
  _CustomCameraWebViewState createState() => _CustomCameraWebViewState();
}

class _CustomCameraWebViewState extends State<CustomCameraWebView> {
  late WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      // カメラ等、メディアの自動再生などを許可する場合の設定（環境に応じて調整）
      ..addJavaScriptChannel(
        'ff_webview_handler',
        onMessageReceived: (JavaScriptMessage message) {
          try {
            final data = jsonDecode(message.message);
            if (data['success'] == true) {
              // 成功メッセージ受信時にコールバック発火
              widget.onUploadComplete();
            }
          } catch (e) {
            print('Error parsing message: $e');
          }
        },
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.width,
      height: widget.height,
      child: WebViewWidget(controller: _controller),
    );
  }
}
```

この **Custom Widget** を FlutterFlow 上に配置し、アップロード成功時のコールバックアクション（WebView画面を閉じる、次の画面へ遷移させる、リロードをかけるなど）をアクションエディタで設定してください。

## まとめ・ワークフロー

1.  **FF側**: 次の画面へ進むアクションで `orderid` や `upload_id` を用意。
2.  **FF側**: `Custom Action` にて、Supabase の Session情報を取得し URLフラグメントを生成。
3.  **FF側**: 対象URLを組み立て、Custom Widget ベースの WebView を呼び出す。（直前にカメラ権限を聞いておくとなお良し）。
4.  **Web側**: 即座にセッションを復帰し、カメラ画面を表示、撮影・アップロード実行。
5.  **Web側**: 完了時に `ff_webview_handler.postMessage(...)` を発火。
6.  **FF側**: Custom Widget がそれを受信し、設定された完了アクションを実行（画面遷移など）。
