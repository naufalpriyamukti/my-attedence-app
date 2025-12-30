const supabase = require('../utils/SupabaseClient');
// 1. Tampilkan Halaman Utama
exports.index = (req, res) => {
    res.render('peserta/index', { 
        title: 'Absensi Digital',
        error: null,
        success: null 
    });
};

// 2. API Pencarian Peserta (Autocomplete)
exports.searchPeserta = async (req, res) => {
    const { query } = req.query;
    
    if (!query) return res.json([]);

    try {
        const { data, error } = await supabase
            .from('peserta')
            .select('id, nama, nim, prodi')
            .or(`nama.ilike.%${query}%,nim.ilike.%${query}%`)
            .limit(5);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
};

exports.submitAbsen = async (req, res) => {
    const { peserta_id } = req.body;

    try {
        // 1. Ambil Pengaturan (Jam & Waktu Reset Terakhir)
        const { data: setting, error: errSetting } = await supabase
            .from('pengaturan')
            .select('*')
            .limit(1)
            .single();
        
        if (errSetting || !setting) throw new Error("Gagal mengambil pengaturan sistem.");

        // 2. Validasi Sesi Aktif
        if (!setting.sesi_aktif) {
            return res.status(400).json({ message: 'Sesi absensi sedang ditutup oleh Admin.' });
        }

        // 3. Validasi Jam Server
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // Format "HH:MM:SS"

        if (currentTime < setting.jam_mulai || currentTime > setting.jam_selesai) {
            return res.status(400).json({ message: `Absensi hanya dibuka jam ${setting.jam_mulai} - ${setting.jam_selesai}` });
        }

        // 4. CEK DUPLIKASI CERDAS (Berdasarkan 'last_reset')
        // Jika admin belum pernah reset, pakai awal hari ini sebagai fallback
        const checkTime = setting.last_reset || new Date().toISOString().split('T')[0] + 'T00:00:00';

        const { data: cekDuplikat } = await supabase
            .from('absensi')
            .select('id')
            .eq('peserta_id', peserta_id)
            .gte('waktu_absen', checkTime); // Cek apakah sudah absen SETELAH admin melakukan reset terakhir

        if (cekDuplikat.length > 0) {
            return res.status(400).json({ message: 'Anda sudah melakukan absensi untuk sesi ini.' });
        }

        // 5. Simpan Absen
        // Tentukan status (Hadir/Terlambat)
        // Logika sederhana: Jika masih dalam jam buka = Hadir (Karena kalau lewat jam tutup sudah dicek di langkah 3)
        // Tapi jika ingin logika terlambat spesifik, bisa disesuaikan. Di sini kita anggap Hadir jika dalam range.
        const status = 'Hadir'; 

        const { error } = await supabase
            .from('absensi')
            .insert([{ 
                peserta_id, 
                waktu_absen: new Date(), 
                status: status 
            }]);

        if (error) throw error;

        // RESPONSE SUKSES
        return res.status(200).json({ message: 'Absensi Berhasil', success: true });

    } catch (err) {
        console.error("Error Absen:", err);
        return res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};