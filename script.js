const API_URL = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', function() {
    setupAuth();
    const path = window.location.pathname;

    if (path.includes('beranda.html')) {
        loadDashboard();
        setupPrintFunctionality();
    } else if (path.includes('kamar.html')) {
        loadKamar();
        setupKamarForm();
    } else if (path.includes('penghuni.html')) {
        loadPenghuni();
        setupPenghuniForm();
        loadKamarOptions();
    } else if (path.includes('pembayaran.html')) {
        // Panggil fungsi lama dan baru
        loadPembayaran();
        setupPembayaranForm();
        loadPenghuniOptions();
        setupPembayaranPage(); // Fungsi baru untuk tampilan berbeda
    } else if (path.includes('pengeluaran.html')) {
        loadPengeluaran();
        setupPengeluaranForm();
    }
    setupChatbot();
});

// AUTH
function setupAuth() {
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.onclick = (e) => { 
        e.preventDefault();
        if(confirm('Keluar?')) { localStorage.clear(); window.location.href='index.html'; } 
    };

    if (!window.location.href.includes('index.html')) {
        if (!localStorage.getItem('loggedIn')) window.location.href = 'index.html';
        else applyUserRole();
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
    
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
    
            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });
    
                const data = await res.json();
    
                if (!res.ok) {
                    alert(data.error || "Login gagal");
                    return;
                }
    
                // Simpan TOKEN
                localStorage.setItem("token", data.token);
    
                // Simpan data user
                localStorage.setItem("loggedIn", "true");
                localStorage.setItem("username", data.user.username);
                localStorage.setItem("role", data.user.role);
                localStorage.setItem("userId", data.user.id);
    
                window.location.href = "beranda.html";
    
            } catch (err) {
                alert("Server Error");
            }
        };
    }
}

function applyUserRole() {
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('username');
    const el = document.getElementById('user-role');

    if(el) el.textContent = `${username.toUpperCase()} (${role})`;

    if (role === 'penghuni') {
        const hide = [
            '#tambah-kamar',
            '#tambah-penghuni',
            '#tambah-pengeluaran',
            '#tambah-pembayaran',
            '#print-report',
            'a[href="pengeluaran.html"]',
            'a[href="penghuni.html"]',
            '#card-belum-lunas'
        ];

        hide.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
        });
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const role = localStorage.getItem("role");

    if (role === "penghuni") {
        document.body.classList.add("penghuni");

        const hideCols = [4, 5];
        document.querySelectorAll("#table-kamar tr").forEach(row => {
            hideCols.forEach(i => {
                if (row.children[i]) {
                    row.children[i].style.display = "none";
                }
            });
        });
    }
});

