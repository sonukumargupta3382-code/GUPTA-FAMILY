import { createClient } from '@supabase/supabase-js';

// Configuration: Hardcoded to ensure correct project is used
// Project Ref: wyzakfvlsedzfyfekqsz
const supabaseUrl = 'https://wyzakfvlsedzfyfekqsz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5emFrZnZsc2VkemZ5ZmVrcXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzU3MzIsImV4cCI6MjA4NzY1MTczMn0.4HR6FSRdwmGAFVc0nxGWsmrIqZy8lp3gXS0ioY1d4p4';

console.log("Supabase Client Initialized with:", supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
