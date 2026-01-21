const nodemailer = require("nodemailer");
require("dotenv").config();

// Create transporter
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ Email configuration not found. Running in mock mode.");
    return null;
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Format to Rupiah
function formatRupiah(angka) {
  return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function unformatRupiah(value) {
  if (!value) return 0;

  return parseInt(
    value.toString().replace(/[^\d]/g, ""),
    10
  );
}

function formatRupiahDenganKodeUnik(value, kodeUnik) {
  const angka = parseInt(String(value).replace(/\D/g, ""), 10) || 0;
  const kode = String(kodeUnik).padStart(3, "0");

  // Format rupiah normal dulu
  const rupiah = angka.toLocaleString("id-ID");

  // Ganti .000 TERAKHIR dengan .kodeUnik
  return rupiah.replace(/\.000$/, `.${kode}`);
}

// Mock email sending for development
async function sendMockEmail(paymentData) {
  console.log("📧 Mock email sent to:", paymentData.email);
  console.log("Payment data:", {
    nama: paymentData.nama,
    nim: paymentData.nim,
    total: `Rp ${formatRupiah(paymentData.jumlah_pembayaran)}`,
  });
  return true;
}

// Send payment confirmation email
async function sendPaymentConfirmation(paymentData) {
  try {
    const transporter = createTransporter();

    // If no email config, use mock
    if (!transporter) {
      return await sendMockEmail(paymentData);
    }
    await transporter.verify();
    console.log("✅ SMTP READY - Gmail accepted connection");

    const mailOptions = {
      from: `"Sistem Pembayaran Online" <${process.env.EMAIL_USER}>`,
        to: paymentData.email,
      subject: `Konfirmasi Pembayaran - ${paymentData.nim}`,
      html: generateEmailHTML(paymentData),
      text: generateEmailText(paymentData),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${paymentData.email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    // Try mock as fallback
    return await sendMockEmail(paymentData);
  }
}

// Generate HTML email content
function generateEmailHTML(paymentData) {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Konfirmasi Pembayaran</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            color: #4a5568;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 12px;
        }
        .info-label {
            color: #718096;
            font-weight: 500;
        }
        .info-value {
            color: #2d3748;
            font-weight: 600;
        }
        .payment-card {
            background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
            border-radius: 8px;
            padding: 20px;
            color: white;
            margin: 20px 0;
        }
        .amount {
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            margin: 10px 0;
        }
        .instructions {
            background-color: #edf2f7;
            border-radius: 8px;
            padding: 20px;
            margin-top: 25px;
        }
        .footer {
            background-color: #f7fafc;
            padding: 20px;
            text-align: center;
            color: #718096;
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
        }
        .success-icon {
            font-size: 48px;
            color: #48bb78;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Pembayaran Berhasil</h1>
            <p>Konfirmasi Pembayaran Online</p>
        </div>
        
        <div class="content">
            <div style="text-align: center;" class="section">
                <div class="success-icon">✓</div>
                <h2 style="color: #2d3748; margin: 0 0 10px 0;">Terima Kasih ${paymentData.nama}</h2>
                <p style="color: #718096; margin: 0;">Pembayaran Anda telah berhasil direkam</p>
            </div>

            <div class="section">
                <div class="section-title">Informasi Mahasiswa</div>
                <div class="info-grid">
                    <div class="info-label">Nama Lengkap</div>
                    <div class="info-value">${paymentData.nama}</div>
                    
                    <div class="info-label">Email</div>
                    <div class="info-value">${paymentData.email}</div>
                    
                    <div class="info-label">NIM</div>
                    <div class="info-value">${paymentData.nim}</div>
                    
                    <div class="info-label">Program Studi</div>
                    <div class="info-value">${paymentData.prodi}</div>
                    
                    <div class="info-label">Semester</div>
                    <div class="info-value">Semester ${paymentData.semester}</div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Detail Pembayaran</div>
                <div class="payment-card">
                    <div style="text-align: center;">
                        <div style="font-size: 14px; opacity: 0.9;">Jumlah yang harus dibayar</div>
                        <div class="amount">Rp ${formatRupiahDenganKodeUnik(paymentData.jumlah_pembayaran, paymentData.kodeUnik)}</div>
                        <div style="font-size: 14px; opacity: 0.9; margin-top: 10px;">
                            <span>Rp ${formatRupiah(paymentData.jumlah_pembayaran)} + Kode Unik: ${paymentData.kodeUnik}</span>
                        </div>
                    </div>
                </div>
                <div class="info-grid" style="margin-top: 15px;">
                    <div class="info-label">ID Pembayaran</div>
                    <div class="info-value" style="font-family: monospace;">${paymentData.id}</div>
                    
                    <div class="info-label">Waktu Transaksi</div>
                    <div class="info-value">${paymentData.timestamp}</div>
                </div>
            </div>

            <div class="instructions">
                <div class="section-title" style="color: #2d3748;">Instruksi Transfer</div>
                <ol style="margin: 0; padding-left: 20px; color: #4a5568;">
                    <li>Transfer tepat sejumlah <strong>${formatRupiahDenganKodeUnik(paymentData.jumlah_pembayaran, paymentData.kodeUnik)}</strong></li>
                    <li>
                        Ke rekening:
                        <ul>
                            <li>BSI : 7304398878</li>
                            <li>BTN : 14901500142223</li>
                            <li>BRI : 009501004410307</li>
                            <li>BNI : 5516000000</li>
                        </ul>
                    </li>
                    <li>Atas nama: <strong>Universitas Annuqayah</strong></li>
                    <li>Gunakan ID Pembayaran sebagai referensi</li>
                    <li>Simpan bukti transfer untuk verifikasi</li>
                </ol>
            </div>
        </div>
        
        <div class="footer">
            <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
            <p>Hubungi administrasi jika ada pertanyaan.</p>
            <p>&copy; ${new Date().getFullYear()} Sistem Pembayaran Online - Universitas Annuqayah</p>
        </div>
    </div>
</body>
</html>
    `;
}

// Generate plain text email content
function generateEmailText(paymentData) {
  return `
KONFIRMASI PEMBAYARAN BERHASIL

Halo ${paymentData.nama},

Pembayaran Anda telah berhasil direkam. Berikut detail pembayaran:

INFORMASI MAHASISWA:
- Nama: ${paymentData.nama}
- Email: ${paymentData.email}
- NIM: ${paymentData.nim}
- Program Studi: ${paymentData.prodi}
- Semester: Semester ${paymentData.semester}

DETAIL PEMBAYARAN:
- ID Pembayaran: ${paymentData.id}
- Jumlah Pembayaran: Rp ${formatRupiah(paymentData.jumlah_pembayaran)}
- Kode Unik: ${paymentData.kodeUnik}
- Total: Rp ${formatRupiah(paymentData.jumlah_pembayaran)}
- Waktu: ${paymentData.timestamp}

INSTRUKSI TRANSFER:
1. Transfer tepat sejumlah Rp ${formatRupiah(paymentData.jumlah_pembayaran)}
2. Ke rekening: BANK ABC - 1234567890
3. Atas nama: UNIVERSITAS CONTOH
4. Gunakan ID Pembayaran sebagai referensi

Email ini dikirim secara otomatis. Mohon tidak membalas.

Salam,
Sistem Pembayaran Online
Universitas Contoh
    `;
}

module.exports = {
  sendPaymentConfirmation,
};
