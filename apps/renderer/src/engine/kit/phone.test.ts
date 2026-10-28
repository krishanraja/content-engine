import { describe, expect, it } from 'vitest'
import format from '../../../../../config/ve/formats/hand-held-screen.json'
import { Cam } from './camera'
import { homography } from './homography'
import { PH,PW,QUAD,Screen,uiClipPath } from './phoneGlass'
const point=(actual:readonly number[],expected:readonly number[],digits=6)=>actual.forEach((v,i)=>expect(v).toBeCloseTo(expected[i]!,digits))
describe('Python phone geometry parity',()=>{
  it.each([
    [new Cam(1.8,-3,-78.7,535.9),'matrix3d(0.48566510,0.09329935,0.00000000,-0.00006900,-0.19396267,0.47665805,0.00000000,-0.00006731,0.00000000,0.00000000,1.00000000,0.00000000,235.83583886,50.24915899,0.00000000,1.00000000)',[[350.0,604.0],[953.8,687.9],[604.5,2008.2],[-40.4,1853.0]]],
    [new Cam(1.95,-104.5,-197.2,1648.3),'matrix3d(0.44830625,0.08612248,0.00000000,-0.00006369,-0.17904247,0.43999204,0.00000000,-0.00006213,0.00000000,0.00000000,1.00000000,0.00000000,235.83583886,50.24915899,0.00000000,1.00000000)',[[-217.5,1178.5],[-258.8,519.4],[1218.2,605.1],[1192.7,1323.1]]],
  ] as const)('matches matrix and rounded canvas corners for %s',(cam,css,corners)=>{
    const s=new Screen(cam)
    expect(s.css()).toBe(css)
    s.quadC().forEach((p,i)=>p.forEach((v,j)=>expect(Math.abs(v-corners[i]![j]!)).toBeLessThan(0.06)))
    for(const p of [[0,0],[941,1672],[-17,732],[235.835838862,50.249158995]] as const) point(cam.c2p(...cam.p2c(p[0],p[1])),p)
    point(cam.p2c(0,0),[cam.tx,cam.ty])
  })
  it('maps a unit rectangle onto the exact quad',()=>{
    const h=homography([[0,0],[1,0],[1,1],[0,1]],QUAD)
    ;[[0,0],[1,0],[1,1],[0,1]].forEach(([x,y],i)=>{
      const z=h[2][0]*x!+h[2][1]*y!+1
      point([(h[0][0]*x!+h[0][1]*y!+h[0][2])/z,(h[1][0]*x!+h[1][1]*y!+h[1][2])/z],QUAD[i]!)
    })
    expect(()=>homography([[0,0],[0,0],[0,0],[0,0]],QUAD)).toThrow('singular')
  })
  it('ports check_cover for all approved cameras, except the declared F4 sleeve edge',()=>{
    for(const [id,c] of Object.entries(format.cameras)) {
      const cam=new Cam(c.k,c.rot,c.tx,c.ty), bg=c.bg
      const backdrop=new Cam(bg.k,'rot' in bg?bg.rot:0,bg.x,bg.y)
      for(const p of [[0,0],[1080,0],[1080,1920],[0,1920]] as const) {
        if(id!=='evidence') expect(cam.c2p(p[0],p[1])[0]).toBeGreaterThanOrEqual(0)
        const [x,y]=backdrop.c2p(p[0],p[1])
        expect(x).toBeGreaterThanOrEqual(-1); expect(x).toBeLessThanOrEqual(PW+1)
        expect(y).toBeGreaterThanOrEqual(-1); expect(y).toBeLessThanOrEqual(PH+1)
      }
    }
  })
  it('rounds the expanded plate clip exactly as Python',()=>{
    expect(uiClipPath()).toBe("path('M217.5 73.7Q230.1 40.0 265.4 46.8L544.7 100.6Q580.1 107.4 569.1 141.7L353.1 813.5Q342.1 847.8 307.6 837.6L5.7 748.0Q-28.8 737.7 -16.3 704.0Z')")
  })
})
