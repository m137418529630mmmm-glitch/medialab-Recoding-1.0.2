export {};
declare global {
  interface Window {
    electronAPI?: {
      getDefaultSaveInfo: () => Promise<{savePath:string;currentIndex:number}>;
      chooseFolder: (format:string) => Promise<{savePath:string;currentIndex:number}|null>;
      selectRegion: () => Promise<{x:number;y:number;width:number;height:number;cancelled?:boolean}>;
      startRecord: (options:any) => Promise<any>;
      pauseRecord: () => Promise<any>;
      resumeRecord: () => Promise<any>;
      stopSave: () => Promise<{path:string;fileName:string;durationSeconds:number;currentIndex:number}|null>;
      onRegionUpdated: (callback:(region:any)=>void) => (()=>void)|void;
      onRecordingSaved: (callback:(result:any)=>void) => (()=>void)|void;
      onRecordingStatusChange: (callback:(status:any)=>void) => (()=>void)|void;
      onRecordingError?: (callback:(error:string)=>void) => (()=>void)|void;
    };
  }
}
