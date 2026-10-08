import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { zoonosesService } from '../../services/zoonoses/zoonosesService';
import { SPECIES_LABELS, Species } from '../../services/zoonoses/zoonosesMetrics';
import { Button, TextInput, fmtDate } from '../ui/ModuleKit';

/**
 * Verificação pública do comprovante de vacinação antirrábica (rota /verificar-vacina).
 * Mostra só dados do registro (data, espécie, vacina, lote, serviço) — nunca tutor ou endereço.
 */
export const VaccinationVerifyView: React.FC = () => {
  const initial = new URLSearchParams(window.location.search).get('c') || '';
  const [code, setCode] = useState(initial);
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'found' | 'not_found'; data?: any }>({ status: 'idle' });

  const check = async (value: string) => {
    if (value.trim().length < 8) return;
    setState({ status: 'loading' });
    const data = await zoonosesService.publicVerify(value.trim());
    setState(data ? { status: 'found', data } : { status: 'not_found' });
  };
  useEffect(() => {
    if (initial) check(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-teal-800" aria-hidden="true" />
          <h1 className="text-lg font-bold text-slate-900">Verificar vacinação antirrábica</h1>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); check(code); }}>
          <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VAC-XXXXXXXXXX" aria-label="Código de verificação" />
          <Button type="submit" loading={state.status === 'loading'}>Verificar</Button>
        </form>
        {state.status === 'not_found' && (
          <p className="flex items-center gap-2 text-sm text-rose-700" role="alert"><XCircle className="h-4 w-4" aria-hidden="true" /> Código não encontrado.</p>
        )}
        {state.status === 'found' && state.data && (
          <section aria-live="polite" className="space-y-2">
            <p className={`flex items-center gap-2 text-sm font-semibold ${state.data.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
              {state.data.valid ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <XCircle className="h-5 w-5" aria-hidden="true" />}
              {state.data.valid ? 'Registro válido' : 'Registro anulado pelo serviço de saúde'}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-slate-500">Código</dt><dd className="font-mono">{state.data.code}</dd>
              {state.data.animal_code && <><dt className="text-slate-500">Animal</dt><dd>{state.data.animal_code}</dd></>}
              <dt className="text-slate-500">Espécie</dt><dd>{SPECIES_LABELS[state.data.species as Species]}</dd>
              <dt className="text-slate-500">Data</dt><dd>{fmtDate(state.data.vaccinated_on)}</dd>
              <dt className="text-slate-500">Vacina</dt><dd>{state.data.vaccine}{state.data.manufacturer ? ` (${state.data.manufacturer})` : ''}</dd>
              <dt className="text-slate-500">Lote</dt><dd>{state.data.batch}</dd>
              <dt className="text-slate-500">Serviço</dt><dd>{state.data.service}</dd>
            </dl>
          </section>
        )}
      </div>
    </main>
  );
};
