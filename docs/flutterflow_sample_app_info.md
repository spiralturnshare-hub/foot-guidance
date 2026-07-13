# サンプルFlutterFlowアプリについて

本番環境との連携における動作確認用として、サンプルのFlutterFlowアプリを作成しています。Webアプリ（Next.js側）とのパラメーター連携や機能テストの際などの参考にしてください。

## 1. アプリへのアクセスとプロジェクト共有

- **公開URL**
  [https://test-app-taking-photo-1o725p.flutterflow.app/](https://test-app-taking-photo-1o725p.flutterflow.app/)

> [!NOTE]
> **FlutterFlowプロジェクトの閲覧について**
> サンプルFlutterFlowアプリの内部コード（ウィジェットのツリー構造やアクション設定など）を直接閲覧したい場合は、プロジェクトへ招待いたします。希望される担当者様の**メールアドレス**をご連絡ください。

## 2. テスト用クレデンシャル

動作確認には、以下のテストアカウントおよびテスト用IDをご利用ください。

| 項目 | 値 |
| :--- | :--- |
| **Email** | `studyhelperproject@gmail.com` |
| **Password** | `password12345$` |
| **User ID** | `7c5af233-76fd-4cad-b2b1-eacc2ba0e9c8` |
| **Upload ID** | `898c9545-f8ef-4b8c-919a-9495c8b35ef7` |
| **Order ID** | `898c9525-f8ef-4b8c-919a-9495c8b35ef7` |

## 3. サンプルアプリの画面構成

シンプルに以下の要素で構成されています。
*   **ログインページ**
*   **機能ページ**
    *   Next.js用アクセスURL生成、および遷移ボタン
    *   `uploads_files` テーブル上にレコードが存在するかを確認するためのクエリ結果表示

## 4. 特記事項：URL生成用のCustom Function

Next.jsに対してユーザーセッション等の必須パラメータを引き渡すため、FlutterFlow側で以下のCustom Functionを定義してURLを組み立てています。
実際の実装に組み込む際の参考にしてください。

```dart
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;
import '/flutter_flow/custom_functions.dart';
import '/flutter_flow/lat_lng.dart';
import '/flutter_flow/place.dart';
import '/flutter_flow/uploaded_file.dart';
import '/backend/supabase/supabase.dart';
import '/auth/supabase_auth/auth_util.dart';

String? generateNextjsUrl(
  String? uploadId,
  String? userId,
  String? baseUrl,
  String? orderId,
) {
  /// MODIFY CODE ONLY BELOW THIS LINE

  // 動いているコードと同じ方法でセッションを取得
  final session = Supabase.instance.client.auth.currentSession;

  // 未ログイン時のフォールバック
  if (session == null) {
    return '$baseUrl?orderid=$orderId&from=ff';
  }

  final accessToken = session.accessToken;
  final refreshToken = session.refreshToken ?? '';

  // クエリパラメータとURLフラグメント（ハッシュ）を結合して返す
  return '$baseUrl?orderid=$orderId&uploadid=$uploadId&userId=$userId&from=ff#access_token=$accessToken&refresh_token=$refreshToken';

  /// MODIFY CODE ONLY ABOVE THIS LINE
}
```
