import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA CHAVE DA VIZZION
const KEY = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus'.trim();

// URL DA API
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO (V16 - CÓDIGO PRODUTO ZG14WV9)");

    try {
        const { valor, name, cpf, email } = req.body;
        
        // 1. PREPARAÇÃO DOS DADOS
        const amountFloat = parseFloat(valor || 27.90);
        const uniqueId = `PEDIDO-${Date.now()}`;
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : "05350974033";
        
        // Data de Vencimento (Amanhã)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        const formattedDate = dueDate.toISOString().split('T')[0];

        // 2. PAYLOAD OFICIAL COM O SEU PRODUTO
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
                    id: "ZG14WV9",  // <--- CÓDIGO DO PRODUTO INSERIDO AQUI
                    name: "Taxa de Desbloqueio",
                    quantity: 1,
                    price: amountFloat
                }
            ],
            dueDate: formattedDate
        };

        console.log(`Enviando Produto ZG14WV9... Valor: R$ ${amountFloat}`);

        // 3. ENVIO PARA VIZZION
        const response = await axios.post(API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log("✅ SUCESSO! QR CODE GERADO.");
        
        const data = response.data;
        
        // 4. CAPTURA DO PIX (Copia e Cola + Imagem)
        // Tenta pegar dentro do objeto 'pix' (padrão novo) ou na raiz (padrão antigo)
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
        console.error("❌ ERRO NA REQUISIÇÃO:");
        
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Motivo: ${JSON.stringify(error.response.data)}`);
            
            const msg = error.response.data.message || JSON.stringify(error.response.data);
            
            return res.json({ 
                success: false, 
                message: `Erro Vizzion (${error.response.status}): ${msg}` 
            });
        }
        
        return res.json({ success: false, message: "Erro de conexão com o servidor." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V16 RODANDO NA PORTA ${PORT}`));
