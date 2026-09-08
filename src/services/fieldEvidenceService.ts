import { supabase } from './supabaseClient';

export type EvidenceEntityType =
  | 'visita'
  | 'foco'
  | 'denuncia'
  | 'pe'
  | 'ie'
  | 'bloqueio'
  | 'os'
  | 'equipamento';

export interface FieldEvidenceItem {
  id: string;
  municipalityId: string;
  entityType: EvidenceEntityType;
  entityId: string;
  fileUrl: string;
  fileType: string;
  latitude?: number;
  longitude?: number;
  capturedAt: string;
  uploadedBy?: string;
  uploadedByName?: string;
  description?: string;
  createdAt: string;
  isOfflinePending?: boolean;
}

const OFFLINE_EVIDENCE_KEY = 'endemias_gov_offline_evidence';
const DEFAULT_MUN_ID = '00000000-0000-0000-0000-000000000001';

export const fieldEvidenceService = {
  /**
   * Redimensiona e comprime uma imagem usando HTML5 Canvas (remove metadados EXIF sensíveis)
   */
  async compressImage(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.75): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Falha ao processar arquivo de imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Salvar evidência de campo no banco ou na fila offline
   */
  async saveEvidence(params: {
    municipalityId?: string;
    entityType: EvidenceEntityType;
    entityId: string;
    fileDataUrl: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    uploadedBy?: string;
  }): Promise<{ success: boolean; data?: FieldEvidenceItem; error?: string }> {
    const municipalityId = params.municipalityId || DEFAULT_MUN_ID;
    const now = new Date().toISOString();

    // Se estiver offline ou sem conectividade, salvar no LocalStorage
    if (!navigator.onLine) {
      const offlineItem: FieldEvidenceItem = {
        id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        municipalityId,
        entityType: params.entityType,
        entityId: params.entityId,
        fileUrl: params.fileDataUrl,
        fileType: 'image/jpeg',
        latitude: params.latitude,
        longitude: params.longitude,
        capturedAt: now,
        uploadedBy: params.uploadedBy,
        description: params.description,
        createdAt: now,
        isOfflinePending: true,
      };

      try {
        const stored = JSON.parse(localStorage.getItem(OFFLINE_EVIDENCE_KEY) || '[]');
        stored.push(offlineItem);
        localStorage.setItem(OFFLINE_EVIDENCE_KEY, JSON.stringify(stored));
        return { success: true, data: offlineItem };
      } catch (err) {
        console.warn('Falha ao gravar evidência offline:', err);
        return { success: false, error: 'Armazenamento offline cheio' };
      }
    }

    // Modo Online: persistir no banco Supabase
    try {
      const { data, error } = await supabase
        .from('field_evidence')
        .insert({
          municipality_id: municipalityId,
          entity_type: params.entityType,
          entity_id: params.entityId,
          file_url: params.fileDataUrl,
          file_type: 'image/jpeg',
          latitude: params.latitude,
          longitude: params.longitude,
          captured_at: now,
          uploaded_by: params.uploadedBy,
          description: params.description,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          id: data.id,
          municipalityId: data.municipality_id,
          entityType: data.entity_type,
          entityId: data.entity_id,
          fileUrl: data.file_url,
          fileType: data.file_type,
          latitude: data.latitude,
          longitude: data.longitude,
          capturedAt: data.captured_at,
          uploadedBy: data.uploaded_by,
          description: data.description,
          createdAt: data.created_at,
        },
      };
    } catch (err: any) {
      console.warn('Erro ao salvar no banco, gravando em fallback offline:', err);
      // Fallback para fila offline se houver falha de rede
      const offlineItem: FieldEvidenceItem = {
        id: `offline-${Date.now()}`,
        municipalityId,
        entityType: params.entityType,
        entityId: params.entityId,
        fileUrl: params.fileDataUrl,
        fileType: 'image/jpeg',
        latitude: params.latitude,
        longitude: params.longitude,
        capturedAt: now,
        uploadedBy: params.uploadedBy,
        description: params.description,
        createdAt: now,
        isOfflinePending: true,
      };
      const stored = JSON.parse(localStorage.getItem(OFFLINE_EVIDENCE_KEY) || '[]');
      stored.push(offlineItem);
      localStorage.setItem(OFFLINE_EVIDENCE_KEY, JSON.stringify(stored));
      return { success: true, data: offlineItem };
    }
  },

  /**
   * Buscar evidências fotográficas vinculadas a uma entidade
   */
  async getEvidencesByEntity(
    entityType: EvidenceEntityType,
    entityId: string,
    municipalityId = DEFAULT_MUN_ID
  ): Promise<FieldEvidenceItem[]> {
    try {
      // 1. Buscar online
      const { data, error } = await supabase
        .from('field_evidence')
        .select('*, profiles:uploaded_by (full_name)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('captured_at', { ascending: false });

      let list: FieldEvidenceItem[] = [];
      if (!error && data) {
        list = data.map((d: any) => ({
          id: d.id,
          municipalityId: d.municipality_id,
          entityType: d.entity_type,
          entityId: d.entity_id,
          fileUrl: d.file_url,
          fileType: d.file_type,
          latitude: d.latitude,
          longitude: d.longitude,
          capturedAt: d.captured_at,
          uploadedBy: d.uploaded_by,
          uploadedByName: d.profiles?.full_name,
          description: d.description,
          createdAt: d.created_at,
        }));
      }

      // 2. Mesclar itens na fila offline local
      const stored: FieldEvidenceItem[] = JSON.parse(
        localStorage.getItem(OFFLINE_EVIDENCE_KEY) || '[]'
      );
      const offlineMatches = stored.filter(
        item => item.entityType === entityType && item.entityId === entityId
      );

      return [...offlineMatches, ...list];
    } catch (err) {
      console.error('Erro ao buscar evidências:', err);
      return [];
    }
  },

  /**
   * Sincronizar fila de fotos offline quando a conexão retornar
   */
  async syncOfflineEvidences(): Promise<{ syncedCount: number; errors: number }> {
    const stored: FieldEvidenceItem[] = JSON.parse(
      localStorage.getItem(OFFLINE_EVIDENCE_KEY) || '[]'
    );
    if (stored.length === 0) return { syncedCount: 0, errors: 0 };

    let syncedCount = 0;
    let errors = 0;
    const remaining: FieldEvidenceItem[] = [];

    for (const item of stored) {
      try {
        const { error } = await supabase.from('field_evidence').insert({
          municipality_id: item.municipalityId,
          entity_type: item.entityType,
          entity_id: item.entityId,
          file_url: item.fileUrl,
          file_type: item.fileType,
          latitude: item.latitude,
          longitude: item.longitude,
          captured_at: item.capturedAt,
          uploaded_by: item.uploadedBy,
          description: item.description,
        });

        if (error) {
          errors++;
          remaining.push(item);
        } else {
          syncedCount++;
        }
      } catch {
        errors++;
        remaining.push(item);
      }
    }

    localStorage.setItem(OFFLINE_EVIDENCE_KEY, JSON.stringify(remaining));
    return { syncedCount, errors };
  },
};
