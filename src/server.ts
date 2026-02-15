import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 SUAS CHAVES DA VIZZION PAY
const SECRET_KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
const PUBLIC_KEY = "rodrigogato041_glxgrxj8x8yy8jo2";
// =====================================================

const bancoTransacoes = new Map();

app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

const formatCpf = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");

// =====================================================
// ROTA 1: GERA O PIX
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        const valorFixo = parseFloat(valor) || 79.10; 
        const identifier = `ID${Date.now()}`; 

        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const dueDateStr = amanha.toISOString().split('T')[0];

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { 
                name: name || "Cliente", 
                email: email || "cliente@email.com", 
                phone: formatPhone(phone || "11999999999"), 
                document: formatCpf(cpf || "00000000000") 
            },
            products: [{
                id: "TAXA_01",
                name: "Taxa de Liberação",
                quantity: 1,
                price: valorFixo
            }],
            dueDate: dueDateStr,
            metadata: { provedor: "Sistema Pix" },
            callbackUrl: "https://checkoutfinal.onrender.com/webhook" 
        };

        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'x-public-key': PUBLIC_KEY,
                'x-secret-key': SECRET_KEY,
                'Content-Type': 'application/json'
            }
        });

        // 👇 A MÁGICA PARA NUNCA MAIS DAR UNDEFINED 👇
        // Extrai os dados seja lá como a Vizzion mandou o nome da variável
        const pixData = response.data.pix || response.data || {};
        
        const codigoPix = pixData.payload || pixData.qrcode_text || pixData.emv || pixData.copyPaste || pixData.qrcode || response.data.payload || "Erro: Código não encontrado";
        
        const imagemPix = pixData.encodedImage || pixData.qrcode_image || pixData.image || pixData.base64 || response.data.encodedImage || "";

        console.log("✅ PIX GERADO COM SUCESSO!");

        return res.json({ 
            success: true, 
            payload: codigoPix,
            encodedImage: imagemPix,
            transactionId: identifier 
        });

    } catch (error: any) {
        const erroReal = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error("❌ Erro Vizzion:", erroReal);
        return res.status(error.response?.status || 401).json({ 
            success: false, 
            message: `Erro Vizzion: ${erroReal}` 
        });
    }
});

// =====================================================
// ROTA 2: WEBHOOK (ESPERA O PAGAMENTO)
// =====================================================
app.post('/webhook', (req, res) => {
    const { transaction_id, identifier, status, payment_method, amount, event } = req.body;
    const idBusca = identifier || transaction_id;

    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            if (Number(transacao.amount) === Number(amount)) {
                bancoTransacoes.set(idBusca, { status: 'paid', amount: amount });
                console.log(`💰 PAGAMENTO CONFIRMADO! Transação: ${idBusca}`);
            }
        }
    }
    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: POLLING (REDIRECIONAMENTO AUTOMÁTICO)
// =====================================================
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = bancoTransacoes.get(id);

    if (transacao && transacao.status === 'paid') {
        return res.json({ paid: true }); 
    } else {
        return res.json({ paid: false }); 
    }
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor da Vizzion com Chave Dupla Rodando!"));