// DASHBOARD
async function loadDashboard() {
    try {
        const role = localStorage.getItem('role');
        const userId = localStorage.getItem('userId');
        const res = await apiFetch(`${API_URL}/api/dashboard?role=${role}&user_id=${userId}`);
        const data = await res.json();
        
        const cards = document.querySelectorAll('.card');
        if(cards.length > 0) {
            if (role === 'pemilik') {
                cards[0].querySelector('.value').textContent = formatRupiah(data.pendapatan);
                cards[1].querySelector('.value').textContent = formatRupiah(data.pengeluaran);
                cards[2].querySelector('.value').textContent = `${data.terisi} Kamar`;
                cards[3].querySelector('.value').textContent = formatRupiah(data.pendapatan - data.pengeluaran);
            } else {
                cards[0].querySelector('h3').textContent = 'Tagihan Saya (Belum Lunas)';
                cards[0].querySelector('.value').textContent = formatRupiah(data.tagihan_saya || 0);
                cards[1].querySelector('h3').textContent = 'Kamar Saya';
                cards[1].querySelector('.value').textContent = data.kamar_saya || '-';
                cards[2].style.display = 'none'; cards[3].style.display = 'none';
            }
        }

        async function loadBelumLunas() {
            const res = await apiFetch(`${API_URL}/api/dashboard/belum-lunas`);
        
            if (!res || !res.ok) {
                const tbody = document.querySelector('#tabel-belum-lunas tbody');
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Gagal memuat data</td></tr>`;
                }
                return;
            }
        
            const data = await res.json();
        
            const tbody = document.querySelector('#tabel-belum-lunas tbody');
            if (!tbody) return;
        
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Tidak ada tagihan</td></tr>`;
                return;
            }
        
            tbody.innerHTML = data.map(item => `
                <tr>
                    <td>${item.nama}</td>
                    <td>${item.tenggat}</td>
                    <td>${formatRupiah(item.nominal)}</td>
                </tr>
            `).join('');
        }   
        
        if (role === 'pemilik') {
            loadBelumLunas();
        }       
        
        // Print Report Logic
        if (role === 'pemilik' && document.getElementById('print-content')) {
            document.getElementById('print-date').textContent = new Date().toLocaleDateString('id-ID');

            const tables = document.querySelectorAll('#print-content table');

            const financialTable = tables[0];
            if (financialTable) {
                financialTable.rows[0].cells[1].textContent = formatRupiah(data.pendapatan);
                financialTable.rows[1].cells[1].textContent = formatRupiah(data.pengeluaran);
                financialTable.rows[2].cells[1].textContent = formatRupiah(data.pendapatan - data.pengeluaran);
            }

            const kamarTable = tables[1];
            if (kamarTable) {
                kamarTable.rows[0].cells[1].textContent = `${data.terisi} Kamar`;
            }
        }
        
        if (role === "pemilik") {
            const btn = document.getElementById("edit-info-btn");
            if (btn) btn.style.display = "inline-block"; 
        }

    } catch (e) {
        console.error("Error loading dashboard:", e);
    }
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        "Authorization": `Bearer ${token}`
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        localStorage.clear();
        window.location.href = "index.html";
        return;
    }

    return res;
}

document.getElementById("edit-info-btn")?.addEventListener("click", async () => {
    const res = await apiFetch(`${API_URL}/api/info-kos`);
    const data = await res.json();

    document.getElementById("input-tata-tertib").value = data.tata_tertib;
    document.getElementById("input-wifi-nama").value = data.wifi_nama;
    document.getElementById("input-wifi-pass").value = data.wifi_pass;

    document.getElementById("edit-info-modal").style.display = "block";
});

document.getElementById("save-info-btn")?.addEventListener("click", async () => {
    const body = {
        tata_tertib: document.getElementById("input-tata-tertib").value,
        wifi_nama: document.getElementById("input-wifi-nama").value,
        wifi_pass: document.getElementById("input-wifi-pass").value
    };

    const res = await apiFetch(`${API_URL}/api/info-kos`, {
        method: "PUT",
        body: JSON.stringify(body)
    });

    if (res.ok) {
        alert("Informasi kos berhasil diperbarui.");
        location.reload();
    } else {
        alert("Gagal menyimpan data.");
    }
});

// CRUD LOADERS
async function loadKamar() {
    const res = await apiFetch(`${API_URL}/api/kamar`); 
    const data = await res.json();
    const tbody = document.querySelector('#table-kamar tbody');
    if (!tbody) return;
    const role = localStorage.getItem('role');
    tbody.innerHTML = data.map(k => `
        <tr>
            <td>${k.nomor_kamar}</td>
            <td>${formatRupiah(k.harga)}</td>
            <td>${k.status}</td>
            <td>${k.nama_penghuni || '-'}</td>
            <td>${k.password || '-'}</td>
            <td>
                ${role === 'pemilik' ? `<button class="btn btn-warning" onclick="editKamar(${k.id}, '${k.nomor_kamar}', ${k.harga}, '${k.status}')">Edit</button>` : '-'}
                <button class="btn btn-danger" onclick="deleteItem('api/kamar',${k.id})">Hapus</button>
            </td>
        </tr>
    `).join('');
}

