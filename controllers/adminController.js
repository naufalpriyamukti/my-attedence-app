const supabase = require('../utils/supabaseClient');
const ExcelJS = require('exceljs');

// Helper: Mendapatkan tanggal hari ini dalam format YYYY-MM-DD sesuai lokal (WIB/Server)
const getLocalDate = () => {
    const now = new Date();
    // Mengoreksi offset timezone agar sesuai lokal
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - offset).toISOString().slice(0, 10);
    return localISOTime;
};

// ==================================================================
// 1. DASHBOARD
// ==================================================================
exports.dashboard = async (req, res) => {
    try {
        // 1. Tangkap Tanggal dari Query URL (Default: Hari Ini)
        // Dashboard EJS menggunakan name="date"
        const selectedDate = req.query.date || getLocalDate();

        // FIX BUG TANGGAL: Menggunakan format ISO string lengkap
        // Tambahkan jam spesifik agar query Supabase akurat
        const startTime = `${selectedDate}T00:00:00`;
        const endTime = `${selectedDate}T23:59:59`;

        // 2. Hitung Statistik (Berdasarkan Tanggal Terpilih)
        // Total Peserta (Selalu semua)
        const { count: totalPeserta } = await supabase.from('peserta').select('*', { count: 'exact', head: true });
        
        // Hadir pada tanggal terpilih
        const { count: hadir } = await supabase.from('absensi')
            .select('*', { count: 'exact', head: true })
            .gte('waktu_absen', startTime).lte('waktu_absen', endTime)
            .eq('status', 'Hadir');

        // Terlambat pada tanggal terpilih
        const { count: terlambat } = await supabase.from('absensi')
            .select('*', { count: 'exact', head: true })
            .gte('waktu_absen', startTime).lte('waktu_absen', endTime)
            .eq('status', 'Terlambat');
            
        // Izin pada tanggal terpilih
        const { count: izin } = await supabase.from('absensi')
            .select('*', { count: 'exact', head: true })
            .gte('waktu_absen', startTime).lte('waktu_absen', endTime)
            .eq('status', 'Izin');

        // 3. LOGIKA LIST TABEL (MERGE DATA)
        const { data: allPeserta } = await supabase.from('peserta').select('*').order('nama', { ascending: true });
        
        // Ambil data absen pada tanggal terpilih
        const { data: absenSession } = await supabase
            .from('absensi')
            .select('peserta_id, status, waktu_absen')
            .gte('waktu_absen', startTime).lte('waktu_absen', endTime);

        // Gabungkan data
        const attendanceList = allPeserta.map(p => {
            const log = absenSession.find(a => a.peserta_id === p.id);
            return {
                nim: p.nim,
                nama: p.nama,
                prodi: p.prodi,
                status: log ? log.status : 'Belum Absen',
                // Tampilkan waktu lokal
                waktu: log ? new Date(log.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'
            };
        });

        // 4. Render View
        res.render('admin/dashboard', { 
            title: 'Dashboard - Admin Panel',
            user: req.session.user,
            page: 'dashboard',
            stats: {
                total: totalPeserta || 0,
                hadir: hadir || 0,
                terlambat: terlambat || 0,
                izin: izin || 0,
                belum: (totalPeserta || 0) - ((hadir || 0) + (terlambat || 0) + (izin || 0))
            },
            attendanceList: attendanceList,
            filterDate: selectedDate // Kirim tanggal ke view untuk form filter & tombol export
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.render('admin/dashboard', { 
            title: 'Dashboard', user: req.session.user, page: 'dashboard', 
            stats: { total: 0, hadir: 0, terlambat: 0, izin: 0, belum: 0 }, 
            attendanceList: [], filterDate: getLocalDate()
        });
    }
};

// ==================================================================
// 2. MANAJEMEN PESERTA (CRUD LENGKAP)
// ==================================================================
exports.halamanPeserta = async (req, res) => {
    try {
        const { data, error } = await supabase.from('peserta').select('*').order('nama', { ascending: true });
        if (error) throw error;
        res.render('admin/data-peserta', {
            title: 'Data Peserta', page: 'data-peserta', user: req.session.user,
            peserta: data, status: req.query.status, msg: req.query.msg
        });
    } catch (err) { res.status(500).send("Server Error"); }
};

exports.tambahPeserta = async (req, res) => {
    const { nama, nim, prodi } = req.body;
    try {
        const { error } = await supabase.from('peserta').insert([{ nama, nim, prodi }]);
        if(error) throw error;
        res.redirect('/admin/data-peserta?status=success&msg=Peserta berhasil ditambahkan');
    } catch (err) { res.redirect('/admin/data-peserta?status=error&msg=Gagal menambah peserta'); }
};

exports.editPeserta = async (req, res) => {
    const { id, nama, nim, prodi } = req.body;
    try {
        const { error } = await supabase.from('peserta').update({ nama, nim, prodi }).eq('id', id);   
        if(error) throw error;
        res.redirect('/admin/data-peserta?status=success&msg=Data peserta diperbarui');
    } catch (err) { res.redirect('/admin/data-peserta?status=error&msg=Gagal update peserta'); }
};

exports.hapusPeserta = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('peserta').delete().eq('id', id);
        if (error) throw error;
        res.redirect('/admin/data-peserta?status=success&msg=Peserta berhasil dihapus');
    } catch (err) { res.redirect('/admin/data-peserta?status=error&msg=Gagal menghapus peserta'); }
};

exports.importPeserta = async (req, res) => {
    try {
        if (!req.file) return res.redirect('/admin/data-peserta?status=error&msg=File tidak ditemukan');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);
        const dataToInsert = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; 
            let cell1 = row.getCell(1).value;
            let nama, nim, prodi;
            
            if (cell1 && !isNaN(cell1)) { 
                nama = row.getCell(2).value; nim = row.getCell(3).value; prodi = row.getCell(4).value;
            } else {
                nama = row.getCell(1).value; nim = row.getCell(2).value; prodi = row.getCell(3).value;
            }
            if (nama && nim) {
                dataToInsert.push({ nama: nama.toString(), nim: nim.toString(), prodi: prodi ? prodi.toString() : '-' });
            }
        });

        if (dataToInsert.length > 0) {
            const { error } = await supabase.from('peserta').insert(dataToInsert);
            if (error) throw error;
        }
        res.redirect('/admin/data-peserta?status=success&msg=Import Excel Berhasil');
    } catch (err) { res.redirect('/admin/data-peserta?status=error&msg=Gagal Import Excel'); }
};

