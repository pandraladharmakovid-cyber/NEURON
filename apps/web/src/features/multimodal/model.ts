import type {MultiModel,Modality} from './types';
import {extractorId,dimension} from './types';
import {validateTabularModel} from '../../tabular/model-format';
import {requireCondition} from '../../lib/errors';
import {textFeatures} from './text';
import {audioFeatures} from './audio';
import {videoFeatures} from './video';
import {predictRow} from '../../tabular/predict';
export const featureNames=(modality:Modality)=>Array.from({length:dimension(modality)},(_,i)=>'f'+i);
export function validateMultiModel(value:unknown):MultiModel{const a=value as MultiModel;requireCondition(a&&a.format==='neuron-multimodal'&&a.version===1&&['text','audio','video'].includes(a.modality)&&a.extractor===extractorId(a.modality),'Unsupported multimodal model/extractor version.');const model=validateTabularModel(a.model),names=featureNames(a.modality);requireCondition(model.config.task==='classification'&&model.config.target==='label'&&model.config.features.length===names.length&&model.config.features.every((f,i)=>f.name===names[i]&&f.kind==='numeric'),'Multimodal feature contract mismatch.');return {format:'neuron-multimodal',version:1,modality:a.modality,extractor:a.extractor,model};}
export async function extract(modality:Modality,input:string|Blob,signal?:AbortSignal){signal?.throwIfAborted();if(modality==='text'){requireCondition(typeof input==='string','Enter plain text.');return textFeatures(input);}requireCondition(input instanceof Blob,'Choose a media file.');const result=await (modality==='audio'?audioFeatures(input,signal):videoFeatures(input,signal));signal?.throwIfAborted();return result;}
export async function predictMulti(artifact:MultiModel,input:string|Blob,signal?:AbortSignal){const safe=validateMultiModel(artifact),values=await extract(safe.modality,input,signal);return predictRow(safe.model,Object.fromEntries(featureNames(safe.modality).map((name,i)=>[name,String(values[i])])));}
