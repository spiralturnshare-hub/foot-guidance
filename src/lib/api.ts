import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export async function uploadImage(
    blob: Blob,
    orderId: string,
    providedUploadId?: string,
    providedUserId?: string
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
            // 作成済みの order_id と user_id に紐づく uploads レコードの id を使用する
            const { data: uploadRecord, error: uploadError } = await supabase
                .from('uploads')
                .select('id')
                .eq('order_id', orderId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
                
            if (uploadError || !uploadRecord) {
                 console.error("uploads table select error or not found:", uploadError);
                 return { success: false, message: "Failed to find existing upload record for this orderId and userId." };
            }
            uploadId = uploadRecord.id;
        }

        // Storage へのアップロード
        const filePath = `${userId}/live/${uploadId}/${kind}/${uploadFileId}/foot_image.jpg`;
        const { error: storageError } = await supabase.storage
            .from('upsys')
            .upload(filePath, blob, { contentType: 'image/jpeg' });

        if (storageError) {
            console.error("Storage upload error:", storageError);
            return { success: false, message: `Storage error: ${storageError.message}` };
        }

        // DB へのアップロード情報保存
        const { error: dbError } = await supabase
            .from('uploads_files')
            .insert({
                id: uploadFileId,
                order_id: orderId,
                upload_id: uploadId,
                user_id: userId,
                status: 'draft',
                file_type: 'image',
                kind: kind,
                url: filePath,
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
