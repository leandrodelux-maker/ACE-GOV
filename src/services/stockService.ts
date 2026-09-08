import { supabase } from './supabaseClient';

export interface Product {
  id: string;
  municipality_id: string;
  name: string;
  category: 'larvicida' | 'inseticida' | 'EPI' | 'material_de_campo' | 'material_laboratorio' | 'outro';
  active_ingredient?: string;
  unit: string;
  manufacturer?: string;
  minimum_stock: number;
  active: boolean;
  total_stock?: number;
  batches?: ProductBatch[];
}

export interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  expiration_date: string;
  quantity_received: number;
  current_quantity: number;
  received_at: string;
  days_to_expiration?: number;
  is_expired?: boolean;
  is_near_expiration?: boolean;
}

export interface StockMovement {
  id: string;
  municipality_id: string;
  product_id: string;
  batch_id: string;
  movement_type: 'entrada' | 'saida' | 'devolucao' | 'ajuste' | 'perda' | 'vencimento';
  quantity: number;
  agent_id?: string;
  team_id?: string;
  operation_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  product?: { name: string; unit: string };
  batch?: { batch_number: string; expiration_date: string };
}

export interface StockAlerts {
  lowStockCount: number;
  zeroStockCount: number;
  nearExpirationCount: number;
  expiredCount: number;
  alertsList: {
    type: 'LOW_STOCK' | 'ZERO_STOCK' | 'NEAR_EXPIRATION' | 'EXPIRED';
    productName: string;
    detail: string;
    severity: 'warning' | 'danger';
  }[];
}

