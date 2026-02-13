import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA CHAVE
const KEY = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus'.trim();

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO PROTOCOLO QUEBRA-CADEADO (V17)");

    const { valor, name, cpf, email } = req.body;
    
    // PREPARAÇÃO DOS DADOS
    const amountFloat = parseFloat(valor || 27.90);
    const uniqueId = `ID-${Date.now()}`;
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : "05350974033";
    
    // Data de Vencimento
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const formattedDate = dueDate.toISOString().split('T')[0];

    // PAYLOAD (COM O PRODUTO ZG14WV9 QUE VOCÊ ME PASSOU)
    const payload = {
        identifier: uniqueId,
        amount: amountFloat,
        client: {
            name: name || "Cliente Consumidor",
            email: email || "comprovante@pagamento.com",
            phone: "(11) 99999-9999",
            document: cpfLimpo
        },
        products: [
            {
                id: "ZG14WV9", // <--- ID DO PRODUTO OBRIGATÓRIO
                name: "Taxa de Desbloqueio",
                quantity: 1,
                price: amountFloat
            }
        ],
        dueDate: formattedDate
    };

    // LISTA DE TENTATIVAS (AS 4 COMBINAÇÕES POSSÍVEIS)
    const tentativas = [
        {
            nome: "TENTATIVA 1 (URL API + Bearer)",
            url: 'https://api.vizzionpay.com/api/v1/gateway/pix/receive',
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
        },
        {
            nome: "TENTATIVA 2 (URL APP + Bearer)",
            url: 'https://app.vizzionpay.com/api/v1/gateway/pix/receive',
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
        },
        {
            nome: "TENTATIVA 3 (URL API + X-API-KEY)",
            url: 'https://api.vizzionpay.com/api/v1/gateway/pix/receive',
            headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/json' }
        },
        {
            nome: "TENTATIVA 4 (URL APP + X-API-KEY)",
            url: 'https://app.vizzionpay.com/api/v1/gateway/pix/receive',
            headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/json' }
        }
    ];

    // LOOP DE TENTATIVAS
    for (const tentativa of tentativas) {
        try {
            console.log(`Trying: ${tentativa.nome}...`);
            
            const response = await axios.post(tentativa.url, payload, {
                headers: tentativa.headers,
                timeout: 8000 // 8 segundos por tentativa
            });

            console.log(`✅ SUCESSO NA ${tentativa.nome}!`);
            
            // SE DEU CERTO, RETORNA E PARA O LOOP
            const data = response.data;
            let copyPaste = "";
            let qrImage = "";

            if (data.pix) {
                copyPaste = data.pix.qrcode_text || data.pix.payload || data.pix.emv;
                qrImage = data.pix.qrcode_image || data.pix.base64 || data.pix.encodedImage;
            } else {
                copyPaste = data.qrcode_text || data.pix_code || data.payload;
                qrImage = data.qrcode_image || data.encodedImage;
            }

            return res.json({ success: true, payload: copyPaste, encodedImage: qrImage });

        } catch (error: any) {
            const status = error.response?.status;
            console.log(`❌ Falhou ${tentativa.nome} (Status: ${status})`);
            
            // Se o erro NÃO for 401 (ex: 400, 500), significa que a chave funcionou mas os dados estão errados.
            // Nesse caso, paramos e mostramos o erro real, pois não adianta trocar a chave.
            if (status && status !== 401 && status !== 403) {
                 const msg = error.response?.data?.message || JSON.stringify(error.response?.data);
                 console.log("Erro de dados (não de chave). Parando tentativas.");
                 return res.json({ success: false, message: `Erro Vizzion (${status}): ${msg}` });
            }
            // Se for 401, o loop continua para a próxima tentativa...
        }
    }

    // SE CHEGOU AQUI, TODAS FALHARAM
    return res.json({ 
        success: false, 
        message: "Erro 401: Nenhuma combinação de URL/Chave funcionou. Verifique se a chave está ativa no painel." 
    });
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR QUEBRA-CADEADO V17 RODANDO NA PORTA ${PORT}`));
