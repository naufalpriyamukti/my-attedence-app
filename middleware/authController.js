const supabase = require('../utils/supabaseClient');

// Halaman Login
exports.loginPage = (req, res) => {
    res.render('admin/login', { 
        title: 'Login Admin',
        layout: false, // Login tidak butuh layout sidebar
        error: null 
    });
};

// Proses Login
exports.loginProcess = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Cek ke Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Simpan data user ke session server
        req.session.user = data.user;
        req.session.save(() => {
            res.redirect('/admin/dashboard');
        });

    } catch (err) {
        res.render('admin/login', { 
            title: 'Login Admin',
            layout: false,
            error: 'Email atau Password salah!'
        });
    }
};

// Proses Logout
exports.logout = async (req, res) => {
    await supabase.auth.signOut();
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
};