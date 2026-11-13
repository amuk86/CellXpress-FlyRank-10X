import { HttpError } from './errors.js';
const fields = ['customerName','deviceModel','fee','faultDescription'];
export const EXTRACTION_SCHEMA = {
  type:'object', additionalProperties:false,
  properties: {
    customerName:{type:['string','null']}, deviceModel:{type:['string','null']}, fee:{type:['number','null']}, faultDescription:{type:['string','null']},
    confidence:{type:'object',additionalProperties:false,properties:Object.fromEntries(fields.map(f=>[f,{type:'number',minimum:0,maximum:1}])),required:fields},
    evidence:{type:'object',additionalProperties:false,properties:Object.fromEntries(fields.map(f=>[f,{type:'string'}])),required:fields},
    conflicts:{type:'array',items:{type:'string'}},
  }, required:[...fields,'confidence','evidence','conflicts'],
};
export function validateExtraction(value) {
  const fail = () => { throw new HttpError(502, 'AI returned invalid or unsupported facts. Enter details manually or try again.'); };
  const obj = v => v && typeof v==='object' && !Array.isArray(v);
  if (!obj(value) || Object.keys(value).length !== 7 || !obj(value.confidence) || !obj(value.evidence) || !Array.isArray(value.conflicts) || value.conflicts.length>10) fail();
  for (const map of [value.confidence,value.evidence]) if (Object.keys(map).length!==4 || Object.keys(map).some(k=>!fields.includes(k))) fail();
  for (const key of fields) {
    const fact=value[key], score=value.confidence[key], evidence=value.evidence[key];
    if (typeof score!=='number' || !Number.isFinite(score) || score<0 || score>1 || typeof evidence!=='string' || evidence.length>500) fail();
    if (fact === null) { if(score!==0 || evidence!=='') fail(); continue; }
    if (key==='fee') { if(typeof fact!=='number'|| !Number.isFinite(fact)||fact<0||fact>1000000 || Math.abs(fact*100-Math.round(fact*100))>0.00001) fail(); }
    else if (typeof fact!=='string' || !fact.trim() || fact.length > (key==='faultDescription'?1000:key==='customerName'?100:120) || /[\x00-\x1f]/.test(fact)) fail();
    if(!evidence.trim()) fail();
  }
  if(value.conflicts.some(c=>typeof c!=='string'||!c.trim()||c.length>500)) fail();
  const warnings = ['AI draft only: check every field against the source before saving.'];
  for (const field of fields) {
    if (value[field]===null) warnings.push(`Missing: ${field}. Enter it manually.`);
    else if(value.confidence[field]<0.6) warnings.push(`Low confidence: ${field}. Verify this value.`);
  }
  warnings.push(...value.conflicts.map(c=>`Conflict: ${c}`));
  return {...value,warnings,reviewRequired:true};
}
const imageMimes=['image/jpeg','image/png','image/webp'];
const audioMimes=['audio/webm','audio/mp4','audio/mpeg','audio/wav','audio/ogg'];
export function validateMedia(input) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new HttpError(400,'Expected media input.');
  if(Object.keys(input).some(k=>!['imageBase64','imageMimeType','audioBase64','audioMimeType'].includes(k))) throw new HttpError(400,'Unsupported media fields.');
  const parts=[];let size=0;
  for(const [kind,mimes] of [['image',imageMimes],['audio',audioMimes]]) {
    const data=input[`${kind}Base64`]; const mime=input[`${kind}MimeType`];
    if(data===undefined && mime===undefined) continue;
    if(typeof data!=='string'||!data.length||data.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)||!mimes.includes(mime)) throw new HttpError(400,`Invalid ${kind} data or unsupported MIME type.`);
    size+=data.length;
    parts.push({inlineData:{mimeType:mime,data}});
  }
  if(!parts.length) throw new HttpError(400,'Provide a photo or a voice note.');
  if(size>3800000) throw new HttpError(413,'Media is too large. Use a smaller photo or shorter recording.');
  return parts;
}
export function usageMetadata(data, model, env=process.env) {
  const token = n => Number.isInteger(n) && n>=0 ? n : null;
  const inputTokens=token(data?.promptTokenCount), outputTokens=token(data?.candidatesTokenCount), totalTokens=token(data?.totalTokenCount), thinkingTokens=token(data?.thoughtsTokenCount);
  const rate = v => typeof v==='string' && v.trim()!=='' && Number.isFinite(Number(v)) && Number(v)>=0 ? Number(v):null;
  const inputRate=rate(env.GEMINI_INPUT_USD_PER_MILLION), outputRate=rate(env.GEMINI_OUTPUT_USD_PER_MILLION);
  const pricingConfigured=inputRate!==null&&outputRate!==null;
  return {model,timestamp:new Date().toISOString(),inputTokens,outputTokens,totalTokens,thinkingTokens,
    estimatedCostUsd:pricingConfigured && inputTokens!==null && outputTokens!==null ? (inputTokens*inputRate+(outputTokens+(thinkingTokens||0))*outputRate)/1000000:null,
    pricingAssumptions:{currency:'USD',inputPerMillion:inputRate,outputPerMillion:outputRate,source:env.GEMINI_PRICING_NOTE||'Not configured; no cost assertion',method:'Input plus candidate and reported thinking tokens; excludes caching, taxes and other charges'},
  };
}
