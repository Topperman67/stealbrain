// STEAL A BRAINROT — multiplayer server (static files + WebSocket sync)
// Run: npm install && node server.js   → http://localhost:5544
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 5544;
const ROOT = __dirname;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.json':'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/stats'){
    res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-cache' });
    return res.end(JSON.stringify({ online: seats.filter(Boolean).length }));
  }
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                         'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---- game data (mirror of the client tables) ---- */
const RARITIES = { Common:55, Rare:25, Epic:12, Legendary:5, Mythic:2.2, 'Brainrot God':0.7, Secret:0.12 };
const BRAINROTS = [
  ['Noobini Pizzanini','Common'],['Fluriflura','Common'],['Tim Cheese','Common'],['Pipi Kiwi','Common'],
  ['Trippi Troppi','Rare'],['Gangster Footera','Rare'],['Bandito Bobritto','Rare'],
  ['Cappuccino Assassino','Epic'],['Brr Brr Patapim','Epic'],['Trulimero Trulicina','Epic'],
  ['Burbaloni Loliloli','Legendary'],['Frigo Camelo','Legendary'],['Bombardiro Crocodilo','Legendary'],
  ['Lirili Larila','Mythic'],['Tung Tung Tung Sahur','Mythic'],['Bombombini Gusini','Mythic'],
  ['Tralalero Tralala','Brainrot God'],['La Vaca Saturno Saturnita','Brainrot God'],
  ['La Grande Combinasion','Secret'],
];
function pickBrainrot(){
  const total = Object.values(RARITIES).reduce((s,w)=>s+w,0);
  let r = Math.random()*total, rarity = 'Common';
  for (const [name,w] of Object.entries(RARITIES)){ r-=w; if (r<=0){ rarity=name; break; } }
  const pool = BRAINROTS.filter(b=>b[1]===rarity);
  return pool[Math.floor(Math.random()*pool.length)][0];
}

/* ---- room state: 6 seats ---- */
const SEATS = 6;
const seats = Array(SEATS).fill(null);       // { ws, name, pos, carry:{def,from}|null }
const pods  = Array.from({length:SEATS}, ()=>Array(10).fill(null));
const locks = Array(SEATS).fill(0);          // epoch ms
let belt = [];                               // { id, def, t0 }
let beltSeq = 1;
const BELT_MS = (64/1.7)*1000;               // travel time before despawn (matches client BELT.speed)

const wss = new WebSocketServer({ server, path:'/ws' });
const send = (ws,o)=>{ try{ ws.send(JSON.stringify(o)); }catch(e){} };
const cast = (o,except=-1)=>seats.forEach((s,i)=>{ if (s && i!==except) send(s.ws,o); });

setInterval(()=>{                            // belt spawner + pruning
  const now = Date.now();
  belt = belt.filter(b=>now-b.t0 < BELT_MS);
  if (belt.length < 10 && seats.some(Boolean)){
    const item = { id:'S'+beltSeq++, def:pickBrainrot(), t0:now };
    belt.push(item);
    cast({ t:'spawnB', id:item.id, def:item.def });
  }
}, 4500);

function firstEmpty(seat){ return pods[seat].findIndex(p=>!p); }
function returnCarry(seat){                  // put a stolen carry back where it came from
  const c = seats[seat] && seats[seat].carry;
  if (!c) return;
  if (c.from){
    let idx = pods[c.from.seat][c.from.idx] ? firstEmpty(c.from.seat) : c.from.idx;
    if (idx >= 0){ pods[c.from.seat][idx] = c.def; cast({ t:'pod', seat:c.from.seat, idx, def:c.def }); }
  }
  seats[seat].carry = null;
  cast({ t:'carry', seat, def:null, fromSeat:null });
}

wss.on('connection', ws => {
  let seat = -1;
  ws.on('message', raw => {
    let m; try{ m = JSON.parse(raw); }catch(e){ return; }
    if (m.t === 'hello'){
      seat = seats.findIndex(s=>!s);
      if (seat < 0) return send(ws, { t:'full' });
      const name = String(m.name||'Guest').slice(0,18) || 'Guest';
      seats[seat] = { ws, name, pos:{x:0,z:0,ry:0,money:0}, carry:null };
      send(ws, { t:'welcome', seat, now:Date.now(),
        players: seats.map((s,i)=>s?{seat:i,name:s.name}:null).filter(Boolean),
        pods, locks, belt });
      cast({ t:'join', seat, name }, seat);
      console.log(`[+] ${name} -> seat ${seat}`);
      return;
    }
    if (seat < 0 || !seats[seat]) return;
    const me = seats[seat];
    switch (m.t){
      case 'pos':
        me.pos = { x:+m.x||0, z:+m.z||0, ry:+m.ry||0, money:+m.money||0 };
        cast({ t:'pp', seat, ...me.pos }, seat);
        break;
      case 'buy': {
        const i = belt.findIndex(b=>b.id===m.id);
        if (i < 0 || me.carry) break;
        const item = belt.splice(i,1)[0];
        me.carry = { def:item.def, from:null };
        cast({ t:'take', id:item.id, seat, def:item.def });
        cast({ t:'carry', seat, def:item.def, fromSeat:null });
        break;
      }
      case 'place': {
        const idx = m.idx|0;
        if (!me.carry || idx<0 || idx>9 || pods[seat][idx]) break;
        pods[seat][idx] = me.carry.def;
        const stolen = me.carry.from;
        me.carry = null;
        cast({ t:'pod', seat, idx, def:pods[seat][idx] });
        cast({ t:'carry', seat, def:null, fromSeat:null });
        if (stolen && seats[stolen.seat])
          send(seats[stolen.seat].ws, { t:'alert', msg:`💀 ${me.name} got away with your ${pods[seat][idx]}!`, color:'#ff5252' });
        break;
      }
      case 'steal': {
        const vs = m.seat|0, idx = m.idx|0;
        if (vs===seat || vs<0 || vs>=SEATS || me.carry) break;
        if (locks[vs] > Date.now()) break;
        const def = pods[vs] && pods[vs][idx];
        if (!def) break;
        pods[vs][idx] = null;
        me.carry = { def, from:{ seat:vs, idx } };
        cast({ t:'pod', seat:vs, idx, def:null });
        cast({ t:'carry', seat, def, fromSeat:vs });
        break;
      }
      case 'slap': {
        const vs = m.seat|0;
        const victim = seats[vs];
        if (!victim || vs===seat) break;
        const dx = victim.pos.x-me.pos.x, dz = victim.pos.z-me.pos.z;
        if (dx*dx+dz*dz > 36) break;         // loose 6-unit reach check
        cast({ t:'slapped', to:vs, from:seat });
        if (victim.carry && victim.carry.from && victim.carry.from.seat===seat) returnCarry(vs);
        break;
      }
      case 'lock':
        if (locks[seat] > Date.now()) break;
        locks[seat] = Date.now() + 60000;
        cast({ t:'lock', seat, until:locks[seat] });
        break;
    }
  });
  ws.on('close', () => {
    if (seat < 0 || !seats[seat]) return;
    console.log(`[-] ${seats[seat].name} left seat ${seat}`);
    returnCarry(seat);
    seats[seat] = null;
    locks[seat] = 0;
    cast({ t:'leave', seat });
  });
});

server.listen(PORT, () => console.log(`STEAL A BRAINROT server → http://localhost:${PORT}  (ws: /ws)`));
