import { useState } from 'react';
import { Download, FileText, FileType } from 'lucide-react';
import { exportAsMarkdown, exportAsPdf } from '../utils/export';

interface ExportMenuProps {
  title: string;
  content: string;
}

export default function ExportMenu({ title, content }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-secondary !py-2 !text-xs"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-card">
            <button
              type="button"
              onClick={() => {
                exportAsMarkdown(title, content);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-slate-400" />
              Markdown (.md)
            </button>
            <button
              type="button"
              onClick={() => {
                exportAsPdf(title, content);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FileType className="h-4 w-4 text-slate-400" />
              PDF (print)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
