import { Component } from 'react';
import { AlertTriangle, Home, PhoneCall, RefreshCw } from 'lucide-react';
import i18n from '../../i18n';

/**
 * React Error Boundary protecting FloodConnect views from unexpected runtime errors.
 * Always keeps India disaster emergency helpline numbers (112, 108, 101, 1077) visible
 * so a UI error never blocks access to urgent emergency contacts.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || i18n.t('errors.genericMessage'),
    };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { compact = false } = this.props;

    return (
      <div
        role="alert"
        className={`flex items-center justify-center bg-[#F4F6F8] ${
          compact ? 'rounded-lg border border-red-200 p-6' : 'min-h-[60vh] p-6'
        }`}
      >
        <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-red-50 p-2.5 text-red-700 shrink-0">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                {i18n.t('errors.genericTitle')}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-[#0B2545]">
                {i18n.t('errors.boundaryTitle')}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {i18n.t('errors.boundarySubtitle')}
              </p>
            </div>
          </div>

          {this.state.errorMessage ? (
            <div className="rounded-md border border-slate-200 bg-[#F4F6F8] px-3.5 py-2.5 font-mono text-xs text-slate-700 break-words">
              {this.state.errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{i18n.t('common.retry')}</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#0B2545] hover:bg-slate-50 transition-colors"
            >
              <span>{i18n.t('common.reloadPage')}</span>
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              <span>{i18n.t('common.goHome')}</span>
            </a>
          </div>

          <div className="flex items-start gap-2.5 rounded-md border border-[#F28C28]/40 bg-[#FEF5EC] px-3.5 py-2.5 text-xs text-[#9A4D09]">
            <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-[#C06310]" aria-hidden="true" />
            <span>{i18n.t('errors.boundaryHelplineNote')}</span>
          </div>
        </div>
      </div>
    );
  }
}
