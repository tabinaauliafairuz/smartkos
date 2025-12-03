-- phpMyAdmin SQL Dump
-- version 4.9.0.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 26 Nov 2025 pada 07.47
-- Versi server: 10.3.16-MariaDB
-- Versi PHP: 7.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `smart_kos_db`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `kamar`
--

CREATE TABLE `kamar` (
  `id` int(11) NOT NULL,
  `nomor_kamar` varchar(10) NOT NULL,
  `harga` decimal(10,0) NOT NULL,
  `status` enum('kosong','terisi') NOT NULL DEFAULT 'kosong'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data untuk tabel `kamar`
--

INSERT INTO `kamar` (`id`, `nomor_kamar`, `harga`, `status`) VALUES
(1, 'A1', '800000', 'terisi'),
(2, 'A2', '850000', 'terisi'),
(4, 'A3', '900000', 'terisi'),
(5, 'A4', '900000', 'terisi'),
(6, 'A5', '700000', 'terisi'),
(7, 'A6', '750000', 'terisi'),
(8, 'A7', '700000', 'terisi'),
(9, 'A8', '700000', 'terisi');

-- --------------------------------------------------------

--
-- Struktur dari tabel `pembayaran`
--

CREATE TABLE `pembayaran` (
  `id` int(11) NOT NULL,
  `id_penghuni` int(11) NOT NULL,
  `bulan` varchar(50) NOT NULL,
  `tanggal_bayar` date NOT NULL,
  `jumlah` decimal(10,0) NOT NULL,
  `status` enum('lunas','belum') NOT NULL DEFAULT 'belum'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data untuk tabel `pembayaran`
--

INSERT INTO `pembayaran` (`id`, `id_penghuni`, `bulan`, `tanggal_bayar`, `jumlah`, `status`) VALUES
(1, 1, 'Januari 2024', '2024-01-05', '800000', 'lunas'),
(2, 2, 'Februari 2024', '2024-02-20', '850000', 'belum');

-- --------------------------------------------------------

--
-- Struktur dari tabel `pengeluaran`
--

CREATE TABLE `pengeluaran` (
  `id` int(11) NOT NULL,
  `kategori` varchar(50) NOT NULL,
  `jumlah` decimal(10,0) NOT NULL,
  `tanggal` date NOT NULL,
  `keterangan` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data untuk tabel `pengeluaran`
--

INSERT INTO `pengeluaran` (`id`, `kategori`, `jumlah`, `tanggal`, `keterangan`) VALUES
(1, 'Listrik', '500000', '2024-01-20', 'Token Listrik Utama');

-- --------------------------------------------------------

--
-- Struktur dari tabel `penghuni`
--

CREATE TABLE `penghuni` (
  `id` int(11) NOT NULL,
  `id_user` int(11) DEFAULT NULL,
  `nama` varchar(100) NOT NULL,
  `no_hp` varchar(20) NOT NULL,
  `alamat` text NOT NULL,
  `tanggal_masuk` date NOT NULL,
  `id_kamar` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data untuk tabel `penghuni`
--

INSERT INTO `penghuni` (`id`, `id_user`, `nama`, `no_hp`, `alamat`, `tanggal_masuk`, `id_kamar`) VALUES
(1, 2, 'Budi Santoso', '08123456789', 'Jakarta', '2024-01-01', 1),
(2, 3, 'Siti Aminah', '08987654321', 'Bandung', '2024-02-15', 2),
(4, 5, 'ViVi', '1234567890097', 'marunda', '2025-11-25', 4),
(5, 6, 'lita', '5763567324578236', 'marunda', '2025-11-27', 5),
(6, 8, 'sunoo', '243534656767', 'Jakarta', '2025-11-25', 6),
(8, 10, 'Jay', '08943467487', 'Jakarta', '2023-12-31', 7),
(9, 11, 'riska', '089434789387', 'Jakarta', '2023-12-31', 8),
(10, 12, 'tabina', '0823978356', 'TAMBUN', '2025-11-26', 9);

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('pemilik','penghuni') NOT NULL DEFAULT 'penghuni'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data untuk tabel `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `role`) VALUES
(1, 'pemilik', '$2b$10$LKc1tJbHHUhmBZ7LzrzSG.19QiSIzZ284zOpDHTOt0jymyqO/LMMi', 'pemilik'),
(8, 'sunoo362', '$2b$10$MTmD8yHdkuGbzBASDLveTuXNWYXNg7KPqNCUraKYzSVYMrJSrG84m', 'penghuni'),
(10, 'jay213', '$2b$10$drCNxJANCQDOUQaFsylK2.u4kExKYiFYLPAzoqYqvpkqk/Ndhl2Xy', 'penghuni'),
(11, 'riska508', '$2b$10$DsJSZeYIz0l0HRkgmwMxBOqo9R4.YhMkt0PVIAV5NPBSqSAdJBL/O', 'penghuni'),
(12, 'kmrA8', '$2b$10$THAA.orGrnm8vCB5UyTDwu454C.pIdRQq1FnaEMPmxzraZ2fCJuRW', 'penghuni');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `kamar`
--
ALTER TABLE `kamar`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_penghuni` (`id_penghuni`);

--
-- Indeks untuk tabel `pengeluaran`
--
ALTER TABLE `pengeluaran`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `penghuni`
--
ALTER TABLE `penghuni`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_kamar` (`id_kamar`),
  ADD KEY `id_user` (`id_user`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `kamar`
--
ALTER TABLE `kamar`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT untuk tabel `pembayaran`
--
ALTER TABLE `pembayaran`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT untuk tabel `pengeluaran`
--
ALTER TABLE `pengeluaran`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT untuk tabel `penghuni`
--
ALTER TABLE `penghuni`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `pembayaran`
--
ALTER TABLE `pembayaran`
  ADD CONSTRAINT `fk_pembayaran_penghuni` FOREIGN KEY (`id_penghuni`) REFERENCES `penghuni` (`id`) ON DELETE CASCADE;

--
-- Ketidakleluasaan untuk tabel `penghuni`
--
ALTER TABLE `penghuni`
  ADD CONSTRAINT `fk_penghuni_kamar` FOREIGN KEY (`id_kamar`) REFERENCES `kamar` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_penghuni_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
