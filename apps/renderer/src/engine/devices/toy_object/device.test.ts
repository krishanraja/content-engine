import { expect, it } from 'vitest'
import * as T from 'three'
import fixture from './fixture.json'
import { buildSet, projectedBounds, labelBox } from './scene'
import type { DeviceProps } from '../types'
const props=(aspect:'9:16'|'16:9',frame:number):DeviceProps=>({...fixture,aspect,frame,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080},tokens:{ink:'black',inkDeep:'black',inkSoft:'gray',cream:'ivory',mint:'aquamarine',channel:'coral'}} as DeviceProps)
for(const aspect of ['9:16','16:9'] as const) {
  it(`${aspect}: settled hero, copies and label fit; label clears every stud`,()=>{
    for(const frame of [0,65,86,113,150,199]) {
      const p=props(aspect,frame),s=buildSet(p),label=labelBox(p)
      expect(label.left+label.width).toBeLessThan(p.box.width);expect(label.top+label.height).toBeLessThan(p.box.height)
      for(const node of [s.hero,...s.copies]){
        const b=projectedBounds(node,s.camera,p)
        expect(b.left).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(p.box.width)
        expect(b.top).toBeGreaterThanOrEqual(0);expect(b.bottom).toBeLessThanOrEqual(p.box.height)
        node.traverse(stud=>{if(stud.name==='stud'){const r=projectedBounds(stud,s.camera,p);expect(r.top).toBeGreaterThan(label.top+label.height)}})
      }
      if(aspect==='9:16'){const b=projectedBounds(s.hero,s.camera,p);expect(b.right-b.left).toBeGreaterThanOrEqual(.8*p.box.width)}
      // Tall: every toy stays inside the picture slot (y 270 to 1320, config/channel-safe-zones.json).
      if(aspect==='9:16')for(const node of [s.hero,...s.copies]){const b=projectedBounds(node,s.camera,p);expect(b.top).toBeGreaterThanOrEqual(270);expect(b.bottom).toBeLessThanOrEqual(1320)}
    }
  })
  it(`${aspect}: real picture texture is attached upright and follows camera`,()=>{
    const texture=new T.Texture(),a=buildSet(props(aspect,79),texture),b=buildSet(props(aspect,113),texture)
    const face=a.hero.getObjectByName('picture') as T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>
    expect(face.parent).toBe(a.hero);expect(face.material.map).toBe(texture);expect(face.rotation.toArray().slice(0,3)).toEqual([0,0,0])
    const corners=(s:ReturnType<typeof buildSet>)=>[[-1.9,-.775],[1.9,.775]].map(([x,y])=>s.hero.getObjectByName('picture')!.localToWorld(new T.Vector3(x,y,0)).project(s.camera).toArray())
    expect(corners(a)).not.toEqual(corners(b))
  })
}
it('camera drifts between events, repeatably',()=>{const a=buildSet(props('9:16',150)),b=buildSet(props('9:16',156));expect(a.camera.position.toArray()).not.toEqual(b.camera.position.toArray());expect(buildSet(props('9:16',150)).camera.position.toArray()).toEqual(a.camera.position.toArray())})
it('count lights sourced studs; highlight and exit change the object',()=>{
 const a=buildSet(props('9:16',40)),b=buildSet(props('9:16',140));const studs=a.hero.children.filter(c=>c.name==='stud') as T.Mesh<T.SphereGeometry,T.MeshStandardMaterial>[]
 expect(studs.filter(s=>s.material.color.equals(new T.Color('aquamarine')))).toHaveLength(6)
 expect(b.hero.children.filter(c=>c.name==='stud')[7]!.scale.x).toBeGreaterThan(1)
 expect(buildSet(props('9:16',206)).visible).toBe(false)
})
it('the canvas keeps the scene camera: it is manual, so its frustum is never reset to pixel units',()=>{
  for(const aspect of ['9:16','16:9'] as const){const s=buildSet(props(aspect,40));expect((s.camera as T.OrthographicCamera & {manual?:boolean}).manual).toBe(true);expect(s.camera.right-s.camera.left).toBeLessThan(20)}
})
