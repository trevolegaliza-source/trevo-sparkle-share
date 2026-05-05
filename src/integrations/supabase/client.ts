import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://aahhauquuicvtwtrxyan.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x3shj99Z2BIh7haYop-PlQ_gNXTLRmm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
