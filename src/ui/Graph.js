export class RoastGraph {
    constructor(svgEl) {
        this.svg = svgEl;
        this.padding = { top: 20, right: 30, bottom: 30, left: 40 };
        this.profile = null;

        // Auto-resize
        new ResizeObserver(() => {
            if (this.profile) this.render(this.profile);
        }).observe(this.svg);

        this.markerEls = {};
    }

    render(profile) {
        this.profile = profile;
        const rect = this.svg.getBoundingClientRect();
        const W = rect.width;
        const H = rect.height;

        // Clear
        this.svg.innerHTML = "";
        this.markerEls = {};

        if (!profile || !profile.points.length) return;

        // 1. Determine Scales
        // Max time: Profile end + 2 mins buffer (120s)
        const maxT = profile.points[profile.points.length - 1].tS + 120;
        const minT = 0;

        // Max Temp: Find max + buffer
        const allTemps = profile.points.map(p => p.tempC);
        const minC = Math.min(...allTemps, 100); // Floor at 100 if profile is high
        const maxC = Math.max(...allTemps) + 10;

        // Helper to map coordinates
        const mapX = (t) => this.padding.left + (t / maxT) * (W - this.padding.left - this.padding.right);
        const mapY = (c) => H - this.padding.bottom - ((c - minC) / (maxC - minC)) * (H - this.padding.top - this.padding.bottom);

        // 2. Draw Axes (Simple grid)
        // Horizontal Lines (Temp)
        const stepC = 20;
        for (let c = Math.ceil(minC / 10) * 10; c <= maxC; c += stepC) {
            const y = mapY(c);
            this.addEl("line", { x1: this.padding.left, y1: y, x2: W - this.padding.right, y2: y, stroke: "rgba(255,255,255,0.1)", "stroke-dasharray": "4" });
            this.addEl("text", { x: this.padding.left - 5, y: y + 4, fill: "var(--text-muted)", "font-size": "10px", "text-anchor": "end" }, `${c}°`);
        }

        // Vertical Lines (Time) every 2 mins (120s)
        for (let t = 0; t <= maxT; t += 120) {
            const x = mapX(t);
            this.addEl("line", { x1: x, y1: this.padding.top, x2: x, y2: H - this.padding.bottom, stroke: "rgba(255,255,255,0.05)" });
            const min = Math.floor(t / 60);
            this.addEl("text", { x: x, y: H - this.padding.bottom + 14, fill: "var(--text-muted)", "font-size": "10px", "text-anchor": "middle" }, `${min}m`);
        }

        // 3. Draw Profile Curve
        const pathData = profile.points.map((p, i) => {
            return `${i === 0 ? 'M' : 'L'} ${mapX(p.tS)} ${mapY(p.tempC)}`;
        }).join(" ");

        this.addEl("path", {
            d: pathData,
            fill: "none",
            stroke: "var(--gene-red)",
            "stroke-width": "3",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "vector-effect": "non-scaling-stroke",
            filter: "drop-shadow(0 4px 6px rgba(193, 41, 70, 0.3))" // Glow
        });

        // 4. Draw Events via circles
        (profile.events || []).forEach(ev => {
            const x = mapX(ev.tS);
            // We don't have temp for events ideally, assume on curve or fixed?
            // Let's verify temp at time T linearly
            // For now just put them near bottom or top? Or interpolate?
            // Let's put them on the curve roughly
            const y = mapY(this.interpolateTemp(profile.points, ev.tS)); // use interpolate helper if available or just plot at bottom

            this.addEl("circle", { cx: x, cy: y, r: 4, fill: "var(--text-main)", stroke: "var(--bg-panel)", "stroke-width": "2" });
        });

        // 5. Cursor (The visual element to update)
        this.cursor = this.addEl("line", {
            x1: mapX(0), y1: this.padding.top,
            x2: mapX(0), y2: H - this.padding.bottom,
            stroke: "var(--gene-blue)",
            "stroke-width": "2",
            "stroke-dasharray": "5,3"
        });

        // Store scales for update
        this.scales = { mapX, maxT };
    }

    update(elapsedS, markers = {}) {
        if (!this.cursor || !this.scales) return;
        const x = this.scales.mapX(Math.min(elapsedS, this.scales.maxT));
        this.cursor.setAttribute("x1", x);
        this.cursor.setAttribute("x2", x);

        this._updateMarker("yellow", markers.yellowAtS, "#facc15"); // Gold
        this._updateMarker("firstCrack", markers.firstCrackAtS, "#dda0dd"); // Plum
    }

    _updateMarker(key, tS, color) {
        if (tS && !this.markerEls[key]) {
            // Create marker line
            const x = this.scales.mapX(tS);
            const H = this.svg.getBoundingClientRect().height; // or user cached H
            this.markerEls[key] = this.addEl("line", {
                x1: x, y1: this.padding.top,
                x2: x, y2: H - this.padding.bottom,
                stroke: color,
                "stroke-width": 2,
                "stroke-dasharray": "2"
            });
            // Add label?
            this.addEl("text", {
                x: x, y: this.padding.top - 5,
                fill: color, "font-size": "10px", "text-anchor": "middle"
            }, key === "yellow" ? "Y" : "1C");
        }
    }

    addEl(tag, attrs, text) {
        const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        if (text) el.textContent = text;
        this.svg.appendChild(el);
        return el;
    }

    interpolateTemp(points, t) {
        // Simple linear implementation solely for graph plotting dot Y position
        // find segment
        if (t <= points[0].tS) return points[0].tempC;
        if (t >= points[points.length - 1].tS) return points[points.length - 1].tempC;

        const idx = points.findIndex(p => p.tS >= t);
        const p1 = points[idx - 1];
        const p2 = points[idx];
        const factor = (t - p1.tS) / (p2.tS - p1.tS);
        return p1.tempC + (p2.tempC - p1.tempC) * factor;
    }
}
