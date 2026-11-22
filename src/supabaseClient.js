import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nbgrniqypbmqoijerytr.supabase.co';
const supabaseAnonKey = 'sb_publishable_2mgfYpCDx7zzmCEgdzo2kA_M9Z6yLWM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
