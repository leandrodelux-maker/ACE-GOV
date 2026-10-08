import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** Ao mudar (ex.: rota atual), o erro é descartado e a tela é renderizada de novo. */
  resetKey?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Pacote de tela ausente: acontece quando uma nova versão é publicada e o navegador
// ainda tem a página antiga aberta (os arquivos com hash anterior deixam de existir).
const isChunkLoadError = (error: Error) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    error.message || ''
  );

/**
 * Impede que uma falha de renderização em uma tela derrube o sistema inteiro
 * (tela branca). Mostra a falha e oferece recarregar.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Falha ao renderizar a tela:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const outdated = isChunkLoadError(error);
    return (
      <div role="alert" className="max-w-lg mx-auto mt-10 bg-white border border-rose-200 rounded-xl p-6 shadow-sm text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-900">
          {outdated ? 'Uma nova versão do sistema foi publicada' : 'Não foi possível exibir esta tela'}
        </h2>
        <p className="text-sm text-slate-600">
          {outdated
            ? 'Recarregue a página para usar a versão atualizada. Visitas pendentes de envio continuam salvas neste aparelho.'
            : 'Ocorreu uma falha inesperada. Recarregue a página; se o problema continuar, informe o suporte.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Recarregar página
        </button>
      </div>
    );
  }
}
