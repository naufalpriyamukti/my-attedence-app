const supabase = require('../utils/supabaseClient');
const ExcelJS = require('exceljs');

// ==================================================================
// 1. DASHBOARD (LOGIKA BARU)
// ==================================================================
exports.dashboard = async (req, res) => {
    try {
        // Setup rentang waktu hari ini (00:00 - 23:59)
        const todayStr = new Date().toISOString().split('T')[0];
        const todayStart = `${todayStr}T00:00:00`;
        const todayEnd = `${todayStr}T23:59:59`;

        // A. Hitung Total Peserta
        const { count: totalPeserta, error: errTotal } = await supabase
            .from('peserta')
            .select('*', { count: 'exact', head: true });

        // B. Hitung Yang Hadir (Status: Hadir)
        const { count: hadirHariIni, error: errHadir } = await supabase
            .from('absensi')
            .select('*', { count: 'exact', head: true })
            .gte('waktu_absen', todayStart)
            .lte('waktu_absen', todayEnd)
            .eq('status', 'Hadir');

        // C. Hitung Yang Terlambat (Status: Terlambat)
         const { count: terlambat, error: errLambat } = await supabase
            .from('absensi')
            .select('*', { count: 'exact', head: true })
            .gte('waktu_absen', todayStart)
            .lte('waktu_absen', todayEnd)
            .eq('status', 'Terlambat');

        // D. Logika Mencari Siapa yang BELUM Absen
        // 1. Ambil semua peserta
        const { data: allPeserta } = await supabase.from('peserta').select('*').order('nama', { ascending: true });
        
        // 2. Ambil semua ID yang sudah absen hari ini
        const { data: absenToday } = await supabase
            .from('absensi')
            .select('peserta_id')
            .gte('waktu_absen', todayStart)
            .lte('waktu_absen', todayEnd);
        
        // 3. Filter: Peserta yang ID-nya TIDAK ada di daftar absenToday
        const idYangSudahAbsen = absenToday.map(a => a.peserta_id);
        const belumAbsenList = allPeserta.filter(p => !idYangSudahAbsen.includes(p.id));

        // E. Render View
        res.render('admin/dashboard', { 
            title: 'Dashboard - Admin Panel',
            user: req.session.user,
            page: 'dashboard',
            stats: {
                total: totalPeserta || 0,
                hadir: hadirHariIni || 0,
                terlambat: terlambat || 0,
                belum: (totalPeserta || 0) - ((hadirHariIni || 0) + (terlambat || 0))
            },
            belumAbsenList: belumAbsenList // Data untuk tabel "Belum Absen"
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        // Fallback jika error agar tidak crash
        res.render('admin/dashboard', { 
            title: 'Dashboard', 
            user: req.session.user, 
            page: 'dashboard', 
            stats: { total: 0, hadir: 0, terlambat: 0, belum: 0 }, 
            belumAbsenList: [] 
        });
    }
};

// ==================================================================
// 2. MANAJEMEN PESERTA (CRUD LENGKAP)
// ==================================================================

// Tampilkan Halaman Data Peserta
exports.halamanPeserta = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('peserta')
            .select('*')
            .order('nama', { ascending: true });

        if (error) throw error;

        res.render('admin/data-peserta', {
            title: 'Data Peserta',
            page: 'data-peserta',
            user: req.session.user,
            peserta: data,
            status: req.query.status
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi Kesalahan Server");
    }
};

// [BARU] Tambah Peserta Manual
exports.tambahPeserta = async (req, res) => {
    const { nama, nim, prodi } = req.body;
    try {
        const { error } = await supabase.from('peserta').insert([{ nama, nim, prodi }]);
        if(error) throw error;
        res.redirect('/admin/data-peserta?status=success_add');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/data-peserta?status=error');
    }
};

// [BARU] Edit Peserta
exports.editPeserta = async (req, res) => {
    const { id, nama, nim, prodi } = req.body;
    try {
        const { error } = await supabase
            .from('peserta')
            .update({ nama, nim, prodi })
            .eq('id', id);
            
        if(error) throw error;
        res.redirect('/admin/data-peserta?status=success_edit');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/data-peserta?status=error');
    }
};

// Hapus Peserta
exports.hapusPeserta = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('peserta').delete().eq('id', id);
        if (error) throw error;
        res.redirect('/admin/data-peserta?status=success_delete');
    } catch (err) {
        res.redirect('/admin/data-peserta?status=error_delete');
    }
};

