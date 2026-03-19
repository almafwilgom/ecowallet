/**
 * EcoWallet API Service
 * Configured for Supabase Backend (BaaS)
 */

const supabaseUrl = window.ECOWALLET_SUPABASE_URL;
const supabaseKey = window.ECOWALLET_SUPABASE_ANON_KEY;
let supabase = null;

if (window.supabase && supabaseUrl && supabaseKey) {
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('Supabase client not initialized. Ensure supabase-js is loaded and config.js has credentials.');
}

function getClient() {
    if (!supabase) throw new Error('Supabase not connected. Refresh page or check config.');
    return supabase;
}

function getCurrentUserId() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr).id : null;
}

window.authAPI = {
    async login(email, password) {
        const { data, error } = await getClient().auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Fetch user profile from 'users' table if needed, or construct from metadata
        const user = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email.split('@')[0],
            role: data.user.user_metadata?.role || 'user',
            state: data.user.user_metadata?.state
        };
        
        localStorage.setItem('user', JSON.stringify(user));
        // Supabase handles session persistence
        return { user, session: data.session };
    },
    async register(userData) {
        const { data, error } = await getClient().auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    name: userData.name,
                    state: userData.state,
                    role: 'user'
                }
            }
        });
        if (error) throw error;
        return data;
    },
    async logout() {
        await getClient().auth.signOut();
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
};

window.agentAPI = {
    async getAgentStats() {
        const { data, error } = await getClient().rpc('get_agent_stats'); // Assuming RPC or view
        if (error) {
             // Fallback to manual calc if RPC missing
             const userId = getCurrentUserId();
             const { count } = await getClient().from('waste_submissions')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', userId).eq('status', 'collected');
             return { stats: { total_collections: count || 0 } };
        }
        return { stats: data || {} };
    },
    async getPendingCollections() {
        const { data, error } = await getClient().from('waste_submissions')
            .select('*, users:user_id(name)') // Join logic depends on Supabase setup
            .eq('status', 'pending');
        if (error) throw error;
        // Map join result if necessary
        const mapped = data.map(d => ({...d, user_name: d.users?.name}));
        return { collections: mapped };
    },
    async getRecentCollections() {
        const userId = getCurrentUserId();
        const { data, error } = await getClient().from('waste_submissions')
            .select('*, users:user_id(name)')
            .eq('agent_id', userId)
            .eq('status', 'collected');
        if (error) throw error;
        const mapped = data.map(d => ({...d, user_name: d.users?.name}));
        return { collections: mapped };
    },
    async updateCollectionStatus(id, status) {
        const userId = getCurrentUserId();
        const { error } = await getClient().from('waste_submissions')
            .update({ status, agent_id: userId })
            .eq('id', id);
        if (error) throw error;
        return { message: 'Updated' };
    }
};

window.adminAPI = {
    async getPlatformStats() {
        const { data, error } = await getClient().from('platform_stats').select('*').single();
        if (error) throw error;
        return { stats: data };
    },
    async getPendingWithdrawals() {
        const { data, error } = await getClient().from('withdrawal_requests')
            .select('*, users:user_id(name, email)')
            .eq('status', 'pending');
        if (error) throw error;
        const mapped = data.map(d => ({...d, user_name: d.users?.name, email: d.users?.email}));
        return { withdrawals: mapped };
    },
    async approveWithdrawal(id, status) {
        const { error } = await getClient().from('withdrawal_requests')
            .update({ status })
            .eq('id', id);
        if (error) throw error;
        return { message: 'Updated' };
    },
    async getAllSubmissions(status) {
        let query = getClient().from('waste_submissions').select('*, users:user_id(name), agent:agent_id(name)');
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        const mapped = data.map(d => ({...d, user_name: d.users?.name, agent_name: d.agent?.name}));
        return { submissions: mapped };
    },
    async getAllUsers(role) {
        let query = getClient().from('users').select('*');
        if (role) query = query.eq('role', role);
        const { data, error } = await query;
        if (error) throw error;
        return { users: data };
    },
    async createAgent() {
        throw new Error('Creating agents requires Supabase Admin Dashboard or Edge Functions.');
    },
    async createAdmin() {
        throw new Error('Creating admins requires Supabase Admin Dashboard or Edge Functions.');
    },
    async softDeleteUser(id) {
        const { error } = await getClient().from('users').update({ deleted_at: new Date() }).eq('id', id);
        if (error) throw error;
    },
    async restoreUser(id) {
        const { error } = await getClient().from('users').update({ deleted_at: null }).eq('id', id);
        if (error) throw error;
    },
    async deleteUser() {
         // Hard delete
         throw new Error('Hard delete restricted on client.');
    }
};

window.wasteAPI = {
    async submitWaste(data) {
        const userId = getCurrentUserId();
        const { data: result, error } = await getClient().from('waste_submissions').insert({
            user_id: userId,
            material_type: data.material_type,
            weight_kg: data.weight_kg,
            location: data.location,
            // Payout calculation ideally happens via DB trigger or RPC.
            // For now sending rough calculation or relying on DB default/trigger
            payout: 0, 
            co2_saved: 0,
            status: 'pending'
        }).select().single();
        if (error) throw error;
        return { message: 'Waste submitted', submission: result };
    },
    async getUserStats() {
        const userId = getCurrentUserId();
        const { data, error } = await getClient().from('user_stats').select('*').eq('id', userId).single();
        if (error) return { stats: {} }; // Stats might be empty for new user
        return { stats: data };
    },
    async getLeaderboard(limit) {
        const { data, error } = await getClient().from('leaderboard').select('*').limit(limit || 10);
        if (error) throw error;
        return { leaderboard: data };
    },
    async getUserSubmissions(status) {
        const userId = getCurrentUserId();
        let query = getClient().from('waste_submissions').select('*').eq('user_id', userId);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return { submissions: data };
    }
};

window.walletAPI = {
    async getBalance() {
        const userId = getCurrentUserId();
        const { data, error } = await getClient().from('wallets').select('balance').eq('user_id', userId).single();
        if (error) return { wallet: { balance: 0 } };
        return { wallet: data };
    },
    async requestWithdrawal(data) {
        const userId = getCurrentUserId();
        const { data: result, error } = await getClient().from('withdrawal_requests').insert({
            user_id: userId,
            amount: data.amount,
            method: data.method,
            phone_number: data.phone_number,
            bank_details: JSON.stringify({
                account: data.bank_account,
                bank: data.bank_name,
                name: data.account_name
            }),
            status: 'pending'
        }).select().single();
        if (error) throw error;
        return { withdrawal: result };
    },
    async getWithdrawals() {
        const userId = getCurrentUserId();
        const { data, error } = await getClient().from('withdrawal_requests').select('*').eq('user_id', userId);
        if (error) throw error;
        return { withdrawals: data };
    }
};

// Session Sync Shim (keeps compatibility with existing auth.js)
window.syncSupabaseSession = async function() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
        const user = {
            id: data.session.user.id,
            email: data.session.user.email,
            name: data.session.user.user_metadata?.name,
            role: data.session.user.user_metadata?.role || 'user',
            state: data.session.user.user_metadata?.state
        };
        localStorage.setItem('user', JSON.stringify(user));
        return user;
    }
    return null;
};