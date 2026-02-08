import { Request, Response } from 'express';
import { PixService } from '../services/PixService';

const pixService = new PixService();

export class PixController {
    async create(req: Request, res: Response) {
        const { amount, name, cpf } = req.body;
        try {
            const result = await pixService.createCharge(Number(amount), name, cpf);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar PIX' });
        }
    }

    async webhook(req: Request, res: Response) {
        // O Mercado Pago manda o ID aqui
        const { data } = req.body;
        
        if (data && data.id) {
            const id = String(data.id); // <--- AQUI ESTAVA O ERRO (Agora convertemos para texto)
            console.log(`🔔 Webhook recebeu atualização do ID: ${id}`);

            // Verifica se foi pago
            const status = await pixService.checkStatus(id);

            if (status === 'approved') {
                console.log("💰 Pagamento aprovado! Iniciando estorno...");
                await pixService.refund(id);
            }
        }

        res.status(200).send();
    }
}