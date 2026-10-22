import { mkdirSync, readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { basename, join, resolve, relative, sep, isAbsolute } from 'node:path';
import { rankCandidates } from './retrieval.js';
import { LogPalace } from '../../log-palace/store.js';
import type { KnowledgeCard, KnowledgeEvidence, KnowledgePreview, PalaceOptions, PalaceProvider, InvokeContext, KnowledgeScope } from './types.js';
import { PalaceStore, type EvidenceLocation } from './store.js';
import { SourceCatalog, extractDocument, extractObservation, gitSnapshot, readDocument } from './sources.js';
import { abort, assertLive, boundedInt, canonical, cardHash, clip, hash, object, preview, scopeOf, text } from './util.js';
export type * from './types.js';
export { cardHash } from './util.js';

export const PALACE_CAPABILITIES = ['knowledge.search','knowledge.list','knowledge.read','knowledge.stat','knowledge.import',
  'knowledge.ingest','knowledge.correct','knowledge.learn','knowledge.skills'] as const;
type Input = Record<string,unknown>;
type SourceObservation = Record<string,unknown>;

class Provider implements PalaceProvider {
  private store?:PalaceStore;
  private logs?:LogPalace;
  private timer?:ReturnType<typeof setInterval>;
  private tail:Promise<unknown>=Promise.resolve();
  private catalog:SourceCatalog;
  private stopping=false;
  private readonly indexBudget:Input;
  private readonly indexInterval:number;
  constructor(private readonly options:PalaceOptions) {
    if(!options.deviceId||options.deviceId.length>256)throw new Error('DEVICE_ID_REQUIRED');
    this.catalog=new SourceCatalog(options);
    this.indexBudget=object(options.indexBudget??{});this.indexInterval=boundedInt(this.indexBudget.intervalMs,30000,1000,3600000);
  }
  async start():Promise<void> {
    if(this.store)return;
    this.stopping=false;mkdirSync(this.options.dataRoot,{recursive:true});
    this.store=new PalaceStore(this.options.dataRoot,this.options.deviceId);
    try {this.logs=new LogPalace(join(this.options.dataRoot,'source-index'));}
    catch(error){this.store.close();this.store=undefined;throw error;}
    for(const path of this.catalog.logRoots()) {
      if(/\.(md|markdown)$/i.test(path))continue;
      try {this.logs.add(path);}catch(error){this.store.setMeta('lastDiscoveryError',String(error).slice(0,512));}
    }
    if(this.options.autoIndex!==false) {
      try {await this.invoke('knowledge.ingest',this.indexBudget);}catch(error){this.store.setMeta('lastIndexError',String(error).slice(0,512));}
      this.timer=setInterval(()=>{void this.invoke('knowledge.ingest',this.indexBudget).catch(error=>{
        if(this.store)this.store.setMeta('lastIndexError',String(error).slice(0,512));
      });},this.indexInterval);
      this.timer.unref();
    }
  }
  async stop():Promise<void> {
    this.stopping=true;if(this.timer)clearInterval(this.timer);this.timer=undefined;
    await this.tail.catch(()=>{});
    this.logs?.close();this.logs=undefined;this.store?.close();this.store=undefined;
  }
  invoke(capability:string,input:unknown,context:InvokeContext={}):Promise<unknown> {
    if(this.stopping||!this.store||!this.logs)return Promise.reject(new Error('PLUGIN_NOT_STARTED'));
    const args=object(input);
    if(Buffer.byteLength(JSON.stringify(args),'utf8')>256*1024)return Promise.reject(new Error('INPUT_TOO_LARGE'));
    const job=this.tail.then(async()=>{abort(context.signal);return this.dispatch(capability,args,context);});
    this.tail=job.catch(()=>{});return job;
  }
  private get db():PalaceStore {if(!this.store)throw new Error('PLUGIN_NOT_STARTED');return this.store;}
  private get p1():LogPalace {if(!this.logs)throw new Error('PLUGIN_NOT_STARTED');return this.logs;}
  private id(input:Input):string {
    const ref=text(input.ref??input.id,512);if(!ref)throw new Error('KNOWLEDGE_REF_REQUIRED');return ref;
  }
  private card(id:string):KnowledgeCard {const card=this.db.get(id);if(!card)throw new Error('KNOWLEDGE_NOT_FOUND');return card;}
  private newCard(id:string,summary:string,body:string,status:KnowledgeCard['status'],scope:KnowledgeScope,
    evidence:KnowledgeEvidence[],derivedFrom:string[]=[]):KnowledgeCard {
    const now=Date.now(),card:KnowledgeCard={id,version:1,contentHash:'',summary:clip(summary,256),body:clip(body,16384),status,
      originDeviceId:this.options.deviceId,servingDeviceId:this.options.deviceId,scope,evidence,
      derivedFrom:[...new Set(derivedFrom)],provenance:[this.options.deviceId],updatedAt:now,lastVerifiedAt:now};
    card.contentHash=cardHash(card);return card;
  }
  private managedEvidence(value:unknown,kind:KnowledgeEvidence['kind']):KnowledgeEvidence {
    const bytes=Buffer.from(canonical(value)+'\n'),recordHash=hash(bytes);
    if(bytes.length>128*1024)throw new Error('EVIDENCE_TOO_LARGE');
    const relativePath=join('evidence',recordHash+'.json'),path=join(this.options.dataRoot,relativePath);
    mkdirSync(join(this.options.dataRoot,'evidence'),{recursive:true});
    if(!existsSync(path)){const tmp=path+'.tmp';writeFileSync(tmp,bytes);renameSync(tmp,path);}
    const evidence:KnowledgeEvidence={id:'ev:'+hash(this.options.deviceId+':managed:'+recordHash),
      originDeviceId:this.options.deviceId,sourceId:'managed:'+recordHash,sourceRef:'managed:'+recordHash,recordHash,
      kind,sourceAvailable:true,observedAt:Date.now()};
    this.db.saveEvidence({evidence,type:'managed',path:relativePath,bytes:bytes.length});return evidence;
  }
  private evidenceRead(location:EvidenceLocation,maxBytes=4096):Record<string,unknown> {
    if(location.type==='remote')return {id:location.evidence.id,available:false,reason:'REMOTE_EVIDENCE_REFERENCE',
      originDeviceId:location.evidence.originDeviceId,sourceRef:location.evidence.sourceRef};
    if(location.type==='p1'){
      const read=this.p1.read(location.sourceRef??location.evidence.sourceRef,Math.min(65536,Math.max(128,maxBytes)));
      return {id:location.evidence.id,available:true,verifiedBytes:true,recordHash:location.evidence.recordHash,...read};
    }
    const path=location.type==='managed'?resolve(this.options.dataRoot,location.path??''):location.path??'';
    if(location.type==='managed'){
      const rel=relative(resolve(this.options.dataRoot),path);
      if(rel.startsWith('..'+sep)||rel==='..')throw new Error('EVIDENCE_PATH_INVALID');
    }
    const bytes=readFileSync(path);if(bytes.length>256*1024)throw new Error('EVIDENCE_TOO_LARGE');
    if(hash(bytes)!==location.evidence.recordHash)throw new Error('SOURCE_CHANGED');
    const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    return {id:location.evidence.id,available:true,verifiedBytes:true,recordHash:location.evidence.recordHash,
      text:clip(decoded,maxBytes),truncated:bytes.length>maxBytes};
  }
  private refresh(card:KnowledgeCard):KnowledgeCard {
    for(const evidence of card.evidence){
      const location=this.db.evidence(evidence.id);if(!location||location.type==='remote')continue;
      try {this.evidenceRead(location,128);}
      catch {this.db.markUnavailable(evidence.id);}
    }
    return this.card(card.id);
  }
  private checkScope(card:KnowledgeCard,input:Input):void {
    const projectId=text(input.projectId,512);
    if(projectId && card.scope.visibility==='project' && card.scope.projectId!==projectId)throw new Error('KNOWLEDGE_SCOPE_MISMATCH');
  }
  private async dispatch(capability:string,input:Input,context:InvokeContext):Promise<unknown> {
    switch(capability){
      case 'knowledge.search':return this.search(input,false);
      case 'knowledge.list':return this.search(input,true);
      case 'knowledge.stat':{let card=this.card(this.id(input));this.checkScope(card,input);card=this.refresh(card);return this.db.stat(card.id);}
      case 'knowledge.read':return this.read(input);
      case 'knowledge.import':return this.import(input);
      case 'knowledge.ingest':return this.ingest(input,context.signal);
      case 'knowledge.correct':return this.correct(input);
      case 'knowledge.learn':return this.learn(input,context.signal);
      case 'knowledge.skills':return this.skills(input,context.signal);
      default:throw new Error('CAPABILITY_UNAVAILABLE');
    }
  }
  private search(input:Input,list:boolean):unknown {
    const query=list?'':text(input.query,2048);
    if(!list&&!query.trim())throw new Error('QUERY_REQUIRED');
    const limit=boundedInt(input.limit,8,1,50),maxBytes=boundedInt(input.maxBytes,8192,512,65536);
    let rows=this.db.query({query,projectId:text(input.projectId,512)||undefined,
      includeInactive:input.includeInactive===true,kind:text(input.kind,64)||undefined,status:text(input.status,64)||undefined,limit:list?limit+1:Math.min(200,Math.max(40,limit*8)),
      cursor:list?text(input.cursor,512)||undefined:undefined});
    if(!list)rows=rankCandidates(rows,query,limit+1);
    const items:KnowledgePreview[]=[];
    let truncated=rows.length>limit;
    for(const card of rows.slice(0,limit)){
      const item=preview(card),proposal={items:[...items,item],total:rows.length,truncated,nextCursor:list?card.id:null};
      if(Buffer.byteLength(JSON.stringify(proposal),'utf8')>maxBytes){truncated=true;break;}
      items.push(item);
    }
    const response={items,total:rows.length,truncated,nextCursor:list&&truncated&&items.length?items[items.length-1].id:null};
    if(Buffer.byteLength(JSON.stringify(response),'utf8')>maxBytes)throw new Error('BUDGET_TOO_SMALL');
    return response;
  }
  private read(input:Input):unknown {
    const maxBytes=boundedInt(input.maxBytes,65536,1024,256*1024);
    let card=this.card(this.id(input));this.checkScope(card,input);card=this.refresh(card);
    const response:{card:KnowledgeCard;evidence?:Record<string,unknown>[]}={card};
    if(Buffer.byteLength(JSON.stringify(response),'utf8')>maxBytes)throw new Error('BUDGET_TOO_SMALL');
    if(input.evidence===true){
      response.evidence=[];
      for(const evidence of card.evidence.slice(0,32)){
        const location=this.db.evidence(evidence.id);
        let item:Record<string,unknown>;
        try {item=location?this.evidenceRead(location,Math.min(4096,maxBytes)): {id:evidence.id,available:false,reason:'REMOTE_EVIDENCE_REFERENCE'};}
        catch(error){item={id:evidence.id,available:false,reason:String(error).slice(0,160)};}
        const candidate={...response,evidence:[...response.evidence,item]};
        if(Buffer.byteLength(JSON.stringify(candidate),'utf8')>maxBytes)break;
        response.evidence.push(item);
      }
    }
    return response;
  }
  private import(input:Input):unknown {
    const raw=object(input.card);
    if(Buffer.byteLength(JSON.stringify(raw),'utf8')>65536)throw new Error('CARD_TOO_LARGE');
    const id=text(raw.id,256),origin=text(raw.originDeviceId,256);
    if(!id||!origin||!Number.isSafeInteger(raw.version)||Number(raw.version)<1)throw new Error('INVALID_CARD');
    const evidence=raw.evidence;
    if(!Array.isArray(evidence)||!evidence.length||evidence.length>32)throw new Error('INVALID_EVIDENCE');
    const ids=new Set<string>();
    for(const value of evidence){
      const e=object(value);
      if(!text(e.id,256)||!text(e.originDeviceId,256)||!text(e.sourceId,512)||!text(e.sourceRef,512)||
        !/^[a-f0-9]{64}$/.test(text(e.recordHash,64))||!['source_trace','tool_receipt','postcondition'].includes(String(e.kind)))
        throw new Error('INVALID_EVIDENCE');
      if(typeof e.sourceAvailable!=='boolean'||!Number.isFinite(e.observedAt))throw new Error('INVALID_EVIDENCE');
      if(ids.has(String(e.id)))throw new Error('DUPLICATE_EVIDENCE');ids.add(String(e.id));
    }
    if(!Array.isArray(raw.derivedFrom)||raw.derivedFrom.length>32||raw.derivedFrom.some(x=>typeof x!=='string'||x.length>256))
      throw new Error('INVALID_DERIVATION');
    if(!Array.isArray(raw.provenance)||raw.provenance.length>64||raw.provenance.some(x=>typeof x!=='string'||x.length>256))
      throw new Error('INVALID_PROVENANCE');
    if(!['hypothesis','observed','validated','stale','superseded','withdrawn'].includes(String(raw.status)))throw new Error('INVALID_STATUS');
    if(!Number.isFinite(raw.updatedAt)||Number(raw.updatedAt)<0||
      !(raw.lastVerifiedAt===null||Number.isFinite(raw.lastVerifiedAt)))throw new Error('INVALID_CARD_TIME');
    const card={...raw,id,originDeviceId:origin,summary:text(raw.summary,256),body:text(raw.body,32768),
      scope:scopeOf(raw.scope),servingDeviceId:this.options.deviceId} as unknown as KnowledgeCard;
    if(!card.summary||cardHash(card)!==card.contentHash)throw new Error('CARD_HASH_MISMATCH');
    if(card.scope.visibility==='local'&&origin!==this.options.deviceId)throw new Error('LOCAL_ONLY_KNOWLEDGE');
    const existing=this.db.get(id);
    if(origin===this.options.deviceId&&(!existing||card.version>existing.version))throw new Error('ORIGIN_WRITE_FORBIDDEN');
    return this.db.importCard(card);
  }
  private async ingest(input:Input,signal?:AbortSignal):Promise<unknown> {
    const maxRecords=boundedInt(input.maxRecords,64,1,256),maxBytes=boundedInt(input.maxBytes,2*1024*1024,1024,16*1024*1024);
    const maxFiles=boundedInt(input.maxFiles,32,1,128);abort(signal);
    for(const path of this.catalog.logRoots())if(!/\.(md|markdown)$/i.test(path))try{this.p1.add(path);}catch{}
    const index=this.p1.index({maxFiles,maxBytes});
    let remaining=maxBytes,created=0,skipped=0;
    const page=this.p1.observations({cursor:this.db.getMeta('observationCursor')||undefined,limit:maxRecords,maxBytes:1024*1024});
    for(const row of page.items as SourceObservation[]){
      abort(signal);
      const ref=String(row.ref),recordBytes=Number(row.bytes),sourcePath=String(row.source_path);
      const evidenceId='ev:'+hash(this.options.deviceId+':p1:'+ref+':'+String(row.hash));
      if(!row.source_available){this.db.markUnavailable(evidenceId);skipped++;continue;}
      if(recordBytes>remaining){skipped++;continue;}
      remaining-=recordBytes;
      const id='k:'+hash(this.options.deviceId+':observation:'+evidenceId);
      const existing=this.db.get(id);if(existing&&existing.status!=='stale'){skipped++;continue;}
      try{
        const read=this.p1.read(ref,8192);
        const extracted=extractObservation(read.text,String(row.kind),String(row.tool??''));
        if(!extracted){skipped++;continue;}
        const evidence:KnowledgeEvidence={id:evidenceId,originDeviceId:this.options.deviceId,sourceId:'source:'+hash(sourcePath),
          sourceRef:ref,recordHash:String(row.hash),kind:'source_trace',sourceAvailable:true,observedAt:Date.now()};
        const scope=this.catalog.scope(typeof row.file_path==='string'&&isAbsolute(row.file_path)?row.file_path:sourcePath);
        const normalized=(body:string)=>body.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
        const similarityKey=hash(canonical({scope,status:extracted.status,body:normalized(extracted.body)}));
        const similar=this.db.similar(similarityKey);
        if(similar&&(similar.status==='withdrawn'||similar.status==='superseded'||normalized(similar.body)!==normalized(extracted.body))){skipped++;continue;}
        if(similar&&similar.evidence.some(e=>e.id===evidence.id&&e.sourceAvailable)&&similar.status!=='stale'){skipped++;continue;}
        if(similar&&similar.evidence.length>=32){skipped++;continue;}
        const saved=this.db.atomic(()=>{
          this.db.saveEvidence({evidence,type:'p1',sourceRef:ref,bytes:recordBytes});
          const base=similar??existing;
          const allEvidence=[...(base?.evidence??[]).filter(e=>e.sourceAvailable&&e.id!==evidence.id),evidence];
          const fresh=this.newCard(base?.id??id,extracted.summary,extracted.body,extracted.status,scope,allEvidence);
          const card=base?this.db.nextVersion(base,{status:fresh.status,evidence:allEvidence,lastVerifiedAt:Date.now()}):fresh;
          this.db.put(card);this.db.rememberSimilarity(similarityKey,card.id);return card;
        });created++;
        if(saved.evidence.length>=2){
          const fix=saved.body.match(/(?:fix|solution|resolved by)\s*:\s*([^\n]{8,1024})/i)?.[1];
          if(fix)await this.learn({key:'automatic:'+saved.id,summary:clip('Procedure candidate: '+fix,256),steps:[fix],evidenceRefs:[saved.id]},signal);
        }
      }catch{skipped++;}
    }
    this.db.setMeta('observationCursor',page.nextCursor??'');
    for(const source of this.catalog.documents(Math.min(32,maxFiles))){
      abort(signal);
      try{
        const data=readDocument(source.path);if(data.bytes.length>remaining)continue;remaining-=data.bytes.length;
        const old=this.db.document(source.path);if(old?.hash===data.hash)continue;
        const extracted=extractDocument(data.text),id=old?.cardId??'k:'+hash(this.options.deviceId+':document:'+source.path);
        const evidence:KnowledgeEvidence={id:'ev:'+hash(this.options.deviceId+':file:'+source.path+':'+data.hash),
          originDeviceId:this.options.deviceId,sourceId:'source:'+hash(source.path),sourceRef:'file:'+hash(source.path)+':'+data.hash,
          recordHash:data.hash,kind:'source_trace',sourceAvailable:true,observedAt:Date.now()};
        this.db.atomic(()=>{
          this.db.saveEvidence({evidence,type:'file',path:source.path,bytes:data.bytes.length});
          const current=this.db.get(id),fresh=this.newCard(id,extracted.summary,extracted.body,'observed',source.scope,[evidence]);
          const card=current?this.db.nextVersion(current,{summary:fresh.summary,body:fresh.body,evidence:[evidence],status:'observed',lastVerifiedAt:Date.now()}):fresh;
          this.db.put(card,source.kind);
          if(current)this.db.invalidateDependents(id);
          this.db.setDocument(source.path,data.hash,id);
        });created++;
      }catch{skipped++;}
    }
    for(const root of this.catalog.projects.slice(0,4)){
      abort(signal);const snapshot=await gitSnapshot(root);if(!snapshot||Buffer.byteLength(snapshot)>remaining)continue;
      remaining-=Buffer.byteLength(snapshot);
      const key='git:'+hash(root),revision=hash(snapshot);
      if(this.db.getMeta(key)===revision)continue;
      const evidence=this.managedEvidence({type:'git-history',project:root,output:snapshot},'source_trace');
      const id='k:'+hash(this.options.deviceId+':'+key),old=this.db.get(id);
      const fresh=this.newCard(id,'Recent Git history: '+basename(root),snapshot,'observed',this.catalog.scope(root),[evidence]);
      this.db.atomic(()=>{
        this.db.put(old?this.db.nextVersion(old,{summary:fresh.summary,body:fresh.body,evidence:[evidence],status:'observed'}):fresh,'project');
        if(old)this.db.invalidateDependents(id);
        this.db.setMeta(key,revision);
      });created++;
    }
    const verify=this.db.locations(this.db.getMeta('verificationCursor'),Math.min(64,maxRecords));
    let invalidated=0;
    for(const location of verify.items){
      abort(signal);if(location.type==='remote'||!location.evidence.sourceAvailable)continue;
      try {this.evidenceRead(location,128);}catch{invalidated+=this.db.markUnavailable(location.evidence.id).length;}
    }
    this.db.setMeta('verificationCursor',verify.cursor??'');
    return {indexed:index,created,skipped,invalidated,cards:this.db.count(),cursor:page.nextCursor,complete:page.complete,
      projects:this.catalog.projects.map(path=>({path,scope:this.catalog.scope(path)})),modelCalls:0};
  }
  private correct(input:Input):unknown {
    const old=this.card(this.id(input));
    if(old.originDeviceId!==this.options.deviceId)throw new Error('ORIGIN_CORRECTION_REQUIRED');
    const body=text(input.body??input.correctedText,16384),summary=text(input.summary,256)||clip(body,256),reason=text(input.reason,1024);
    if(!body.trim()||!reason.trim())throw new Error('CORRECTION_AND_REASON_REQUIRED');
    const evidence=this.managedEvidence({type:'correction',ref:old.id,version:old.version,reason,body,at:Date.now()},'source_trace');
    return this.db.atomic(()=>{
      const card=this.db.nextVersion(old,{summary,body,status:'hypothesis',evidence:[evidence],lastVerifiedAt:Date.now()});
      this.db.put(card,this.db.kind(old.id));
      const invalidated=this.db.invalidateDependents(old.id);
      return {card,invalidated};
    });
  }
  private parents(input:Input):{cards:KnowledgeCard[];evidence:KnowledgeEvidence[]} {
    const refs=input.evidenceRefs??input.evidence;
    if(!Array.isArray(refs)||!refs.length||refs.length>32||refs.some(x=>typeof x!=='string'))throw new Error('EVIDENCE_REQUIRED');
    const cards=new Map<string,KnowledgeCard>(),evidence=new Map<string,KnowledgeEvidence>();
    for(const ref of refs as string[]){
      let card=this.db.get(ref);
      if(card){card=this.refresh(card);assertLive(card);cards.set(card.id,card);for(const e of card.evidence)evidence.set(e.id,e);continue;}
      const loc=this.db.evidence(ref);if(!loc)throw new Error('EVIDENCE_NOT_FOUND');
      if(!loc.evidence.sourceAvailable)throw new Error('EVIDENCE_NOT_CURRENT');
      this.evidenceRead(loc,128);
      for(const cardId of this.db.evidenceCards(ref)){
        const parent=this.refresh(this.card(cardId));assertLive(parent);cards.set(cardId,parent);
      }
      evidence.set(ref,loc.evidence);
    }
    if(!cards.size||evidence.size>32)throw new Error('EVIDENCE_REQUIRED');
    return {cards:[...cards.values()],evidence:[...evidence.values()]};
  }
  private async activate(card:KnowledgeCard,signal?:AbortSignal):Promise<{card:KnowledgeCard;activated:boolean;reason:string}> {
    if(!this.options.validationRunner)return {card,activated:false,reason:'VALIDATION_POLICY_NOT_CONFIGURED'};
    abort(signal);
    const receipt=await this.options.validationRunner(JSON.parse(JSON.stringify(card)) as KnowledgeCard,signal);
    abort(signal);
    if(!receipt||!text(receipt.executionId,256)||!text(receipt.validatorVersion,256)||!Number.isSafeInteger(receipt.exitCode)||
      typeof receipt.postconditionPassed!=='boolean')throw new Error('INVALID_VALIDATOR_RECEIPT');
    const evidence=this.managedEvidence({type:'validation',cardId:card.id,revision:card.contentHash,...receipt,at:Date.now()},'postcondition');
    if(receipt.exitCode!==0||!receipt.postconditionPassed)return {card,activated:false,reason:'VALIDATION_FAILED'};
    for(const parent of card.derivedFrom)assertLive(this.refresh(this.card(parent)));
    const next=this.db.nextVersion(card,{status:'validated',evidence:[...card.evidence,evidence],lastVerifiedAt:Date.now()});
    if(next.evidence.length>32)throw new Error('EVIDENCE_BUDGET_EXCEEDED');
    this.db.atomic(()=>this.db.put(next,'procedure'));
    return {card:next,activated:true,reason:'EXECUTED_VALIDATION_PASSED'};
  }
  private async learn(input:Input,signal?:AbortSignal):Promise<unknown> {
    const parents=this.parents(input),scope=input.scope===undefined?parents.cards[0].scope:scopeOf(input.scope);
    for(const parent of parents.cards)if(parent.scope.visibility==='project'&&
      (scope.visibility!=='project'||scope.projectId!==parent.scope.projectId))throw new Error('SCOPE_WIDENING_REQUIRES_SEPARATE_EVIDENCE');
    const steps=input.steps;
    if(!Array.isArray(steps)||!steps.length||steps.length>20||steps.some(x=>typeof x!=='string'||Buffer.byteLength(x)>1024))
      throw new Error('PROCEDURE_STEPS_REQUIRED');
    const summary=text(input.summary??input.title,256);if(!summary)throw new Error('SUMMARY_REQUIRED');
    const body=(steps as string[]).map((step,i)=>(i+1)+'. '+step).join('\n');
    const key=text(input.key,256)||hash(canonical({body,scope})),id='k:'+hash(this.options.deviceId+':procedure:'+key);
    const old=this.db.get(id);
    let card=this.newCard(id,summary,body,'hypothesis',scope,parents.evidence,parents.cards.map(c=>c.id));
    if(old) {
      const equivalent=old.body===body&&canonical(old.scope)===canonical(scope)&&
        canonical(old.evidence.filter(e=>e.kind!=='postcondition').map(e=>e.id).sort())===canonical(parents.evidence.map(e=>e.id).sort());
      if(equivalent&&old.status==='validated')return {card:old,activated:true,deduplicated:true,reason:'EXISTING_VALIDATION'};
      card=this.db.nextVersion(old,{summary,body,status:'hypothesis',scope,evidence:parents.evidence,derivedFrom:parents.cards.map(c=>c.id)});
    }
    this.db.atomic(()=>{this.db.put(card,'procedure');if(old)this.db.invalidateDependents(id);});
    if(input.autoActivate===false)return {card,activated:false,reason:'CANDIDATE_ONLY'};
    return this.activate(card,signal);
  }
  private async skills(input:Input,signal?:AbortSignal):Promise<unknown> {
    const action=text(input.action,64)||'list';
    if(action==='read'){
      const card=this.refresh(this.card(this.id(input)));this.checkScope(card,input);
      if(this.db.kind(card.id)!=='procedure')throw new Error('SKILL_NOT_FOUND');
      if(card.status!=='validated'&&input.includeCandidates!==true)throw new Error('SKILL_NOT_ACTIVE');
      const response={card,body:card.body,active:card.status==='validated'};
      if(Buffer.byteLength(JSON.stringify(response),'utf8')>boundedInt(input.maxBytes,65536,1024,65536))throw new Error('BUDGET_TOO_SMALL');
      return response;
    }
    if(action==='rollback'){
      const id=this.id(input),old=this.db.get(id,boundedInt(input.version,0,1,Number.MAX_SAFE_INTEGER));
      if(!old||this.db.kind(id)!=='procedure'||old.status!=='validated')throw new Error('VALIDATED_REVISION_REQUIRED');
      const currentEvidence=new Set<string>();
      for(const parent of old.derivedFrom){const current=this.refresh(this.card(parent));assertLive(current);for(const e of current.evidence)currentEvidence.add(e.id);}
      if(old.evidence.some(e=>e.kind!=='postcondition'&&!currentEvidence.has(e.id)))throw new Error('CORRECTED_EVIDENCE_CANNOT_ROLLBACK');
      if(!this.options.validationRunner)throw new Error('VALIDATION_POLICY_NOT_CONFIGURED');
      const current=this.card(id),candidate=this.db.nextVersion(current,{...old,status:'hypothesis',version:current.version+1,
        evidence:old.evidence.filter(e=>e.kind!=='postcondition')});
      this.db.atomic(()=>this.db.put(candidate,'procedure'));
      return this.activate(candidate,signal);
    }
    if(action!=='list')throw new Error('SKILL_ACTION_UNSUPPORTED');
    const maxBytes=boundedInt(input.maxBytes,8192,512,65536);
    const response={...(this.search({...input,kind:'procedure',status:input.includeCandidates===true?undefined:'validated',
      includeInactive:input.includeCandidates===true},true) as {items:KnowledgePreview[];truncated:boolean;nextCursor:string|null}),
      activationPolicy:this.options.validationRunner?'configured':'candidate_only'};
    while(Buffer.byteLength(JSON.stringify(response),'utf8')>maxBytes&&response.items.length){
      response.items.pop();response.truncated=true;response.nextCursor=response.items.length?response.items[response.items.length-1].id:null;
    }
    if(Buffer.byteLength(JSON.stringify(response),'utf8')>maxBytes)throw new Error('BUDGET_TOO_SMALL');
    return response;
  }
}
export function createPalaceProvider(options:PalaceOptions):PalaceProvider {return new Provider(options);}
