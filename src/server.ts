import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { Resend } from 'resend'; // <-- Adicionado

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔑 CONFIGURAÇÕES DE INTEGRAÇÃO (Preencha seus dados)
// =====================================================
const SECRET_KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
const PUBLIC_KEY = "rodrigogato041_glxgrxj8x8yy8jo2";
const RESEND_KEY = "re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez"; // Sua chave Resend
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; // Sua chave MemberKit
const MK_SUBDOMINIO = "rodrigo-gato-ribeiro"; // Seu subdomínio MK

const resend = new Resend(RESEND_KEY);
const bancoTransacoes = new Map();

// 👉 Rastreador de Pix Copia e Cola
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

// =====================================================
// ROTA 1: GERA O PIX (Agora salva Nome e E-mail)
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        const valorFixo = parseFloat(valor) || 27.90; 
        const identifier = `ID${Date.now()}`;
        
        // SALVAMOS O NOME E E-MAIL NO MAPA (Importante!)
        bancoTransacoes.set(identifier, { 
            status: 'pending', 
            amount: valorFixo,
            email: email,
            nome: name 
        });

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { 
                name: name || "Cliente", 
                email: email || "cliente@email.com", 
                document: cpf || "000.000.000-00" 
            },
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY }
        });

        return res.json({ 
            success: true, 
            payload: acharCopiaECola(response.data),
            transactionId: identifier 
        });

    } catch (error: any) {
        return res.status(401).json({ success: false });
    }
});

// =====================================================
// ROTA 2: WEBHOOK (Onde a mágica do acesso acontece)
// =====================================================
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (!transaction) return res.status(400).send("Invalid");

    const idBusca = transaction.identifier || transaction.id;

    if (transaction.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const dados = bancoTransacoes.get(idBusca);
            
            // 1. Atualiza status no banco temporário
            bancoTransacoes.set(idBusca, { ...dados, status: 'paid' });

            console.log(`💰 PAGAMENTO APROVADO: ${dados.nome}`);

            try {
                // 2. CADASTRO NA MEMBERKIT COM SENHA PADRÃO
                await axios.post(`https://${MK_SUBDOMINIO}.memberkit.com.br/api/v1/enrollments`, {
                    full_name: dados.nome,
                    email: dados.email,
                    password: "shopee123" // <-- Senha definida!
                }, {
                    headers: { "X-MemberKit-API-Key": MK_KEY }
                });

                // 3. ENVIO DO E-MAIL PELO RESEND
                await resend.emails.send({
                    from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>',
                    to: dados.email,
                    subject: 'Seu acesso chegou! 🚀 Resgate de Bonificação',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px;">
                            <h2>Olá, ${dados.nome}! 🎉</h2>
                            <p>Seu acesso já está liberado. Use os dados abaixo:</p>
                            <p><strong>Login:</strong> ${dados.email}</p>
                            <p><strong>Senha:</strong> shopee123</p>
                            <br>
                            <a href="https://${MK_SUBDOMINIO}.memberkit.com.br/" style="background:#ee4d2d; color:#fff; padding:15px; text-decoration:none; border-radius:5px;">ACESSAR AGORA</a>
                        </div>`
                });

                console.log("✅ Acesso liberado e e-mail enviado!");

            } catch (err) {
                console.error("❌ Erro na liberação:", err);
            }
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const transacao = bancoTransacoes.get(req.params.id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor Full Integrado!"));
