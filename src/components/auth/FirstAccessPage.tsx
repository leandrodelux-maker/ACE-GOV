import React, { useState } from 'react';
import { Shield, ArrowLeft, UserCheck, AlertTriangle, Building2, CheckCircle2 } from 'lucide-react';

interface FirstAccessPageProps {
  onNavigate: (route: string) => void;
}

export const FirstAccessPage: React.FC<FirstAccessPageProps> = ({ onNavigate }) => {
  const [cpfOrMatricula, setCpfOrMatricula] = useState('');
  const [checked, setChecked] = useState(false);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    setChecked(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50">
          <button
            onClick={() => onNavigate('/login')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para o Login</span>
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-600/20 text-sky-400 border border-sky-500/30 mb-3">
              <UserCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Primeiro Acesso ao Sistema</h1>
            <p className="text-xs text-slate-400 mt-1">
              Orientações para servidores públicos e equipes de campo SUS
            </p>
          </div>

          {/* Aviso Institucional Importante */}
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-300">Cadastro restrito a Servidores Municipais</p>
              <p className="text-slate-300 leading-relaxed">
                Em conformidade com as diretrizes do Ministério da Saúde, o <strong>Endemias GOV não permite autocadastro público</strong>. Todo usuário deve ser previamente habilitado pela Coordenação Municipal de Vigilância em Saúde.
              </p>
            </div>
          </div>

          {/* Instruções para Ativação */}
          <div className="space-y-4 mb-6">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Como obter acesso:</h2>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  1
                </span>
                <p>
                  <strong>Agentes de Combate às Endemias (ACE):</strong> Solicite ao seu Supervisor de Campo ou Coordenador de Endemias o cadastro da sua matrícula funcional e e-mail no módulo de Equipes.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  2
                </span>
                <p>
                  <strong>Supervisores e Coordenadores:</strong> O cadastro é efetuado pelo Administrador do Sistema da Secretaria Municipal de Saúde.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  3
                </span>
                <p>
                  Após a inclusão, você receberá a senha inicial temporária ou poderá utilizar a opção <strong>"Esqueci minha senha"</strong> com o seu e-mail cadastrado.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Dúvidas operacionais?</span>
            <button
              onClick={() => onNavigate('/login')}
              className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 transition"
            >
              Ir para Tela de Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
