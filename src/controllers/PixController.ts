import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || ''
});

export class PixController {
    
    async create(req: Request, res: Response) {
        const payment = new Payment(client);
        
        try {
            const { amount, name, cpf } = req.body;

            const result = await payment.create({
                body: {
                    transaction_amount: parseFloat(amount),
                    description: `Taxa de Verificação - R$ ${amount}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: 'cliente@verificado.com',
                        first_name: name,
                        identification: {
                            type: 'CPF',
                            number: cpf.replace(/\D/g, '') // Remove pontos e traços
                        }
                    },
                    notification_url: 'https://checkout-pix-profissional.onrender.com/webhook'
                }
            });

            return res.status(201).json(result);

        } catch (error: any) {
            console.error('Erro ao criar Pix:', error);
            return res.status(500).json({ error: 'Erro ao criar Pix' });
        }
    }

    async webhook(req: Request, res: Response) {
        const payment = new Payment(client);
        const refund = new PaymentRefund(client);
        const { action, data } = req.body;

        try {
            if (action === 'payment.updated') {
                const pay = await payment.get({ id: String(data.id) });

                if (pay.status === 'approved') {
                    const valorPago = pay.transaction_amount || 0;
                    console.log(`✅ Pagamento de R$ ${valorPago} APROVADO!`);

                    // --- AUTOMAÇÃO DE REEMBOLSO ---
                    const valoresDoFunil = [37.90, 47.90]; 

                    if (valoresDoFunil.includes(valorPago)) {
                        console.log(`⏳ Fase do Funil (R$ ${valorPago}). Aguardando 5s para liberar estorno...`);
                        
                        // O SEGREDO ESTÁ AQUI 👇
                        // Esperamos 5 segundos (5000ms) para o MP liberar o reembolso
                        setTimeout(async () => {
                            try {
                                await refund.create({
                                    payment_id: String(data.id),
                                    body: {
                                        amount: valorPago
                                    }
                                });
                                console.log('💸 Estorno realizado com sucesso!');
                            } catch (error) {
                                console.error('❌ Erro ao tentar estornar (Tentativa atrasada):', error);
                            }
                        }, 5000); // 5 segundos de espera
                        
                    } else {
                        console.log(`💰 Venda Real (R$ ${valorPago}). Dinheiro mantido.`);
                    }
                }
            }
            return res.status(200).send();
        } catch (error) {
            console.error('Erro no Webhook:', error);
            return res.status(500).send();
        }
    }

    async checkStatus(req: Request, res: Response) {
        const payment = new Payment(client);
        try {
            const { id } = req.params;
            const result = await payment.get({ id: String(id) }); 
            return res.json({ status: result.status });
        } catch (error) {
            return res.status(404).json({ status: 'error' });
        }
    }
}