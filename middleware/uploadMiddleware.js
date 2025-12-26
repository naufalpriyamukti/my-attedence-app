const multer = require('multer');

// Kita gunakan memoryStorage agar file tidak perlu disimpan ke harddisk server,
// tapi langsung diproses di memori (lebih cepat untuk file kecil/sedang).
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Validasi hanya menerima file Excel
        if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheetml')) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file Excel yang diperbolehkan!'), false);
        }
    }
});

module.exports = upload;