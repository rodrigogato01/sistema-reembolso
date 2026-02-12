import { Request, Response } from 'express';
import axios from 'axios';

export class PixController {
    private accessToken = process.env.MERCADO_PAGO_TOKEN || 'APP_USR-7433336192149093-020423-97cd4e2614f56c0f43836231bfb0e432-202295570';

    create = async (req: Request, res: Response) => {
        try {
            const { name, cpf, valor } = req.body;
            
            console.log('Recebido:', { name, cpf, valor });

            if (!name || !cpf || !valor) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Dados incompletos' 
                });
            }

            const cpfLimpo = String(cpf).replace(/\D/g, '');
            
            const response = await axios({
                method: 'POST',
                url: 'https://api.mercadopago.com/v1/payments',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `${Date.now()}`
                },
                data: {
                    transaction_amount: parseFloat(valor),
                    description: 'Taxa de Servico',
                    payment_method_id: 'pix',
                    payer: {
                        email: `${cpfLimpo}@email.com`,
                        identification: {
                            type: 'CPF',
                            number: cpfLimpo
                        }
                    }
                }
            });

            console.log('PIX criado:', response.data.id);

            // CORREÇÃO: Formata o base64 corretamente
            const qrBase64 = response.data.point_of_interaction.transaction_data.qr_code_base64;
            const qrImage = `data:image/png;base64,${qrBase64}`;

            return res.json({
                success: true,
                payload: response.data.point_of_interaction.transaction_data.qr_code,
                encodedImage: qrImage, // Agora está formatado corretamente
                txid: response.data.id
            });

        } catch (error: any) {
            console.error('Erro MP:', error.response?.data || error.message);
            
            return res.status(500).json({
                success: false,
                message: error.response?.data?.message || error.message
            });
        }
    }

    checkStatus = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const response = await axios.get(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            return res.json({ status: response.data.status });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    webhook = async (req: Request, res: Response) => {
        console.log('Webhook MP:', req.body);
        return res.status(200).send('OK');
    }
}
