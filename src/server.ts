import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// 1. SUA CHAVE (Com .trim() para remover espaços invisíveis)
const VIZZION_PUBLIC = 'rodrigogato041_glxgrxj8x8yy8jo2'.trim();
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus'.trim();

// 2. URL DA API
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO (V13 - AUTENTICAÇÃO REFORÇADA)");

    try {
        let { valor, name, cpf, email, phone } = req.body;

        if (!valor) valor = 27.90;

        let amountNumber = Number(valor);
            
        if (Number.isInteger(amountNumber) && amountNumber > 1000) {
            amountNumber = amountNumber / 100;
        }

        amountNumber = Math.round(amountNumber * 100) / 100;

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
            amount: amountNumber,
            client: {
                name: name || "Cliente Consumidor",
                email: email || "cliente@pagamento.com",
                phone: phone || "(11) 99999-9999",
                document: cpfLimpo
            },
            products: [
                {
                    id: "v3b8k2m9x7",
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
                'x-public-key': VIZZION_PUBLIC,
                'x-secret-key': VIZZION_SECRET,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 25000 // Aumentei o tempo de espera
        });

        console.log("✅ VIZZION RESPONDEU 201 SUCESSO!");
        
        const data = response.data;

        let payloadPix = "";
        let imagemPix = "";

        if (data.pix) {
            payloadPix = data.pix.code || "";
            imagemPix = data.pix.base64 || data.pix.image || "";
        }

        return res.json({
            success: true,
            payload: payloadPix,
            encodedImage: imagemPix
        });

    } catch (error: any) {
        console.error("❌ FALHA NA REQUISIÇÃO:");
        
        if (error.response) {

            const debugData = {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: error.response.data,
                request: {
                    url: error.config?.url,
                    method: error.config?.method,
                    payload: error.config?.data
                }
            };
        
            // LOG COMPLETO NO CONSOLE DO SERVIDOR
            console.error("===== ERRO COMPLETO VIZZION =====");
            console.error(JSON.stringify(debugData, null, 2));
            console.error("==================================");
        
            // RETORNA TUDO NO NAVEGADOR (DEBUG)
            return res.json({
                success: false,
                message: "Erro na Vizzion",
                debug: debugData
            });
        
        } else {
        
            console.error("===== ERRO DE CONEXÃO =====");
            console.error(error.message);
            console.error("===========================");
        
            return res.json({
                success: false,
                message: "Erro de conexão (Time out ou URL errada)",
                debug: {
                    message: error.message,
                    stack: error.stack
                }
            });
        }
    }
});

// Rota para o HTML
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V13 RODANDO NA PORTA ${PORT}`));
