import TurndownService from 'turndown';

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'document';
}

export function exportAsMarkdown(title: string, html: string) {
  const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
  const md = `# ${title}\n\n${turndown.turndown(html || '')}`;
  downloadFile(`${sanitizeFilename(title)}.md`, md, 'text/markdown');
}

export function exportAsPdf(title: string, html: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to export PDF');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 2rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin-top: 1.5rem; }
    h3 { font-size: 1.25rem; margin-top: 1.25rem; }
    p { margin: 0.75rem 0; }
    ul, ol { padding-left: 1.5rem; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${html || '<p></p>'}
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}
