// Supabase-powered API wrapper for EcoWallet
(function () {
    function getConfigValue(value, fallback = '') {
        return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    }

    function getSupabaseConfig() {
        return {
            url: getConfigValue(window.ECOWALLET_SUPABASE_URL),
            anonKey: getConfigValue(window.ECOWALLET_SUPABASE_ANON_KEY)
        };
    }

    function isSupabaseConfigured() {
        const config = getSupabaseConfig();
        return Boolean(config.url && config.anonKey);
    }

    window.isSupabaseConfigured = isSupabaseConfigured;

    let supabaseClient = null;

    function getSupabaseClient() {
        if (!isSupabaseConfigured()) {
            throw new Error('Supabase is not configured. Set ECOWALLET_SUPABASE_URL and ECOWALLET_SUPABASE_ANON_KEY.');
        }

        if (!window.supabase || !window.supabase.createClient) {
            throw new Error('Supabase client SDK is not loaded.');
        }

        if (!supabaseClient) {
            const config = getSupabaseConfig();
            supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
        }

        return supabaseClient;
    }

    window.ecowalletSupabase = {
        getClient: () => {
            try {
                return getSupabaseClient();
            } catch (error) {
                return null;
            }
        }
    };

    function normalizeSupabaseError(error, fallback = 'Request failed') {
        if (!error) return new Error(fallback);
        if (typeof error === 'string') return new Error(error);
        return new Error(error.message || error.error_description || fallback);
    }

    function getLocalUser() {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch (error) {
            return {};
        }
    }

    function getLocalUserId() {
        return getLocalUser().id || null;
    }

    async function ensureProfileForUser(authUser) {
        if (!authUser) {
            throw new Error('Not authenticated');
        }

        const client = getSupabaseClient();
        const { data, error } = await client
            .from('users')
            .select('id, auth_id, name, email, phone, address, role, state, deleted_at, created_at')
            .eq('auth_id', authUser.id)
            .single();

        if (!error && data) {
            return data;
        }

        const metadata = authUser.user_metadata || {};
        const name = metadata.name || metadata.full_name || authUser.email?.split('@')[0] || 'User';
        const state = metadata.state || 'Unknown';
        const role = metadata.role || 'user';
        const phone = metadata.phone || metadata.phone_number || null;
        const address = metadata.address || null;

        const insertResult = await client
            .from('users')
            .insert({
                auth_id: authUser.id,
                name,
                email: authUser.email,
                phone,
                address,
                state,
                role
            })
            .select('id, auth_id, name, email, phone, address, role, state, deleted_at, created_at')
            .single();

        if (insertResult.error) {
            throw normalizeSupabaseError(insertResult.error, 'Failed to load profile');
        }

        return insertResult.data;
    }

    async function maybeExchangeRecoverySession(client) {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code && client.auth.exchangeCodeForSession) {
            await client.auth.exchangeCodeForSession(code);
        }

        if (window.location.hash && window.location.hash.includes('access_token')) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (accessToken && client.auth.setSession) {
                await client.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });
            }
        }
    }

    async function syncSupabaseSession() {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabaseClient();

        try {
            await maybeExchangeRecoverySession(client);
        } catch (error) {
            // Ignore URL parsing errors
        }

        const { data, error } = await client.auth.getSession();
        if (error || !data?.session || !data.session.user) {
            return null;
        }

        const profile = await ensureProfileForUser(data.session.user);
        if (profile?.deleted_at) {
            await client.auth.signOut();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            throw new Error('Account is disabled. Contact admin.');
        }

        localStorage.setItem('token', data.session.access_token || '');
        localStorage.setItem('user', JSON.stringify(profile));
        return profile;
    }

    window.syncSupabaseSession = syncSupabaseSession;

    const authAPI = {
        register: async (payload) => {
            const { name, email, password, state, phone, address } = payload || {};
            const client = getSupabaseClient();
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                        phone,
                        address,
                        state,
                        role: 'user'
                    }
                }
            });

            if (error) {
                throw normalizeSupabaseError(error, 'Registration failed');
            }

            if (data?.user) {
                try {
                    await ensureProfileForUser(data.user);
                } catch (profileError) {
                    // Profile might be created by trigger; ignore if already exists
                }
            }

            return { message: 'Registration successful. Please check your email if confirmation is enabled.' };
        },
        login: async (payload) => {
            const { email, password } = payload || {};
            const client = getSupabaseClient();
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) {
                throw normalizeSupabaseError(error, 'Login failed');
            }

            const session = data?.session;
            const authUser = data?.user;

            if (!session || !authUser) {
                throw new Error('Login failed');
            }

            const profile = await ensureProfileForUser(authUser);
            if (profile?.deleted_at) {
                await client.auth.signOut();
                throw new Error('Account is disabled. Contact admin.');
            }

            return {
                token: session.access_token,
                user: profile
            };
        },
        loginWithGithub: async () => {
            const client = getSupabaseClient();
            const redirectTo = window.ECOWALLET_GITHUB_REDIRECT_URL
                || `${window.location.origin}/login.html`;

            const { data, error } = await client.auth.signInWithOAuth({
                provider: 'github',
                options: { redirectTo }
            });

            if (error) {
                throw normalizeSupabaseError(error, 'GitHub login failed');
            }

            if (data?.url) {
                window.location.assign(data.url);
            }

            return { message: 'Redirecting to GitHub...' };
        },
        requestPasswordReset: async (payload) => {
            const { email } = payload || {};
            const client = getSupabaseClient();
            const redirectTo = window.ECOWALLET_PASSWORD_RESET_URL
                || `${window.location.origin}/reset-password.html`;

            const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) {
                throw normalizeSupabaseError(error, 'Password reset failed');
            }

            return { message: 'If the account exists, a reset link has been sent.' };
        },
        confirmPasswordReset: async (payload) => {
            const { password } = payload || {};
            const client = getSupabaseClient();

            await maybeExchangeRecoverySession(client);

            const { data: sessionData } = await client.auth.getSession();
            if (!sessionData?.session) {
                throw new Error('Reset link is invalid or expired.');
            }

            const { error } = await client.auth.updateUser({ password });
            if (error) {
                throw normalizeSupabaseError(error, 'Password reset failed');
            }

            return { message: 'Password reset successful.' };
        },
        getCurrentUser: async () => {
            const client = getSupabaseClient();
            const { data, error } = await client.auth.getUser();
            if (error || !data?.user) {
                throw new Error('Not authenticated');
            }

            const profile = await ensureProfileForUser(data.user);
            return { user: profile };
        },
        logout: async () => {
            const client = getSupabaseClient();
            await client.auth.signOut();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return { message: 'Logged out' };
        }
    };

    const publicAPI = {
        getStats: async () => {
            const client = getSupabaseClient();
            const { data, error } = await client.rpc('get_public_stats');
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load stats');
            }
            return { stats: data?.[0] || data || {} };
        }
    };

    const wasteAPI = {
        submitWaste: async (payload) => {
            const client = getSupabaseClient();
            const { material_type, weight_kg, location } = payload || {};

            const { data, error } = await client
                .from('waste_submissions')
                .insert({ material_type, weight_kg, location })
                .select('id, payout, co2_saved')
                .single();

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to submit waste');
            }

            return {
                message: 'Waste submitted',
                reward: {
                    message: 'Waste submitted',
                    amount: data?.payout || 0
                },
                submission: {
                    id: data?.id,
                    payout: data?.payout || 0,
                    co2_saved: data?.co2_saved || 0
                }
            };
        },
        getUserSubmissions: async (status = null) => {
            const client = getSupabaseClient();
            const userId = getLocalUserId();

            let query = client
                .from('waste_submissions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (userId) {
                query = query.eq('user_id', userId);
            }
            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load submissions');
            }

            return { submissions: data || [] };
        },
        getLeaderboard: async (limit = 10) => {
            const client = getSupabaseClient();
            const { data, error } = await client.rpc('get_leaderboard', { limit_count: limit });
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load leaderboard');
            }
            return { leaderboard: data || [] };
        },
        getUserStats: async () => {
            const client = getSupabaseClient();
            const { data, error } = await client.rpc('get_user_stats');
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load stats');
            }
            return { stats: data?.[0] || data || {} };
        }
    };

    const walletAPI = {
        getBalance: async () => {
            const client = getSupabaseClient();
            const userId = getLocalUserId();

            let query = client.from('wallets').select('balance').limit(1);
            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query.single();
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load wallet');
            }
            return { wallet: { balance: data?.balance || 0 } };
        },
        requestWithdrawal: async (payload) => {
            const client = getSupabaseClient();
            const {
                amount,
                method,
                phone_number,
                bank_account,
                bank_name,
                account_name,
                network_type
            } = payload || {};

            const bank_details = {};
            if (bank_account) bank_details.account_number = bank_account;
            if (bank_name) bank_details.bank_name = bank_name;
            if (account_name) bank_details.account_name = account_name;
            if (network_type) bank_details.network = network_type;

            const detailsPayload = Object.keys(bank_details).length ? bank_details : null;

            const { data, error } = await client
                .from('withdrawal_requests')
                .insert({
                    amount,
                    method,
                    phone_number: phone_number || null,
                    bank_details: detailsPayload
                })
                .select('id, amount, method, status')
                .single();

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to request withdrawal');
            }

            return { withdrawal: data };
        },
        getWithdrawals: async (status = null) => {
            const client = getSupabaseClient();
            const userId = getLocalUserId();

            let query = client
                .from('withdrawal_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (userId) {
                query = query.eq('user_id', userId);
            }
            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load withdrawals');
            }

            return { withdrawals: data || [] };
        }
    };

    const agentAPI = {
        getPendingSubmissions: async () => {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('waste_submissions')
                .select('id, material_type, weight_kg, location, payout, created_at, user_id, users:users!waste_submissions_user_id_fkey(name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load submissions');
            }

            const submissions = (data || []).map((row) => ({
                ...row,
                user_name: row.users?.name || 'Unknown'
            }));

            return { submissions };
        },
        collectSubmission: async (submissionId) => {
            const client = getSupabaseClient();
            const userId = getLocalUserId();
            const { error } = await client
                .from('waste_submissions')
                .update({
                    status: 'collected',
                    agent_id: userId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', submissionId);

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to update submission');
            }

            return { message: 'Marked as collected' };
        },
        getCollectedSubmissions: async () => {
            const client = getSupabaseClient();
            const userId = getLocalUserId();

            let query = client
                .from('waste_submissions')
                .select('id, material_type, weight_kg, payout, co2_saved, updated_at, user_id, users:users!waste_submissions_user_id_fkey(name)')
                .eq('status', 'collected')
                .order('updated_at', { ascending: false })
                .limit(50);

            if (userId) {
                query = query.eq('agent_id', userId);
            }

            const { data, error } = await query;
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load submissions');
            }

            const submissions = (data || []).map((row) => ({
                ...row,
                user_name: row.users?.name || 'Unknown'
            }));

            return { submissions };
        },
        getAgentStats: async () => {
            const client = getSupabaseClient();
            const { data, error } = await client.rpc('get_agent_stats');
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load stats');
            }
            return { stats: data?.[0] || data || {} };
        }
    };

    const adminAPI = {
        getPlatformStats: async () => {
            const client = getSupabaseClient();
            const { data, error } = await client.rpc('get_admin_stats');
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load stats');
            }
            return { stats: data?.[0] || data || {} };
        },
        getAllUsers: async (role = null, limit = 50) => {
            const client = getSupabaseClient();
            let query = client
                .from('users')
                .select('id, name, email, phone, address, state, role, deleted_at, created_at')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (role) {
                query = query.eq('role', role);
            }

            const { data, error } = await query;
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load users');
            }
            return { users: data || [] };
        },
        getAllSubmissions: async (status = null, limit = 100) => {
            const client = getSupabaseClient();
            let query = client
                .from('waste_submissions')
                .select('id, material_type, weight_kg, payout, co2_saved, status, created_at, user_id, agent_id, users:users!waste_submissions_user_id_fkey(name), agents:users!waste_submissions_agent_id_fkey(name)')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;
            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load submissions');
            }

            const submissions = (data || []).map((row) => ({
                ...row,
                user_name: row.users?.name || 'Unknown',
                agent_name: row.agents?.name || '-'
            }));

            return { submissions };
        },
        getPendingWithdrawals: async () => {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from('withdrawal_requests')
                .select('id, amount, method, phone_number, bank_details, status, created_at, user_id, users:users!withdrawal_requests_user_id_fkey(name, email)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to load withdrawals');
            }

            const withdrawals = (data || []).map((row) => ({
                ...row,
                user_name: row.users?.name || 'Unknown',
                user_email: row.users?.email || ''
            }));

            return { withdrawals };
        },
        approveWithdrawal: async (withdrawalId, status) => {
            const client = getSupabaseClient();
            const { error } = await client.rpc('approve_withdrawal', {
                withdrawal_id: withdrawalId,
                new_status: status
            });

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to update withdrawal');
            }
            return { message: 'Withdrawal updated' };
        },
        createAdmin: async (payload) => {
            const { email, state } = payload || {};
            return adminAPI.updateUserRole(email, 'admin', state);
        },
        createAgent: async (payload) => {
            const { email, state } = payload || {};
            return adminAPI.updateUserRole(email, 'agent', state);
        },
        updateUserRole: async (email, role, state) => {
            const client = getSupabaseClient();
            let updatePayload = { role };
            if (state) updatePayload.state = state;

            const { data, error } = await client
                .from('users')
                .update(updatePayload)
                .eq('email', email)
                .select('id');

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to update user role');
            }

            if (!data || data.length === 0) {
                throw new Error('User not found. Ask them to sign up first.');
            }

            return { message: 'Role updated' };
        },
        softDeleteUser: async (userId) => {
            const client = getSupabaseClient();
            const { error } = await client
                .from('users')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to disable user');
            }

            return { message: 'User disabled' };
        },
        restoreUser: async (userId) => {
            const client = getSupabaseClient();
            const { error } = await client
                .from('users')
                .update({ deleted_at: null })
                .eq('id', userId);

            if (error) {
                throw normalizeSupabaseError(error, 'Failed to restore user');
            }

            return { message: 'User restored' };
        },
        deleteUser: async (userId) => {
            return adminAPI.softDeleteUser(userId);
        }
    };

    window.authAPI = authAPI;
    window.publicAPI = publicAPI;
    window.wasteAPI = wasteAPI;
    window.walletAPI = walletAPI;
    window.agentAPI = agentAPI;
    window.adminAPI = adminAPI;

    // Utility function to format currency
    window.formatCurrency = function formatCurrency(amount) {
        const value = Number(amount || 0);
        return `NGN ${value.toLocaleString('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    window.formatDate = function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    window.formatWeight = function formatWeight(weight) {
        const value = Number(weight || 0);
        return `${value.toFixed(3)} kg`;
    };
})();
