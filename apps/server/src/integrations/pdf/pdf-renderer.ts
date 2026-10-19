import PDFDocument = require('pdfkit');
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { imageDimensionsFromData } from 'image-dimensions';
import { pdfMessages } from './pdf-languages';
import { personalRowValues, evaluateCommunityFormula, type FormulaValue } from '@docmost/editor-ext';

export type PdfNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: PdfNode[];
};
export type PdfImage = { bytes: Buffer; width: number; height: number };
export type PdfDocumentSource = { title: string; content: PdfNode };
export type PdfSourceBudget = { nodes: number; text: number };
export const PDF_LIMITS = {
  documents: 30,
  treeNodes: 500,
  treeDepth: 40,
  nodes: 10000,
  depth: 40,
  text: 2_000_000,
  pages: 200,
  image: 5_000_000,
  images: 20_000_000,
  bytes: 30_000_000,
};

export function validatePdfSource(content: unknown, budget?: PdfSourceBudget): PdfNode {
  const source = content ?? { type: 'doc', content: [] };
  const pending = [{ node: source as PdfNode, depth: 0 }];
  let count = budget?.nodes || 0,
    text = budget?.text || 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (
      !node ||
      typeof node.type !== 'string' ||
      ++count > PDF_LIMITS.nodes ||
      depth > PDF_LIMITS.depth ||
      (node.content && !Array.isArray(node.content))
    )
      throw new BadRequestException({
        code: 'pdfSource',
        message: 'Invalid or excessively large PDF source',
      });
    if (typeof node.text === 'string') text += node.text.length;
    for (const value of Object.values(node.attrs || {})) {
      if (typeof value === 'string') text += value.length;
    }
    if (text > PDF_LIMITS.text)
      throw new BadRequestException({
        code: 'pdfLimit',
        message: 'PDF source exceeds the size limit',
      });
    for (const child of node.content || [])
      pending.push({ node: child, depth: depth + 1 });
  }
  if ((source as PdfNode).type !== 'doc')
    throw new BadRequestException({
      code: 'pdfSource',
      message: 'Invalid PDF document',
    });
  if (budget) { budget.nodes = count; budget.text = text; }
  return source as PdfNode;
}

export function pdfImage(bytes: Buffer): PdfImage | undefined {
  if (bytes.length > PDF_LIMITS.image) return;
  const dimensions = imageDimensionsFromData(bytes);
  if (
    !dimensions ||
    !['png', 'jpeg'].includes(dimensions.type) ||
    dimensions.width * dimensions.height > 16_000_000 ||
    dimensions.width < 1 ||
    dimensions.height < 1
  )
    return;
  return { bytes, ...dimensions };
}

