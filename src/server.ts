import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.SECRET_KEY;
const PUBLIC_KEY = process.env.PUBLIC_KEY;

const bancoTransacoes = new Map();

app.use(express.static(path.resolve()));
app.get('/', (req, res) => {
  res.sendFile(path.resolve('index.html'));
});

const formatCpf = v =>
  v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

const formatPhone = v =>
  v.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");

function acharCopiaECola(obj) {
  if (typeof obj === 'string' && obj.startsWith('000201')) return obj;

  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      const result = acharCopiaECola(obj[key]);
      if (result) return result;
    }
  }
  return null;
}

// ================= GERAR PIX =================
app.post('/pix', async (req, res) => {
  try {
    const { name, email, cpf, phone, valor } = req.body;

    const valorFixo = parseFloat(valor) || 79.10;
    const identifier = `ID${Date.now()}`;

    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);

    const payload = {
      identifier,
      amount: valorFixo,
      client: {
        name: name || "Cliente",
        email: email || "cliente@email.com",
        phone: formatPhone(phone || "11999999999"),
        document: formatCpf(cpf || "00000000000")
      },
      products: [
        {
          id: "TAXA_01",
          name: "Taxa de Liberação",
          quantity: 1,
          price: valorFixo
        }
      ],
      splits: [
        {
          producerId: "cmg7bvpns00u691tsx9g6vlyp",
          amount: Number((valorFixo * 0.5).toFixed(2))
        }
      ],
      dueDate: amanha.toISOString().split('T')[0],
      callbackUrl: "https://checkoutfinal.onrender.com/webhook"
    };

    bancoTransacoes.set(identifier, {
      status: 'pending',
      amount: valorFixo
    });

    const response = await axios.post(
      'https://app.vizzionpay.com/api/v1/gateway/pix/receive',
      payload,
      {
        headers: {
          'x-public-key': PUBLIC_KEY,
          'x-secret-key': SECRET_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const pixData = response.data.pix || response.data || {};

    const imagemPix =
      pixData.encodedImage ||
      pixData.qrcode_image ||
      pixData.image ||
      "";

    const codigoPix =
      acharCopiaECola(response.data) ||
      "Erro ao localizar código PIX";

    return res.json({
      success: true,
      payload: codigoPix,
      encodedImage: imagemPix,
      transactionId: identifier
    });

  } catch (error) {
    const erroReal = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    console.error("❌ Erro Vizzion:", erroReal);

    res.status(500).json({
      success: false,
      message: `Erro Vizzion: ${erroReal}`
    });
  }
});

// ================= WEBHOOK =================
app.post('/webhook', (req, res) => {

  const { event, transaction } = req.body;

  if (!transaction) return res.sendStatus(400);

  const { identifier, status, paymentMethod, amount } = transaction;

  if (
    paymentMethod === 'PIX' &&
    status === 'COMPLETED' &&
    event === 'TRANSACTION_PAID'
  ) {
    if (bancoTransacoes.has(identifier)) {

      bancoTransacoes.set(identifier, {
        status: 'paid',
        amount
      });

      console.log(`💰 PAGAMENTO CONFIRMADO! ${identifier}`);
    }
  }

  res.sendStatus(200);
});

// ================= CHECK STATUS =================
app.get('/check-status/:id', (req, res) => {

  const transacao = bancoTransacoes.get(req.params.id);

  res.json({
    paid: transacao?.status === 'paid'
  });

});

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Servidor rodando")
);
