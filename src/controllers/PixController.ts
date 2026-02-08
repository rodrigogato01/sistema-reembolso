import { Request, Response } from 'express';
import { PixService } from '../services/PixService';

const pixService = new PixService();

export class PixController {
    // 1. Cria o PIX
    async create(req: Request, res: Response) {
        const { amount, name, cpf } = req.body;
        try {
            const result = await pixService.createCharge(Number(amount), name, cpf);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar PIX' });
        }
    }

    // 2. Recebe o Webhook (Aviso do Banco)
    async webhook(req: Request, res: Response) {
        const { data } = req.body;
        
        if (data && data.id) {
            const id = String(data.id);
            console.log(`🔔 Webhook recebeu atualização do ID: ${id}`);

            try {
                const status = await pixService.checkStatus(id);
                if (status === 'approved') {
                    console.log("💰 Pagamento aprovado! Iniciando estorno...");
                    await pixService.refund(id);
                }
            } catch (e) {
                console.log("Erro ao processar webhook", e);
            }
        }
        res.status(200).send();
    }

    // 3. A FUNÇÃO QUE FALTAVA (Check Status Manual)
    async checkStatus(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const status = await pixService.checkStatus(id);
            res.json({ status });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao consultar status' });
        }
    }
}