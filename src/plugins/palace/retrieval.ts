import type { KnowledgeCard } from './types.js';

// Query grammar contributes no evidence. A bounded lexical stage supplies candidates;
// the coverage floor prevents generic shared words from masquerading as an answer.
const STOP=new Set(('a an the and or of to for from in on at by with without after before while during as than '+
  'is are was were be been being do does did can could should would will may might must have has had '+
  'i my we our you your it its this that these those how why what which when where who '+
  'not just only also although but if then so need needed necessary another about '+
  'la cua va hay cho tu trong tren tai voi sau truoc khi nhu thi toi chung ban mot nhung cac nay do '+
  'can phai nen lam sao gi tai sao de khong').split(/\s+/));
const words=(value:string)=>(value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}_]+/gu)??[]);
export function queryTerms(query:string):string[] {
  const raw=[...new Set(words(query))],meaningful=raw.filter(term=>!STOP.has(term));
  return meaningful.length?meaningful:raw;
}
function stem(term:string):string {
  if(term.length<5||term.includes('_'))return term;
  if(term.endsWith('ies'))return term.slice(0,-3)+'y';
  if(term.endsWith('ing')&&term.length>6)return term.slice(0,-3);
  if(term.endsWith('ed')&&term.length>5)return term.slice(0,-2);
  if(term.endsWith('s')&&!term.endsWith('ss'))return term.slice(0,-1);
  return term;
}
export function rankCandidates(cards:KnowledgeCard[],query:string,limit:number):KnowledgeCard[] {
  const terms=[...new Set(queryTerms(query).map(stem))];
  if(!terms.length)return [];
  const sets=cards.map(card=>new Set(words(card.summary+' '+card.body).map(stem)));
  const frequencies=new Map(terms.map(term=>[term,sets.filter(set=>set.has(term)).length]));
  const minimum=terms.length>=3?Math.max(2,Math.ceil(terms.length*.25)):1;
  return cards.map((card,index)=>{
    const matched=terms.filter(term=>sets[index].has(term));
    const information=matched.reduce((score,term)=>score+Math.log(1+(cards.length+1)/((frequencies.get(term)??0)+1)),0);
    return {card,matches:matched.length,score:information*(.5+matched.length/terms.length)};
  }).filter(row=>row.matches>=minimum)
    .sort((a,b)=>b.score-a.score||statusRank(a.card)-statusRank(b.card)||a.card.id.localeCompare(b.card.id))
    .slice(0,limit).map(row=>row.card);
}
function statusRank(card:KnowledgeCard):number {return card.status==='validated'?0:card.status==='observed'?1:2;}
