import json,pathlib,subprocess,concurrent.futures,struct,gzip,hashlib,itertools
import numpy as np
# Run from repository root with Python 3 and NumPy. Uses public HTTP assets only.
root=pathlib.Path('work/obstacle-research'); root.mkdir(parents=True,exist_ok=True)
output=pathlib.Path('public/obstacles');output.mkdir(exist_ok=True)
pinned=json.loads((output/'manifest.json').read_text())['maps']

def get(url,path):
 if not path.exists():
  subprocess.run(['curl.exe','-fsSL','--retry','2','-A','WARBOARD data preparation (https://github.com/ifBars/warboard)',url,'-o',str(path)],check=True,stdout=subprocess.DEVNULL)
 return path
def xorshift(seed):
 value=seed & 0xffffffff or 625341585
 while True:
  value ^= (value << 13) & 0xffffffff
  value ^= value >> 17
  value ^= (value << 5) & 0xffffffff
  value &= 0xffffffff
  yield value

def surface_data(name):
 meta=pinned[name];size=meta['size']
 data=get(meta['surfaceSource'],root/(name+'-surface.wdem')).read_bytes()
 assert len(data)==8+size*size*2
 key,header=struct.unpack_from('<II',data)
 assert header==size^key
 order=list(range(size));rng=xorshift(key^2654435769)
 for i in range(size-1,0,-1):
  j=next(rng)%(i+1);order[i],order[j]=order[j],order[i]
 rng=xorshift(key|1)
 mask=np.fromiter((next(rng) for _ in range(size*size//2)),dtype='<u4')
 decoded=(np.frombuffer(data,dtype='<u4',offset=8)^mask).view('<u2').reshape(size,size)
 result=np.empty((size,size),dtype='<u2');result[order]=decoded
 raw=result.tobytes()
 assert hashlib.sha256(raw).hexdigest()==meta['surfaceHash'], 'Pinned composite surface changed'
 return raw

sources={}
for name in ['bakurani','ozeti']:
 base='https://clutchbase.app/wardogs/3d/'+name+'/'
 folder=root/name;folder.mkdir(exist_ok=True)
 index=json.loads(get(base+'tiles.json',folder/'tiles.json').read_text())
 manifest=[json.loads(s) for s in get('https://clutchbase.app/wardogs/3d/bakurani/glb_trees_lod3a/_manifest.jsonl',folder/'manifest.jsonl').read_text().splitlines() if s.strip()]
 files={m['mesh']:m['files'][0] for m in manifest if m.get('files')}
 needed=set(index['tree_meshes'])
 for parts in index['tree_parts'].values():needed.update(parts)
 bounds={}
 def mesh_bounds(mesh):
  if mesh not in files:return mesh,None
  p=folder/(hashlib.sha256(mesh.encode()).hexdigest()[:16]+'.glb')
  b=get('https://clutchbase.app/wardogs/3d/bakurani/glb_trees_lod3a/'+files[mesh],p).read_bytes()
  assert b[:4]==b'glTF'; n=struct.unpack_from('<I',b,12)[0]; d=json.loads(b[20:20+n])
  if any(any(k in node for k in ['matrix','rotation','translation','scale']) for node in d.get('nodes',[])):return mesh,None
  a=[d['accessors'][p['attributes']['POSITION']] for m in d['meshes'] for p in m['primitives']]
  lo=np.min([v['min'] for v in a],axis=0); hi=np.max([v['max'] for v in a],axis=0)
  return mesh,np.array(list(itertools.product(*zip(lo,hi))))
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for mesh,b in pool.map(mesh_bounds,needed):bounds[mesh]=b
 keys=[k for k,v in index['tiles'].items() if v['n_t']]
 def tile(k):return k,get(base+'tiles/'+k+'_t.bin',folder/(k+'_t.bin'))
 raster=np.full((2048,2048),np.nan,dtype='<f4');count=0;missing=0
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for key,p in pool.map(tile,keys):
   rows=np.frombuffer(p.read_bytes(),dtype='<f4').reshape(-1,15);off=0
   for meshid,n in index['tiles'][key]['t']:
    group=rows[off:off+n];off+=n
    parts=[index['tree_meshes'][meshid]]+index['tree_parts'].get(str(meshid),[])
    valid=[bounds.get(m) for m in parts if bounds.get(m) is not None]
    if not valid:missing+=n;continue
    corners=np.concatenate(valid)[:,[0,2,1]]
    for row in group:
     world=(corners*row[12:15])@row[3:12].reshape(3,3)+row[:3]/100
     gx=(world[:,0]+(16320 if name=='bakurani' else 16160))/100
     gy=((-4080 if name=='bakurani' else 160)-world[:,1])/100
     x0=max(0,int(np.floor(gx.min()/163.2*2048)));x1=min(2048,int(np.ceil(gx.max()/163.2*2048))+1)
     y0=max(0,int(np.floor((1-gy.max()/163.2)*2048)));y1=min(2048,int(np.ceil((1-gy.min()/163.2)*2048))+1)
     if x1>x0 and y1>y0:raster[y0:y1,x0:x1]=np.fmax(raster[y0:y1,x0:x1],world[:,2].max());count+=1
    assert off<=len(rows)
   assert off==len(rows)
 data=raster.tobytes();(output/(name+'-canopy.f32.gz')).write_bytes(gzip.compress(data))
 meta=pinned[name]
 raw=surface_data(name);(output/(name+'-surface.u16.gz')).write_bytes(gzip.compress(raw))
 sources[name]={'size':2048,'span':163.2,'scale':meta['scale'],'offset':meta['offset'],'surfaceHash':hashlib.sha256(raw).hexdigest(),'canopyHash':hashlib.sha256(data).hexdigest(),'instances':count,'unresolvedInstances':missing,'source':base,'surfaceSource':meta['surfaceSource'],**{k:v for k,v in meta.items() if k.startswith('road')}}
 print(name,count,'unresolved',missing,flush=True)
(output/'manifest.json').write_text(json.dumps({'version':1,'date':'2026-09-08','maps':sources},indent=2))

