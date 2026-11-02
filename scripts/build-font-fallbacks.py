"""Split the licensed complete heading font; website builds consume committed files."""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.ttLib import woff2
import json, logging, argparse, tempfile
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'assets/pantry-hand-complete.woff2'
OUTPUT=ROOT/'assets/fonts'
START='/* PANTRY_FALLBACK_FONTS_START */'
END='/* PANTRY_FALLBACK_FONTS_END */'
BROTLI_COMPRESS=woff2.brotli.compress

def build_chunk(job):
 logging.getLogger('fontTools').setLevel(logging.ERROR)
 # Brotli quality changes encoding effort/bytes only; glyphs remain lossless.
 def encode(data, **options):
  options.setdefault('quality',6)
  return BROTLI_COMPRESS(data,**options)
 woff2.brotli.compress=encode
 index,codes,source=job
 font=TTFont(source)
 options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
 worker=subset.Subsetter(options=options);worker.populate(unicodes=codes);worker.subset(font)
 path=OUTPUT/f'pantry-hand-{index:02d}.woff2';font.flavor='woff2';font.save(path);font.close()
 return {'file':f'./assets/fonts/{path.name}','start':codes[0],'end':codes[-1],'glyphs':len(codes),'bytes':path.stat().st_size,'probe':codes[0]}

def main():
 logging.getLogger('fontTools').setLevel(logging.ERROR)
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=SOURCE);args=parser.parse_args()
 full=TTFont(args.source);ui=TTFont(ROOT/'assets/pantry-ui.woff2')
 reference=TTFont(SOURCE,lazy=True)
 if set(full.getBestCmap())!=set(reference.getBestCmap()) or full['head'].fontRevision!=reference['head'].fontRevision:
  raise ValueError('The source must be the same licensed font version as pantry-hand-complete.woff2')
 reference.close()
 codes=sorted(set(full.getBestCmap())-set(ui.getBestCmap()));ui.close()
 OUTPUT.mkdir(exist_ok=True)
 results=[]
 # Decode WOFF2 transforms once, then share the temporary TTF across workers.
 # An original same-version TTF may be supplied to skip that decoding step.
 with tempfile.TemporaryDirectory(prefix='pantry-font-') as temporary:
  source=args.source
  if full.flavor:
   source=Path(temporary)/'source.ttf';full.flavor=None;full.save(source)
  full.close()
  jobs=[(i,codes[offset:offset+512],source) for i,offset in enumerate(range(0,len(codes),512))]
  with ProcessPoolExecutor(max_workers=4) as pool:
   for future in as_completed([pool.submit(build_chunk,job) for job in jobs]):
    results.append(future.result())
    if len(results)%10==0:print(f'Generated {len(results)}/{len(jobs)} font shards',flush=True)
 results.sort(key=lambda value:value['start'])
 active={Path(value['file']).name for value in results}
 for old in OUTPUT.glob('pantry-hand-*.woff2'):
  if old.name not in active:old.unlink()
 (ROOT/'assets/pantry-font-fallbacks.json').write_text(json.dumps(results,indent=2)+'\n')
 faces='\n'.join('@font-face{font-family:"Pantry Hand Complete";src:url(\''+value['file']+'\') format(\'woff2\');font-style:normal;font-weight:700;font-display:swap;unicode-range:U+'+format(value['start'],'X')+'-'+format(value['end'],'X')+'}' for value in results)
 css=ROOT/'pantry.css';text=css.read_text();block=START+'\n'+faces+'\n'+END
 if START in text:
  before,rest=text.split(START,1);_,after=rest.split(END,1);text=before+block+after
 else:
  old='@font-face{font-family:"Pantry Hand Complete";src:url(\'./assets/pantry-hand-complete.woff2\') format(\'woff2\');font-style:normal;font-weight:700;font-display:swap}'
  assert old in text;text=text.replace(old,block)
 css.write_text(text)
 print(json.dumps({'shards':len(results),'largestBytes':max(value['bytes'] for value in results),'totalBytes':sum(value['bytes'] for value in results)}),flush=True)

if __name__=='__main__':main()