window.editKamar = (id, nomor, harga, status) => {
    document.getElementById('modal-edit-kamar').style.display = 'block';
    
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-nomor-kamar').value = nomor;
    document.getElementById('edit-harga').value = harga;
    document.getElementById('edit-status').value = status;
};

const cancelKamar = document.getElementById('cancel-kamar');
if (cancelKamar) {
    cancelKamar.onclick = () => {
        document.getElementById('modal-edit-kamar').style.display = 'none';
    };
}

const formEdit = document.getElementById('form-edit-kamar');
if (formEdit) {
    formEdit.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const bodyData = {
            nomor_kamar: document.getElementById('edit-nomor-kamar').value,
            harga: parseInt(document.getElementById('edit-harga').value),
            status: document.getElementById('edit-status').value
        };
        const res = await apiFetch(`${API_URL}/api/kamar/${id}`, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(bodyData)
        });        
        if (!res.ok) {
            alert("Gagal update kamar");
            return;
        }
        alert("Berhasil update kamar");
        location.reload();
    }
}

async function loadPenghuni() {
    const res = await apiFetch(`${API_URL}/api/penghuni`); 
    const data = await res.json();
    const tbody = document.querySelector('#table-penghuni tbody');
    if(tbody) {
        const role = localStorage.getItem('role');
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.nama}</td>
                <td>${p.no_hp || '-'}</td>
                <td>${p.alamat || '-'}</td>
                <td>${formatDate(p.tanggal_masuk)}</td>
                <td>${p.nomor_kamar || '-'}</td>
                <td>
                    ${role === 'pemilik' ? `<button class="btn btn-danger" onclick="deleteItem('api/penghuni',${p.id})">Hapus</button>` : '-'}
                </td>
            </tr>
        `).join('');
    }
}

async function loadPembayaran() {
    const role = localStorage.getItem('role'); 
    const userId = localStorage.getItem('userId');
    const res = await apiFetch(`${API_URL}/api/pembayaran?role=${role}&user_id=${userId}`); 
    const data = await res.json();
    const tbody = document.querySelector('#table-pembayaran tbody');
    if(tbody) {
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.nama_penghuni}</td>
                <td>${p.bulan}</td>
                <td>${formatDate(p.tanggal_bayar)}</td>
                <td>${formatRupiah(p.jumlah)}</td>
                <td>${p.status}</td>
                <td>${role==='pemilik' ? `<button class="btn btn-danger" onclick="deleteItem('api/pembayaran',${p.id})">Hapus</button>`:''}</td>
            </tr>
        `).join('');
    }
}

/* === AUTO ISI HARGA KAMAR SAAT PILIH PENGHUNI === */
document.addEventListener("change", async function(e) {
    if (e.target.id === "id-penghuni-bayar") {

        const idPenghuni = e.target.value;
        if (!idPenghuni) return;

        // Ambil list penghuni
        const resPenghuni = await apiFetch(`${API_URL}/api/penghuni`);
        const penghuniList = await resPenghuni.json();

        const penghuni = penghuniList.find(p => p.id == idPenghuni);
        if (!penghuni) return;

        const nomorKamar = penghuni.nomor_kamar;
        if (!nomorKamar) return;

        // Ambil list kamar
        const resKamar = await apiFetch(`${API_URL}/api/kamar`);
        const kamarList = await resKamar.json();

        const kamar = kamarList.find(k => k.nomor_kamar == nomorKamar);
        if (!kamar) return;

        // Isi harga otomatis
        document.getElementById("jumlah-pembayaran").value = kamar.harga;
    }
});