// ==================================================================
// 3. PENGATURAN & RESET
// ==================================================================
exports.halamanPengaturan = async (req, res) => {
    try {
        let { data, error } = await supabase.from('pengaturan').select('*').limit(1).single();
        if (!data) {
             const { data: newData } = await supabase.from('pengaturan')
                .insert([{ jam_mulai: '07:00', jam_selesai: '17:00', sesi_aktif: true }]).select().single();
             data = newData;
        }
        res.render('admin/pengaturan', {
            title: 'Pengaturan Sistem', page: 'pengaturan', user: req.session.user,
            setting: data, status: req.query.status, msg: req.query.msg
        });
    } catch (err) { res.status(500).send("Error mengambil pengaturan"); }
};

exports.updatePengaturan = async (req, res) => {
    const { jam_mulai, jam_selesai, sesi_aktif } = req.body;
    const isAktif = sesi_aktif === 'on';
    try {
        const { error } = await supabase.from('pengaturan').update({ jam_mulai, jam_selesai, sesi_aktif: isAktif }).gt('id', 0);
        if (error) throw error;
        res.redirect('/admin/pengaturan?status=success&msg=Pengaturan Jam Disimpan');
    } catch (err) { res.redirect('/admin/pengaturan?status=error&msg=Gagal menyimpan pengaturan'); }
};

