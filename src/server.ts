import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { Resend } from 'resend';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔑 CONFIGURAÇÕES DE INTEGRAÇÃO
// =====================================================
const SECRET_KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
const PUBLIC_KEY = "rodrigogato041_glxgrxj8x8yy8jo2";
const RESEND_KEY = "re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez"; 
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 
const MK_SUBDOMINIO = "rodrigo-gato-ribeiro"; 

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

const formatCpf = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");

// =====================================================
// ROTA 1: GERA O PIX (Salvando Nome e E-mail)
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        const valorFixo = parseFloat(valor) || 27.90; 
        const identifier = `ID${Date.now()}`;
        
        // SALVANDO PARA O WEBHOOK USAR DEPOIS
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
                phone: formatPhone(phone || "11999999999"), 
                document: formatCpf(cpf || "00000000000") 
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
        console.error("Erro Vizzion:", error.message);
        return res.status(401).json({ success: false });
    }
});

// =====================================================
// ROTA 2: WEBHOOK (NOTIFICAÇÃO + ACESSO + E-MAIL)
// =====================================================
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (!transaction) return res.status(400).send("Invalid");

    const idBusca = transaction.identifier || transaction.id;

    if (transaction.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const dados = bancoTransacoes.get(idBusca);
            
            bancoTransacoes.set(idBusca, { ...dados, status: 'paid' });
            console.log(`💰 PAGAMENTO CONFIRMADO: ${dados.nome}`);

            // 1. 🔔 NOTIFICAÇÕES PUSHCUT (Seus links de volta)
            const url1 = 'https://api.pushcut.io/KnUVBiCa-4A0euJ42eJvj/notifications/MinhaNotifica%C3%A7%C3%A3o';
            const url2 = 'https://api.pushcut.io/g8WCdXfM9ImJ-ulF32pLP/notifications/Minha%20Primeira%20Notifica%C3%A7%C3%A3o';
            
            Promise.all([axios.get(url1), axios.get(url2)])
                .then(() => console.log('🔔 Pushcut enviado!'))
                .catch(err => console.error('❌ Erro Pushcut:', err.message));

            try {
                // 2. 🔑 CADASTRO MEMBERKIT (SENHA shopee123)
                await axios.post(`https://${MK_SUBDOMINIO}.memberkit.com.br/api/v1/enrollments`, {
                    full_name: dados.nome,
                    email: dados.email,
                    password: "shopee123"
                }, {
                    headers: { "X-MemberKit-API-Key": MK_KEY }
                });

                // 3. 📧 E-MAIL RESEND (COM A SENHA NO TEXTO)
                await resend.emails.send({
                    from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>',
                    to: dados.email,
                    subject: 'Seu acesso chegou! 🚀 Resgate de Bonificação',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                            <h2 style="color: #333;">Olá, ${dados.nome}! 🎉</h2>
                            <p>Seu acesso já está liberado. Use os dados abaixo:</p>
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                                <p><strong>Login:</strong> ${dados.email}</p>
                                <p><strong>Senha:</strong> shopee123</p>
                            </div>
                            <br>
                            <a href="https://${MK_SUBDOMINIO}.memberkit.com.br/" style="background:#ee4d2d; color:#fff; padding:15px; text-decoration:none; border-radius:5px; font-weight:bold;">ACESSAR PAINEL AGORA</a>
                        </div>`
                });

                console.log("✅ MemberKit e Resend processados!");

            } catch (err) {
                console.error("❌ Erro na automação de acesso:", err);
            }
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const transacao = bancoTransacoes.get(req.params.id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor Restaurado com Pushcut e Automação!"));
