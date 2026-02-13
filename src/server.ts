import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

// ==================================================================
// 🔴 CONFIRA SUA CHAVE AQUI (Sem espaços extras no final)
const KEY = 'SUA_CHAVE_VIZZION_AQUI'; 
// ==================================================================

app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;

        // Força o valor correto (27.90) numérico
        const amountFloat = parseFloat(valor) || 27.90;

        // Garante que CPF e Telefone vão limpos (apenas números)
        // A Vizzion prefere receber LIMPO e ela formata se precisar
        const cpfLimpo = cpf.replace(/\D/g, ''); 
        const phoneLimpo = phone.replace(/\D/g, '');

        const payload = {
            identifier: `ID-${Date.now()}`,
            amount: amountFloat,
            client: {
                name: name,
                email: email,
                document: cpfLimpo, // Enviando limpo para testar
                phone: phoneLimpo
            },
            products: [
                { id: "TAXA", name: "Taxa Desbloqueio", quantity: 1, price: amountFloat }
            ],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
        };

        console.log("Enviando para Vizzion:", payload);

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': `Bearer ${KEY}`, 
                'Content-Type': 'application/json' 
            }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: payload.identifier 
        });

    } catch (error: any) {
        // AQUI ESTÁ A MUDANÇA: PEGA O ERRO REAL DA VIZZION
        const erroVizzion = error.response?.data;
        const statusErro = error.response?.status;

        console.error("❌ ERRO REAL VIZZION:", JSON.stringify(erroVizzion));

        // Devolve o erro exato para o site mostrar no alerta
        return res.json({ 
            success: false, 
            message: `VIZZION RECUSOU (${statusErro}): ${JSON.stringify(erroVizzion || error.message)}`
        });
    }
});

// Rotas extras para não quebrar
app.get('/check-status/:id', (req, res) => res.json({ paid: false }));
app.listen(process.env.PORT || 3000, () => console.log("Servidor Dedo-Duro Rodando"));
