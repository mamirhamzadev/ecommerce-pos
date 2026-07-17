import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaIcon } from './FaIcon';
import {
  DEFAULT_PRINT_OPTIONS,
  InvoicePrintView,
  preloadPrintFormPages,
} from './InvoicePrintView';
import {
  twBtnGhostSm,
  twBtnPrimarySm,
  twModalActions,
  twModalBackdrop,
} from '../lib/tw';

const PER_PAGE_OPTIONS = [1, 2, 3, 4, 5, 6];

/**
 * @param {{
 *   open: boolean;
 *   invoices: import('../../global').InvoiceForPrint[];
 *   onClose: () => void;
 *   title?: string;
 * }} props
 */
export function BulkPrintModal({ open, invoices, onClose, title = 'Bulk print' }) {
  const count = invoices?.length || 0;
  const maxPerPage = Math.min(6, Math.max(1, count));
  const availablePerPage = PER_PAGE_OPTIONS.filter((n) => n <= maxPerPage);

  const [perPage, setPerPage] = useState(1);
  const [options, setOptions] = useState(() => ({ ...DEFAULT_PRINT_OPTIONS }));
  const [printing, setPrinting] = useState(false);
  const printTriggered = useRef(false);

  useEffect(() => {
    if (!open) return;
    setPerPage(1);
    setOptions({ ...DEFAULT_PRINT_OPTIONS });
    setPrinting(false);
    printTriggered.current = false;
    preloadPrintFormPages();
  }, [open, count]);

  useEffect(() => {
    if (perPage > maxPerPage) setPerPage(maxPerPage);
  }, [perPage, maxPerPage]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape' && !printing) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, printing]);

  const anyOption = options.formFront || options.formBack || options.invoice;

  const previewKey = useMemo(
    () =>
      `${count}-${perPage}-${options.formFront ? 1 : 0}${options.formBack ? 1 : 0}${options.invoice ? 1 : 0}`,
    [count, perPage, options],
  );

  const handlePrint = useCallback(() => {
    if (!anyOption || count === 0 || printing) return;
    printTriggered.current = false;
    setPrinting(true);
  }, [anyOption, count, printing]);

  useEffect(() => {
    if (!printing || printTriggered.current) return undefined;
    printTriggered.current = true;
    let cancelled = false;
    preloadPrintFormPages().then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          if (!cancelled) {
            setPrinting(false);
            printTriggered.current = false;
          }
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [printing]);

  if (!open) return null;

  return (
    <>
      {printing ? (
        <InvoicePrintView invoices={invoices} options={options} perPage={perPage} />
      ) : null}

      <div
        className={`${twModalBackdrop} z-[240]`}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !printing) onClose();
        }}
      >
        <div
          className="bulk-print-modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-print-modal-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bulk-print-modal-header">
            <h2 id="bulk-print-modal-title" className="bulk-print-modal-title">
              {title}
            </h2>
            <button
              type="button"
              className="bulk-print-modal-close"
              aria-label="Close"
              disabled={printing}
              onClick={onClose}
            >
              <FaIcon icon="xmark" />
            </button>
          </div>

          <div className="bulk-print-modal-toolbar">
            <div className="bulk-print-per-page" role="group" aria-label="Prints per page">
              <span className="bulk-print-toolbar-label">Per page</span>
              <div className="bulk-print-pills">
                {availablePerPage.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`bulk-print-pill${perPage === n ? ' is-active' : ''}`}
                    aria-pressed={perPage === n}
                    onClick={() => setPerPage(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="bulk-print-options" role="group" aria-label="Print contents">
              <label className="bulk-print-check">
                <input
                  type="checkbox"
                  className="pretty-check"
                  checked={options.formFront}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, formFront: e.target.checked }))
                  }
                />
                <span>Print Form front</span>
              </label>
              <label className="bulk-print-check">
                <input
                  type="checkbox"
                  className="pretty-check"
                  checked={options.formBack}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, formBack: e.target.checked }))
                  }
                />
                <span>Print Form back</span>
              </label>
              <label className="bulk-print-check">
                <input
                  type="checkbox"
                  className="pretty-check"
                  checked={options.invoice}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, invoice: e.target.checked }))
                  }
                />
                <span>Print receipts</span>
              </label>
            </div>
          </div>

          <div className="bulk-print-preview-wrap">
            {!anyOption ? (
              <p className="bulk-print-preview-empty">
                Select at least one print option to preview.
              </p>
            ) : count === 0 ? (
              <p className="bulk-print-preview-empty">No invoices selected.</p>
            ) : (
              <div className="bulk-print-preview-scaler" key={previewKey}>
                <InvoicePrintView
                  invoices={invoices}
                  options={options}
                  perPage={perPage}
                  preview
                />
              </div>
            )}
          </div>

          <div className={`${twModalActions} bulk-print-modal-footer`}>
            <button
              type="button"
              className={twBtnGhostSm}
              disabled={printing}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={twBtnPrimarySm}
              disabled={!anyOption || count === 0 || printing}
              onClick={handlePrint}
            >
              {printing ? 'Printing…' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
