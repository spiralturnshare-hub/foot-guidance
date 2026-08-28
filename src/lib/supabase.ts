// ============================================================
// SPIRAL TURN - Supabase クライアント設定（foot-guidance / かんたん撮影アプリ）
// Green Supabase: fhamrkmsxidxayaoexso
//
// 【過去の失敗と対策 (2026-08-28)】
//   以前はここが `import.meta.env.VITE_SUPABASE_URL || ''` で、フォールバックが
//   空文字だった。Vercel 側に環境変数を設定し忘れると createClient('', '') となり、
//   Storage アップロードも uploads_files への INSERT も即座に失敗する
//   （＝「撮影しても自動アップロードされない」の主因）。
//   姉妹アプリ（upload-center / customer-mgmt-console / foot-measure）はいずれも
//   Green の URL と anon key をコードにフォールバック定数として持っている。anon key は
//   ブラウザに配布される公開前提のキー（RLS で保護）なので、ここに書いても
//   セキュリティ上の新たな露出は無い。foot-guidance も同じ方式に合わせる。
//   ※ env が設定されていればそちらが優先される（本番昇格時のキー差し替え用）。
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://fhamrkmsxidxayaoexso.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYW1ya21zeGlkeGF5YW9leHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTcwMTMsImV4cCI6MjEwMDI3MzAxM30.7GRn0m2SO3BzNQLQAb8dbREpoC8ewSIMLU2gWMIHp5I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
