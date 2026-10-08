import React, { useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Package, Plus, Scale, TriangleAlert, Undo2 } from 'lucide-react';
import { PageHeader, Card } from '../ui';
import { Button, DataTable, Dialog, EmptyState, Field, LoadingBlock, Notice, SectionTitle, SelectInput, StatusPill, TextArea, TextInput, fmtDate, fmtDateTime, todayLocal, useAsync } from '../ui/ModuleKit';
import { useAuth, useMunicipalityId } from '../../contexts/AuthContext';
import { BatchBalance, zoonosesService } from '../../services/zoonoses/zoonosesService';
import { batchAlert, daysToExpire } from '../../services/zoonoses/zoonosesMetrics';

type Op = 'entrada' | 'distribuicao' | 'devolucao' | 'perda' | 'ajuste';
const OP_LABELS: Record<Op, string> = { entrada: 'Entrada de doses', distribuicao: 'Distribuição para equipe', devolucao: 'Devolução da equipe', perda: 'Perda técnica/física', ajuste: 'Ajuste de inventário' };
const MOVEMENT_LABELS: Record<string, string> = {
  entrada: 'Entrada', distribuicao_equipe: 'Distribuição', devolucao: 'Devolução', perda: 'Perda (central)', perda_equipe: 'Perda (equipe)',
  uso_operacao: 'Aplicação (central)', aplicacao_equipe: 'Aplicação (equipe)', estorno_aplicacao: 'Estorno (central)', estorno_equipe: 'Estorno (equipe)',
  ajuste_entrada: 'Ajuste +', ajuste_saida: 'Ajuste −', vencimento: 'Vencimento',
};

