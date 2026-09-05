import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export async function uploadImage(
    blob: Blob,
    orderId: string,
    providedUploadId?: string,
    providedUserId?: string,
    filenameBase: string = 'foot_image.jpg'
): Promise<{ success: boolean; message: string }> {
    try {
        let userId = providedUserId;
        // Auth情報からユーザーを取得。トークンがあればそれが優先、なければprovidedUserIdを使う。
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (user) {
            userId = user.id;
        }

        if (!userId) {
            return { success: false, message: "Authentication failed. User not logged in and no userId provided." };
        }
        
        const uploadFileId = uuidv4();
        const kind = 'foot';
        
        let uploadId = providedUploadId;

        if (!uploadId) {
            // uploads.user_id も public.users.id(auth.uid() ではない)。auth_user_id 経由で解決する
            // (2026-09-05 発見・修正。uploads_files.user_id と同根のバグ)。
            const { data: customerRow, error: customerError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_user_id', userId)
                .maybeSingle();
            if (customerError || !customerRow) {
                console.error("public.users 解決エラー:", customerError);
                return { success: false, message: "Failed to resolve customer record for this user." };
            }
            // 作成済みの order_id と user_id に紐づく uploads レコードの id を使用する
            const { data: uploadRecord, error: uploadError } = await supabase
                .from('uploads')
                .select('id')
                .eq('order_id', orderId)
                .eq('user_id', customerRow.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (uploadError || !uploadRecord) {
                 console.error("uploads table select error or not found:", uploadError);
                 return { success: false, message: "Failed to find existing upload record for this orderId and userId." };
            }
            uploadId = uploadRecord.id;
        }

        // Storage へのアップロード。ファイル名は呼び出し側から注文番号入りを渡せる。
        const safeName = (filenameBase || 'foot_image.jpg').replace(/[^\w.\-]/g, '_');
        const filePath = `${userId}/live/${uploadId}/${kind}/${uploadFileId}/${safeName}`;
        const { error: storageError } = await supabase.storage
            .from('upsys')
            .upload(filePath, blob, { contentType: blob.type || 'image/jpeg' });

        if (storageError) {
            console.error("Storage upload error:", storageError);
            return { success: false, message: `Storage error: ${storageError.message}` };
        }

        // DB へのアップロード情報保存
        //   uploads_files.user_id は public.users.id への FK(auth.uid() ではない)。
        //   ここまでの userId は supabase.auth.getUser() の user.id = auth.uid() であり、
        //   public.users.id と一致しないため、そのまま入れると FK 違反で INSERT が必ず失敗する
        //   (upload-center の insertUploadFile も同じ理由で user_id: null に固定している。
        //    2026-09-05 発見・修正: 親 uploads 行が正しい user_id を保持しているので null で良い)。
        const { error: dbError } = await supabase
            .from('uploads_files')
            .insert({
                id: uploadFileId,
                // orderId が空文字のことがある(ゲスト/未決済フローで upload-center から
                // orderid 未指定で開かれるケース)。uuid 列へ '' を入れると失敗するため null 化する。
                order_id: orderId || null,
                upload_id: uploadId,
                user_id: null,
                status: 'draft',
                file_type: 'image',
                kind: kind,
                url: filePath,
                mime_type: blob.type || 'image/jpeg',
                file_size: blob.size,
                updated_at: new Date().toISOString()
            });

        if (dbError) {
            console.error("Database insert error:", dbError);
            return { success: false, message: `DB error: ${dbError.message}` };
        }

        return { success: true, message: "Upload to Supabase successful." };
    } catch (e: any) {
        console.error("Unexpected error in uploadImage:", e);
        return { success: false, message: e.message || "Unknown error." };
    }
}
