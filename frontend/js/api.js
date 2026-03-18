/**
 * EcoWallet API Service
 * Cleaned for ESLint compliance and global scope reliability.
 */

let isSyncing = false;

(function () {
    // --- 1. CONFIGURATION & CLIENT ---
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
        // Access via window.supabase to satisfy ESLint no-undef/no-unused-vars
        if (!config.url || !config.anonKey || !window.supabase) return null;

        if (!supabaseClient) {
            supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        }
        return supabaseClient;
    }

    // --- 2. INTERNAL UTILITIES ---
    async function ensureProfileForUser(authUser) {
        if (!authUser) throw new Error('Not authenticated');
        const client = getSupabaseClient();
        
        const { data, error } = await client
            .from('users')
            .select('*')
            .eq('auth_id', authUser.id)
            .single();

        if (!error && data) return data;
        
        // Fallback to auth metadata if profile table fetch fails
        return {
            ...authUser,
            role: authUser.user_metadata?.role || 'user',
            name: authUser.user_metadata?.name || 'Eco User'
        };
    }

    // --- 3. GLOBAL AUTH SYNC ---
    window.syncSupabaseSession = async function() {
        if (isSyncing) return null;
        isSyncing = true;
        
        const client = getSupabaseClient();
        if (!client) {
            isSyncing = false;
            return null;
        }

        try {
            const { data, error } = await client.auth.getSession();
            if (error || !data?.session) {
                isSyncing = false;
                return null;
            }
            
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

    // --- 4. AGENT DASHBOARD API ---
    window.agentAPI = {
        async getAgentStats() {
            const client = getSupabaseClient();
            const { data, error } = await client.rpc('get_agent_stats');
            if (error) throw error;
            return { stats: data?.[0] || data || {} };
        },

        async getPendingSubmissions() {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('waste_submissions')
                .select('*, users(name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) throw error;
            return { 
                submissions: (data || []).map(row => ({
                    ...row,
                    user_name: row.users?.name || 'Unknown User'
                }))
            };
        },

        async getCollectedSubmissions() {
            const client = getSupabaseClient();
            const { data: { user } } = await client.auth.getUser();
            const { data, error } = await client
                .from('waste_submissions')
                .select('*, users(name)')
                .eq('status', 'collected')
                .eq('agent_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return { 
                submissions: (data || []).map(row => ({
                    ...row,
                    user_name: row.users?.name || 'Unknown User'
                }))
            };
        },

        async collectSubmission(submissionId) {
            const client = getSupabaseClient();
            const { data: { user } } = await client.auth.getUser();
            const { error } = await client
                .from('waste_submissions')
                .update({ 
                    status: 'collected', 
                    agent_id: user.id,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', submissionId);

            if (error) throw error;
            return { success: true };
        }
    };

    // --- 5. FORMATTERS ---
    window.formatCurrency = (amt) => `NGN ${Number(amt || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    window.formatDate = (d) => new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
    window.formatWeight = (w) => `${Number(w || 0).toFixed(2)} kg`;

})();