const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const stockService = {
  // 1. Obter catálogo de produtos com lotes ordenados por FEFO
  async getProductsWithBatches(municipalityId = DEFAULT_MUN_ID): Promise<Product[]> {
    try {
      const { data: prods, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('municipality_id', municipalityId)
        .is('deleted_at', null)
        .order('name');

      if (pErr) throw pErr;
      if (!prods) return [];

      const productIds = prods.map(p => p.id);
      if (productIds.length === 0) return [];

      const { data: batches, error: bErr } = await supabase
        .from('product_batches')
        .select('*')
        .in('product_id', productIds)
        .order('expiration_date', { ascending: true }); // FEFO: Primeiro que vence é o primeiro da lista

      if (bErr) throw bErr;

      const now = new Date();

      return prods.map(p => {
        const pBatches: ProductBatch[] = (batches || [])
          .filter(b => b.product_id === p.id)
          .map(b => {
            const expDate = new Date(b.expiration_date);
            const diffTime = expDate.getTime() - now.getTime();
            const daysToExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
              ...b,
              current_quantity: Number(b.current_quantity),
              quantity_received: Number(b.quantity_received),
              days_to_expiration: daysToExpiration,
              is_expired: daysToExpiration <= 0,
              is_near_expiration: daysToExpiration > 0 && daysToExpiration <= 60,
            };
          });

        const totalStock = pBatches.reduce((acc, curr) => acc + curr.current_quantity, 0);

        return {
          ...p,
          minimum_stock: Number(p.minimum_stock),
          total_stock: totalStock,
          batches: pBatches,
        };
      });
    } catch (err) {
      console.error('Erro ao buscar produtos com lotes:', err);
      return [];
    }
  },

  // 2. Criar novo Produto no catálogo
  async createProduct(product: Omit<Product, 'id' | 'total_stock' | 'batches'>): Promise<Product | null> {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...product,
          municipality_id: product.municipality_id || DEFAULT_MUN_ID,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Erro ao cadastrar produto:', err);
      return null;
    }
  },

  // 3. Dar Entrada em Lote de Produto
  async addBatchEntry(payload: {
    productId: string;
    batchNumber: string;
    expirationDate: string;
    quantity: number;
    notes?: string;
    municipalityId?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const munId = payload.municipalityId || DEFAULT_MUN_ID;

      // 1. Inserir lote
      const { data: batch, error: bErr } = await supabase
        .from('product_batches')
        .insert({
          product_id: payload.productId,
          batch_number: payload.batchNumber,
          expiration_date: payload.expirationDate,
          quantity_received: payload.quantity,
          current_quantity: payload.quantity,
          received_at: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (bErr) throw bErr;

      // 2. Registrar movimentação de entrada
      const { error: mErr } = await supabase
        .from('stock_movements')
        .insert({
          municipality_id: munId,
          product_id: payload.productId,
          batch_id: batch.id,
          movement_type: 'entrada',
          quantity: payload.quantity,
          notes: payload.notes || `Entrada de nota fiscal / remessa Lote ${payload.batchNumber}`,
        });

      if (mErr) throw mErr;

      // 3. Auditoria
      await supabase.from('audit_logs').insert({
        municipality_id: munId,
        action: 'STOCK_ENTRY',
        module: 'estoque',
        entity: 'product_batches',
        entity_id: batch.id,
        new_data: {
          product_id: payload.productId,
          batch_number: payload.batchNumber,
          quantity: payload.quantity,
        },
      });

      return { success: true, message: 'Entrada de lote registrada com sucesso!' };
    } catch (err: any) {
      console.error('Erro ao registrar entrada:', err);
      return { success: false, message: err.message || 'Falha ao registrar entrada.' };
    }
  },

  // 4. Saída Inteligente com Regra FEFO (First Expire, First Out)
  async dispatchProductFEFO(payload: {
    productId: string;
    quantity: number;
    movementType: 'saida' | 'perda' | 'vencimento' | 'ajuste';
    agentId?: string;
    teamId?: string;
    operationId?: string;
    notes?: string;
    municipalityId?: string;
  }): Promise<{ success: boolean; message: string; batchesUsed?: { batchNumber: string; qty: number }[] }> {
    try {
      const munId = payload.municipalityId || DEFAULT_MUN_ID;
      let remainingQtyToDispatch = payload.quantity;

      // 1. Buscar lotes disponíveis ordenados por data de validade ascendente (FEFO)
      const { data: batches, error: bErr } = await supabase
        .from('product_batches')
        .select('*')
        .eq('product_id', payload.productId)
        .gt('current_quantity', 0)
        .order('expiration_date', { ascending: true });

      if (bErr) throw bErr;

      const totalAvailable = (batches || []).reduce((acc, curr) => acc + Number(curr.current_quantity), 0);
      if (totalAvailable < payload.quantity) {
        return {
          success: false,
          message: `Saldo insuficiente em estoque! Disponível: ${totalAvailable}, Solicitado: ${payload.quantity}. Não é permitido saldo negativo.`,
        };
      }

      const batchesUsed: { batchNumber: string; qty: number }[] = [];

      // 2. Consumir sequencialmente os lotes que vencem primeiro (FEFO)
      for (const batch of batches || []) {
        if (remainingQtyToDispatch <= 0) break;

        const batchCurrent = Number(batch.current_quantity);
        const qtyToDeduct = Math.min(batchCurrent, remainingQtyToDispatch);
        const newBatchQty = batchCurrent - qtyToDeduct;

        // Atualizar saldo do lote
        await supabase
          .from('product_batches')
          .update({
            current_quantity: newBatchQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch.id);

        // Registrar movimentação individual do lote
        await supabase.from('stock_movements').insert({
          municipality_id: munId,
          product_id: payload.productId,
          batch_id: batch.id,
          movement_type: payload.movementType,
          quantity: qtyToDeduct,
          agent_id: payload.agentId || null,
          team_id: payload.teamId || null,
          operation_id: payload.operationId || null,
          notes: payload.notes || `Saída FEFO (Lote vence em ${batch.expiration_date})`,
        });

        batchesUsed.push({
          batchNumber: batch.batch_number,
          qty: qtyToDeduct,
        });

        remainingQtyToDispatch -= qtyToDeduct;
      }

      // 3. Auditoria
      await supabase.from('audit_logs').insert({
        municipality_id: munId,
        action: 'STOCK_DISPATCH_FEFO',
        module: 'estoque',
        entity: 'products',
        entity_id: payload.productId,
        new_data: {
          product_id: payload.productId,
          quantity: payload.quantity,
          batches_used: batchesUsed,
          destination: payload.agentId ? 'ACE' : payload.teamId ? 'Equipe' : 'Operação',
        },
      });

      return {
        success: true,
        message: `Saída de ${payload.quantity} realizada com sucesso aplicando critério FEFO!`,
        batchesUsed,
      };
    } catch (err: any) {
      console.error('Erro na saída FEFO:', err);
      return { success: false, message: err.message || 'Falha ao processar saída FEFO.' };
    }
  },

  // 5. Histórico de Movimentações
  async getMovements(municipalityId = DEFAULT_MUN_ID, limit = 50): Promise<StockMovement[]> {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          product:products (name, unit),
          batch:product_batches (batch_number, expiration_date)
        `)
        .eq('municipality_id', municipalityId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Erro ao obter movimentações de estoque:', err);
      return [];
    }
  },

  // 6. Alertas de Estoque e Validades
  calculateStockAlerts(products: Product[]): StockAlerts {
    let lowStockCount = 0;
    let zeroStockCount = 0;
    let nearExpirationCount = 0;
    let expiredCount = 0;
    const alertsList: StockAlerts['alertsList'] = [];

    products.forEach(p => {
      const currentTotal = p.total_stock || 0;

      if (currentTotal === 0) {
        zeroStockCount++;
        alertsList.push({
          type: 'ZERO_STOCK',
          productName: p.name,
          detail: 'Produto totalmente esgotado no almoxarifado central.',
          severity: 'danger',
        });
      } else if (currentTotal <= p.minimum_stock) {
        lowStockCount++;
        alertsList.push({
          type: 'LOW_STOCK',
          productName: p.name,
          detail: `Estoque atual (${currentTotal} ${p.unit}) abaixo do mínimo de segurança (${p.minimum_stock} ${p.unit}).`,
          severity: 'warning',
        });
      }

      (p.batches || []).forEach(b => {
        if (b.is_expired && b.current_quantity > 0) {
          expiredCount++;
          alertsList.push({
            type: 'EXPIRED',
            productName: `${p.name} (Lote ${b.batch_number})`,
            detail: `Lote vencido em ${b.expiration_date} com saldo de ${b.current_quantity} ${p.unit}. Necessário baixa por descarte/incineração.`,
            severity: 'danger',
          });
        } else if (b.is_near_expiration && b.current_quantity > 0) {
          nearExpirationCount++;
          alertsList.push({
            type: 'NEAR_EXPIRATION',
            productName: `${p.name} (Lote ${b.batch_number})`,
            detail: `Vence em ${b.days_to_expiration} dias (${b.expiration_date}). Priorizar despacho imediato via FEFO.`,
            severity: 'warning',
          });
        }
      });
    });

    return {
      lowStockCount,
      zeroStockCount,
      nearExpirationCount,
      expiredCount,
      alertsList,
    };
  },
};
