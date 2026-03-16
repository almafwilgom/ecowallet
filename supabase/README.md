# Supabase Setup (EcoWallet)

1. Open the Supabase dashboard for your project.
2. Go to SQL Editor and run `supabase/schema.sql`.
3. In Authentication:
   - Enable Email/Password.
   - Enable GitHub provider and set the redirect URL to your frontend domain (for example: `https://your-vercel-domain/reset-password.html` and `https://your-vercel-domain/login.html`).
4. Update `frontend/js/config.js` with your Supabase project URL and anon key.
5. Create your first admin:
   - Sign up normally.
   - In the `users` table, set your `role` to `admin`.

Notes:
- If email confirmation is enabled, new users must confirm before logging in.
- Password reset links should redirect to `reset-password.html`.