exports.resetAbsensi = async (req, res) => {
    try {
        const { error } = await supabase.from('pengaturan').update({ last_reset: new Date() }).gt('id', 0);
        if (error) throw error;
        res.redirect('/admin/pengaturan?status=success&msg=Sesi Baru Dimulai! Peserta bisa absen kembali.');
    } catch (err) { res.redirect('/admin/pengaturan?status=error&msg=Gagal mereset absensi.'); }
};

// ==================================================================
// 4. LAPORAN & MANUAL (LOGIKA BARU: SINGLE DATE)
// ==================================================================
exports.halamanLaporan = async (req, res) => {
    // Tangkap parameter 'tanggal' dari URL (Laporan EJS menggunakan name="tanggal")
    const selectedDate = req.query.tanggal || getLocalDate();

    // Set rentang waktu 1 hari penuh (Local Aware)
    const startTime = `${selectedDate}T00:00:00`;
    const endTime = `${selectedDate}T23:59:59`;

    try {
        const { data, error } = await supabase
            .from('absensi')
            .select(`id, waktu_absen, status, peserta ( nama, nim, prodi )`)
            .gte('waktu_absen', startTime)
            .lte('waktu_absen', endTime)
            .order('waktu_absen', { ascending: false });

        if (error) throw error;

        res.render('admin/laporan', {
            title: 'Laporan Absensi', page: 'laporan', user: req.session.user,
            absensi: data, filterDate: selectedDate, status: req.query.status, msg: req.query.msg
        });
    } catch (err) { res.status(500).send("Error Laporan"); }
};

exports.exportLaporan = async (req, res) => {
    // Support parameter 'tanggal' (dari Laporan) atau 'date' (jika dari Dashboard)
    const selectedDate = req.query.tanggal || req.query.date || getLocalDate();

    const startTime = `${selectedDate}T00:00:00`;
    const endTime = `${selectedDate}T23:59:59`;

    try {
        const { data, error } = await supabase
            .from('absensi')
            .select(`waktu_absen, status, peserta ( nama, nim, prodi )`)
            .gte('waktu_absen', startTime)
            .lte('waktu_absen', endTime)
            .order('waktu_absen', { ascending: true });

        if (error) throw error;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan');
        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Tanggal', key: 'tanggal', width: 15 },
            { header: 'Jam', key: 'jam', width: 10 },
            { header: 'Nama', key: 'nama', width: 30 },
            { header: 'NIM', key: 'nim', width: 15 },
            { header: 'Prodi', key: 'prodi', width: 25 },
            { header: 'Status', key: 'status', width: 15 }
        ];
        data.forEach((row, index) => {
            const dateObj = new Date(row.waktu_absen);
            worksheet.addRow({
                no: index + 1,
                tanggal: dateObj.toLocaleDateString('id-ID'),
                jam: dateObj.toLocaleTimeString('id-ID'),
                nama: row.peserta?.nama || '-',
                nim: row.peserta?.nim || '-',
                prodi: row.peserta?.prodi || '-',
                status: row.status
            });
        });
        worksheet.getRow(1).font = { bold: true };
        
        // Nama file menyertakan tanggal yang dipilih
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Absensi_${selectedDate}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) { res.status(500).send("Gagal Export"); }
};

exports.halamanManual = async (req, res) => {
    const { data: peserta } = await supabase.from('peserta').select('id, nama, nim').order('nama');
    res.render('admin/absensi-manual', {
        title: 'Absensi Manual', page: 'absensi-manual', user: req.session.user, peserta: peserta || [],
        status: req.query.status, msg: req.query.msg
    });
};

exports.prosesManual = async (req, res) => {
    const { peserta_id, tanggal, jam, status } = req.body;
    try {
        const { error } = await supabase.from('absensi').insert([{ peserta_id, waktu_absen: `${tanggal}T${jam}:00`, status }]);
        if (error) throw error;
        res.redirect('/admin/absensi-manual?status=success&msg=Absensi manual berhasil disimpan');
    } catch (err) { res.redirect('/admin/absensi-manual?status=error&msg=Gagal menyimpan data'); }
};