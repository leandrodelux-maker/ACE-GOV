import React from 'react';
import { Building2 } from 'lucide-react';

/** Exibido quando o link do portal não identifica o município (nunca usa município padrão). */
export const PublicPortalUnavailable: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
    <div className="max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" role="alert">
      <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
      <h1 className="text-base font-bold text-slate-900">Portal do Cidadão indisponível neste endereço</h1>
      <p className="text-xs text-slate-600 mt-2">
        Não foi possível identificar o município. Acesse o portal pelo link oficial divulgado pela Secretaria Municipal de Saúde.
      </p>
    </div>
  </div>
);
