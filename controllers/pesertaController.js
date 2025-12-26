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
        // 1. Ambil Pengaturan
        const { data: setting } = await supabase
            .from('pengaturan')
            .select('*')
            .limit(1)
            .single();

        if (!setting.sesi_aktif) {
            return res.status(400).json({ message: 'Sesi absensi sedang ditutup oleh Admin.' });
        }

        // 2. Validasi Jam Server
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0];

        if (currentTime < setting.jam_mulai || currentTime > setting.jam_selesai) {
            return res.status(400).json({ message: `Absensi hanya dibuka jam ${setting.jam_mulai} s/d ${setting.jam_selesai}` });
        }

        // 3. Cek Duplikasi
        const todayStart = new Date().toISOString().split('T')[0] + 'T00:00:00';
        const todayEnd = new Date().toISOString().split('T')[0] + 'T23:59:59';

        const { data: cekDuplikat } = await supabase
            .from('absensi')
            .select('id')
            .eq('peserta_id', peserta_id)
            .gte('waktu_absen', todayStart)
            .lte('waktu_absen', todayEnd);

        if (cekDuplikat.length > 0) {
            return res.status(400).json({ message: 'Anda sudah melakukan absensi hari ini.' });
        }

        // 4. Proses Simpan
        const { error } = await supabase
            .from('absensi')
            .insert([
                { 
                    peserta_id: peserta_id,
                    waktu_absen: new Date(), 
                    status: (currentTime > setting.jam_selesai) ? 'Terlambat' : 'Hadir' 
                }
            ]);

        if (error) throw error;

        // RESPONSE JSON SUKSES
        return res.status(200).json({ message: 'Absensi Berhasil', success: true });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Terjadi kesalahan server.' });
    }
};