import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 CHAVE VIZZION AQUI
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

// "Banco de Dados" em memória para armazenar as transações geradas
// (Num cenário ideal, salva-se num BD real. Aqui usamos Map para resposta imediata)
const bancoTransacoes = new Map();

// ROTA 1: GERA O PIX
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : ""; 
        const phoneLimpo = phone ? phone.replace(/\D/g, '') : "";
        const valorFixo = parseFloat(valor) || 27.90; 

        const identifier = `ID-${Date.now()}`; // ID Único da transação

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name: name || "Cliente", email: email || "email@teste.com", document: cpfLimpo, phone: phoneLimpo },
            products: [{ id: "TAXA", name: "Taxa Liberacao", quantity: 1, price: valorFixo }],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
        };

        // 1. SALVA A TRANSAÇÃO NO "BANCO" COMO PENDENTE
        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: identifier // Devolve o ID para o front fazer o polling
        });

    } catch (error: any) {
        return res.json({ success: false, message: `Erro: ${error.message}` });
    }
});

// ROTA 2: O WEBHOOK (VIZZION PAY BATE AQUI)
app.post('/webhook', (req, res) => {
    const { transaction_id, status, payment_method, amount, event } = req.body;

    console.log(`🔔 Webhook Recebido - ID: ${transaction_id} | Status: ${status}`);

    // Validações que você pediu (PIX, COMPLETED e TRANSACTION_PAID)
    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        // Verifica se a transação existe no nosso banco
        if (bancoTransacoes.has(transaction_id)) {
            const transacao = bancoTransacoes.get(transaction_id);
            
            // Verifica se o valor bate (opcional, mas recomendado)
            if (transacao.amount == amount) {
                // ATUALIZA O STATUS PARA PAGO
                bancoTransacoes.set(transaction_id, { status: 'paid', amount: amount });
                console.log(`✅ Pagamento Confirmado e Atualizado: ${transaction_id}`);
            }
        }
    }

    // Sempre responda 200 OK para o Gateway parar de enviar a notificação
    return res.status(200).send("OK");
});

// ROTA 3: POLLING (O FRONT-END PERGUNTA A CADA 3 SEGUNDOS)
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = bancoTransacoes.get(id);

    // Se a transação existe e o Webhook já mudou para 'paid'
    if (transacao && transacao.status === 'paid') {
        return res.json({ paid: true }); // Isso faz o front redirecionar
    } else {
        return res.json({ paid: false }); // Continua esperando
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor com Webhook Rodando 🚀"));
