# Gene Cafe Roast Helper (MVP)

## Run it
Because browsers block module `fetch` for `file://` pages in many cases, run a tiny local web server.

### Option 1: Python
From this folder:
- `python3 -m http.server 8000`

Then open:
- http://localhost:8000

### Option 2: VS Code Live Server
Right click `index.html` → "Open with Live Server"

## Use it
1. Click the file picker and select a profile JSON (example in `profiles/test-profile.json`)
2. Click Start
3. Watch SET temp and event pop-ups
4. (Optional) Mark Yellow / Mark 1C Start
5. Press Drop to end and enter green/roasted weights
6. Click Save to store the roast record in localStorage

## Profile format
- `name`: string
- `points`: array of `{ tS: number, tempC: number }` (at least 2)
- `events` (optional): `{ tS: number, label: string, instruction?: string, requireAck?: boolean }`
