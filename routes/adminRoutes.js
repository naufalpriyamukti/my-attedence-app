const express = require('express');
const router = express.Router();

// Import Controllers
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');

// Import Middleware
const { isAuthenticated, isGuest } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware'); // Middleware Upload Excel

// ==================================================================
// 1. ROUTE OTENTIKASI (LOGIN/LOGOUT)
// ==================================================================
router.get('/login', isGuest, authController.loginPage);
router.post('/login', isGuest, authController.loginProcess);
router.get('/logout', authController.logout);

// ==================================================================
// 2. DASHBOARD
// ==================================================================
// PENTING: Gunakan adminController.dashboard, JANGAN render langsung di sini
router.get('/dashboard', isAuthenticated, adminController.dashboard);

// ==================================================================
// 3. MANAJEMEN DATA PESERTA
// ==================================================================
// Lihat Data
router.get('/data-peserta', isAuthenticated, adminController.halamanPeserta);

// Tambah Peserta (Manual) - BARU
router.post('/tambah-peserta', isAuthenticated, adminController.tambahPeserta);

// Edit Peserta - BARU
router.post('/edit-peserta', isAuthenticated, adminController.editPeserta);

// Import Excel
router.post('/import-peserta', isAuthenticated, upload.single('fileExcel'), adminController.importPeserta);

// Hapus Peserta
router.get('/hapus-peserta/:id', isAuthenticated, adminController.hapusPeserta);

// ==================================================================
// 4. LAPORAN ABSENSI
// ==================================================================
router.get('/laporan', isAuthenticated, adminController.halamanLaporan);
router.get('/export-laporan', isAuthenticated, adminController.exportLaporan);

// ==================================================================
// 5. ABSENSI MANUAL
// ==================================================================
router.get('/absensi-manual', isAuthenticated, adminController.halamanManual);
router.post('/absensi-manual', isAuthenticated, adminController.prosesManual);

// ==================================================================
// 6. PENGATURAN
// ==================================================================
router.get('/pengaturan', isAuthenticated, adminController.halamanPengaturan);
router.post('/pengaturan', isAuthenticated, adminController.updatePengaturan);

module.exports = router;