async function loadPengeluaran() {
    const res = await apiFetch(`${API_URL}/api/pengeluaran`); 
    const data = await res.json();
    const tbody = document.querySelector('#table-pengeluaran tbody');
    if(tbody) tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.kategori}</td>
            <td>${formatRupiah(p.jumlah)}</td>
            <td>${formatDate(p.tanggal)}</td>
            <td>${p.keterangan}</td>
            <td><button class="btn btn-danger" onclick="deleteItem('api/pengeluaran',${p.id})">Hapus</button></td>
        </tr>
    `).join('');
}

// UTILS
function formatRupiah(n) { 
    return new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}).format(n); 
}

function formatDate(d) { 
    return d ? new Date(d).toLocaleDateString('id-ID') : '-'; 
}

function setupModal(b, m, c) {
    const btn=document.getElementById(b), mod=document.getElementById(m), cl=document.getElementById(c);
    if(btn) btn.onclick=()=>mod.style.display='block'; 
    if(cl) cl.onclick=()=>mod.style.display='none';
}

async function postData(u, d) { 
    await apiFetch(`${API_URL}${u}`, {
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify(d)
    }); 
    alert('Sukses'); 
}

window.deleteItem = async (u, id) => { 
    if(confirm('Hapus?')) { 
        await apiFetch(`${API_URL}/${u}/${id}`, {method:'DELETE'}); 
        location.reload(); 
    } 
}

// FORMS
function setupKamarForm() { 
    setupModal('tambah-kamar','modal-kamar','batal-kamar'); 
    const f=document.getElementById('form-kamar'); 
    if(f) f.onsubmit=async(e)=>{
        e.preventDefault(); 
        await postData('/api/kamar',{
            nomor_kamar:document.getElementById('nomor-kamar').value, 
            harga:document.getElementById('harga-kamar').value, 
            status:document.getElementById('status-kamar').value
        }); 
        location.reload();
    } 
}

function setupPenghuniForm() {
    setupModal('tambah-penghuni','modal-penghuni','batal-penghuni');
    const f = document.getElementById('form-penghuni');

    if (f) f.onsubmit = async (e) => {
        e.preventDefault();

        const dataBody = {
            nama: document.getElementById('nama').value,
            username: document.getElementById('username-penghuni').value,
            password: document.getElementById('password-penghuni').value,
            no_hp: document.getElementById('no-hp').value,
            alamat: document.getElementById('alamat').value,
            tanggal_masuk: document.getElementById('tanggal-masuk').value,
            id_kamar: parseInt(document.getElementById('id-kamar').value)
        };

        const res = await apiFetch(`${API_URL}/api/penghuni`, {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify(dataBody)
        });

        const d = await res.json();

        if (!res.ok) {
            alert(d.error || "Gagal tambah penghuni");
            return;
        }
        alert("Penghuni berhasil dibuat ✔️");
        location.reload();
    }
}

function setupPembayaranForm() { 
    setupModal('tambah-pembayaran','modal-pembayaran','batal-pembayaran'); 
    const f=document.getElementById('form-pembayaran'); 
    if(f) f.onsubmit=async(e)=>{
        e.preventDefault(); 
        await postData('/api/pembayaran',{
            id_penghuni:document.getElementById('id-penghuni-bayar').value, 
            bulan:document.getElementById('bulan-pembayaran').value, 
            tanggal_bayar:document.getElementById('tanggal-bayar').value, 
            jumlah:document.getElementById('jumlah-pembayaran').value, 
            status:document.getElementById('status-pembayaran').value
        }); 
        location.reload();
    } 
}

function setupPengeluaranForm() { 
    setupModal('tambah-pengeluaran','modal-pengeluaran','batal-pengeluaran'); 
    const f=document.getElementById('form-pengeluaran'); 
    if(f) f.onsubmit=async(e)=>{
        e.preventDefault(); 
        await postData('/api/pengeluaran',{
            kategori:document.getElementById('kategori-pengeluaran').value, 
            jumlah:document.getElementById('jumlah-pengeluaran').value, 
            tanggal:document.getElementById('tanggal-pengeluaran').value, 
            keterangan:document.getElementById('keterangan-pengeluaran').value
        }); 
        location.reload();
    } 
}

async function loadKamarOptions() { 
    const r=await apiFetch(`${API_URL}/api/kamar`); 
    const d=await r.json(); 
    const s=document.getElementById('id-kamar'); 
    if(s) s.innerHTML='<option value="">Pilih</option>'+d.filter(k=>k.status==='kosong').map(k=>`<option value="${k.id}">${k.nomor_kamar}</option>`).join(''); 
}

async function loadPenghuniOptions() { 
    const r=await apiFetch(`${API_URL}/api/penghuni`); 
    const d=await r.json(); 
    const s=document.getElementById('id-penghuni-bayar'); 
    if(s) s.innerHTML='<option value="">Pilih</option>'+d.map(p=>`<option value="${p.id}">${p.nama}</option>`).join(''); 
}

function setupPrintFunctionality() { 
    const b=document.getElementById('print-report'); 
    if(b) b.onclick=()=>window.print(); 
}

function setupChatbot() { 
    const b=document.getElementById('chatbot-btn'), 
          w=document.getElementById('chatbot-window'), 
          c=document.getElementById('close-chatbot'); 
    if(b) { 
        b.onclick=()=>w.style.display='flex'; 
        c.onclick=()=>w.style.display='none'; 
    } 
}

// ===================== FUNGSI BARU UNTUK PEMBAYARAN PENGHUNI =====================

// Fungsi untuk setup halaman pembayaran berdasarkan role
function setupPembayaranPage() {
    const role = localStorage.getItem('role');
    const viewPemilik = document.getElementById('view-pemilik');
    const viewPenghuni = document.getElementById('view-penghuni');
    const btnWa = document.getElementById('btn-wa-pemilik');
    
    // Set nomor WA pemilik
    if (btnWa) {
        const noPemilik = '6281234567890'; // Ganti dengan nomor pemilik sebenarnya
        const namaUser = localStorage.getItem('username') || 'Penghuni';
        const pesan = `Halo%20Admin%20Smart%20Kos%2C%0ASaya%20${encodeURIComponent(namaUser)}%20ingin%20bertanya%20tentang%20pembayaran%20kos.`;
        btnWa.href = `https://wa.me/${noPemilik}?text=${pesan}`;
        btnWa.target = '_blank';
    }
    
    if (role === 'pemilik') {
        if (viewPemilik) viewPemilik.style.display = 'block';
        if (viewPenghuni) viewPenghuni.style.display = 'none';
    } else {
        if (viewPemilik) viewPemilik.style.display = 'none';
        if (viewPenghuni) viewPenghuni.style.display = 'block';
        loadPembayaranPenghuni();
        loadStatusBulanIni();
        loadTenggatBayar();
    }
}

