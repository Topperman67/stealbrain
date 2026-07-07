# 🧠 STEAL A BRAINROT — three.js edition

A single-player, browser-playable take on *Steal a Brainrot*, built with [Three.js](https://threejs.org/).
Buy brainrots off the conveyor belt, place them on your base to earn cash, and steal from the AI bots —
who will chase you down and steal from you right back.

## How to play

### Multiplayer (up to 6 players)

```
npm install
node server.js
```

then everyone opens **http://YOUR-IP:5544** (or http://localhost:5544 on the host machine).
Each player who joins claims one of the six bases — buy, steal, slap, and lock against real people.
The belt, podiums, locks, and steals are all server-arbitrated. To play with friends over the
internet, forward port 5544 or use a tunnel like `npx localtunnel --port 5544`.

### Solo (with AI bots)

- Just double-click `index.html` (needs internet for the Three.js CDN), **or**
- open `http://localhost:5544/?offline` while the server runs.

If no server is reachable, the game automatically falls back to solo mode with 5 AI bots.

## Controls

| Key | Action |
|-----|--------|
| **WASD** | Move |
| **Space** | Jump (you can jump onto the conveyor — it carries you!) |
| **Drag mouse** | Rotate camera |
| **Mouse wheel** | Zoom |
| **E** | Buy / Steal / Place (context-sensitive) |
| **F** | Slap (knock thieves back to recover your brainrots) |
| **M** | Mute |

## Gameplay

- 🛒 Brainrots spawn on the central conveyor, from **Common** all the way to **Secret** rarity
  (Mythic+ spawns get announced — don't miss a Tralalero Tralala).
- 💰 Placed brainrots generate **$/s**. Income pools at your base — walk over the **gold pad** to collect.
- 😈 Walk into a bot's base and press **E** on a podium to steal. The owner will chase and slap you —
  if they catch you, they take it back.
- 🚨 Bots periodically raid **your** base too. Slap them with **F** before they escape,
  or step on the **green pad** to lock your base for 60s (relock any time — no cooldown).
- 🗺️ Six fenced bases line the conveyor — the only way in is through the front gate,
  and a locked gate physically blocks intruders (you can even trap a thief inside!).
- 💾 Your money and placed brainrots auto-save to `localStorage`. Use **Reset save** (bottom-right) to start over.

## Roster

19 brainrots across 7 rarities, including Tung Tung Tung Sahur, Bombardiro Crocodilo,
Cappuccino Assassino, Brr Brr Patapim, La Vaca Saturno Saturnita, and the Secret **La Grande Combinasion**.

## Dev notes

- Everything lives in a single `index.html` — no build step, no dependencies to install.
- Characters are detailed procedural models built from primitive shapes: every brainrot has a
  unique multi-part design (teeth, fins, hats, katanas, spinning propellers, orbiting sparkles…),
  and players/bots are blocky avatars with walk-cycle animations and per-bot outfits.
- Rendering: HDR pipeline with UnrealBloom post-processing, image-based ambient lighting,
  a gradient sky dome with sun + drifting clouds, instanced grass/flowers, and soft shadows.
- A debug handle is exposed at `window.__game` in the console (state, bots, placeOnPod,
  frame(dt) for single-stepping, etc.).
