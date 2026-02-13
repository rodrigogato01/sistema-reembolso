import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// 1. SUA CHAVE (Com .trim() para remover espaços invisíveis)
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus'.trim();

// 2. URL DA API
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO (V13 - AUTENTICAÇÃO REFORÇADA)");

    try {
        let { valor, name, cpf, email, phone } = req.body;

        // 3. TRATAMENTO DE DADOS
        if (!valor) valor = 27.90;
        const amountNumber = parseFloat(valor.toString());
        
        // Remove caracteres especiais do CPF
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : "12345678900";
        
        // Gera ID único
        const uniqueId = `ID-${Date.now()}`;

        // Data de vencimento (Hoje + 1 dia)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        const formattedDate = dueDate.toISOString().split('T')[0];

        // 4. PAYLOAD OFICIAL
        const payloadVizzion = {
            identifier: uniqueId,
            amount: amountNumber, // Formato Float (27.90)
            client: {
                name: name || "Cliente Consumidor",
                email: email || "cliente@pagamento.com",
                phone: phone || "(11) 99999-9999",
                document: cpfLimpo
            },
            products: [
                {
                    id: "1",
                    name: "Taxa de Desbloqueio",
                    quantity: 1,
                    price: amountNumber
                }
            ],
            dueDate: formattedDate
        };

        console.log(`Enviando para Vizzion com a chave iniciada em: ${VIZZION_SECRET.substring(0, 5)}...`);

        // 5. ENVIO COM CABEÇALHOS DE NAVEGADOR (Para evitar bloqueio)
        const response = await axios.post(API_URL, payloadVizzion, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 25000 // Aumentei o tempo de espera
        });

        console.log("✅ VIZZION RESPONDEU 201 SUCESSO!");
        
        const data = response.data;
        
        // Captura inteligente do campo Pix (tenta todos os lugares possíveis)
        let payloadPix = "";
        let imagemPix = "";

        if (data.pix) {
            payloadPix = data.pix.qrcode_text || data.pix.payload || data.pix.copy_paste;
            imagemPix = data.pix.qrcode_image || data.pix.base64 || data.pix.encodedImage;
        } else {
            payloadPix = data.qr_code || data.pix_code || data.payload;
            imagemPix = data.qr_code_base64 || data.encodedImage;
        }

        return res.json({ success: true, payload: payloadPix, encodedImage: imagemPix });

    } catch (error: any) {
        console.error("❌ FALHA NA REQUISIÇÃO:");
        
        if (error.response) {
            console.error(`Status: ${error.response.status}`); // 401 = Erro de Chave, 400 = Erro de Dados
            console.error(`Mensagem: ${JSON.stringify(error.response.data)}`);
            
            const msg = error.response.data.message || JSON.stringify(error.response.data);
            return res.json({ success: false, message: `Erro Vizzion (${error.response.status}): ${msg}` });
        } else {
            console.error(error.message);
            return res.json({ success: false, message: "Erro de conexão (Time out ou URL errada)" });
        }
    }
});

// Rota para o HTML
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V13 RODANDO NA PORTA ${PORT}`));
