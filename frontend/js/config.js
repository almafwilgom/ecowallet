// Frontend runtime configuration
// OAuth config (use GitHub in Supabase Auth)
// Example: window.ECOWALLET_GITHUB_REDIRECT_URL = 'https://your-domain/login.html';
window.ECOWALLET_GITHUB_REDIRECT_URL = window.ECOWALLET_GITHUB_REDIRECT_URL
    || 'https://ecowallet-3mtt.vercel.app/login.html';

// Supabase configuration (required for Supabase-only setup)
// Example: window.ECOWALLET_SUPABASE_URL = 'https://your-project-ref.supabase.co';
// Example: window.ECOWALLET_SUPABASE_ANON_KEY = 'your-anon-key';
window.ECOWALLET_SUPABASE_URL = window.ECOWALLET_SUPABASE_URL || 'https://eigitkparyebddjtoocd.supabase.co';
window.ECOWALLET_SUPABASE_ANON_KEY = window.ECOWALLET_SUPABASE_ANON_KEY
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZ2l0a3BhcnllYmRkanRvb2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTUzNDksImV4cCI6MjA4OTE5MTM0OX0.4eMrrwb7qoxJBg0JCKIJgPv7tQWKUKGVC0IWsWYyDQk';

// Password reset redirect URL (defaults to current origin)
window.ECOWALLET_PASSWORD_RESET_URL = window.ECOWALLET_PASSWORD_RESET_URL
    || 'https://ecowallet-3mtt.vercel.app/reset-password.html';
