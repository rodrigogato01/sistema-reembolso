import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';

// Configuração do Cliente Mercado Pago
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || ''
});

export class PixController {
    
    // 1. CRIA O PIX (Igual para todas as fases)
    async create(req: Request, res: Response) {
        const payment = new Payment(client);
        
        try {
            const { amount, name, cpf } = req.body;

            const result = await payment.create({
                body: {
                    transaction_amount: parseFloat(amount),
                    description: `Pagamento Fase Funil - R$ ${amount}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: 'cliente@teste.com',
                        first_name: name,
                        identification: {
                            type: 'CPF',
                            number: cpf
                        }
                    },
                    // SEU LINK NA RENDER (Não esqueça de verificar se está correto)
                    notification_url: 'https://checkout-pix-profissional.onrender.com/webhook'
                }
            });

            return res.status(201).json(result);

        } catch (error: any) {
            console.error('Erro ao criar Pix:', error);
            return res.status(500).json({ error: 'Erro ao criar Pix' });
        }
    }

    // 2. RECEBE O AVISO E DECIDE SE REEMBOLSA
    async webhook(req: Request, res: Response) {
        const payment = new Payment(client);
        const refund = new PaymentRefund(client);
        const { action, data } = req.body;

        try {
            if (action === 'payment.created') {
                console.log('🔔 Pix Criado:', data.id);
            }

            if (action === 'payment.updated') {
                // Busca os detalhes do pagamento
                const pay = await payment.get({ id: String(data.id) });

                if (pay.status === 'approved') {
                    // Se vier vazio, ele assume que é 0. O TypeScript fica feliz!
const valorPago = pay.transaction_amount || 0;
                    console.log(`✅ Pagamento de R$ ${valorPago} APROVADO!`);

                    // --- CONFIGURAÇÃO DA ESTRATÉGIA ---
                    // Coloque aqui APENAS os valores que devem voltar para o cliente.
                    const valoresParaReembolso = [0.01, 27.00, 57.90]; 

                    if (valoresParaReembolso.includes(valorPago)) {
                        console.log(`🔄 Valor R$ ${valorPago} está na lista VIP de estorno. Devolvendo...`);
                        
                        await refund.create({
                            payment_id: String(data.id),
                            body: {
                                amount: valorPago // Devolve tudo
                            }
                        });
                        
                        console.log('💸 Estorno realizado com sucesso!');
                    } else {
                        // Se não estiver na lista, é venda real!
                        console.log(`💰 CAIXA! Venda de R$ ${valorPago} confirmada e mantida na conta.`);
                    }
                }
            }

            return res.status(200).send();

        } catch (error) {
            console.error('Erro no Webhook:', error);
            return res.status(500).send();
        }
    }

    // 3. CONSULTA STATUS (Para o site saber se aprovou)
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