export const ZooStockView: React.FC = () => {
  const municipalityId = useMunicipalityId();
  const { can } = useAuth();
  const [tick, setTick] = useState(0);
  const data = useAsync(async () => ({
    balances: await zoonosesService.stockBalances(),
    products: await zoonosesService.listVaccineProducts(municipalityId),
    teams: await zoonosesService.listTeams(municipalityId),
    movements: await zoonosesService.stockMovements(municipalityId, 300),
  }), [municipalityId, tick]);
  const [op, setOp] = useState<Op | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const today = todayLocal();
  const canMove = can('antirrabica.estoque');

  return (
    <div className="space-y-4">
      <PageHeader icon={Package} title="Estoque de vacinas antirrábicas" subtitle="Lotes, validade, distribuição por equipe, doses aplicadas, perdas e saldo. Saldo negativo e lote vencido são bloqueados no banco."
        actions={canMove ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Plus} onClick={() => setProductOpen(true)}>Vacina</Button>
            <Button icon={ArrowDownToLine} onClick={() => setOp('entrada')}>Entrada</Button>
          </div>
        ) : undefined} />
      {msg && <Notice tone="success" onClose={() => setMsg(null)}>{msg}</Notice>}
      {data.loading && <LoadingBlock />}
      {data.error && <Notice tone="danger">{data.error}</Notice>}
      {data.data && (
        <>
          {canMove && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={ArrowLeftRight} onClick={() => setOp('distribuicao')}>Distribuir</Button>
              <Button variant="secondary" icon={Undo2} onClick={() => setOp('devolucao')}>Devolução</Button>
              <Button variant="secondary" icon={TriangleAlert} onClick={() => setOp('perda')}>Perda</Button>
              {can('antirrabica.estoque_ajuste') && <Button variant="secondary" icon={Scale} onClick={() => setOp('ajuste')}>Ajuste</Button>}
            </div>
          )}
          {data.data.balances.length === 0 ? <EmptyState title="Nenhum lote de vacina antirrábica" description="Cadastre a vacina e registre a entrada do lote recebido." /> : (
            <DataTable rows={data.data.balances} rowKey={(b) => b.batch_id} searchPlaceholder="Pesquisar lote ou vacina"
              columns={[
                { key: 'p', header: 'Vacina', render: (b) => <span><strong>{b.product_name}</strong><span className="block text-[11px] text-slate-500">{b.manufacturer || ''}</span></span>, text: (b) => `${b.product_name} ${b.manufacturer || ''}` },
                { key: 'l', header: 'Lote', render: (b) => <span className="font-mono">{b.batch_number}</span>, text: (b) => b.batch_number },
                { key: 'v', header: 'Validade', render: (b) => <span>{fmtDate(b.expiration_date)}<span className="block text-[11px] text-slate-500">{daysToExpire(b.expiration_date, today) < 0 ? 'vencido' : `${daysToExpire(b.expiration_date, today)} dia(s)`}</span></span> },
                { key: 'r', header: 'Recebido', align: 'right', render: (b) => Number(b.quantity_received).toLocaleString('pt-BR') },
                { key: 'a', header: 'Aplicado', align: 'right', render: (b) => Number(b.applied).toLocaleString('pt-BR') },
                { key: 'x', header: 'Perdas', align: 'right', render: (b) => Number(b.losses).toLocaleString('pt-BR') },
                { key: 'c', header: 'Saldo central', align: 'right', render: (b) => <strong>{Number(b.central_balance).toLocaleString('pt-BR')}</strong> },
                { key: 't', header: 'Equipes', render: (b) => b.teams.length ? b.teams.map((t) => `${t.team_name}: ${t.balance}`).join(' · ') : '—' },
                { key: 's', header: 'Alerta', render: (b) => {
                  const al = batchAlert({ ...b, central_balance: Number(b.central_balance) }, today);
                  return al ? <StatusPill tone={al === 'vencido' ? 'danger' : 'warning'}>{al === 'vencido' ? 'Vencido' : al === 'vence_em_30_dias' ? 'Vence em 30 dias' : 'Saldo baixo'}</StatusPill> : <StatusPill tone="success">OK</StatusPill>;
                } },
              ]} />
          )}
          <Card>
            <SectionTitle>Movimentações (trilha de auditoria)</SectionTitle>
            <DataTable rows={data.data.movements} rowKey={(m) => m.id} pageSize={15} searchPlaceholder="Pesquisar movimentação"
              columns={[
                { key: 'd', header: 'Data', render: (m) => fmtDateTime(m.created_at) },
                { key: 't', header: 'Tipo', render: (m) => MOVEMENT_LABELS[m.movement_type] || m.movement_type, text: (m) => MOVEMENT_LABELS[m.movement_type] || m.movement_type },
                { key: 'l', header: 'Lote', render: (m) => m.product_batches?.batch_number || '—', text: (m) => m.product_batches?.batch_number || '' },
                { key: 'q', header: 'Doses', align: 'right', render: (m) => Number(m.quantity).toLocaleString('pt-BR') },
                { key: 'e', header: 'Equipe', render: (m) => m.teams?.name || 'Central' },
                { key: 'u', header: 'Responsável', render: (m) => m.profiles?.full_name || '—' },
                { key: 'n', header: 'Observação', render: (m) => m.notes || '—', text: (m) => m.notes || '' },
              ]} />
          </Card>
        </>
      )}
      {op && data.data && <OperationDialog op={op} balances={data.data.balances} products={data.data.products} teams={data.data.teams} onClose={() => setOp(null)}
        onDone={(t) => { setOp(null); setMsg(t); setTick((x) => x + 1); }} />}
      {productOpen && <ProductDialog onClose={() => setProductOpen(false)} onDone={() => { setProductOpen(false); setTick((x) => x + 1); }} />}
    </div>
  );
};

