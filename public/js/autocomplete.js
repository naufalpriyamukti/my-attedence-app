const inputNama = document.getElementById('inputNama');
const suggestionsBox = document.getElementById('suggestions');
const inputNIM = document.getElementById('inputNIM');
const inputProdi = document.getElementById('inputProdi');
const inputId = document.getElementById('peserta_id');
const btnSubmit = document.getElementById('btnSubmit');
const formAbsensi = document.getElementById('formAbsensi');

// 1. Logika Autocomplete
inputNama.addEventListener('input', async function() {
    const query = this.value;

    // Jika user mengetik ulang, reset ID tersembunyi
    if (inputId.value) {
        inputId.value = '';
        inputNIM.value = '';
        inputProdi.value = '';
        btnSubmit.disabled = true;
    }

    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        suggestionsBox.innerHTML = '';
        return;
    }

    try {
        const res = await fetch(`/api/search-peserta?query=${query}`);
        const data = await res.json();

        suggestionsBox.innerHTML = '';
        
        if (data.length > 0) {
            suggestionsBox.style.display = 'block';
            data.forEach(item => {
                const button = document.createElement('button');
                button.type = 'button';
                button.classList.add('list-group-item', 'list-group-item-action');
                button.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div style="text-align: left;">
                            <strong>${item.nama}</strong>
                            <br><small class="text-muted">${item.nim}</small>
                        </div>
                        <span class="badge bg-secondary">${item.prodi}</span>
                    </div>
                `;
                
                button.addEventListener('click', () => {
                    inputNama.value = item.nama;     
                    inputNIM.value = item.nim;       
                    inputProdi.value = item.prodi;   
                    inputId.value = item.id;         
                    
                    suggestionsBox.style.display = 'none'; 
                    btnSubmit.disabled = false;      
                });
                
                suggestionsBox.appendChild(button);
            });
        } else {
            suggestionsBox.style.display = 'none';
        }
    } catch (err) {
        console.error("Error fetching data:", err);
    }
});

// Sembunyikan saran jika klik di luar
document.addEventListener('click', function(e) {
    if (!inputNama.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});

// 2. Logika Submit dengan SweetAlert Tombol
formAbsensi.addEventListener('submit', async function(e) {
    e.preventDefault(); 

    const peserta_id = inputId.value;

    // Validasi input kosong
    if(!peserta_id) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Belum Lengkap',
            text: 'Mohon pilih nama Anda dari daftar saran yang muncul.',
            confirmButtonText: 'Mengerti',
            confirmButtonColor: '#384BC9'
        }).then(() => {
            // Reset form jika salah input
            resetForm();
        });
        return;
    }

    // Loading State
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btnSubmit.disabled = true;

    try {
        const response = await fetch('/absen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ peserta_id: peserta_id })
        });

        const result = await response.json();

        if (response.ok) {
            // --- SUKSES ---
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Absen!',
                text: `Terima kasih ${inputNama.value}, kehadiran Anda tercatat.`,
                confirmButtonText: 'OK, Selesai',
                confirmButtonColor: '#2fb344',
                allowOutsideClick: false 
            }).then((result) => {
                if (result.isConfirmed) {
                    resetForm(); // HAPUS TEXT SETELAH KLIK OK
                }
            });

        } else {
            // --- GAGAL (Duplikat / Tutup) ---
            Swal.fire({
                icon: 'error',
                title: 'Gagal Absen',
                text: result.message || 'Terjadi kesalahan sistem.',
                confirmButtonText: 'Tutup',
                confirmButtonColor: '#d63939',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    resetForm(); // HAPUS TEXT SETELAH KLIK TUTUP
                }
            });
        }

    } catch (error) {
        // --- ERROR SERVER ---
        Swal.fire({
            icon: 'error',
            title: 'Kesalahan Server',
            text: 'Gagal menghubungi server. Periksa koneksi internet.',
            confirmButtonText: 'Tutup',
            confirmButtonColor: '#d63939'
        }).then(() => {
            resetForm(); // HAPUS TEXT SETELAH KLIK TUTUP
        });
    } finally {
        btnSubmit.innerHTML = originalBtnText;
    }
});

// Fungsi Bersihkan Form
function resetForm() {
    inputNama.value = '';
    inputNIM.value = '';
    inputProdi.value = '';
    inputId.value = '';
    
    btnSubmit.disabled = true;
    inputNama.focus(); 
}