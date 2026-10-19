/** Independent, bounded expression evaluator. No JS evaluation or commercial code. */
export type FormulaValue = string | number | boolean | null | FormulaValue[];
type Ast = { kind: string; value?: string | number | boolean; children?: Ast[] };
export function evaluateCommunityFormula(source: string, property: (name: string) => FormulaValue): FormulaValue {
  if (source.length > 4000) throw new Error('Formula too long');
  const tokens: string[] = [];
  const pattern = /\s*(?:((?:\d+(?:\.\d*)?|\.\d+))|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([a-zA-Z_][a-zA-Z_0-9]*)|(==|!=|<=|>=|&&|\|\||[()+\-*/%,<>!]))/y;
  let offset = 0;
  while (offset < source.length) {
    if (!source.slice(offset).trim()) break;
    pattern.lastIndex = offset; const match = pattern.exec(source);
    if (!match) throw new Error('Invalid formula token');
    tokens.push(match[1] || match[2] || match[3] || match[4]); offset = pattern.lastIndex;
    if (tokens.length > 256) throw new Error('Formula too complex');
  }
  let index = 0;
  const precedence: Record<string,number> = { '||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6 };
  const expression = (min=0, depth=0): Ast => {
    if (depth > 32) throw new Error('Formula nesting limit');
    const token=tokens[index++]; if (!token) throw new Error('Expected expression');
    let left:Ast;
    if (['!','-','+'].includes(token)) left={kind:'unary',value:token,children:[expression(7,depth+1)]};
    else if (token==='(') { left=expression(0,depth+1); if(tokens[index++]!==')')throw new Error('Expected closing parenthesis'); }
    else if (/^[\d.]/.test(token)) left={kind:'literal',value:Number(token)};
    else if (/^["']/.test(token)) {
      const value=token.startsWith('"')?JSON.parse(token):token.slice(1,-1).replace(/\\(['\\])/g,'$1');
      left={kind:'literal',value};
    } else if (['true','false','null'].includes(token)) left={kind:token==='null'?'null':'literal',value:token==='true'};
    else if (tokens[index++]==='(') {
      const children:Ast[]=[];
      if(tokens[index]!==')')do{children.push(expression(0,depth+1));}while(tokens[index]===',' && ++index);
      if(tokens[index++]!==')')throw new Error('Expected closing parenthesis');
      left={kind:'call',value:token,children};
    } else throw new Error('Unknown identifier');
    while (precedence[tokens[index]]>=min && tokens[index] in precedence) {
      const op=tokens[index++]; left={kind:'binary',value:op,children:[left,expression(precedence[op]+1,depth+1)]};
    }
    return left;
  };
  const ast=expression(); if(index!==tokens.length)throw new Error('Unexpected token');
  const numeric=(v:FormulaValue):number=>{ const n=typeof v==='number'?v:typeof v==='boolean'?Number(v):typeof v==='string' && v.trim()?Number(v):NaN; if(!Number.isFinite(n))throw new Error('Expected finite number');return n; };
  const run=(n:Ast):FormulaValue=>{
    if(n.kind==='null')return null;
    if(n.kind==='literal')return n.value as FormulaValue;
    if(n.kind==='unary'){const v=run(n.children[0]);return n.value==='!'?!v:n.value==='-'?-numeric(v):numeric(v);}
    if(n.kind==='binary'){
      const a=run(n.children[0]); const op=n.value;
      if(op==='&&')return a && run(n.children[1]);if(op==='||')return a || run(n.children[1]);
      const b=run(n.children[1]);
      if(op==='==')return a===b;if(op==='!=')return a!==b;
      if(op==='+')return typeof a==='string'||typeof b==='string'?String(a??'')+String(b??''):numeric(a)+numeric(b);
      if(op==='-')return numeric(a)-numeric(b);if(op==='*')return numeric(a)*numeric(b);
      if(op==='/'||op==='%'){if(numeric(b)===0)throw new Error('Division by zero');return op==='/'?numeric(a)/numeric(b):numeric(a)%numeric(b);}
      const x=typeof a==='string' && typeof b==='string'?a:numeric(a), y=typeof a==='string' && typeof b==='string'?b:numeric(b);
      if(op==='<')return x<y;if(op==='>')return x>y;if(op==='<=')return x<=y;return x>=y;
    }
    const name=String(n.value), nodes=n.children;
    if(name==='if'){if(nodes.length!==3)throw new Error('if requires three arguments');return run(nodes[0])?run(nodes[1]):run(nodes[2]);}
    const args=nodes.map(run);
    if(name==='prop'){if(args.length!==1 || typeof args[0]!=='string')throw new Error('prop requires a name');return property(args[0]);}
    const text=String(args[0]??'');
    if(name==='concat')return args.map(v=>String(v??'')).join('');
    if(name==='lower')return text.toLowerCase();if(name==='upper')return text.toUpperCase();
    if(name==='length')return Array.isArray(args[0])?args[0].length:text.length;
    if(name==='empty')return args[0]==null || text==='' || Array.isArray(args[0]) && args[0].length===0;
    if(name==='contains')return text.includes(String(args[1]??''));
    if(name==='toNumber')return numeric(args[0]);if(name==='format')return text;
    if(['abs','round','floor','ceil'].includes(name))return Math[name as 'abs'](numeric(args[0]));
    const values=args.flat();
    if(name==='count')return values.filter(v=>v!=null && v!=='').length;
    if(['sum','average','min','max'].includes(name)){
      const nums=values.filter(v=>v!=null && v!=='').map(numeric);
      if(!nums.length)return 0;
      if(name==='sum')return nums.reduce((a,b)=>a+b,0);
      if(name==='average')return nums.reduce((a,b)=>a+b,0)/nums.length;
      return name==='min'?Math.min(...nums):Math.max(...nums);
    }
    throw new Error('Unknown formula function');
  };
  const result=run(ast); if(typeof result==='number' && !Number.isFinite(result))throw new Error('Non-finite formula result');
  if(typeof result==='string' && result.length>8192)throw new Error('Formula output limit');
  return result;
}
