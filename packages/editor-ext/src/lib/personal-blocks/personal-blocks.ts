import { Node, mergeAttributes } from '@tiptap/core';

export const PERSONAL_DATABASE_VIEWS = [
  'table',
  'board',
  'gallery',
  'list',
  'feed',
  'dashboard',
  'calendar',
  'timeline',
  'map',
  'bar',
  'horizontal-bar',
  'line',
  'donut',
  'number',
  'form',
] as const;
export type PersonalDatabaseView = (typeof PERSONAL_DATABASE_VIEWS)[number];
export const PERSONAL_ROW_FIELDS = [
  'id',
  'title',
  'status',
  'assignee',
  'date',
  'number',
  'location',
  'deleted',
] as const;
export type PersonalRow = {
  id: string;
  title: string;
  status: string;
  assignee: string;
  date: string;
  number: number;
  location: string;
  deleted: boolean;
};
export function personalRowValues(attrs: Record<string, unknown>): PersonalRow {
  const str = (key: string, max = 500) =>
    typeof attrs[key] === 'string' ? (attrs[key] as string).slice(0, max) : '';
  return {
    id: str('id', 100),
    title: str('title'),
    status: ['todo', 'doing', 'done'].includes(str('status'))
      ? str('status')
      : 'todo',
    assignee: str('assignee'),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str('date')) ? str('date') : '',
    number:
      typeof attrs.number === 'number' && Number.isFinite(attrs.number)
        ? attrs.number
        : 0,
    location: str('location'),
    deleted: attrs.deleted === true,
  };
}
export function personalRowsToCsv(rows: PersonalRow[]): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return [
    'title,status,assignee,date,number,location',
    ...rows
      .filter((r) => !r.deleted)
      .map((r) =>
        [r.title, r.status, r.assignee, r.date, r.number, r.location]
          .map(cell)
          .join(','),
      ),
  ].join('\r\n');
}

// Each row is a separate Yjs-backed ProseMirror node. A cell edit only changes
// that field on the current row, rather than replacing a stale JSON dataset.
export const PersonalDatabaseRow = Node.create({
  name: 'personalDatabaseRow',
  content: 'personalDatabaseCell*',
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      id: { default: '' },
      title: { default: '' },
      status: { default: 'todo' },
      assignee: { default: '' },
      date: { default: '' },
      number: { default: 0 },
      location: { default: '' },
      deleted: { default: false },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="personalDatabaseRow"]',
        contentElement: '[data-database-cells]',
        getAttrs: (element) => {
          try {
            const attrs = JSON.parse(
              (element as HTMLElement).getAttribute('data-row') || '{}',
            );
            return personalRowValues(attrs);
          } catch {
            return false;
          }
        },
      },
    ];
  },
  renderHTML({ node }) {
    const row = personalRowValues(node.attrs);
    return ['div', { 'data-type': this.name, 'data-row': JSON.stringify(row) },
      ['span', {}, row.deleted ? '' : [row.title, row.status, row.assignee, row.date, row.number, row.location].join(' | ')],
      ['div', { 'data-database-cells': '' }, 0]];
  },
  renderText({ node }) {
    const row = personalRowValues(node.attrs);
    return row.deleted
      ? ''
      : [
          row.title,
          row.status,
          row.assignee,
          row.date,
          String(row.number),
          row.location,
        ]
          .filter(Boolean)
          .join(' ');
  },
});
export const PersonalDatabase = Node.create({
  name: 'personalDatabase',
  group: 'block',
  content: 'personalDatabaseProperty* personalDatabaseRow*',
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      id: { default: '' },
      title: { default: 'Database' },
      view: { default: 'table' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'section[data-type="personalDatabase"]',
        contentElement: (element) =>
          element.querySelector('[data-database-rows]') ||
          element.querySelector(':scope > div') || element,
        getAttrs: (element) => ({
          id: (element as HTMLElement).getAttribute('data-database-id') || '',
          title:
            (element as HTMLElement).getAttribute('data-title') || 'Database',
          view: (element as HTMLElement).getAttribute('data-view') || 'table',
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-type': this.name,
        'data-database-id': node.attrs.id,
        'data-title': node.attrs.title,
        'data-view': node.attrs.view,
      }),
      ['h3', {}, String(node.attrs.title)],
      ['div', { 'data-database-rows': '' }, 0],
    ];
  },
});

// A linked view stores only the source identity and its own presentation. Rows
// stay in the source page's authenticated Yjs document, never in a copied JSON
// dataset on the reference page.
export const PersonalDatabaseReference = Node.create({
  name: 'personalDatabaseReference',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      sourcePageId: { default: '' },
      databaseId: { default: '' },
      view: { default: 'table' },
    };
  },
  parseHTML() {
    return [{
      tag: 'div[data-type="personalDatabaseReference"]',
      getAttrs: (element) => {
        const el = element as HTMLElement;
        return {
          sourcePageId: el.getAttribute('data-source-page-id') || '',
          databaseId: el.getAttribute('data-database-id') || '',
          view: el.getAttribute('data-view') || 'table',
        };
      },
    }];
  },
  renderHTML({ node }) {
    return ['div', {
      'data-type': this.name,
      'data-source-page-id': node.attrs.sourcePageId,
      'data-database-id': node.attrs.databaseId,
      'data-view': node.attrs.view,
    }, 'Linked database'];
  },
  renderText() { return ''; },
});

