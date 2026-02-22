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
// 🔑 CONFIGURAÇÕES
// =====================================================
const MK_API_URL = "api.memberkit.com.br"; 
const MK_CLIENT_DOMAIN = "membros.xn--seubnushopp-5eb.com"; 
const MK_COURSE_ID = 275575; 
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 

const PUBLIC_KEY = "rodrigo-igp_9mdb0v11ivwyoqtt"; 
const SECRET_KEY = "2z9x2whgofky0aneyx1pu0dkaj8y9j0m8981yitu81wdb75lrirj1u2b50xiqacf"; 

const resend = new Resend('re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez');
const META_PIXEL_ID = "847728461631550"; 
const META_ACCESS_TOKEN = "EAAGZAoNPRbbwBQlVq2XIPxcm6S3lE7EHASXNsyQoiULVOBES9uwoBt1ijXLIsS19daREz2xzuLnMl0C1yZAE3HYkKK19Fmykttzdhs5qZCZC0TkCviGXSrS9NuGvb99ZBDYZB8dkEzjlp6sZBrnG8x79dvvpV55mDhVXTocILMBbuxZCASrUZCIdUr18mYTZB0fgZDZD";

const bancoTransacoes = new Map();

function hashData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

app.use(express.static(path.join(__dirname, '..'))); 
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '..', 'index.html')); });

// ROTA PIX (MANTIDA IGUAL)
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor, origem } = req.body;
        const identifier = `ID${Date.now()}`;
        const valorFixo = parseFloat(valor) || 27.90;
        bancoTransacoes.set(identifier, { status: 'pending', emailCliente: email, nomeCliente: name, origem: origem || 'direto' });

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name, email, document: (cpf || "").replace(/\D/g, ''), phone: (phone || "").replace(/\D/g, '') },
            products: [{ id: "TAXA_01", name: "Taxa de Liberação", quantity: 1, price: valorFixo }],
            splits: [{ producerId: "cmg7bvpns00u691tsx9g6vlyp", amount: parseFloat((valorFixo * 0.5).toFixed(2)) }],
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        return res.json({ success: true, payload: response.data.pix?.qrcode_base64 || response.data.pix?.qrcode, transactionId: identifier });
    } catch (error: any) { return res.status(401).json({ success: false }); }
});

// =====================================================
// 💰 WEBHOOK (CORREÇÃO DO 404)
// =====================================================
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (transaction?.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        const idBusca = transaction.identifier || transaction.id;
        const memoria = bancoTransacoes.get(idBusca) || {};
        const nomeCliente = transaction.client?.name || memoria.nomeCliente || "Cliente Shopee";
        const emailCliente = transaction.client?.email || memoria.emailCliente;

        bancoTransacoes.set(idBusca, { ...memoria, status: 'paid' });

        if (emailCliente) {
            const enrollmentData = {
                "enrollment": {
                    "full_name": nomeCliente,
                    "email": emailCliente,
                    "course_id": MK_COURSE_ID,
                    "password": "shopee123",
                    "password_confirmation": "shopee123"
                }
            };

            try {
                // 🎯 O AJUSTE MATADOR: Adicionado o header "Accept" e endpoint direto
                const mkResponse = await axios.post(`https://${MK_API_URL}/v1/enrollments`, enrollmentData, {
                    headers: { 
                        "X-MemberKit-API-Key": MK_KEY, 
                        "Content-Type": "application/json",
                        "Accept": "application/json" // <--- OBRIGATÓRIO PARA NÃO DAR 404 HTML
                    }
                });
                console.log(`✅ SUCESSO MK: Aluno ${emailCliente} matriculado!`);
            } catch (err: any) {
                console.log("❌ FALHA MEMBERKIT DETALHADA:");
                console.log("🔹 Status:", err.response?.status);
                console.log("🔹 Resposta:", JSON.stringify(err.response?.data || err.message, null, 2));
            }

            // META PURCHASE E RESEND (MANTIDOS)
            axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
                data: [{
                    event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), action_source: "website",
                    user_data: { em: [hashData(emailCliente)], fn: [hashData(nomeCliente)] },
                    custom_data: { value: Number(transaction.amount), currency: "BRL" }
                }],
                access_token: META_ACCESS_TOKEN
            }).catch(() => {});

            setTimeout(async () => {
                await resend.emails.send({
                    from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>',
                    to: emailCliente,
                    subject: 'Seu acesso chegou! 🚀 Liberação Imediata',
                    html: `<div style="text-align: center;"><h2>Olá, ${nomeCliente}! 🎉</h2><p>Clique abaixo para entrar <b>direto</b>:</p><a href="https://${MK_CLIENT_DOMAIN}/users/sign_in?user[email]=${encodeURIComponent(emailCliente)}&user[password]=shopee123" style="background: #ee4d2d; color: white; padding: 20px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">ACESSAR MEU PAINEL AGORA</a></div>`
                });
            }, 2000);
            
            axios.get('https://api.pushcut.io/KnUVBiCa-4A0euJ42eJvj/notifications/MinhaNotifica%C3%A7%C3%A3o').catch(() => {});
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const transacao = bancoTransacoes.get(req.params.id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Sistema Ativo e Blindado!"));
