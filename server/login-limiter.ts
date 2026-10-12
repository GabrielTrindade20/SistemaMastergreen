// Single-process limiter. Use an upstream/shared limiter before scaling replicas.
export function createLoginLimiter(limit=10,windowMs=15*60_000) {
  const attempts=new Map<string,{count:number;until:number}>();
  return {
    take(key:string,now=Date.now()) {
      attempts.forEach((entry,id)=>{if(entry.until<=now)attempts.delete(id);});
      const entry=attempts.get(key)??{count:0,until:now+windowMs};
      if(entry.count>=limit||attempts.size>=10000)return false;
      entry.count++;attempts.set(key,entry);return true;
    },
    clear(key:string){attempts.delete(key);},
  };
}
