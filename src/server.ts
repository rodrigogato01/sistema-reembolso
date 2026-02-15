import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 CHAVE VIZZION ATUALIZADA
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

// "Banco de Dados" (Simulado em memória para armazenar as transações)
// O Dev pode depois trocar isso por uma query no banco MySQL/Postgres dele.
const bancoTransacoes = new Map();

// ROTA PARA EXIBIR A SUA PÁGINA VISUAL (FRONTEND)
app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// =====================================================
// ROTA 1: GERAÇÃO DO PIX E CRIAÇÃO NO BANCO
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : ""; 
        const phoneLimpo = phone ? phone.replace(/\D/g, '') : "";
        const valorFixo = parseFloat(valor) || 27.90; 

        // Cria o ID único para a transação
        const identifier = `ID-${Date.now()}`; 

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name: name || "Cliente", email: email || "email@teste.com", document: cpfLimpo, phone: phoneLimpo },
            products: [{ id: "TAXA", name: "Taxa Liberacao", quantity: 1, price: valorFixo }],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
        };

        // 1. SALVA A TRANSAÇÃO NO "BANCO" COMO PENDENTE (Conforme o Dev pediu)
        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: identifier // Devolve esse ID para o Front-end fazer o Polling
        });

    } catch (error: any) {
        return res.json({ success: false, message: `Erro: ${error.response?.data?.message || error.message}` });
    }
});

// =====================================================
// ROTA 2: PROCESSAR O WEBHOOK (LÓGICA DO SEU DEV)
// =====================================================
app.post('/webhook', (req, res) => {
    // Captura os dados enviados pela Vizzion
    const { transaction_id, identifier, status, payment_method, amount, event } = req.body;

    // A Vizzion pode mandar o nosso ID dentro de "identifier" ou "transaction_id"
    const idBusca = identifier || transaction_id;

    console.log(`🔔 Webhook - ID: ${idBusca} | Status: ${status} | Evento: ${event}`);

    // VALIDAÇÃO EXATA SUGERIDA PELO DEV:
    // Confirma se é PIX, se está COMPLETED e se o evento é TRANSACTION_PAID
    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        // 1. Procura o ID da transação no banco de dados
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            
            // 2. Valida se o valor do pagamento bate com o valor gerado
            if (Number(transacao.amount) === Number(amount)) {
                
                // 3. Altera de 'pending' para 'completed'
                bancoTransacoes.set(idBusca, { status: 'completed', amount: transacao.amount });
                console.log(`✅ SUCESSO! Transação ${idBusca} atualizada para COMPLETED no banco.`);
                
            } else {
                console.log(`❌ ERRO: Valor divergente. Valor banco: ${transacao.amount}, Pago: ${amount}`);
            }
        } else {
            console.log(`❌ ERRO: Transação ${idBusca} não encontrada no banco.`);
        }
    }

    // O Webhook é apenas para atualizar o banco. Sempre retornar 200 OK.
    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: ARQUIVO PARA VERIFICAR TRANSAÇÃO (POLLING DO FRONT)
// =====================================================
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    
    // Consulta a transação no banco
    const transacao = bancoTransacoes.get(id);

    // Se a transação existe e o Webhook alterou para 'completed' (Pago)
    if (transacao && transacao.status === 'completed') {
        // Envia 'true' para o front-end, que fará o redirecionamento
        return res.json({ paid: true }); 
    } else {
        // Se ainda está 'pending', manda false e o front continua perguntando
        return res.json({ paid: false }); 
    }
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor e Webhook rodando 100%!"));
