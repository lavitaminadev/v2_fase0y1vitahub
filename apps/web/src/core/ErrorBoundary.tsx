import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="fatal-error-page">
        <section>
          <span className="page-eyebrow">RECUPERACIÓN SEGURA</span>
          <div className="fatal-error-code">!</div>
          <h1>Esta vista encontró un problema.</h1>
          <p>La sesión y los datos guardados siguen protegidos. Puedes reconstruir la vista o volver al panel principal.</p>
          <div>
            <button className="btn btn-primary" onClick={() => this.setState({ hasError: false })}>Intentar recuperar</button>
            <a className="btn btn-outline" href="/dashboard">Volver al dashboard</a>
          </div>
        </section>
        <aside><strong>Si vuelve a ocurrir</strong><p>Indica qué pantalla estabas usando y la última acción realizada. Esto permite ubicar el error sin pedirte datos sensibles.</p></aside>
      </main>
    );
  }
}
