import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';

// These keys are read from environment variables by Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key are required. Make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file or hosting provider.");
}

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const getSupabaseFunctionUrl = (functionName: string) => {
    return `${supabaseUrl}/functions/v1/${functionName}`;
};