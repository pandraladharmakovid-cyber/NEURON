import {shareableArtifact} from './share-format';
import {validateTabularModel} from '../../tabular/model-format';
import {validateMultiModel} from '../multimodal/model';
import {validateCustom,saveCustom} from '../custom/model';
import {importReceived} from './sharing.service';
import {importModel} from '../../tabular/repository';
import {importMulti} from '../multimodal/repository';
import {requireCondition} from '../../lib/errors';
export function validatePeerModel(value:unknown){const a=value as {format:string};requireCondition(a&&typeof a==='object','Choose a supported model JSON, not a full backup or arbitrary binary.');if(a.format==='neuron-image')return shareableArtifact(a);if(a.format==='neuron-tabular')return validateTabularModel(a);if(a.format==='neuron-multimodal')return validateMultiModel(a);if(a.format==='neuron-custom-linear')return validateCustom(a);throw new Error('P2P accepts model-only image, CSV, media or custom linear JSON. Full backups/raw datasets/deletion receipts/executable model graphs are not accepted.');}
export async function importPeer(value:unknown,name:string){const a=validatePeerModel(value);requireCondition(name.trim()&&name.length<=64,'Choose a name <=64 characters.');if(a.format==='neuron-image'){const p=await importReceived({format:'neuron-shared-model',version:1,name,artifact:a});return '/projects/'+p.id+'/predict';}if(a.format==='neuron-tabular'){const p=await importModel(a,name);return '/tabular/'+p.id+'/predict';}if(a.format==='neuron-multimodal'){await importMulti(a,name);return '/media';}await saveCustom({...a,name});return '/custom';}
