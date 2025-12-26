// server.js
const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
require('dotenv').config();

// ==================================================================
// 1. GLOBAL MIDDLEWARE
// ==================================================================

// Parsing Body Request (untuk menangkap data form POST)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set Folder Static (CSS, JS, Images dapat diakses publik)
app.use(express.static(path.join(__dirname, 'public')));

// View Engine Setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================================================================
// 2. SETUP SESSION (WAJIB SEBELUM ROUTES)
// ==================================================================
// Ini memperbaiki error "Cannot read properties of undefined (reading 'user')"
app.use(session({
    secret: process.env.SESSION_SECRET || 'kunci_cadangan_jika_env_kosong', // Ambil dari .env
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set true hanya jika menggunakan HTTPS
        httpOnly: true, // Mencegah akses cookie dari client-side script (keamanan)
        maxAge: 1000 * 60 * 60 * 2 // Sesi berlaku 2 jam
    }
}));

// Middleware Helper untuk mengirim data user ke semua view (Opsional tapi berguna)
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Agar di ejs bisa langsung panggil <%= user.email %>
    next();
});

// ==================================================================
// 3. ROUTE IMPORTS
// ==================================================================
const adminRoutes = require('./routes/adminRoutes');
const pesertaRoutes = require('./routes/pesertaRoutes');
const apiRoutes = require('./routes/apiRoutes');

// ==================================================================
// 4. ROUTE USAGE
// ==================================================================

// Route Admin (Login, Dashboard, CRUD)
// Akses: http://localhost:3000/admin/...
app.use('/admin', adminRoutes);

// Route API (Autocomplete, Data JSON)
// Akses: http://localhost:3000/api/...
app.use('/api', apiRoutes);

// Route Peserta (Halaman Utama Absensi)
// Akses: http://localhost:3000/
app.use('/', pesertaRoutes);

// ==================================================================
// 5. ERROR HANDLING
// ==================================================================

// Handle 404 (Halaman Tidak Ditemukan)
app.use((req, res) => {
    res.status(404).render('errors/404', { 
        title: 'Halaman Tidak Ditemukan',
        layout: false 
    });
});

// ==================================================================
// 6. SERVER START
// ==================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`Server Absensi Digital Berjalan!`);
    console.log(`Mode: ${process.env.NODE_ENV || 'Development'}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
});