// Images arrive as authorized bytes. This renderer never opens user paths or URLs.
export async function renderPdf(
  title: string,
  content: PdfNode,
  images: Map<PdfNode, PdfImage>,
  locale?: string,
  additionalDocuments: PdfDocumentSource[] = [],
): Promise<Buffer> {
  if (additionalDocuments.length + 1 > PDF_LIMITS.documents)
    throw new BadRequestException({ code: 'pdfLimit', message: 'Too many PDF documents' });
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    bufferPages: true,
    info: { Title: title, Creator: 'Nopetion' },
  });
  const chunks: Buffer[] = [];
  let bytes = 0;
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > PDF_LIMITS.bytes)
        doc.destroy(
          new BadRequestException({
            code: 'pdfLimit',
            message: 'PDF exceeds the size limit',
          }),
        );
      else chunks.push(chunk);
    });
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  const msg = pdfMessages(locale);
  let pages = 1;
  doc.on('pageAdded', () => {
    if (++pages > PDF_LIMITS.pages)
      throw new BadRequestException({
        code: 'pdfLimit',
        message: 'PDF exceeds the page limit',
      });
  });
  const width = () => doc.page.width - 96;
  const font = (bold = false, size = 11) =>
    doc
      .font(bold ? 'body-bold' : 'body')
      .fontSize(size)
      .fillColor('#20242b');
  const ensure = (height: number) => {
    if (doc.y + height > doc.page.height - 48) doc.addPage();
  };
  const label = (node: PdfNode) =>
    String(
      node.attrs?.label || node.attrs?.name || node.attrs?.alt || node.type,
    ).slice(0, 160);
  const omission = (node: PdfNode, indent = 0) => {
    font(false, 9)
      .fillColor('#666666')
      .text(`[${msg.omitted}: ${label(node)}]`, 48 + indent, doc.y, {
        width: width() - indent,
        lineGap: 3,
      });
    doc.moveDown(0.4);
  };
  const text = (node: PdfNode): string => {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'personalDate') return String(node.attrs?.value || '');
    if (node.type === 'mention' || node.type === 'pageMention')
      return label(node);
    if (!node.content) return `[${msg.omitted}: ${label(node)}]`;
    return node.content
      .map(text)
      .join(['paragraph', 'heading'].includes(node.type) ? '' : '\n');
  };
  const inline = (
    node: PdfNode,
    indent: number,
    bold = false,
    size = 11,
    prefix = '',
  ) => {
    const segments: PdfNode[] = [];
    const flatten = (child: PdfNode) => {
      if (child.type === 'text' || child.type === 'hardBreak' || !child.content)
        segments.push(child);
      else child.content.forEach(flatten);
    };
    (node.content || []).forEach(flatten);
    if (!segments.length) segments.push({ type: 'text', text: ' ' });
    ensure(size * 2);
    segments.forEach((segment, i) => {
      const marks = segment.marks || [];
      font(bold || marks.some((m) => m.type === 'bold'), size);
      const href = marks.find((m) => m.type === 'link')?.attrs?.href;
      const safeLink =
        typeof href === 'string' && /^(https?:\/\/|mailto:)/i.test(href)
          ? href
          : undefined;
      const value = (i === 0 ? prefix : '') + text(segment);
      const options: PDFKit.Mixins.TextOptions = {
        width: width() - indent,
        lineGap: 3,
        continued: i < segments.length - 1,
        underline: marks.some((m) => m.type === 'underline') || !!safeLink,
        strike: marks.some((m) => m.type === 'strike'),
        oblique: marks.some((m) => m.type === 'italic'),
        link: safeLink,
      };
      if (i === 0) doc.text(value, 48 + indent, doc.y, options);
      else doc.text(value, options);
    });
    doc.moveDown(0.5);
  };
  const table = (node: PdfNode, indent: number) => {
    const rows = node.content || [];
    font(false, 10);
    const cols = Math.max(
      1,
      ...rows.map((row) =>
        (row.content || []).reduce(
          (n, cell) => n + Math.min(20, Number(cell.attrs?.colspan) || 1),
          0,
        ),
      ),
    );
    const colWidth = (width() - indent) / cols;
    const complex =
      cols > 12 ||
      rows.some((row) =>
        (row.content || []).some(
          (cell) =>
            doc.heightOfString(text(cell), {
              width: Math.max(20, colWidth - 14),
              lineGap: 3,
            }) >
              doc.page.height - 150 || Number(cell.attrs?.rowspan) > 1,
        ),
      );
    if (complex) {
      font(false, 9)
        .fillColor('#666666')
        .text(`[${msg.table}]`, 48 + indent, doc.y, {
          width: width() - indent,
        });
      rows.forEach((row, index) => {
        font(true, 10).text(`${index + 1}.`, 48 + indent, doc.y, {
          width: width() - indent,
        });
        (row.content || []).forEach((cell) => {
          font(false, 10).text(text(cell), 48 + indent + 12, doc.y, {
            width: width() - indent - 12,
            lineGap: 3,
          });
          doc.moveDown(0.4);
        });
      });
    } else if (rows.length) {
      ensure(36);
      doc.x = 48 + indent;
      doc.table({
        maxWidth: width() - indent,
        columnStyles: Array(cols).fill(colWidth),
        defaultStyle: {
          border: 0.5,
          borderColor: '#d9dde3',
          padding: 7,
          textColor: '#20242b',
        },
        data: rows.map((row) =>
          (row.content || []).map((cell) => ({
            text: text(cell),
            colSpan: Math.max(
              1,
              Math.min(cols, Number(cell.attrs?.colspan) || 1),
            ),
            backgroundColor:
              cell.type === 'tableHeader' ? '#f1f3f5' : undefined,
            font: {
              src: cell.type === 'tableHeader' ? 'body-bold' : 'body',
              size: 10,
            },
          })),
        ),
      });
    }
    doc.x = 48;
    doc.moveDown(0.7);
  };
  const block = (node: PdfNode, indent = 0, prefix = '') => {
    switch (node.type) {
      case 'doc':
      case 'personalTabs':
      case 'personalToggle':
        node.content?.forEach((child) => block(child, indent));
        break;
      case 'personalTab':
        inline(
          {
            type: 'paragraph',
            content: [{ type: 'text', text: String(node.attrs?.title || '') }],
          },
          indent,
          true,
          13,
        );
        node.content?.forEach((child) => block(child, indent));
        break;
      case 'personalDatabase': {
        inline(
          {
            type: 'paragraph',
            content: [{ type: 'text', text: String(node.attrs?.title || '') }],
          },
          indent,
          true,
          15,
        );
        const cell = (value: string) => ({
          type: 'tableCell',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: value }] },
          ],
        });
        table(
          {
            type: 'table',
            content: (node.content || [])
              .filter((row) => row.type === 'personalDatabaseRow')
              .map((row) => personalRowValues(row.attrs || {}))
              .filter((row) => !row.deleted)
              .map((row) => ({
                type: 'tableRow',
                content: [
                  row.title,
                  row.status,
                  row.assignee,
                  row.date,
                  String(row.number),
                  row.location,
                ].map(cell),
              })),
          },
          indent,
        );
        const properties = (node.content || []).filter(p => p.type === 'personalDatabaseProperty' && !p.attrs?.deleted);
        for (const row of (node.content || []).filter(r => r.type === 'personalDatabaseRow' && !r.attrs?.deleted)) {
          if (!properties.length) break;
          inline({ type: 'paragraph', content: [{ type: 'text', text: String(row.attrs?.title || '') }] }, indent, true, 11);
          const value = (name: string, seen = new Set<string>()): FormulaValue => {
            const builtins = { Name:'title', Status:'status', Assignee:'assignee', Date:'date', Value:'number', Location:'location' };
            const key = Object.prototype.hasOwnProperty.call(builtins, name) ? builtins[name] : name;
            if (Object.prototype.hasOwnProperty.call(row.attrs || {}, key)) return row.attrs[key] as FormulaValue;
            const property = properties.find(p => p.attrs.id === name || p.attrs.name === name);
            if (!property || seen.has(String(property.attrs.id)) || seen.size > 16) throw Error('Invalid formula reference');
            if (property.attrs.kind === 'formula') return evaluateCommunityFormula(String(property.attrs.formula), key => value(key, new Set(seen).add(String(property.attrs.id))));
            if (property.attrs.kind === 'rollup') throw Error('Cross-page rollup');
            return (row.content || []).find(cell => cell.type === 'personalDatabaseCell' && cell.attrs?.propertyId === property.attrs.id)?.attrs.value as FormulaValue ?? null;
          };
          for (const property of properties) {
            try { inline({ type:'paragraph',content:[{type:'text',text:String(property.attrs.name)+': '+String(value(String(property.attrs.id)) ?? '')}] }, indent + 10, false, 10); }
            catch { omission(property, indent + 10); }
          }
        }
        break;
      }
      case 'paragraph':
        inline(node, indent, false, 11, prefix);
        break;
      case 'heading':
        inline(
          node,
          indent,
          true,
          [22, 18, 15, 13, 12, 11][
            Math.max(0, Math.min(5, Number(node.attrs?.level || 1) - 1))
          ],
          prefix,
        );
        break;
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        node.content?.forEach((item, index) => {
          const mark =
            node.type === 'orderedList'
              ? `${index + (Number(node.attrs?.start) || 1)}. `
              : node.type === 'taskList'
                ? item.attrs?.checked
                  ? '[x] '
                  : '[ ] '
                : '• ';
          item.content?.forEach((child, i) =>
            block(child, indent + 14, i === 0 ? mark : ''),
          );
        });
        break;
      case 'blockquote':
      case 'callout':
      case 'details':
      case 'detailsContent':
      case 'detailsSummary':
        node.content?.forEach((child) => block(child, indent + 14));
        break;
      case 'codeBlock':
        ensure(30);
        font(false, 9.5).text(text(node), 48 + indent + 10, doc.y, {
          width: width() - indent - 10,
          lineGap: 3,
        });
        doc.moveDown(0.7);
        break;
      case 'horizontalRule':
        ensure(15);
        doc
          .moveTo(48 + indent, doc.y + 5)
          .lineTo(doc.page.width - 48, doc.y + 5)
          .strokeColor('#d9dde3')
          .stroke();
        doc.y += 15;
        break;
      case 'table':
        table(node, indent);
        break;
      case 'image': {
        const image = images.get(node);
        if (!image) {
          omission(node, indent);
          break;
        }
        const requested =
          typeof node.attrs?.width === 'number' && node.attrs.width > 0
            ? node.attrs.width
            : image.width;
        const scale = Math.min(
          Math.min(requested, width() - indent) / image.width,
          430 / image.height,
        );
        const w = image.width * scale,
          h = image.height * scale;
        ensure(h + 30);
        const x = 48 + indent + (width() - indent - w) / 2;
        const y = doc.y;
        try {
          doc.image(image.bytes, x, y, { width: w, height: h });
          doc.y = y + h + 8;
        } catch {
          omission(node, indent);
        }
        if (typeof node.attrs?.alt === 'string' && node.attrs.alt)
          font(false, 9)
            .fillColor('#666666')
            .text(node.attrs.alt, 48 + indent, doc.y, {
              width: width() - indent,
              align: 'center',
            });
        doc.moveDown(0.7);
        break;
      }
      default:
        omission(node, indent);
        // Preserve textual children of unknown blocks, but never dereference them.
        node.content?.forEach((child) => block(child, indent));
    }
  };
  try {
    doc.registerFont(
      'body',
      join(__dirname, 'fonts', 'NopetionPdfSans-Regular.ttf'),
    );
    doc.registerFont(
      'body-bold',
      join(__dirname, 'fonts', 'NopetionPdfSans-Bold.ttf'),
    );
    for (const [index, section] of [{ title, content }, ...additionalDocuments].entries()) {
      if (index > 0) doc.addPage();
      font(true, 26).text(section.title || msg.untitled, 48, doc.y, { width: width(), lineGap: 4 });
      doc.moveDown(0.6);
      block(section.content);
    }
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottomMargin = doc.page.margins.bottom;
      // Footers occupy the reserved margin. PDFKit otherwise moves them onto
      // extra blank pages even when lineBreak is false.
      doc.page.margins.bottom = 0;
      font(false, 8)
        .fillColor('#858a92')
        .text(
          `Nopetion · ${i + 1} / ${range.count}`,
          48,
          doc.page.height - 32,
          { width: width(), lineBreak: false, align: 'right' },
        );
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  } catch (error) {
    doc.destroy(error as Error);
  }
  return result;
}
