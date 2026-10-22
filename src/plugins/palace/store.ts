import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { KnowledgeCard, KnowledgeEvidence, KnowledgeStatus } from './types.js';
import { cardHash, canonical, preview } from './util.js';
import { queryTerms } from './retrieval.js';

type Row = Record<string,unknown>;
export interface EvidenceLocation {
  evidence: KnowledgeEvidence;
  type: 'p1' | 'file' | 'managed' | 'remote';
  path?: string;
  sourceRef?: string;
  bytes?: number;
}
export class PalaceStore {
  readonly db: DatabaseSync;
  constructor(readonly dataRoot: string,readonly deviceId: string) {
    mkdirSync(dataRoot,{recursive:true});
    this.db=new DatabaseSync(join(dataRoot,'palace.sqlite'));
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000");
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);'+
      'CREATE TABLE IF NOT EXISTS cards(id TEXT PRIMARY KEY,version INTEGER NOT NULL,status TEXT NOT NULL,kind TEXT NOT NULL,'+
      'project_id TEXT,visibility TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL,json TEXT NOT NULL);'+
      'CREATE TABLE IF NOT EXISTS versions(id TEXT NOT NULL,version INTEGER NOT NULL,json TEXT NOT NULL,PRIMARY KEY(id,version));'+
      'CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY,json TEXT NOT NULL);'+
      'CREATE TABLE IF NOT EXISTS card_evidence(card_id TEXT NOT NULL,evidence_id TEXT NOT NULL,PRIMARY KEY(card_id,evidence_id));'+
      'CREATE INDEX IF NOT EXISTS evidence_cards ON card_evidence(evidence_id,card_id);'+
      'CREATE TABLE IF NOT EXISTS derivations(parent TEXT NOT NULL,child TEXT NOT NULL,PRIMARY KEY(parent,child));'+
      'CREATE TABLE IF NOT EXISTS documents(path TEXT PRIMARY KEY,hash TEXT NOT NULL,card_id TEXT NOT NULL);'+
      'CREATE TABLE IF NOT EXISTS observation_keys(key TEXT PRIMARY KEY,card_id TEXT NOT NULL);'+
      'CREATE VIRTUAL TABLE IF NOT EXISTS card_fts USING fts5(id UNINDEXED,summary,body);'
    );
    const schema=this.getMeta('schema');
    if(schema && schema!=='1') {this.db.close();throw new Error('PALACE_SCHEMA_UNSUPPORTED');}
    this.setMeta('schema','1');
  }
  close(): void { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.db.close(); }
  atomic<T>(fn:()=>T):T {
    this.db.exec('BEGIN IMMEDIATE');
    try {const value=fn();this.db.exec('COMMIT');return value;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  getMeta(key:string):string {return String((this.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as Row|undefined)?.value??'');}
  setMeta(key:string,value:string):void {this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value);}
  get(id:string,version?:number):KnowledgeCard|undefined {
    const row=(version===undefined?this.db.prepare('SELECT json FROM cards WHERE id=?').get(id):
      this.db.prepare('SELECT json FROM versions WHERE id=? AND version=?').get(id,version)) as Row|undefined;
    if(!row)return undefined;
    const card=JSON.parse(String(row.json)) as KnowledgeCard;
    card.servingDeviceId=this.deviceId;
    return card;
  }
  kind(id:string):string {return String((this.db.prepare('SELECT kind FROM cards WHERE id=?').get(id) as Row|undefined)?.kind??'');}
  put(card:KnowledgeCard,kind='observation'):void {
    this.db.prepare('INSERT INTO versions(id,version,json) VALUES(?,?,?) ON CONFLICT(id,version) DO NOTHING')
      .run(card.id,card.version,JSON.stringify(card));
    this.db.prepare('INSERT INTO cards(id,version,status,kind,project_id,visibility,summary,body,json) VALUES(?,?,?,?,?,?,?,?,?) '+
      'ON CONFLICT(id) DO UPDATE SET version=excluded.version,status=excluded.status,kind=excluded.kind,project_id=excluded.project_id,'+
      'visibility=excluded.visibility,summary=excluded.summary,body=excluded.body,json=excluded.json')
      .run(card.id,card.version,card.status,kind,card.scope.projectId??null,card.scope.visibility,card.summary,card.body,JSON.stringify(card));
    this.db.prepare('DELETE FROM card_fts WHERE id=?').run(card.id);
    this.db.prepare('INSERT INTO card_fts(id,summary,body) VALUES(?,?,?)').run(card.id,card.summary,card.body);
    this.db.prepare('DELETE FROM card_evidence WHERE card_id=?').run(card.id);
    for(const evidence of card.evidence)this.db.prepare('INSERT OR IGNORE INTO card_evidence(card_id,evidence_id) VALUES(?,?)').run(card.id,evidence.id);
    this.db.prepare('DELETE FROM derivations WHERE child=?').run(card.id);
    for(const parent of card.derivedFrom) {
      if(parent===card.id)throw new Error('DERIVATION_CYCLE');
      this.db.prepare('INSERT OR IGNORE INTO derivations(parent,child) VALUES(?,?)').run(parent,card.id);
    }
  }
  saveEvidence(location:EvidenceLocation):void {
    const old=this.evidence(location.evidence.id);
    if(old && old.evidence.recordHash!==location.evidence.recordHash)throw new Error('EVIDENCE_ID_CONFLICT');
    if(old && old.type!=='remote' && location.type==='remote')return;
    this.db.prepare('INSERT INTO evidence(id,json) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json')
      .run(location.evidence.id,JSON.stringify(location));
  }
  evidence(id:string):EvidenceLocation|undefined {
    const row=this.db.prepare('SELECT json FROM evidence WHERE id=?').get(id) as Row|undefined;
    return row?JSON.parse(String(row.json)) as EvidenceLocation:undefined;
  }
  evidenceCards(id:string):string[] {return (this.db.prepare('SELECT card_id FROM card_evidence WHERE evidence_id=?').all(id) as Row[]).map(x=>String(x.card_id));}
  locations(cursor='',limit=64):{items:EvidenceLocation[];cursor:string|null} {
    const rows=this.db.prepare('SELECT id,json FROM evidence WHERE id>? ORDER BY id LIMIT ?').all(cursor,limit+1) as Row[];
    return {items:rows.slice(0,limit).map(x=>JSON.parse(String(x.json))),cursor:rows.length>limit?String(rows[limit-1].id):null};
  }
  similar(key:string):KnowledgeCard|undefined {
    const row=this.db.prepare('SELECT card_id FROM observation_keys WHERE key=?').get(key) as Row|undefined;
    return row?this.get(String(row.card_id)):undefined;
  }
  rememberSimilarity(key:string,cardId:string):void {
    this.db.prepare('INSERT INTO observation_keys(key,card_id) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET card_id=excluded.card_id').run(key,cardId);
  }
  document(path:string):{hash:string;cardId:string}|undefined {
    const row=this.db.prepare('SELECT hash,card_id FROM documents WHERE path=?').get(path) as Row|undefined;
    return row?{hash:String(row.hash),cardId:String(row.card_id)}:undefined;
  }
  setDocument(path:string,hash:string,cardId:string):void {
    this.db.prepare('INSERT INTO documents(path,hash,card_id) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET hash=excluded.hash,card_id=excluded.card_id')
      .run(path,hash,cardId);
  }
  nextVersion(old:KnowledgeCard,changes:Partial<KnowledgeCard>):KnowledgeCard {
    const card={...old,...changes,version:old.version+1,updatedAt:Date.now(),servingDeviceId:this.deviceId};
    card.contentHash=cardHash(card);return card;
  }
  /** Caller wraps this plus the correction itself in a single transaction. */
  invalidateDependents(id:string,status:KnowledgeStatus='withdrawn'):string[] {
    const queue=[id],seen=new Set<string>([id]),affected:string[]=[];
    for(let at=0;at<queue.length;at++){
      if(queue.length>10000)throw new Error('DERIVATION_BUDGET_EXCEEDED');
      const rows=this.db.prepare('SELECT child FROM derivations WHERE parent=?').all(queue[at]) as Row[];
      for(const row of rows){
        const child=String(row.child);if(seen.has(child))continue;
        seen.add(child);queue.push(child);
        const card=this.get(child);if(!card)continue;
        if(card.status!==status)this.put(this.nextVersion(card,{status,lastVerifiedAt:null}),this.kind(child));
        affected.push(child);
      }
    }
    return affected;
  }
  markUnavailable(evidenceId:string):string[] {
    return this.atomic(()=>{
      const loc=this.evidence(evidenceId);if(!loc||!loc.evidence.sourceAvailable)return [];
      loc.evidence.sourceAvailable=false;this.saveEvidence(loc);const ids=this.evidenceCards(evidenceId),affected:string[]=[];
      for(const id of ids) {
        const card=this.get(id);if(!card||card.originDeviceId!==this.deviceId)continue;
        if(!['stale','superseded','withdrawn'].includes(card.status)){
          const evidence=card.evidence.map(e=>e.id===evidenceId?{...e,sourceAvailable:false}:e);
          this.put(this.nextVersion(card,{status:'stale',evidence,lastVerifiedAt:null}),this.kind(id));
          affected.push(id,...this.invalidateDependents(id));
        }
      }
      return [...new Set(affected)];
    });
  }
  query(input:{query?:string;projectId?:string;includeInactive?:boolean;kind?:string;status?:string;limit:number;cursor?:string;visibility?:string}):KnowledgeCard[] {
    const tokens=queryTerms(input.query??'');
    if(tokens.length>24)throw new Error('QUERY_TOO_LARGE');
    const args:(string|number)[]=[];
    let sql='SELECT c.json FROM cards c ';
    if(tokens.length) {
      sql+='JOIN card_fts ON card_fts.id=c.id WHERE card_fts MATCH ?';
      args.push(tokens.map(x=>'"'+x.replace(/"/g,'""')+'"').join(' OR '));
    } else sql+='WHERE 1=1';
    if(!input.includeInactive)sql+=" AND c.status NOT IN ('stale','superseded','withdrawn')";
    if(input.projectId) {sql+=" AND (c.project_id=? OR c.visibility='account')";args.push(input.projectId);}
    else sql+=" AND c.visibility<>'project'";
    if(input.visibility) {sql+=' AND c.visibility=?';args.push(input.visibility);}
    if(input.kind){sql+=' AND c.kind=?';args.push(input.kind);}
    if(input.status){sql+=' AND c.status=?';args.push(input.status);}
    if(input.cursor){sql+=' AND c.id>?';args.push(input.cursor);}
    sql+=tokens.length?" ORDER BY CASE c.status WHEN 'validated' THEN 0 WHEN 'observed' THEN 1 ELSE 2 END, bm25(card_fts),c.id":" ORDER BY c.id";
    sql+=' LIMIT ?';args.push(input.limit);
    return (this.db.prepare(sql).all(...args) as Row[]).map(row=>{const card=JSON.parse(String(row.json)) as KnowledgeCard;card.servingDeviceId=this.deviceId;return card;});
  }
  count():number {return Number((this.db.prepare('SELECT count(*) n FROM cards').get() as Row).n);}
  importCard(incoming:KnowledgeCard):{imported:boolean;deduplicated:boolean;card:KnowledgeCard} {
    const existing=this.get(incoming.id);
    if(existing && existing.originDeviceId!==incoming.originDeviceId)throw new Error('KNOWLEDGE_ORIGIN_CONFLICT');
    if(existing && incoming.version<existing.version)return {imported:false,deduplicated:true,card:existing};
    if(existing && incoming.version===existing.version) {
      if(existing.contentHash!==incoming.contentHash)throw new Error('KNOWLEDGE_VERSION_CONFLICT');
      return {imported:false,deduplicated:true,card:existing};
    }
    return this.atomic(()=>{
      const card={...incoming,servingDeviceId:this.deviceId,provenance:[...new Set([...incoming.provenance,this.deviceId])]};
      for(const evidence of card.evidence)this.saveEvidence({evidence,type:'remote'});
      this.put(card,existing?this.kind(existing.id):'imported');
      if(existing && existing.contentHash!==card.contentHash)this.invalidateDependents(card.id);
      return {imported:true,deduplicated:false,card};
    });
  }
  stat(id:string):Record<string,unknown> {
    const card=this.get(id);if(!card)throw new Error('KNOWLEDGE_NOT_FOUND');
    return {...preview(card),derivedCount:(this.db.prepare('SELECT count(*) n FROM derivations WHERE parent=?').get(id) as Row).n};
  }
}
