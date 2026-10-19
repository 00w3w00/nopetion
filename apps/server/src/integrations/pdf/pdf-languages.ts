type PdfMessages = { untitled: string; omitted: string; table: string };
const messages: Record<string, PdfMessages> = {
  'en-US': {
    untitled: 'Untitled',
    omitted: 'Not rendered in PDF',
    table: 'Table displayed as text to preserve long cells',
  },
  'ko-KR': {
    untitled: '제목 없음',
    omitted: 'PDF에서 표시하지 못한 블록',
    table: '긴 셀의 내용을 보존하기 위해 표를 텍스트로 표시합니다',
  },
  'ja-JP': {
    untitled: '無題',
    omitted: 'PDFで表示できないブロック',
    table: '長いセルの内容を保持するため、表をテキストで表示します',
  },
  'zh-CN': {
    untitled: '无标题',
    omitted: 'PDF 中未呈现的内容块',
    table: '为保留长单元格内容，表格以文本显示',
  },
  'de-DE': {
    untitled: 'Ohne Titel',
    omitted: 'In PDF nicht dargestellt',
    table: 'Tabelle als Text dargestellt, um lange Zellen zu erhalten',
  },
  'es-ES': {
    untitled: 'Sin título',
    omitted: 'No se muestra en el PDF',
    table: 'Tabla mostrada como texto para conservar las celdas largas',
  },
  'fr-FR': {
    untitled: 'Sans titre',
    omitted: 'Non affiché dans le PDF',
    table: 'Tableau affiché en texte pour préserver les cellules longues',
  },
  'nl-NL': {
    untitled: 'Naamloos',
    omitted: 'Niet weergegeven in PDF',
    table: 'Tabel als tekst weergegeven om lange cellen te behouden',
  },
  'pt-BR': {
    untitled: 'Sem título',
    omitted: 'Não exibido no PDF',
    table: 'Tabela exibida como texto para preservar células longas',
  },
  'it-IT': {
    untitled: 'Senza titolo',
    omitted: 'Non visualizzato nel PDF',
    table: 'Tabella mostrata come testo per conservare le celle lunghe',
  },
  'uk-UA': {
    untitled: 'Без назви',
    omitted: 'Не відображено в PDF',
    table: 'Таблицю показано як текст для збереження довгих клітинок',
  },
  'ru-RU': {
    untitled: 'Без названия',
    omitted: 'Не отображено в PDF',
    table: 'Таблица показана как текст для сохранения длинных ячеек',
  },
};
export function pdfMessages(locale?: string): PdfMessages {
  const key = Object.keys(messages).find(
    (key) => key === locale || key.split('-')[0] === locale?.split('-')[0],
  );
  return messages[key || 'ko-KR'];
}
