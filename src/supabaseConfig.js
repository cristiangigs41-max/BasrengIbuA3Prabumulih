// Sambungan database online (Supabase). Kosongkan keduanya untuk mode demo (data hanya di browser).
// Kunci "anon / publishable" memang publik; keamanan data dijaga oleh aturan di supabase/schema.sql.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || ''
