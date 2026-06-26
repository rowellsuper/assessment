import mammoth from 'mammoth';

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.markdown', '.docx'];

export function getFileExtension(filename: string): string {
  return filename.toLowerCase().slice(filename.lastIndexOf('.'));
}

export function isAllowedFile(filename: string): boolean {
  return ALLOWED_EXTENSIONS.includes(getFileExtension(filename));
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const paragraphs = escaped.split(/\n\n+/).map((p) => {
    const lines = p.split('\n').join('<br>');
    return `<p>${lines}</p>`;
  });

  return paragraphs.join('');
}

export async function fileBufferToHtml(buffer: Buffer, filename: string): Promise<string> {
  const ext = getFileExtension(filename);

  if (ext === '.docx') {
    const result = await mammoth.convertToHtml({ buffer });
    return result.value;
  }

  if (['.txt', '.md', '.markdown'].includes(ext)) {
    return textToHtml(buffer.toString('utf-8'));
  }

  throw new Error('Unsupported file type. Allowed: .txt, .md, .docx');
}
