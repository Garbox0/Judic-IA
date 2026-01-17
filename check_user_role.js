
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'gbrlescalada@gmail.com';
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
    } else {
        console.log('Profile found:', profile);
    }

    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);
    if (authUser) {
        console.log('Auth user found:', { id: authUser.id, email: authUser.email, metadata: authUser.user_metadata });
    } else {
        console.log('Auth user not found');
    }
}

checkUser();
