import { Request, Response } from 'express';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

export class PixController {
    // Pega das variáveis de ambiente ou usa os valores diretos
    private credentials = {
        client_id: process.env.EFI_CLIENT_ID || 'COLE_SEU_CLIENT_ID_AQUI',
        client_secret: process.env.EFI_CLIENT_SECRET || 'COLE_SEU_CLIENT_SECRET_AQUI',
        certificate: process.env.EFI_CERTIFICATE || 'certificado.p12'
    };

    private getHttpsAgent() {
        const certPath = path.resolve(process.cwd(), this.credentials.certificate);
        
        if (!fs.existsSync(certPath)) {
            throw new Error(`Certificado não encontrado: ${certPath}`);
        }
        
        const cert = fs.readFileSync(certPath);
        return new https.Agent({ pfx: cert, passphrase: '' });
    }

    private async getAccessToken() {
        const auth = Buffer.from(`${this.credentials.client_id}:${this.credentials.client_secret}`).toString('base64');
        
        const response = await axios.post('https://pix.api.efipay.com.br/oauth/token', 
            { grant_type: 'client_credentials' },
            {
                headers: { 
                    Authorization: `Basic ${auth}`, 
                    'Content-Type': 'application/json' 
                },
                httpsAgent: this.getHttpsAgent()
            }
        );
        
        return response.data.access_token;
    }

    create = async (req: Request, res: Response) => {
        try {
            const { name, cpf, valor } = req.body;
            
            if (!name || !cpf || !valor) {
                return res.status(400).json({ success: false, message: 'Dados incompletos' });
            }

            const cpfLimpo = String(cpf).replace(/\D/g, '');
            
            if (cpfLimpo.length !== 11) {
                return res.status(400).json({ success: false, message: 'CPF inválido' });
            }

            const token = await this.getAccessToken();

            const cob = await axios.post('https://pix.api.efipay.com.br/v2/cob', {
                calendario: { expiracao: 3600 },
                devedor: { cpf: cpfLimpo, nome: String(name).substring(0, 80) },
                valor: { original: parseFloat(valor).toFixed(2) },
                chave: 'SUA_CHAVE_PIX_AQUI', // <-- Troque pela sua chave PIX
                solicitacaoPagador: 'Taxa de Servico'
            }, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            const qrcode = await axios.get(`https://pix.api.efipay.com.br/v2/loc/${cob.data.loc.id}/qrcode`, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            return res.json({
                success: true,
                payload: qrcode.data.qrcode,
                encodedImage: qrcode.data.imagemQrcode,
                txid: cob.data.txid
            });

        } catch (error: any) {
            console.error('Erro:', error.response?.data || error.message);
            return res.status(500).json({ 
                success: false, 
                message: error.message,
                detalhes: error.response?.data 
            });
        }
    }

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
            return res.status(500).json({ error: error.message });
        }
    }

    webhook = async (req: Request, res: Response) => {
        console.log('Webhook:', req.body);
        return res.status(200).send('OK');
    }
}
