import { Request, Response } from 'express';
import { PixService } from '../services/PixService';

const pixService = new PixService();

export class PixController {
    // Criar
    async create(req: Request, res: Response) {
        const { amount, name, cpf } = req.body;
        try {
            const result = await pixService.createCharge(Number(amount), name, cpf);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Erro ao criar' });
        }
    }

    // Webhook
    async webhook(req: Request, res: Response) {
        const { data } = req.body;
        if (data && data.id) {
            // Forçamos virar texto para não ter erro
            const id = String(data.id); 
            console.log(`Webhook ID: ${id}`);
            
            try {
                // Agora o service aceita 'any', então não vai dar erro aqui
                const status = await pixService.checkStatus(id);
                
                if (status === 'approved') {
                    console.log("Pago! Devolvendo...");
                    await pixService.refund(id);
                }
            } catch (e) { console.log(e); }
        }
        res.status(200).send();
    }

    // Check Status Manual
    async checkStatus(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const status = await pixService.checkStatus(id);
            res.json({ status });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao consultar' });
        }
    }
}