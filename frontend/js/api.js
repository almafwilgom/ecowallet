/**
 * EcoWallet API Service
 */

let isSyncing = false;

(function () {
    // --- 1. CONFIG & CLIENT ---
    function getConfigValue(value, fallback = '') {
        return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    }

    function getSupabaseConfig() {
        return {
            url: getConfigValue(window.ECOWALLET_SUPABASE_URL),
            anonKey: getConfigValue(window.ECOWALLET_SUPABASE_ANON_KEY)
        };
    }

    let supabaseClient = null;
    function getSupabaseClient() {
        const config = getSupabaseConfig();
        if (!config.url || !config.anonKey || !window.supabase) return null;
        if (!supabaseClient) {
            supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        }
        return supabaseClient;
    }

    async function ensureProfileForUser(authUser) {
        if (!authUser) throw new Error('Not authenticated');
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('users')
            .select('*')
            .eq('auth_id', authUser.id)
            .single();

        if (!error && data) return data;
        return {
            ...authUser,
            role: authUser.user_metadata?.role || 'user',
            name: authUser.user_metadata?.name || 'Eco User'
        };
    }

    // --- 2. AUTH API (REQUIRED FOR LOGIN) ---
    window.authAPI = {
        async login(email, password) {
            const client = getSupabaseClient();
            if (!client) throw new Error("Connection to database failed.");

            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            
            // Immediately sync profile to local storage
            await window.syncSupabaseSession();
            return data;
        },

        async logout() {
            const client = getSupabaseClient();
            if (client) await client.auth.signOut();
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        }
    };

    // --- 3. SESSION SYNC ---
    window.syncSupabaseSession = async function() {
        if (isSyncing) return null;
        isSyncing = true;
        const client = getSupabaseClient();
        if (!client) { isSyncing = false; return null; }

        try {
            const { data, error } = await client.auth.getSession();
            if (error || !data?.session) { isSyncing = false; return null; }
            
            const profile = await ensureProfileForUser(data.session.user);
            localStorage.setItem('user', JSON.stringify(profile));
            isSyncing = false;
            return profile;
        } catch (err) {
            console.error('Session sync failed:', err);
            isSyncing = false;
            return null;
        }
    };

    // --- 4. AGENT API ---
    window.agentAPI = {
        async getAgentStats() {
            const client = getSupabaseClient();
            const { data, error } = await client.rpc('get_agent_stats');
            if (error) throw error;
            return { stats: data?.[0] || data || {} };
        }
        // ... include other agent methods here if needed
    };

})();