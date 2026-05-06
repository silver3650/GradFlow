import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mbazzndgbobgmkyzjaba.supabase.co'
const supabaseKey = 'sb_publishable_x4WFl9-_RxMmUI7LMCzTZA_QfxoX2pZ'
export const supabase = createClient(supabaseUrl, supabaseKey)