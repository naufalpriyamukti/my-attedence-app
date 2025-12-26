const supabase = require('../utils/supabaseClient');

// 1. Halaman Login
exports.loginPage = (req, res) => {
    res.render('admin/login', { 
        title: 'Login Admin',
        layout: false, 
        error: null 
    });
};

// 2. Proses Login
exports.loginProcess = async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

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

// 3. Proses Logout
exports.logout = async (req, res) => {
    await supabase.auth.signOut();
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
};