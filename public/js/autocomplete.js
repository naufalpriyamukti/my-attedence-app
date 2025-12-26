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
                        <div>
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

// 2. Logika Submit Absen (AJAX + SweetAlert)
formAbsensi.addEventListener('submit', async function(e) {
    e.preventDefault(); // MENCEGAH RELOAD HALAMAN (KUNCI FULLSCREEN)

    // Ambil data form
    const peserta_id = inputId.value;

    if(!peserta_id) {
        Swal.fire({
            icon: 'error',
            title: 'Data Tidak Valid',
            text: 'Silakan pilih nama dari saran yang muncul!',
            timer: 2000,
            showConfirmButton: false
        });
        return;
    }

    // Tampilkan Loading
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btnSubmit.disabled = true;

    try {
        const response = await fetch('/absen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ peserta_id: peserta_id })
        });

        const result = await response.json();

        if (response.ok) {
            // SUKSES
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Absen!',
                text: `${inputNama.value} berhasil tercatat.`,
                timer: 3000,
                showConfirmButton: false,
                backdrop: `
                    rgba(0,0,123,0.4)
                    url("/images/confetti.gif") 
                    left top
                    no-repeat
                `
            }).then(() => {
                resetForm(); // Reset form agar siap untuk orang berikutnya
            });
        } else {
            // GAGAL (Misal duplikat atau jam tutup)
            Swal.fire({
                icon: 'error',
                title: 'Gagal Absen',
                text: result.message || 'Terjadi kesalahan sistem.',
            });
            btnSubmit.innerHTML = '<i class="fas fa-check-circle me-1"></i> KONFIRMASI KEHADIRAN';
            btnSubmit.disabled = false;
        }

    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Kesalahan Server',
            text: 'Tidak dapat terhubung ke server.',
        });
        btnSubmit.innerHTML = '<i class="fas fa-check-circle me-1"></i> KONFIRMASI KEHADIRAN';
        btnSubmit.disabled = false;
    }
});

function resetForm() {
    inputNama.value = '';
    inputNIM.value = '';
    inputProdi.value = '';
    inputId.value = '';
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-check-circle me-1"></i> KONFIRMASI KEHADIRAN';
    inputNama.focus(); // Kembalikan kursor ke input nama
}