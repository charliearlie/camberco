import { createClient } from '@supabase/supabase-js';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = 'blog-images';

interface UploadOpts {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
}

export async function uploadImage(file: File, opts: UploadOpts): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are accepted.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File exceeds 5 MB limit.');
  }

  const supabase = createClient(opts.supabaseUrl, opts.supabaseAnonKey);

  if (opts.accessToken) {
    // @ts-expect-error — internal header injection
    supabase.auth.setSession({ access_token: opts.accessToken, refresh_token: '' });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}
