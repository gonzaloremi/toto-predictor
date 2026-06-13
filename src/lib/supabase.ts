import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://faydwdlxexnzvnzcbdrp.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheWR3ZGx4ZXhuenZuemNiZHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNDIwODIsImV4cCI6MjA5NjkxODA4Mn0.gz0rTuUgZcsWMnU_4EhARVQIQfHOoOSwUlva4KfivrI';

export const supabase = createClient(supabaseUrl, supabaseKey);
