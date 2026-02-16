import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve()));

const PORT = process.env.PORT || 3000;

const SECRET_KEY = process.env.SECRET_KEY!;
const PUBLIC_KEY = process.env.PUBLIC_KEY!;

const bancoTransacoes = new Map<string, any>();

app.get('/', (_, res) => {
  res.sendFile(path.resolve('index.html'));
});

function acharCopiaECola(obj: any): string | null {
  if (typeof obj === 'string' && obj.startsWith('000201')) return obj;

  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      const result = acharCopiaECola(obj[key]);
      if (result) return result;
    }
  }
  return null;
}

app.post('/pix', async (req, res) => {
  try {

    const identifier = `ID${Date.now()}`;
    const valor = 79.10;

    const payload = {
      identifier,
      amount: valor,
      client: { name: "Cliente" },
      callbackUrl: "https://SEUAPP.onrender.com/webhook"
    };

    bancoTransacoes.set(identifier, { status: 'pending' });

    const response = await axios.post(
      'https://app.vizzionpay.com/api/v1/gateway/pix/receive',
      payload,
      {
        headers: {
          'x-public-key': PUBLIC_KEY,
          'x-secret-key': SECRET_KEY
        }
      }
    );

    const codigoPix = acharCopiaECola(response.data);

    res.json({
      success: true,
      payload: codigoPix,
      encodedImage: response.data?.encodedImage || "",
      transactionId: identifier
    });

  } catch (err: any) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
});

app.post('/webhook', (req, res) => {

  const { transaction } = req.body;

  if (transaction?.identifier) {

    bancoTransacoes.set(transaction.identifier, {
      status: 'paid'
    });

    console.log("💰 PAGAMENTO CONFIRMADO");
  }

  res.sendStatus(200);
});

app.get('/check-status/:id', (req, res) => {

  const transacao = bancoTransacoes.get(req.params.id);

  res.json({
    paid: transacao?.status === 'paid'
  });

});

app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});
