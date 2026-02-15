import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 CHAVE VIZZION AQUI 
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

// "Banco de Dados" em memória
const bancoTransacoes = new Map();

// SERVIR A PÁGINA HTML NO SEU LINK
app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// =====================================================
// ROTA 1: GERA O PIX (FORMATO EXATO DA VIZZION PAY)
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        
        // Garante que o valor é um número (float) como a Vizzion pede
        const valorFixo = parseFloat(valor) || 79.10; 
        
        // ID único
        const identifier = `ID${Date.now()}`; 

        // Data de vencimento para amanhã (Formato YYYY-MM-DD)
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const dueDateStr = amanha.toISOString().split('T')[0];

        // =====================================================
        // O PAYLOAD EXATO QUE VOCÊ ME MANDOU NA DOCUMENTAÇÃO
        // =====================================================
        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { 
                name: name || "Cliente Consumidor", 
                email: email || "email@pendente.com", 
                phone: phone || "(11) 99999-9999", 
                document: cpf || "000.000.000-00" 
            },
            products: [
                {
                    id: "TAXA_FINAL",
                    name: "Taxa de Ativacao",
                    quantity: 1,
                    price: valorFixo
                }
            ],
            dueDate: dueDateStr,
            metadata: {},
            // 👉 A MÁGICA DO WEBHOOK ACONTECE AQUI DENTRO:
            callbackUrl: "https://checkoutfinal.onrender.com/webhook" 
        };

        // Salva transação no banco antes de gerar
        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        // Manda pra Vizzion
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': `Bearer ${KEY}`, 
                'Content-Type': 'application/json' 
            }
        });

        // Devolve pro HTML
        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: identifier 
        });

    } catch (error: any) {
        console.error("Erro Vizzion:", error.response?.data || error.message);
        return res.json({ 
            success: false, 
            message: "Erro na comunicação com a API de Pagamento." 
        });
    }
});

// =====================================================
// ROTA 2: O WEBHOOK (VIZZION AVISA AQUI QUE FOI PAGO)
// =====================================================
app.post('/webhook', (req, res) => {
    const { transaction_id, identifier, status, payment_method, amount, event } = req.body;
    
    // Identificador
    const idBusca = identifier || transaction_id;
    console.log(`🔔 Webhook Recebido - ID: ${idBusca} | Status: ${status}`);

    // Validação de pagamento PIX e COMPLETED
    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            
            if (Number(transacao.amount) === Number(amount)) {
                bancoTransacoes.set(idBusca, { status: 'paid', amount: amount });
                console.log(`✅ Pix Confirmado! Transação ${idBusca} atualizada para PAID.`);
            }
        }
    }
    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: POLLING (O SITE PERGUNTA SE JÁ PODE REDIRECIONAR)
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

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor da Vizzion rodando 100%!"));
