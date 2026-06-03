import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://odhrurajnwphfelwjhze.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kaHJ1cmFqbndwaGZlbHdqaHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTQ5MDcsImV4cCI6MjA5NjA5MDkwN30._Ohmljkm4xUmuDiHNJbsYmbbsJjGRHzvV9fEPPBbZfs'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
