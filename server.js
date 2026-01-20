const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const emailService = require("./utils/emailService");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menyimpan data pembayaran (dalam memori)
let payments = [];

// Fungsi helper
function generateKodeUnik() {
  return Math.floor(100 + Math.random() * 900).toString();
}

function formatRupiah(angka) {
  return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getTimestamp() {
  return new Date().toLocaleString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

// Serve static files from frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    message: "Payment System API is running",
    timestamp: new Date().toISOString(),
  });
});

// Generate unique payment code
app.get("/api/generate-code", (req, res) => {
  try {
    const kodeUnik = generateKodeUnik();

    res.json({
      success: true,
      data: {
        kode_unik: kodeUnik,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate payment code",
    });
  }
});

// Submit payment
app.post("/api/payments", async (req, res) => {
  try {
    let { nama, email, nim, prodi, semester, kode_unik, jumlah_pembayaran } =
      req.body;
    const auth = new google.auth.GoogleAuth({
      keyFile: "credentials.json",
      scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    // Instance client auth
    const client = await auth.getClient();
    // Instance Google Sheets API
    const googleSheets = google.sheets({ version: "v4", auth: client });

    const errors = [];

    // ===== NORMALIZATION =====
    nama = nama?.trim();
    email = email?.trim();
    nim = nim?.trim();
    prodi = prodi?.trim();
    kode_unik = kode_unik?.trim();
    semester = parseInt(semester);
    jumlah_pembayaran = parseInt(jumlah_pembayaran);

    // ===== VALIDATION =====
    if (!nama || nama.length < 3) errors.push("Nama minimal 3 karakter");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push("Email tidak valid");
    if (!nim || nim.length < 5) errors.push("NIM minimal 5 karakter");
    if (!prodi) errors.push("Program studi wajib dipilih");
    if (!semester || semester < 1 || semester > 8)
      errors.push("Semester harus 1–8");

    if (!jumlah_pembayaran || isNaN(jumlah_pembayaran)) {
      errors.push("Jumlah pembayaran tidak valid");
    } else {
      if (jumlah_pembayaran < 100000) errors.push("Minimal Rp 100.000");
      if (jumlah_pembayaran > 10000000) errors.push("Maksimal Rp 10.000.000");
    }

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Validasi gagal",
        errors,
      });
    }

    // ===== SERVER AUTHORITY =====
    const kodeUnik = kode_unik;
    const total_pembayaran = jumlah_pembayaran + parseInt(kode_unik);
    const paymentId = uuidv4();

    const paymentData = {
      id: paymentId,
      nama,
      email,
      nim,
      prodi,
      semester,
      kodeUnik: kodeUnik,
      jumlah_pembayaran,
      total_pembayaran,
      timestamp: formatTimestamp(),
    };
    payments.push(paymentData);

    const dataSheet = [
      paymentData.nama,
      paymentData.nim,
      paymentData.semester,
      paymentData.email,
      paymentData.prodi,
      paymentData.jumlah_pembayaran,
      paymentData.kodeUnik,
      paymentData.timestamp,
    ];

    const emailSent = await emailService.sendPaymentConfirmation(paymentData);
    paymentData.status = emailSent ? "email_sent" : "email_failed";
    if (emailSent) {
      // Write data to spreadsheet
      await googleSheets.spreadsheets.values.append({
        auth,
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: "Sheet1!A:C",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [dataSheet],
        },
      });
    }
    res.json({
      success: true,
      message: "Pembayaran berhasil direkam",
      data: {
        ...paymentData,
        jumlah_pembayaran_formatted: `Rp ${formatRupiah(jumlah_pembayaran)}`,
        total_pembayaran_formatted: `Rp ${formatRupiah(total_pembayaran)}`,
        redirect_url: `/success.html?id=${paymentId}`,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Kesalahan server",
    });
  }
});

function formatTimestamp(date = new Date()) {
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

// Get payment by ID
app.get("/api/payments/:id", (req, res) => {
  try {
    const paymentId = req.params.id;
    const payment = payments.find((p) => p.id === paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Data pembayaran tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: {
        ...payment,
        jumlah_pembayaran_formatted: `Rp ${formatRupiah(payment.jumlah_pembayaran)}`,
        total_pembayaran_formatted: `Rp ${formatRupiah(payment.total_pembayaran)}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
});

// Get all payments (admin)
app.get("/api/payments", (req, res) => {
  try {
    res.json({
      success: true,
      count: payments.length,
      data: payments.map((p) => ({
        ...p,
        jumlah_pembayaran_formatted: `Rp ${formatRupiah(p.jumlah_pembayaran)}`,
        total_pembayaran_formatted: `Rp ${formatRupiah(p.total_pembayaran)}`,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
});

// Delete payment (admin)
app.delete("/api/payments/:id", (req, res) => {
  try {
    const paymentId = req.params.id;
    const initialLength = payments.length;
    payments = payments.filter((p) => p.id !== paymentId);

    if (payments.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Data pembayaran tidak ditemukan",
      });
    }

    res.json({
      success: true,
      message: "Data pembayaran berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
});

// Clear all payments (admin)
app.delete("/api/payments", (req, res) => {
  try {
    const count = payments.length;
    payments = [];

    res.json({
      success: true,
      message: `Berhasil menghapus ${count} data pembayaran`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server",
    });
  }
});

// Fallback route for frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(
    `📧 Email service: ${process.env.EMAIL_USER ? "Ready" : "Not configured"}`,
  );
  console.log(`💾 Payments storage: In-memory (${payments.length} records)`);
});
