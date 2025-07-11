import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ecphvqdudlkoglhdbext.supabase.co'
const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcGh2cWR1ZGxrb2dsaGRiZXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4ODE3NjAsImV4cCI6MjA2NzQ1Nzc2MH0.eOn24WQsQREcY4XGRMgimNlM3YRK7mMvcBpXsHEyp_c'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper function to set user context for RLS
export const setUserContext = async (userId: string, userEmail?: string) => {
  const { error } = await supabase.rpc('set_user_context', {
    user_id: userId,
    user_email: userEmail || ''
  })
  
  if (error) {
    console.error('Error setting user context:', error)
  }
}