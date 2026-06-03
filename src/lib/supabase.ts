import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dkxwxgupswhpnyegkogc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreHd4Z3Vwc3docG55ZWdrb2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg2MzIsImV4cCI6MjA5NjA5NDYzMn0.cfn_NAXKO_BCGuUdMhZpAnl87cvcNdO9FeXZNW10uKw'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