// Fungsi untuk memuat pembayaran khusus penghuni
async function loadPembayaranPenghuni() {
    try {
        const res = await apiFetch(`${API_URL}/api/pembayaran`);
        const data = await res.json();
        
        // Filter hanya pembayaran penghuni ini
        const userId = localStorage.getItem('userId');
        const penghuniRes = await apiFetch(`${API_URL}/api/penghuni`);
        const penghuniData = await penghuniRes.json();
        const penghuniSaya = penghuniData.find(p => p.id_user == userId);
        
        if (!penghuniSaya) {
            const tbody = document.querySelector('#table-riwayat-penghuni tbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="5">Data penghuni tidak ditemukan</td></tr>';
            return;
        }
        
        const pembayaranSaya = data.filter(p => p.id_penghuni == penghuniSaya.id);
        const tbody = document.querySelector('#table-riwayat-penghuni tbody');
        
        if (tbody) {
            tbody.innerHTML = pembayaranSaya.map(p => `
                <tr>
                    <td>${formatBulan(p.bulan)}</td>
                    <td>
                        <span class="status-badge ${p.status === 'lunas' ? 'status-lunas' : 'status-belum'}">
                            ${p.status === 'lunas' ? '✓ LUNAS' : 'BELUM LUNAS'}
                        </span>
                    </td>
                    <td>${p.tanggal_bayar ? formatDate(p.tanggal_bayar) : '-'}</td>
                    <td>${formatRupiah(p.jumlah)}</td>
                    <td>
                        ${p.status === 'lunas' ? 
                            `<button class="btn btn-secondary" onclick="printNotaPenghuni(${p.id}, '${p.bulan}', ${p.jumlah}, '${p.tanggal_bayar || ''}', '${penghuniSaya.nama}')">
                                🖨️ Cetak Nota
                            </button>` : 
                            '-'
                        }
                    </td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Error loading pembayaran penghuni:', err);
        const tbody = document.querySelector('#table-riwayat-penghuni tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5">Gagal memuat data</td></tr>';
    }
}

// Fungsi untuk memuat status pembayaran bulan ini
async function loadStatusBulanIni() {
    try {
        const now = new Date();
        const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const res = await apiFetch(`${API_URL}/api/pembayaran`);
        const data = await res.json();
        
        const userId = localStorage.getItem('userId');
        const penghuniRes = await apiFetch(`${API_URL}/api/penghuni`);
        const penghuniData = await penghuniRes.json();
        const penghuniSaya = penghuniData.find(p => p.id_user == userId);
        
        if (!penghuniSaya) {
            document.getElementById('status-bulan-ini').innerHTML = '<p>Data penghuni tidak ditemukan</p>';
            return;
        }
        
        const pembayaranBulanIni = data.find(p => 
            p.id_penghuni == penghuniSaya.id && 
            p.bulan === bulanIni
        );
        
        const statusDiv = document.getElementById('status-bulan-ini');
        if (statusDiv) {
            if (pembayaranBulanIni) {
                statusDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <span class="status-badge ${pembayaranBulanIni.status === 'lunas' ? 'status-lunas' : 'status-belum'}" 
                              style="font-size: 1.2rem; padding: 0.5rem 1rem;">
                            ${pembayaranBulanIni.status === 'lunas' ? '✓ LUNAS' : 'BELUM LUNAS'}
                        </span>
                        <div>
                            <p><strong>Bulan:</strong> ${formatBulan(bulanIni)}</p>
                            ${pembayaranBulanIni.tanggal_bayar ? 
                                `<p><strong>Tanggal Bayar:</strong> ${formatDate(pembayaranBulanIni.tanggal_bayar)}</p>` : ''
                            }
                            <p><strong>Nominal:</strong> ${formatRupiah(pembayaranBulanIni.jumlah)}</p>
                        </div>
                    </div>
                `;
            } else {
                statusDiv.innerHTML = `
                    <div style="color: #721c24; padding: 1rem; background: #f8d7da; border-radius: 4px; border-left: 4px solid #721c24;">
                        <p style="margin: 0; font-weight: bold;">
                            <strong>Status:</strong> BELUM ADA DATA PEMBAYARAN UNTUK BULAN INI (${formatBulan(bulanIni)})
                        </p>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error('Error loading status bulan ini:', err);
        const statusDiv = document.getElementById('status-bulan-ini');
        if (statusDiv) statusDiv.innerHTML = '<p>Gagal memuat status pembayaran</p>';
    }
}

// Fungsi untuk menghitung dan menampilkan tenggat bayar
async function loadTenggatBayar() {
    try {
        const userId = localStorage.getItem('userId');
        const penghuniRes = await apiFetch(`${API_URL}/api/penghuni`);
        const penghuniData = await penghuniRes.json();
        const penghuniSaya = penghuniData.find(p => p.id_user == userId);
        
        if (!penghuniSaya || !penghuniSaya.tanggal_masuk) {
            document.getElementById('info-tenggat').innerHTML = '<p>Data tanggal masuk tidak ditemukan</p>';
            return;
        }
        
        const tanggalMasuk = new Date(penghuniSaya.tanggal_masuk);
        const now = new Date();
        
        // Hitung bulan ke-n sejak masuk
        const monthDiff = (now.getFullYear() - tanggalMasuk.getFullYear()) * 12 + 
                         (now.getMonth() - tanggalMasuk.getMonth());
        
        // Tenggat = tanggal masuk + (monthDiff + 1) bulan
        const tenggat = new Date(tanggalMasuk);
        tenggat.setMonth(tenggat.getMonth() + monthDiff + 1);
        
        // Jika sudah lewat tenggat bulan ini, tambah 1 bulan lagi
        if (now > tenggat) {
            tenggat.setMonth(tenggat.getMonth() + 1);
        }
        
        const infoDiv = document.getElementById('info-tenggat');
        if (infoDiv) {
            const daysDiff = Math.ceil((tenggat - now) / (1000 * 60 * 60 * 24));
            const bulanTagihan = tenggat.getFullYear() + '-' + String(tenggat.getMonth() + 1).padStart(2, '0');
            
            infoDiv.innerHTML = `
                <div style="background: ${daysDiff <= 7 ? '#fff3cd' : '#d4edda'}; 
                            padding: 1rem; border-radius: 8px; border-left: 4px solid ${daysDiff <= 7 ? '#856404' : '#155724'};">
                    <p style="margin-bottom: 0.5rem;"><strong>Tenggat Pembayaran:</strong></p>
                    <p style="font-size: 1.3rem; font-weight: bold; color: ${daysDiff <= 7 ? '#856404' : '#155724'}; margin: 0.5rem 0;">
                         ${formatDate(tenggat.toISOString().split('T')[0])}
                    </p>
                    <p><strong>Sisa Waktu:</strong> ${daysDiff} hari</p>
                    <p><strong>Bulan Tagihan:</strong> ${formatBulan(bulanTagihan)}</p>
                    ${daysDiff <= 7 ? 
                        '<p style="color: #856404; font-weight: bold; margin-top: 0.5rem;">⚠️ Segera lakukan pembayaran!</p>' : 
                        '<p style="color: #155724; margin-top: 0.5rem;">✅ Masih ada waktu untuk pembayaran</p>'
                    }
                </div>
            `;
        }
    } catch (err) {
        console.error('Error loading tenggat bayar:', err);
        document.getElementById('info-tenggat').innerHTML = '<p>Gagal memuat informasi tenggat</p>';
    }
}

// Fungsi untuk format bulan (Januari 2024)
function formatBulan(bulanString) {
    if (!bulanString) return '-';
    const [year, month] = bulanString.split('-');
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthIndex = parseInt(month) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
        return `${monthNames[monthIndex]} ${year}`;
    }
    return bulanString;
}

// Fungsi untuk print nota khusus penghuni
window.printNotaPenghuni = function(idPembayaran, bulan, nominal, tglBayar, namaPenghuni) {
    const modalNota = document.getElementById('modal-nota');
    const printContent = document.getElementById('print-content-nota');
    const userNama = namaPenghuni || localStorage.getItem('username') || 'Penghuni';
    const tanggalCetak = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const jamCetak = new Date().toLocaleTimeString('id-ID');
    
    if (printContent) {
        printContent.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333;">
                    <h2 style="margin: 0; color: var(--navy); font-size: 24px;">SMART KOS</h2>
                    <p style="margin: 5px 0; font-size: 12px; color: #666;">Gg. Bharata No. 12B Tembalang, Semarang</p>
                    <p style="margin: 5px 0; font-size: 12px; color: #666;">Telp: (022) 1234567</p>
                </div>
                
                <!-- Info Nota -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px;">
                    <div>
                        <p style="margin: 2px 0;"><strong>No. Nota:</strong> #${idPembayaran.toString().padStart(4, '0')}</p>
                        <p style="margin: 2px 0;"><strong>Tanggal:</strong> ${tanggalCetak}</p>
                        <p style="margin: 2px 0;"><strong>Jam:</strong> ${jamCetak}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 2px 0;"><strong>Status:</strong> <span style="color: #155724; font-weight: bold;">✓ LUNAS</span></p>
                    </div>
                </div>
                
                <!-- Info Penghuni -->
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: var(--navy);">INFORMASI PENGHUNI</h4>
                    <p style="margin: 5px 0;"><strong>Nama:</strong> ${userNama.toUpperCase()}</p>
                </div>
                
                <!-- Detail Pembayaran -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: var(--navy);">DETAIL PEMBAYARAN</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 8px 0;">Deskripsi</td>
                            <td style="text-align: right; padding: 8px 0;">Jumlah</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 8px 0;">Pembayaran Kos Bulan ${formatBulan(bulan)}</td>
                            <td style="text-align: right; padding: 8px 0;">${formatRupiah(nominal)}</td>
                        </tr>
                        <tr style="font-weight: bold; font-size: 16px;">
                            <td style="padding: 12px 0; color: var(--navy);">TOTAL</td>
                            <td style="text-align: right; padding: 12px 0; color: var(--navy);">${formatRupiah(nominal)}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- Metode Pembayaran -->
                <div style="margin-bottom: 25px; font-size: 12px;">
                    <p><strong>Metode Pembayaran:</strong> Transfer Bank / Tunai</p>
                    ${tglBayar ? `<p><strong>Tanggal Bayar:</strong> ${formatDate(tglBayar)}</p>` : ''}
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #666;">
                    <p style="font-size: 11px; color: #666; line-height: 1.4;">
                        <strong>KETERANGAN:</strong><br>
                        1. Nota ini merupakan bukti pembayaran yang sah.<br>
                        2. Simpan nota ini sebagai arsip pribadi.<br>
                        3. Untuk pertanyaan hubungi admin kos.
                    </p>
                    <div style="margin-top: 20px;">
                        <p style="margin: 5px 0;">Hormat kami,</p>
                        <p style="margin: 5px 0; font-weight: bold;">SMART KOS</p>
                        <div style="margin-top: 30px; width: 200px; height: 1px; background: #000; margin: 10px auto;"></div>
                        <p style="margin: 5px 0; font-size: 12px;">(Admin Cantik)</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Tutup lewat tombol "Tutup"
document.getElementById("close-nota-btn").addEventListener("click", function () {
    document.getElementById("modal-nota").style.display = "none";
});

    if (modalNota) {
        modalNota.style.display = 'block';
        
        // Setup tombol close
        const closeNota1 = document.getElementById('close-nota');
        const closeNota2 = document.getElementById('close-nota2');
        if (closeNota1) closeNota1.onclick = () => modalNota.style.display = 'none';
        if (closeNota2) closeNota2.onclick = () => modalNota.style.display = 'none';
        
        // Setup tombol print
        const printBtn = document.getElementById('print-nota');
        if (printBtn) {
            printBtn.onclick = () => {
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                        <head>
                            <title>Nota Pembayaran Kos - ${userNama}</title>
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    margin: 0;
                                    padding: 20px;
                                    color: #333;
                                }
                                @media print { 
                                    @page { margin: 0; }
                                    body { margin: 1cm; }
                                    .no-print { display: none !important; }
                                }
                                table { width: 100%; border-collapse: collapse; }
                                h2, h4 { color: #001f3f; }
                                .footer-note { font-size: 11px; line-height: 1.4; }
                            </style>
                        </head>
                        <body>
                            ${printContent.innerHTML}
                            <div class="no-print" style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
                                <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
                            </div>
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            };
        }
    }
};