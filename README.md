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
5. Press Drop to store the roast as cooling/pending final weight
6. Start the next batch when ready
7. After cooling, click Complete in Post-Roast Analytics and enter the final roasted weight

## Guided Builder
Use **Guided Builder** in the profile library when you want a fast first-pass profile for a new coffee.

1. Choose the coffee `Country`, `Process`, `Region`, and target roast level
2. Adjust the bounded drying, Maillard, peak, and development settings if needed
3. Preview it in the app, save it to the local library, export it, or write it directly into your repo's `profiles/` folder when your browser supports folder writing

The builder keeps the editable values inside conservative Gene Cafe guardrails so it is harder to create a profile that is obviously unusable.

## Profile format
- `name`: string
- `points`: array of `{ tS: number, tempC: number }` (at least 2)
- `events` (optional): `{ tS: number, label: string, instruction?: string, requireAck?: boolean }`
- `beanInfo` (optional): coffee metadata such as origin, process, crop year, roast target, and batch size
- `roasterSettings` (optional): helper metadata such as recommended preheat and Gene start time
