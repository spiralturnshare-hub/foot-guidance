// ============================================================
// SPIRAL TURN - Supabase クライアント設定（foot-guidance / かんたん撮影アプリ）
// Green Supabase: fhamrkmsxidxayaoexso
//
// 【env の扱いの変遷】
//   ~2026-08-28: `VITE_SUPABASE_URL || ''` = 空文字 fallback。Vercel env 設定漏れで
//     createClient('', '') になり「撮影しても自動アップロードされない」の主因になった。
//   2026-08-28: 姉妹アプリに合わせ Green URL + anon key をハードコード fallback に。
//   2026-09-04(現在): Green の Legacy JWT Secret 露出の是正で新 API キー体系へ移行
//     (docs/35 WS-B / docs/36 §2)。**ハードコード fallback を全撤去**し、env 未設定なら
//     即 throw する方式に統一。「静かに旧キーで動く」より「起動時に即エラーで気づく」を選ぶ
//     (Legacy revoke 後は旧キーが 401 になるため、silent fallback はむしろ有害)。
//     VITE_SUPABASE_ANON_KEY には新 publishable キー(sb_publishable_...)を入れる。
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を環境変数(Vercel)に設定してください。' +
      'VITE_SUPABASE_ANON_KEY = 新 publishable キー(sb_publishable_...)。',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
