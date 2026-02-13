import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA CHAVE (Removemos espaços extras por segurança)
const KEY = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus'.trim();

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TENTATIVA DE CONEXÃO MULTIPLA (V14)");

    const { valor, name, cpf, email } = req.body;
    
    // Preparação dos dados
    const amountFloat = parseFloat(valor || 27.90);
    const uniqueId = `ID-${Date.now()}`;
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : "05350974033";
    
    // Payload Oficial
    const payload = {
        identifier: uniqueId,
        amount: amountFloat,
        client: {
            name: name || "Cliente",
            email: email || "email@teste.com",
            phone: "(11) 99999-9999",
            document: cpfLimpo
        },
        products: [{ name: "Taxa", quantity: 1, price: amountFloat }]
    };

    // --- ESTRATÉGIA SNIPER: TENTAR 2 URLS ---
    
    // URL 1: A que você achou (app.)
    const URL_APP = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';
    // URL 2: A padrão de APIs (api.)
    const URL_API = 'https://api.vizzionpay.com/api/v1/gateway/pix/receive';

    try {
        // TENTATIVA 1: URL APP + BEARER TOKEN
        console.log("Tentando URL APP...");
        const response = await axios.post(URL_APP, payload, {
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log("✅ SUCESSO NA URL APP!");
        return enviarResposta(res, response.data);

    } catch (err1: any) {
        console.log(`❌ Falha URL APP: ${err1.response?.status}`);
        
        try {
            // TENTATIVA 2: URL API + BEARER TOKEN
            console.log("Tentando URL API (Troca de app por api)...");
            const response = await axios.post(URL_API, payload, {
                headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
                timeout: 10000
            });
            console.log("✅ SUCESSO NA URL API!");
            return enviarResposta(res, response.data);

        } catch (err2: any) {
            console.log(`❌ Falha URL API: ${err2.response?.status}`);
            
            try {
                // TENTATIVA 3: URL API + HEADER X-API-KEY (Alternativa comum)
                console.log("Tentando URL API com header X-API-KEY...");
                const response = await axios.post(URL_API, payload, {
                    headers: { 'X-API-KEY': KEY, 'Content-Type': 'application/json' },
                    timeout: 10000
                });
                console.log("✅ SUCESSO COM X-API-KEY!");
                return enviarResposta(res, response.data);

            } catch (err3: any) {
                // SE TUDO FALHAR
                console.error("❌ TODAS AS TENTATIVAS FALHARAM.");
                const erroFinal = err1.response?.data || err2.response?.data || err3.response?.data;
                const statusFinal = err1.response?.status || 500;
                
                return res.json({ 
                    success: false, 
                    message: `Erro Definitivo (${statusFinal}): ${JSON.stringify(erroFinal)}` 
                });
            }
        }
    }
});

function enviarResposta(res: any, data: any) {
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
}

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR SNIPER V14 RODANDO NA PORTA ${PORT}`));