// Import Excel
exports.importPeserta = async (req, res) => {
    try {
        if (!req.file) return res.redirect('/admin/data-peserta?status=error_no_file');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);
        
        const dataToInsert = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; 

            const nama = row.getCell(1).value;
            const nim = row.getCell(2).value;
            const prodi = row.getCell(3).value;

            if (nama && nim) {
                dataToInsert.push({
                    nama: nama.toString(),
                    nim: nim.toString(),
                    prodi: prodi ? prodi.toString() : '-'
                });
            }
        });

        if (dataToInsert.length > 0) {
            const { error } = await supabase.from('peserta').insert(dataToInsert);
            if (error) throw error;
        }

        res.redirect('/admin/data-peserta?status=success_import');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/data-peserta?status=error_import');
    }
};

// ==================================================================
// 3. LAPORAN ABSENSI
// ==================================================================

exports.halamanLaporan = async (req, res) => {
    const { tanggal_mulai, tanggal_selesai } = req.query;
    
    const today = new Date().toISOString().split('T')[0];
    const start = tanggal_mulai || today;
    const end = tanggal_selesai || today;

    const startTime = `${start}T00:00:00`;
    const endTime = `${end}T23:59:59`;

    try {
        const { data, error } = await supabase
            .from('absensi')
            .select(`
                id, waktu_absen, status,
                peserta ( nama, nim, prodi ) 
            `)
            .gte('waktu_absen', startTime)
            .lte('waktu_absen', endTime)
            .order('waktu_absen', { ascending: false });

        if (error) throw error;

        res.render('admin/laporan', {
            title: 'Laporan Absensi',
            page: 'laporan',
            user: req.session.user,
            absensi: data,
            filter: { start, end }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Terjadi Kesalahan Server saat mengambil laporan.");
    }
};

exports.exportLaporan = async (req, res) => {
    const { tanggal_mulai, tanggal_selesai } = req.query;
    
    const start = tanggal_mulai || new Date().toISOString().split('T')[0];
    const end = tanggal_selesai || new Date().toISOString().split('T')[0];

    try {
        const { data, error } = await supabase
            .from('absensi')
            .select(`waktu_absen, status, peserta ( nama, nim, prodi )`)
            .gte('waktu_absen', `${start}T00:00:00`)
            .lte('waktu_absen', `${end}T23:59:59`)
            .order('waktu_absen', { ascending: true });

        if (error) throw error;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Absensi');

        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Tanggal', key: 'tanggal', width: 15 },
            { header: 'Jam', key: 'jam', width: 10 },
            { header: 'Nama Lengkap', key: 'nama', width: 30 },
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
                nama: row.peserta ? row.peserta.nama : 'Peserta Terhapus',
                nim: row.peserta ? row.peserta.nim : '-',
                prodi: row.peserta ? row.peserta.prodi : '-',
                status: row.status
            });
        });

        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Absensi_${start}_sd_${end}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).send("Gagal Export Excel");
    }
};

// ==================================================================
// 4. PENGATURAN SISTEM
// ==================================================================

exports.halamanPengaturan = async (req, res) => {
    try {
        let { data, error } = await supabase
            .from('pengaturan')
            .select('*')
            .order('id', { ascending: true })
            .limit(1)
            .single();

        if (!data) {
             const { data: newData } = await supabase
                .from('pengaturan')
                .insert([{ jam_mulai: '07:00', jam_selesai: '17:00', sesi_aktif: true }])
                .select()
                .single();
             data = newData;
        }

        res.render('admin/pengaturan', {
            title: 'Pengaturan Sistem',
            page: 'pengaturan',
            user: req.session.user,
            setting: data,
            status: req.query.status
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error mengambil pengaturan");
    }
};

exports.updatePengaturan = async (req, res) => {
    const { jam_mulai, jam_selesai, sesi_aktif } = req.body;
    const isAktif = sesi_aktif === 'on';

    try {
        const { error } = await supabase
            .from('pengaturan')
            .update({ 
                jam_mulai, 
                jam_selesai, 
                sesi_aktif: isAktif 
            })
            .gt('id', 0);

        if (error) throw error;
        res.redirect('/admin/pengaturan?status=success');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/pengaturan?status=error');
    }
};

// ==================================================================
// 5. ABSENSI MANUAL
// ==================================================================

exports.halamanManual = async (req, res) => {
    const { data: peserta } = await supabase.from('peserta').select('id, nama, nim').order('nama');
    
    res.render('admin/absensi-manual', {
        title: 'Absensi Manual',
        page: 'absensi-manual',
        user: req.session.user,
        peserta: peserta || [],
        status: req.query.status
    });
};

exports.prosesManual = async (req, res) => {
    const { peserta_id, tanggal, jam, status } = req.body;
    const waktu_absen = `${tanggal}T${jam}:00`;

    try {
        const { error } = await supabase.from('absensi').insert([{
            peserta_id,
            waktu_absen,
            status
        }]);

        if (error) throw error;
        res.redirect('/admin/absensi-manual?status=success');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/absensi-manual?status=error');
    }
};