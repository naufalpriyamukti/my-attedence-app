const express = require('express');
const router = express.Router();
const pesertaController = require('../controllers/pesertaController');

// Halaman Utama Absensi
router.get('/', pesertaController.index);

// Proses Submit Absen
router.post('/absen', pesertaController.submitAbsen);

module.exports = router;