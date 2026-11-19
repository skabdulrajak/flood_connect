import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Camera, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { validateImageMagicBytes } from '../../utils/validation';

export function PhotoUploadField({
  label,
  helperText,
  file,
  onFileChange,
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const resolvedLabel = label || t('incident.photoLabel');
  const resolvedHelper = helperText || t('common.photoHelp');

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSelect = async (e) => {
    setError('');
    const selected = e.target.files?.[0];
    if (!selected) return;

    setChecking(true);
    try {
      const check = await validateImageMagicBytes(selected);
      if (!check.valid) {
        setError(check.error);
        e.target.value = '';
        onFileChange(null);
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const objectUrl = URL.createObjectURL(selected);
      setPreviewUrl(objectUrl);
      onFileChange(selected);
    } finally {
      setChecking(false);
    }
  };

  const handleRemove = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setError('');
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-semibold text-[#0B2545]">
        {resolvedLabel}
      </label>
      <p id={helperId} className="mt-0.5 text-xs text-slate-600">
        {resolvedHelper}
      </p>

      {error ? (
        <div
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {!file ? (
        <div className="mt-2">
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-describedby={error ? `${helperId} ${errorId}` : helperId}
            aria-invalid={Boolean(error)}
            onChange={handleSelect}
            className="sr-only"
          />
          <button
            type="button"
            disabled={checking}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-dashed border-slate-300 bg-[#F4F6F8] px-4 py-2.5 text-sm font-medium text-[#0B2545] hover:border-[#13A89E] hover:bg-white transition-colors disabled:opacity-60"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#0E857D]" aria-hidden="true" />
            ) : (
              <Camera className="h-4 w-4 text-[#0E857D]" aria-hidden="true" />
            )}
            <span>
              {checking ? t('common.loading') : t('common.uploadPhoto')}
            </span>
          </button>
        </div>
      ) : (
        <div
          aria-live="polite"
          className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4 rounded-md border border-slate-200 bg-[#F4F6F8] p-3"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={t('common.preview')}
              className="h-16 w-20 rounded border border-slate-200 object-cover shrink-0"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#0B2545]">{file.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700 tabular-nums">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type.replace('image/', '').toUpperCase()}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            aria-label={t('common.removePhoto')}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('common.removePhoto')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
