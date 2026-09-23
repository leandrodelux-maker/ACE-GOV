import { supabase } from './supabaseClient';
import { auditLogService } from './auditLogService';
import { requireMunicipalityId } from './municipalityScope';

export interface DocumentSignature {
  id: string;
  documentId: string;
  documentType: string;
  municipalityId: string;
  userId: string;
  userName: string;
  userRole?: string;
  signatureType: string;
  documentHash: string; // SHA-256
  verificationCode: string; // Ex: END-SIG-2026-A8F9
  signedAt: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}


export const signatureService = {
  /**
   * Calcula o hash criptográfico SHA-256 do documento via Web Crypto API nativa do navegador
   */
  async computeSHA256(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Gera código institucional de verificação rápida (Ex: END-SIG-2026-X9K2)
   */
  generateVerificationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const year = new Date().getFullYear();
    return `END-SIG-${year}-${code.substring(0, 4)}-${code.substring(4, 8)}`;
  },

  /**
   * Assinar eletronicamente um documento sanitário/operacional
   * Bloqueia alterações diretas e cria carimbo imutável
   */
  async signDocument(params: {
    documentId: string;
    documentType: string;
    documentContent: string;
    userId: string;
    userName: string;
    userRole?: string;
    municipalityId: string;
  }): Promise<{ success: boolean; signature?: DocumentSignature; error?: string }> {
    try {
      const municipalityId = requireMunicipalityId(params.municipalityId);
      const documentHash = await this.computeSHA256(params.documentContent);
      const verificationCode = this.generateVerificationCode();
      const signedAt = new Date().toISOString();
      const userAgent = navigator.userAgent;

      const { data, error } = await supabase
        .from('document_signatures')
        .insert({
          document_id: params.documentId,
          document_type: params.documentType,
          municipality_id: municipalityId,
          user_id: params.userId,
          user_name: params.userName,
          user_role: params.userRole || 'Servidor Público Municipal',
          signature_type: 'Assinatura Eletrônica Avançada (Lei 14.063/2020)',
          document_hash: documentHash,
          verification_code: verificationCode,
          signed_at: signedAt,
          ip_address: '127.0.0.1', // Omitido/Local seguro
          user_agent: userAgent,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar auditoria
      await auditLogService.log({
        municipalityId: municipalityId,
        action: 'ASSINATURA_ELETRONICA_DOCUMENTO',
        module: 'documentos',
        entity: 'document_signatures',
        entityId: data.id,
        newData: { descricao: `Documento ${params.documentId} (${params.documentType}) assinado eletronicamente por ${params.userName} [Hash SHA-256: ${documentHash.substring(0, 16)}...].` },
      });

      return {
        success: true,
        signature: {
          id: data.id,
          documentId: data.document_id,
          documentType: data.document_type,
          municipalityId: data.municipality_id,
          userId: data.user_id,
          userName: data.user_name,
          userRole: data.user_role,
          signatureType: data.signature_type,
          documentHash: data.document_hash,
          verificationCode: data.verification_code,
          signedAt: data.signed_at,
          ipAddress: data.ip_address,
          userAgent: data.user_agent,
          createdAt: data.created_at,
        },
      };
    } catch (err: any) {
      console.error('Erro ao assinar documento:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Buscar assinaturas ativas de um documento
   */
  async getSignaturesByDocument(documentId: string): Promise<DocumentSignature[]> {
    try {
      const { data, error } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('document_id', documentId)
        .order('signed_at', { ascending: false });

      if (error || !data) return [];

      return data.map((s: any) => ({
        id: s.id,
        documentId: s.document_id,
        documentType: s.document_type,
        municipalityId: s.municipality_id,
        userId: s.user_id,
        userName: s.user_name,
        userRole: s.user_role,
        signatureType: s.signature_type,
        documentHash: s.document_hash,
        verificationCode: s.verification_code,
        signedAt: s.signed_at,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        createdAt: s.created_at,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Verificar autenticidade do documento pelo código de verificação
   */
  async verifySignatureByCode(verificationCode: string): Promise<{
    isValid: boolean;
    signature?: DocumentSignature;
    message: string;
  }> {
    try {
      const cleanCode = verificationCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from('document_signatures')
        .select('*')
        .eq('verification_code', cleanCode)
        .maybeSingle();

      if (error || !data) {
        return {
          isValid: false,
          message: 'Código de verificação não localizado ou inexistente no registro oficial.',
        };
      }

      return {
        isValid: true,
        signature: {
          id: data.id,
          documentId: data.document_id,
          documentType: data.document_type,
          municipalityId: data.municipality_id,
          userId: data.user_id,
          userName: data.user_name,
          userRole: data.user_role,
          signatureType: data.signature_type,
          documentHash: data.document_hash,
          verificationCode: data.verification_code,
          signedAt: data.signed_at,
          ipAddress: data.ip_address,
          userAgent: data.user_agent,
          createdAt: data.created_at,
        },
        message: 'Assinatura eletrônica autêntica e válida conforme os registros municipais do Endemias GOV.',
      };
    } catch (err: any) {
      return { isValid: false, message: `Erro na validação: ${err.message}` };
    }
  },
};
