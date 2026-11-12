import type {Artifact} from '../../tabular/types';
export type Modality='text'|'audio'|'video';
export type MultiProject={id:string;name:string;modality:Modality;labels:string[];createdAt:number;updatedAt:number;activeId?:string};
export type Example={id:string;projectId:string;label:string;features:number[];hash:string;text?:string;blob?:Blob;createdAt:number};
export type MultiModel={format:'neuron-multimodal';version:1;modality:Modality;extractor:'hash-words-26-v1'|'audio-spectrum-24-v1'|'video-grid-24-v1';model:Artifact};
export type MultiVersion={id:string;projectId:string;name:string;createdAt:number;artifact:MultiModel};
export const extractorId=(m:Modality):MultiModel['extractor']=>m==='text'?'hash-words-26-v1':m==='audio'?'audio-spectrum-24-v1':'video-grid-24-v1';
export const dimension=(m:Modality)=>m==='text'?26:24;
