import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PluginContext, PluginInstance } from '../../platform/plugin-contract.js';
import { createPalaceProvider } from './index.js';
import type { PalaceOptions } from './types.js';

/** Distribution adapter only; the platform loads this through the generic plugin contract. */
export async function createPlugin(context:PluginContext):Promise<PluginInstance> {
  const settings=context.settings??{};
  let validationRunner:PalaceOptions['validationRunner'];
  if(settings.autoActivateSkills===true){
    if(typeof settings.validationModule!=='string'||!isAbsolute(settings.validationModule))
      throw new Error('TRUSTED_VALIDATION_MODULE_REQUIRED');
    const module=await import(pathToFileURL(settings.validationModule).href) as {
      createValidationRunner?:(context:PluginContext)=>PalaceOptions['validationRunner']|Promise<PalaceOptions['validationRunner']>;
    };
    if(typeof module.createValidationRunner!=='function')throw new Error('VALIDATION_FACTORY_REQUIRED');
    validationRunner=await module.createValidationRunner(context);
    if(typeof validationRunner!=='function')throw new Error('VALIDATION_RUNNER_REQUIRED');
  }
  const provider=createPalaceProvider({dataRoot:context.dataRoot,deviceId:context.deviceId,projectRoots:context.projectRoots,
    sourceRoots:context.sourceRoots,discoverKnownSources:settings.discoverKnownSources!==false,
    autoIndex:settings.autoIndex!==false,indexBudget:settings.indexBudget as PalaceOptions['indexBudget'],validationRunner});
  return {
    start:()=>provider.start(),stop:()=>provider.stop(),
    async invoke(capability,input,invocation){
      try{return await provider.invoke(capability,input,invocation);}
      catch(error){
        // Stable provider domain failures are call errors, not plugin process faults.
        if(error instanceof Error&&/^[A-Z][A-Z0-9_]+(?::.*)?$/.test(error.message)){
          const coded=error as Error&{code?:string};coded.code=error.message.split(':')[0];throw coded;
        }
        throw error;
      }
    }
  };
}
export function migrate(options:{dataRoot:string;fromVersion:number;toVersion:number}):void {
  if(options.toVersion!==1||options.fromVersion>1)throw new Error('PALACE_MIGRATION_ADAPTER_REQUIRED');
}
