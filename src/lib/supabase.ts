import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://faydwdlxexnvnzcbdrp.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_shkApqa6M4WHHoW8U7G6TA_gMQtNq-x';

export const supabase = createClient(supabaseUrl, supabaseKey);