export const PersonalWidget = Node.create({
  name: 'personalWidget',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      id: { default: '' },
      kind: { default: 'bookmark' },
      title: { default: '' },
      value: { default: '' },
      provider: { default: '' },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="personalWidget"]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            id: el.getAttribute('data-widget-id') || '',
            kind: el.getAttribute('data-kind'),
            title: el.getAttribute('data-title'),
            value: el.getAttribute('data-value'),
            provider: el.getAttribute('data-provider'),
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'div',
      {
        'data-type': this.name,
        'data-widget-id': node.attrs.id,
        'data-kind': node.attrs.kind,
        'data-title': node.attrs.title,
        'data-value': node.attrs.value,
        'data-provider': node.attrs.provider,
      },
      String(node.attrs.title || node.attrs.provider || node.attrs.kind),
      ['pre', {}, String(node.attrs.value || '')],
    ];
  },
  renderText({ node }) {
    return [node.attrs.title, node.attrs.value].filter(Boolean).join(' ');
  },
});
export const PersonalTab = Node.create({
  name: 'personalTab',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return { title: { default: 'Tab' } };
  },
  parseHTML() {
    return [
      {
        tag: 'section[data-type="personalTab"]',
        getAttrs: (element) => ({
          title: (element as HTMLElement).getAttribute('data-title') || 'Tab',
        }),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'section',
      { 'data-type': this.name, 'data-title': node.attrs.title },
      0,
    ];
  },
});
export const PersonalTabs = Node.create({
  name: 'personalTabs',
  group: 'block',
  content: 'personalTab+',
  draggable: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="personalTabs"]' }];
  },
  renderHTML() {
    return ['div', { 'data-type': this.name }, 0];
  },
});

export const PersonalToggle = Node.create({
  name: 'personalToggle',
  group: 'block',
  content: 'heading block*',
  draggable: true,
  isolating: true,
  addAttributes() {
    return { open: { default: true } };
  },
  parseHTML() {
    return [
      {
        tag: 'section[data-type="personalToggle"]',
        getAttrs: (element) => ({
          open: (element as HTMLElement).getAttribute('data-open') !== 'false',
        }),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'section',
      { 'data-type': this.name, 'data-open': String(node.attrs.open) },
      0,
    ];
  },
});


export const PersonalDate = Node.create({
  name: 'personalDate', group: 'inline', inline: true, atom: true,
  addAttributes() { return { value: { default: '' }, id: { default: null }, remindAt: { default: null } }; },
  parseHTML() { return [{ tag: 'time[data-type="personalDate"]', getAttrs: (el) => ({ value: el.getAttribute('datetime') || '' }) }]; },
  renderHTML({ node }) { return ['time', { 'data-type': this.name, datetime: node.attrs.value }, String(node.attrs.value || 'Date')]; },
  renderText({ node }) { return String(node.attrs.value || ''); },
});

/** Community property definitions and cells are individual Yjs nodes. */
export const COMMUNITY_PROPERTY_TYPES = ['text','number','checkbox','date','select','multi_select','url','email','phone','relation','formula','rollup'] as const;
export const PersonalDatabaseProperty = Node.create({
  name: 'personalDatabaseProperty', atom: true, selectable: false,
  addAttributes() { return Object.fromEntries(Object.entries({ id:'', name:'Property', kind:'text', options:'', formula:'', targetPageId:'', targetDatabaseId:'', relationId:'', sourceProperty:'number', aggregation:'sum', deleted:false }).map(([key,value])=>[key,{default:value}])); },
  parseHTML() { return [{tag:'div[data-type="personalDatabaseProperty"]',getAttrs: el=>{try{return JSON.parse(el.getAttribute('data-property')||'{}')}catch{return false}}}]; },
  renderHTML({node}) {return ['div',{'data-type':this.name,'data-property':JSON.stringify(node.attrs)},String(node.attrs.name)];},
});
export const PersonalDatabaseCell = Node.create({
  name: 'personalDatabaseCell', atom: true, selectable: false,
  addAttributes() {return { id:{default:''}, propertyId:{default:''}, value:{default:null} };},
  parseHTML() {return [{tag:'span[data-type="personalDatabaseCell"]',getAttrs:el=>{try{return JSON.parse(el.getAttribute('data-cell')||'{}')}catch{return false}}}];},
  renderHTML({node}) {return ['span',{'data-type':this.name,'data-cell':JSON.stringify(node.attrs)},String(node.attrs.value??'')];},
  renderText({node}) {return String(node.attrs.value??'');},
});
