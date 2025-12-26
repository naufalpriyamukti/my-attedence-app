const express = require('express');
const router = express.Router();
const pesertaController = require('../controllers/pesertaController');

// Endpoint untuk dipanggil AJAX dari frontend
router.get('/search-peserta', pesertaController.searchPeserta);

module.exports = router;