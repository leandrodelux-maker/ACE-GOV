import React from 'react';
import { Printer, ShieldCheck } from 'lucide-react';
import { qrCodeService } from '../../services/qrCodeService';
import { SPECIES_LABELS, Species } from '../../services/zoonoses/zoonosesMetrics';
import { Button, fmtDate } from '../ui/ModuleKit';

export interface VaccinationCardData {
  verification_code: string;
  animal_code: string;
  animal_name: string | null;
  species: Species;
  tutor_name: string | null;
  vaccinated_on: string;
  vaccine: string;
  batch: string;
  service: string;
  vaccinator: string;
}

/** URL pública de verificação (sem dados pessoais) no domínio onde o sistema está publicado. */
export const verificationUrl = (code: string) => `${window.location.origin}/verificar-vacina?c=${encodeURIComponent(code)}`;

/**
 * Carteira digital do animal. Não informa data de revacinação: o prazo depende de
 * regra validada e configurada (pendente), não é inserido automaticamente.
 */
export const VaccinationCard: React.FC<{ data: VaccinationCardData }> = ({ data }) => {
  const url = data.verification_code ? verificationUrl(data.verification_code) : '';
  return (
    <div className="space-y-3">
      <article className="vaccination-card rounded-2xl border-2 border-teal-800 bg-white p-5 text-slate-900" aria-label="Comprovante de vacinação antirrábica">
        <header className="mb-3 flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">Comprovante de vacinação antirrábica</p>
            <p className="text-xs text-slate-600">{data.service}</p>
          </div>
          <ShieldCheck className="h-6 w-6 text-teal-800" aria-hidden="true" />
        </header>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Animal</dt><dd className="font-semibold">{data.animal_code}{data.animal_name ? ` — ${data.animal_name}` : ''}</dd>
            <dt className="text-slate-500">Espécie</dt><dd>{SPECIES_LABELS[data.species]}</dd>
            {data.tutor_name && <><dt className="text-slate-500">Tutor</dt><dd>{data.tutor_name}</dd></>}
            <dt className="text-slate-500">Vacinação</dt><dd>{fmtDate(data.vaccinated_on)}</dd>
            <dt className="text-slate-500">Vacina</dt><dd>{data.vaccine || '—'}</dd>
            <dt className="text-slate-500">Lote</dt><dd>{data.batch || '—'}</dd>
            <dt className="text-slate-500">Responsável</dt><dd>{data.vaccinator}</dd>
          </dl>
          {url && (
            <div className="text-center">
              <img src={qrCodeService.getQrCodeImageUrl(url, 132)} alt={`QR Code de verificação ${data.verification_code}`} width={132} height={132} className="mx-auto" />
              <p className="mt-1 font-mono text-xs font-semibold">{data.verification_code}</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-[10px] text-slate-500">Autenticidade: leia o QR Code ou acesse /verificar-vacina e informe o código. A verificação não exibe dados pessoais.</p>
      </article>
      <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir comprovante</Button>
    </div>
  );
};
