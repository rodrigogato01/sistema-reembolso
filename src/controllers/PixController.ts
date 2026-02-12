import { Request, Response } from 'express';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

export class PixController {
    // Credenciais EXATAS
    private credentials = {
        client_id: 'Client_Id_4f08f7745e963684c33300837f59e4b3f852e645',
        client_secret: 'Client_Secret_1acd5546d4462972f9d5aae1c8dfee0c0bcddd8d',
        certificate: 'producao-875882-Shopee Bônus.p12'
    };

    private getHttpsAgent() {
        const certPath = path.resolve(process.cwd(), this.credentials.certificate);
        
        console.log("Procurando certificado em:", certPath);
        
        if (!fs.existsSync(certPath)) {
            console.error("ERRO: Certificado não encontrado!");
            throw new Error(`Certificado não encontrado: ${certPath}`);
        }
        
        const cert = fs.readFileSync(certPath);
        console.log("Certificado carregado com sucesso");
        
        return new https.Agent({ 
            pfx: cert, 
            passphrase: '',
            rejectUnauthorized: false // Adicionado para testes
        });
    }

    private async getAccessToken() {
        try {
            const auth = Buffer.from(`${this.credentials.client_id}:${this.credentials.client_secret}`).toString('base64');
            
            console.log("Solicitando token...");
            
            // URL CORRIGIDA (sem espaço no final)
            const response = await axios.post('https://pix.api.efipay.com.br/oauth/token', 
                { grant_type: 'client_credentials' },
                {
                    headers: { 
                        Authorization: `Basic ${auth}`, 
                        'Content-Type': 'application/json' 
                    },
                    httpsAgent: this.getHttpsAgent(),
                    timeout: 10000
                }
            );
            
            console.log("Token obtido com sucesso");
            return response.data.access_token;
            
        } catch (error: any) {
            console.error("Erro ao obter token:", error.response?.data || error.message);
            throw new Error("Falha na autenticação com EFI Bank");
        }
    }

    // CRIAR PIX
    create = async (req: Request, res: Response) => {
        try {
            const { name, cpf, valor } = req.body;
            
            console.log("Dados recebidos:", { name, cpf, valor });

            // Validação básica
            if (!name || !cpf || !valor) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Dados incompletos" 
                });
            }

            // LIMPA O CPF (remove pontos e traço)
            const cpfLimpo = cpf.replace(/\D/g, '');
            
            if (cpfLimpo.length !== 11) {
                return res.status(400).json({ 
                    success: false, 
                    message: "CPF inválido" 
                });
            }

            const token = await this.getAccessToken();

            console.log("Criando cobrança PIX...");

            // Cria a cobrança
            const cob = await axios.post('https://pix.api.efipay.com.br/v2/cob', {
                calendario: { expiracao: 3600 },
                devedor: { 
                    cpf: cpfLimpo, 
                    nome: name.substring(0, 80) // Limita tamanho do nome
                },
                valor: { 
                    original: parseFloat(valor).toFixed(2) 
                },
                chave: 'e0cfba23-ddcb-441f-809d-893ccf6d0f7a',
                solicitacaoPagador: 'Taxa de Servico'
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.getHttpsAgent(),
                timeout: 15000
            });

            console.log("Cobrança criada, ID:", cob.data.loc.id);

            // Gera QR Code
            const qrcode = await axios.get(`https://pix.api.efipay.com.br/v2/loc/${cob.data.loc.id}/qrcode`, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent(),
                timeout: 10000
            });

            console.log("QR Code gerado com sucesso");

            return res.json({
                success: true,
                payload: qrcode.data.qrcode,
                encodedImage: qrcode.data.imagemQrcode,
                txid: cob.data.txid
            });

        } catch (error: any) {
            console.error("Erro completo:", error.response?.data || error.message || error);
            
            return res.status(500).json({ 
                success: false, 
                message: error.response?.data?.mensagem || error.message || "Erro interno",
                detalhes: error.response?.data
            });
        }
    }

    // CHECK STATUS
    checkStatus = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const token = await this.getAccessToken();
            
            const response = await axios.get(`https://pix.api.efipay.com.br/v2/cob/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            return res.json({ status: response.data.status });
            
        } catch (error: any) {
            console.error("Erro checkStatus:", error.response?.data || error.message);
            return res.status(500).json({ error: "Erro ao consultar status" });
        }
    }

    // WEBHOOK
    webhook = async (req: Request, res: Response) => {
        console.log("Webhook recebido:", req.body);
        return res.status(200).send("OK");
    }
}