const OperationDialog: React.FC<{ op: Op; balances: BatchBalance[]; products: { id: string; name: string }[]; teams: { id: string; name: string }[]; onClose: () => void; onDone: (msg: string) => void }> = ({
  op, balances, products, teams, onClose, onDone,
}) => {
  const [f, setF] = useState({ product_id: '', batch_number: '', expiration_date: '', batch_id: '', team_id: '', quantity: '', delta: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const batch = balances.find((b) => b.batch_id === f.batch_id);
  const teamBal = batch && f.team_id ? batch.teams.find((t) => t.team_id === f.team_id)?.balance ?? 0 : null;
  const needsReason = op === 'perda' || op === 'ajuste';
  const valid = op === 'entrada'
    ? f.product_id && f.batch_number.trim() && f.expiration_date && Number(f.quantity) > 0
    : f.batch_id && (op === 'ajuste' ? Number(f.delta) !== 0 && f.reason.trim().length >= 15 : Number(f.quantity) > 0)
      && (op !== 'distribuicao' && op !== 'devolucao' || f.team_id) && (!needsReason || f.reason.trim().length >= (op === 'ajuste' ? 15 : 3));
  return (
    <Dialog open title={OP_LABELS[op]} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!valid} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const r = await zoonosesService.stockOperation({ op, ...f, quantity: f.quantity ? Number(f.quantity) : null, delta: f.delta ? Number(f.delta) : null, team_id: f.team_id || null });
          onDone(`${OP_LABELS[op]} registrada. Saldo central do lote: ${r.central_balance}${r.team_balance != null ? `; saldo da equipe: ${r.team_balance}` : ''}.`);
        } catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Registrar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {op === 'entrada' ? (
          <>
            <Field label="Vacina" required className="sm:col-span-2">{(id) => <SelectInput id={id} value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}><option value="">Selecione</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</SelectInput>}</Field>
            <Field label="Lote" required>{(id) => <TextInput id={id} value={f.batch_number} onChange={(e) => setF({ ...f, batch_number: e.target.value })} />}</Field>
            <Field label="Validade" required>{(id) => <TextInput id={id} type="date" value={f.expiration_date} onChange={(e) => setF({ ...f, expiration_date: e.target.value })} />}</Field>
            <Field label="Doses recebidas" required>{(id) => <TextInput id={id} type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />}</Field>
            <Field label="Documento / observação">{(id) => <TextInput id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Nota de remessa, guia..." />}</Field>
          </>
        ) : (
          <>
            <Field label="Lote" required className="sm:col-span-2">{(id) => (
              <SelectInput id={id} value={f.batch_id} onChange={(e) => setF({ ...f, batch_id: e.target.value })}>
                <option value="">Selecione</option>
                {balances.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.product_name} · {b.batch_number} · val. {fmtDate(b.expiration_date)} · central {b.central_balance}</option>)}
              </SelectInput>
            )}</Field>
            {op !== 'ajuste' && (
              <Field label={op === 'perda' ? 'Equipe (vazio = almoxarifado central)' : 'Equipe'} required={op !== 'perda'}>{(id) => (
                <SelectInput id={id} value={f.team_id} onChange={(e) => setF({ ...f, team_id: e.target.value })}><option value="">{op === 'perda' ? 'Almoxarifado central' : 'Selecione'}</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</SelectInput>
              )}</Field>
            )}
            {op === 'ajuste' ? (
              <Field label="Diferença (+ ou −)" required hint={batch ? `Saldo central atual: ${batch.central_balance}` : undefined}>{(id) => <TextInput id={id} type="number" value={f.delta} onChange={(e) => setF({ ...f, delta: e.target.value })} />}</Field>
            ) : (
              <Field label="Doses" required hint={batch ? (teamBal !== null && op !== 'distribuicao' ? `Saldo da equipe: ${teamBal}` : `Saldo central: ${batch.central_balance}`) : undefined}>
                {(id) => <TextInput id={id} type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />}
              </Field>
            )}
            <Field label={needsReason ? 'Motivo / justificativa' : 'Observação'} required={needsReason} className="sm:col-span-2" hint={op === 'ajuste' ? 'Mínimo de 15 caracteres; o ajuste fica na auditoria.' : undefined}>
              {(id) => <TextArea id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder={op === 'perda' ? 'Ex.: frasco quebrado, quebra da cadeia de frio, sobra de frasco aberto' : ''} />}
            </Field>
          </>
        )}
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};

const ProductDialog: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const municipalityId = useMunicipalityId();
  const [f, setF] = useState({ name: '', manufacturer: '', minimum_stock: '0' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open title="Cadastrar vacina antirrábica" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!f.name.trim() || !f.manufacturer.trim()} onClick={async () => {
        setBusy(true); setError(null);
        try { await zoonosesService.createVaccineProduct(municipalityId, { name: f.name.trim(), manufacturer: f.manufacturer.trim(), minimum_stock: Number(f.minimum_stock) || 0 }); onDone(); }
        catch (e: any) { setError(e.message); } finally { setBusy(false); }
      }}>Salvar</Button></>}>
      <div className="grid gap-3">
        <Field label="Nome do imunobiológico" required>{(id) => <TextInput id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Vacina antirrábica canina (cultivo celular)" />}</Field>
        <Field label="Fabricante" required>{(id) => <TextInput id={id} value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} />}</Field>
        <Field label="Estoque mínimo (doses)" hint="Abaixo deste saldo central o painel emite alerta.">{(id) => <TextInput id={id} type="number" min={0} value={f.minimum_stock} onChange={(e) => setF({ ...f, minimum_stock: e.target.value })} />}</Field>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </Dialog>
  );
};
