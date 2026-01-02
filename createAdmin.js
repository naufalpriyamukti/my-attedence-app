// createAdmin.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Gunakan SERVICE_ROLE_KEY jika ada, atau ANON key tidak apa-apa jika "Enable Signups" nyala
const supabase = createClient(supabaseUrl, supabaseKey);

// ... kode sebelumnya ...

async function createAdmin() {
    console.log("Sedang membuat user admin...");
    
    const { data, error } = await supabase.auth.signUp({
        email: 'admin@mrc.com', // Ganti ke domain umum
        password: 'admin123',
    });

    if (error) {
        console.error("Gagal membuat admin:", error.message);
    } else {
        console.log("SUKSES! Admin berhasil dibuat.");
        console.log("User ID:", data.user.id);
        console.log("Silakan cek email untuk verifikasi, atau confirm manual di dashboard Supabase.");
    }
}

createAdmin();