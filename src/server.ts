import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/pix', async (req, res) => {
    try {
        // =====================================================
        // 🔴 COLE SUA CHAVE AQUI DENTRO DAS ASPAS (SEM ESPAÇOS)
        const CHAVE_FINAL = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
        // =====================================================

        const { name, email, cpf, phone, valor } = req.body;
        
        // Limpeza rigorosa
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : ""; 
        const phoneLimpo = phone ? phone.replace(/\D/g, '') : "";
        const valorFixo = 27.90; // Forçando o valor correto

        // Monta o pedido
        const payload = {
            identifier: `ID-${Date.now()}`,
            amount: valorFixo,
            client: {
                name: name || "Cliente",
                email: email || "email@teste.com",
                document: cpfLimpo,
                phone: phoneLimpo
            },
            products: [
                { id: "TAXA", name: "Taxa Liberacao", quantity: 1, price: valorFixo }
            ],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
        };

        // Verifica se a chave existe antes de enviar
        if (!CHAVE_FINAL || CHAVE_FINAL.includes("COLE_SUA_CHAVE")) {
            throw new Error("A chave API ainda não foi colada no código do servidor!");
        }

        console.log(`Tentando enviar com chave de tamanho: ${CHAVE_FINAL.length} caracteres.`);

        // Envia para a Vizzion
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': `Bearer ${CHAVE_FINAL.trim()}`, // .trim() remove espaços invisíveis
                'Content-Type': 'application/json' 
            }
        });

        // SUCESSO
        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: payload.identifier 
        });

    } catch (error: any) {
        // TRATAMENTO DE ERRO COM DIAGNÓSTICO
        const erroVizzion = error.response?.data;
        const status = error.response?.status;
        
        // Pega a chave que foi usada para mostrar o tamanho dela (sem mostrar a senha)
        // Isso vai te ajudar a saber se o servidor leu a chave ou não
        const chaveUsada = "COLE_SUA_CHAVE_AQUI_DIRETO"; // (Repetido só pro catch ter acesso se precisar, mas o debug abaixo resolve)

        let explicacao = JSON.stringify(erroVizzion || error.message);

        // Retorna o erro detalhado para a sua tela
        return res.json({ 
            success: false, 
            message: `ERRO (${status}): ${explicacao}`
        });
    }
});

// Rota de verificação
app.get('/check-status/:id', (req, res) => res.json({ paid: false }));

app.listen(process.env.PORT || 3000, () => console.log("Servidor Final Rodando"));
