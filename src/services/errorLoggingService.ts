import { supabase } from './supabaseClient';
import { requireMunicipalityId } from './municipalityScope';

export interface SystemErrorLog {
  id?: string;
  municipality_id?: string;
  request_id: string;
  user_id?: string;
  user_role?: string;
  page: string;
  action: string;
  error_message: string;
  stack_trace?: string;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  status: 'NOVO' | 'EM_INVESTIGACAO' | 'RESOLVIDO' | 'IGNORADO';
  created_at?: string;
}


export const errorLoggingService = {
  /**
   * Gera um correlation / request ID no padrão SUS-ERR-[timestamp]-[random]
   */
  generateRequestId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 7);
    return `REQ-${ts}-${rand}`.toUpperCase();
  },

  /**
   * Remove senhas, tokens e credenciais antes de gravar o erro
   */
  sanitizeErrorDetails(details: any): string {
    if (!details) return '';
    let str = typeof details === 'string' ? details : JSON.stringify(details);
    str = str.replace(/password["']?\s*:\s*["'][^"']+["']/gi, 'password: "[REDACTED]"');
    str = str.replace(/token["']?\s*:\s*["'][^"']+["']/gi, 'token: "[REDACTED]"');
    str = str.replace(/authorization["']?\s*:\s*["'][^"']+["']/gi, 'authorization: "[REDACTED]"');
    str = str.replace(/secret["']?\s*:\s*["'][^"']+["']/gi, 'secret: "[REDACTED]"');
    return str;
  },

  /**
   * Registra um erro de forma centralizada
   */
  async logError(
    page: string,
    action: string,
    err: any,
    severity: 'WARNING' | 'ERROR' | 'CRITICAL' = 'ERROR',
    userContext?: { userId?: string; role?: string; municipalityId?: string }
  ): Promise<{ requestId: string; friendlyMessage: string }> {
    const requestId = this.generateRequestId();
    const rawMessage = typeof err === 'string' ? err : err?.message || 'Erro não categorizado';
    const stack = err?.stack || '';
    const cleanStack = this.sanitizeErrorDetails(stack);

    try {
      await supabase.from('system_error_logs').insert({
        municipality_id: requireMunicipalityId(userContext?.municipalityId),
        request_id: requestId,
        user_id: userContext?.userId || null,
        user_role: userContext?.role || 'SISTEMA',
        page,
        action,
        error_message: rawMessage,
        stack_trace: cleanStack,
        severity,
        status: 'NOVO',
      });
    } catch (insertErr) {
      console.error('Falha ao persistir erro no banco de dados:', insertErr);
    }

    return {
      requestId,
      friendlyMessage: 'Não foi possível concluir esta operação. O suporte técnico foi notificado.',
    };
  },

  /**
   * Recupera logs de erro filtrados (apenas para SUPERADMIN)
   */
  async getErrorLogs(filters?: {
    municipalityId?: string;
    severity?: string;
    status?: string;
    page?: string;
  }): Promise<SystemErrorLog[]> {
    try {
      let query = supabase
        .from('system_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.municipalityId && filters.municipalityId !== 'TODOS') {
        query = query.eq('municipality_id', filters.municipalityId);
      }
      if (filters?.severity && filters.severity !== 'TODOS') {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.status && filters.status !== 'TODOS') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Erro ao consultar logs de erro:', err);
      return [];
    }
  },

  /**
   * Atualizar status do log de erro (investigado / resolvido)
   */
  async updateErrorStatus(id: string, status: SystemErrorLog['status']): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_error_logs')
        .update({ status })
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  },
};
