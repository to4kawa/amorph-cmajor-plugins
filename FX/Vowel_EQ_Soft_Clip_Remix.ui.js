/* UI remix change: 3-1-2 layout with param6 Soft Clip control. */

class FancyDial
{
    constructor (options)
    {
        this.param = options.param;
        this.node = options.node;
        this.knob = options.knob;
        this.valueNode = options.valueNode;
        this.min = options.min;
        this.max = options.max;
        this.step = options.step;
        this.defaultValue = options.defaultValue;
        this.onValue = options.onValue;
        this.formatValue = options.formatValue;

        this.value = this.defaultValue;
        this.dragging = false;
        this.pointerId = -1;
        this.dragSource = "";
        this.startValue = this.value;
        this.startY = 0;

        this.onPointerDownBound = (event) => this.onPointerDown(event);
        this.onPointerMoveBound = (event) => this.onPointerMove(event);
        this.onPointerUpBound = (event) => this.onPointerUp(event);
        this.onMouseDownBound = (event) => this.onMouseDown(event);
        this.onMouseMoveBound = (event) => this.onMouseMove(event);
        this.onMouseUpBound = (event) => this.onMouseUp(event);
        this.onDoubleClickBound = () => this.setValue(this.defaultValue, true);

        this.knob.addEventListener("pointerdown", this.onPointerDownBound);
        this.knob.addEventListener("pointermove", this.onPointerMoveBound);
        this.knob.addEventListener("pointerup", this.onPointerUpBound);
        this.knob.addEventListener("pointercancel", this.onPointerUpBound);
        this.knob.addEventListener("mousedown", this.onMouseDownBound);
        this.knob.addEventListener("dblclick", this.onDoubleClickBound);

        this.updateVisuals();
    }

    destroy ()
    {
        this.knob.removeEventListener("pointerdown", this.onPointerDownBound);
        this.knob.removeEventListener("pointermove", this.onPointerMoveBound);
        this.knob.removeEventListener("pointerup", this.onPointerUpBound);
        this.knob.removeEventListener("pointercancel", this.onPointerUpBound);
        this.knob.removeEventListener("mousedown", this.onMouseDownBound);
        this.knob.removeEventListener("dblclick", this.onDoubleClickBound);

        if (typeof window !== "undefined")
        {
            window.removeEventListener("mousemove", this.onMouseMoveBound, true);
            window.removeEventListener("mouseup", this.onMouseUpBound, true);
        }
    }

    setValue (value, notify)
    {
        const next = this.clamp(this.quantize(value), this.min, this.max);
        this.value = next;
        this.updateVisuals();

        if (notify && typeof this.onValue === "function")
            this.onValue(this.param, this.value);
    }

    updateVisuals ()
    {
        const range = Math.max(1.0e-9, this.max - this.min);
        const norm = this.clamp((this.value - this.min) / range, 0.0, 1.0);
        const angle = -140.0 + norm * 280.0;
        const glow = 0.24 + norm * 0.52;

        this.knob.style.setProperty("--norm", `${norm}`);
        this.knob.style.setProperty("--angle", `${angle}deg`);
        this.knob.style.setProperty("--glow", `${glow}`);

        if (this.valueNode)
            this.valueNode.textContent = this.formatValue(this.param, this.value);
    }

    onPointerDown (event)
    {
        if (this.dragging || (event.button !== undefined && event.button !== 0) || event.isPrimary === false)
            return;

        event.preventDefault();
        this.beginDrag("pointer", event.clientY, event.pointerId);

        try { this.knob.setPointerCapture(event.pointerId); } catch (_) {}
    }

    onPointerMove (event)
    {
        if (!this.dragging || this.dragSource !== "pointer" || event.pointerId !== this.pointerId)
            return;

        event.preventDefault();
        this.updateDrag(event.clientY, event.shiftKey);
    }

    onPointerUp (event)
    {
        if (!this.dragging || this.dragSource !== "pointer" || event.pointerId !== this.pointerId)
            return;

        event.preventDefault();
        this.endDrag();

        try { this.knob.releasePointerCapture(event.pointerId); } catch (_) {}
    }

    onMouseDown (event)
    {
        if (this.dragging || (event.button !== undefined && event.button !== 0))
            return;

        event.preventDefault();
        this.beginDrag("mouse", event.clientY, -1);

        if (typeof window !== "undefined")
        {
            window.addEventListener("mousemove", this.onMouseMoveBound, true);
            window.addEventListener("mouseup", this.onMouseUpBound, true);
        }
    }

    onMouseMove (event)
    {
        if (!this.dragging || this.dragSource !== "mouse")
            return;

        event.preventDefault();
        this.updateDrag(event.clientY, event.shiftKey);
    }

    onMouseUp (event)
    {
        if (!this.dragging || this.dragSource !== "mouse")
            return;

        event.preventDefault();
        this.endDrag();

        if (typeof window !== "undefined")
        {
            window.removeEventListener("mousemove", this.onMouseMoveBound, true);
            window.removeEventListener("mouseup", this.onMouseUpBound, true);
        }
    }

    beginDrag (source, clientY, pointerId)
    {
        this.dragging = true;
        this.dragSource = source;
        this.pointerId = pointerId;
        this.startY = clientY;
        this.startValue = this.value;
        this.node.classList.add("is-dragging");
    }

    updateDrag (clientY, fineMode)
    {
        const delta = this.startY - clientY;
        const range = this.max - this.min;
        const sensitivity = range / 190.0;
        const fine = fineMode ? 0.22 : 1.0;
        this.setValue(this.startValue + delta * sensitivity * fine, true);
    }

    endDrag ()
    {
        this.dragging = false;
        this.dragSource = "";
        this.pointerId = -1;
        this.node.classList.remove("is-dragging");
    }

    quantize (value)
    {
        if (!Number.isFinite(this.step) || this.step <= 0.0)
            return value;

        const steps = Math.round((value - this.min) / this.step);
        return this.min + steps * this.step;
    }

    clamp (value, min, max)
    {
        if (!Number.isFinite(value))
            return min;

        return Math.max(min, Math.min(max, value));
    }
}

class VowelFancyDialsView extends HTMLElement
{
    constructor (patchConnection)
    {
        super();

        this.patchConnection = patchConnection;
        this.controls = new Map();

        this.paramDefs = [
            { id: "param2", label: "Brightness", min: 0.5, max: 2.0, step: 0.01, init: 1.0, valueText: "1.00", classes: "slot top-left palette-mint" },
            { id: "param3", label: "Resonance", min: 3.5, max: 20.0, step: 0.1, init: 8.0, valueText: "8.0", classes: "slot top-center palette-violet" },
            { id: "param5", label: "Pitch", min: 0.5, max: 2.0, step: 0.01, init: 1.0, valueText: "1.00", classes: "slot top-right palette-aqua" },
            { id: "param1", label: "Vowel", min: 0.0, max: 4.0, step: 0.01, init: 0.0, valueText: "a", classes: "slot is-center center palette-amber" },
            { id: "param4", label: "Dry/Wet", min: 0.0, max: 1.0, step: 0.01, init: 0.5, valueText: "50%", classes: "slot bottom-left palette-rose" },
            { id: "param6", label: "Soft Clip", min: 0.0, max: 1.0, step: 0.01, init: 0.0, valueText: "0%", classes: "slot bottom-right palette-lime" }
        ];

        this.paramListener = (event) => this.onParamEvent(event);
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = this.render();
    }

    connectedCallback ()
    {
        this.setupControls();

        if (this.patchConnection && typeof this.patchConnection.addAllParameterListener === "function")
            this.patchConnection.addAllParameterListener(this.paramListener);

        this.requestInitialValues();
    }

    disconnectedCallback ()
    {
        if (this.patchConnection && typeof this.patchConnection.removeAllParameterListener === "function")
            this.patchConnection.removeAllParameterListener(this.paramListener);

        for (const control of this.controls.values())
            control.destroy();

        this.controls.clear();
    }

    setupControls ()
    {
        const nodes = this.shadowRoot.querySelectorAll(".dial-card");

        for (const node of nodes)
        {
            const id = String(node.getAttribute("data-param") || "");
            const def = this.paramDefs.find((entry) => entry.id === id);
            if (!def)
                continue;

            const knob = node.querySelector(".dial-knob");
            const valueNode = node.querySelector(".dial-value");
            if (!knob)
                continue;

            const control = new FancyDial({
                param: id,
                node,
                knob,
                valueNode,
                min: def.min,
                max: def.max,
                step: def.step,
                defaultValue: def.init,
                onValue: (param, value) => this.sendParamValue(param, value),
                formatValue: (param, value) => this.formatValue(param, value)
            });

            control.setValue(def.init, false);
            this.controls.set(id, control);
        }
    }

    requestInitialValues ()
    {
        if (!this.patchConnection || typeof this.patchConnection.requestParameterValue !== "function")
            return;

        for (const def of this.paramDefs)
            this.patchConnection.requestParameterValue(def.id);
    }

    onParamEvent (event)
    {
        if (!event)
            return;

        const id = typeof event.endpointID === "string" ? event.endpointID : "";
        if (!id)
            return;

        const control = this.controls.get(id);
        if (!control || control.dragging)
            return;

        const value = Number(event.value);
        if (!Number.isFinite(value))
            return;

        control.setValue(value, false);
    }

    sendParamValue (id, value)
    {
        if (!this.patchConnection)
            return;

        try
        {
            if (typeof this.patchConnection.sendEventOrValue === "function")
            {
                this.patchConnection.sendEventOrValue(id, value);
                return;
            }
        }
        catch (_) {}

        try
        {
            if (typeof this.patchConnection.sendParameterValue === "function")
            {
                this.patchConnection.sendParameterValue(id, value);
                return;
            }
        }
        catch (_) {}

        try
        {
            if (typeof this.patchConnection.sendEvent === "function")
                this.patchConnection.sendEvent(id, value);
        }
        catch (_) {}
    }

    formatValue (id, value)
    {
        if (!Number.isFinite(value))
            return "0";

        if (id === "param1")
        {
            const vowels = ["a", "e", "i", "o", "u"];
            const index = Math.max(0, Math.min(4, Math.round(value)));
            return vowels[index];
        }

        if (id === "param4" || id === "param6")
            return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

        if (id === "param3")
            return value.toFixed(1);

        return value.toFixed(2);
    }

    renderPetalSet (count, radius, rx, ry, className)
    {
        let markup = "";

        for (let index = 0; index < count; ++index)
        {
            const angle = (360 / count) * index;
            const variant = index % 3 === 0 ? "is-c" : (index % 2 === 0 ? "is-a" : "is-b");
            markup += `<ellipse class="${className} ${variant}" cx="50" cy="${(50 - radius).toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" transform="rotate(${angle.toFixed(2)} 50 50)"></ellipse>`;
        }

        return markup;
    }

    renderKnobArt ()
    {
        return `
            <div class="dial-ornament" aria-hidden="true">
                <svg class="dial-ornament-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    <circle class="ring-shadow" cx="50" cy="50" r="43"></circle>
                    <g class="petal-set petal-set-outer">
                        ${this.renderPetalSet(10, 29, 7.2, 18.4, "petal petal-outer")}
                    </g>
                    <circle class="ring ring-outer" cx="50" cy="50" r="34"></circle>
                    <g class="petal-set petal-set-inner">
                        ${this.renderPetalSet(8, 22.5, 5.2, 11.4, "petal petal-inner")}
                    </g>
                    <circle class="ring ring-mid" cx="50" cy="50" r="24.5"></circle>
                    <circle class="ring ring-core" cx="50" cy="50" r="16"></circle>
                </svg>
            </div>
            <div class="dial-pointer"></div>
            <div class="dial-cap"></div>`;
    }

    renderDialCard (def)
    {
        return `
            <div class="dial-card ${def.classes}" data-param="${def.id}">
                <div class="dial-label">${def.label}</div>
                <div class="dial-knob">${this.renderKnobArt()}</div>
                <div class="dial-value">${def.valueText}</div>
            </div>`;
    }

    renderBackgroundBloom (options)
    {
        const { cx, cy, radius, rotate, opacity, palette } = options;
        let petals = "";

        for (let i = 0; i < 5; ++i)
        {
            const angle = rotate + 72 * i;
            const fill = i % 2 === 0 ? palette.a : palette.b;
            petals += `<ellipse cx="${cx}" cy="${(cy - radius * 0.45).toFixed(2)}" rx="${(radius * 0.16).toFixed(2)}" ry="${(radius * 0.35).toFixed(2)}" fill="${fill}" fill-opacity="${opacity.toFixed(3)}" transform="rotate(${angle.toFixed(2)} ${cx} ${cy})"></ellipse>`;
        }

        return `<g>${petals}<circle cx="${cx}" cy="${cy}" r="${(radius * 0.12).toFixed(2)}" fill="${palette.core}" fill-opacity="${(opacity * 1.5).toFixed(3)}"></circle></g>`;
    }

    renderBackgroundArt ()
    {
        const blooms = [
            { cx: 60, cy: 50, radius: 105, rotate: 10, opacity: 0.26, palette: { a: "#ffa3d0", b: "#ff7eb8", core: "#ffcce6" } },
            { cx: 920, cy: 50, radius: 98, rotate: 20, opacity: 0.24, palette: { a: "#baf8ef", b: "#86dbff", core: "#cffff0" } },
            { cx: 60, cy: 510, radius: 100, rotate: -8, opacity: 0.24, palette: { a: "#d3cbff", b: "#9ec6ff", core: "#ddd7ff" } },
            { cx: 920, cy: 510, radius: 108, rotate: 14, opacity: 0.26, palette: { a: "#a7f1dd", b: "#76d9ff", core: "#cbf8ea" } },
            { cx: 490, cy: 30, radius: 82, rotate: 5, opacity: 0.20, palette: { a: "#e8b8ff", b: "#c49fff", core: "#efe0ff" } },
            { cx: 490, cy: 535, radius: 80, rotate: 25, opacity: 0.20, palette: { a: "#ffb8d4", b: "#ff90c0", core: "#ffd0e4" } }
        ];

        return `
            <svg class="bg-art" viewBox="0 0 980 560" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#191f2c"></stop>
                        <stop offset="52%" stop-color="#121a28"></stop>
                        <stop offset="100%" stop-color="#0d1522"></stop>
                    </linearGradient>
                    <radialGradient id="glow-gold" cx="18%" cy="22%" r="48%">
                        <stop offset="0%" stop-color="#ffd4a6" stop-opacity="0.28"></stop>
                        <stop offset="100%" stop-color="#ffd4a6" stop-opacity="0"></stop>
                    </radialGradient>
                    <radialGradient id="glow-plum" cx="54%" cy="14%" r="34%">
                        <stop offset="0%" stop-color="#d7b8ff" stop-opacity="0.18"></stop>
                        <stop offset="100%" stop-color="#d7b8ff" stop-opacity="0"></stop>
                    </radialGradient>
                    <radialGradient id="glow-teal" cx="82%" cy="86%" r="52%">
                        <stop offset="0%" stop-color="#95f2df" stop-opacity="0.22"></stop>
                        <stop offset="100%" stop-color="#95f2df" stop-opacity="0"></stop>
                    </radialGradient>
                    <pattern id="weave" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
                        <path d="M 0 0 L 0 28" stroke="#ffffff" stroke-opacity="0.035" stroke-width="1"></path>
                        <path d="M 14 0 L 14 28" stroke="#ffffff" stroke-opacity="0.025" stroke-width="1"></path>
                    </pattern>
                </defs>

                <rect x="0" y="0" width="980" height="560" rx="28" fill="url(#bg-grad)"></rect>
                <rect x="0" y="0" width="980" height="560" rx="28" fill="url(#weave)"></rect>
                <rect x="0" y="0" width="980" height="560" rx="28" fill="url(#glow-gold)"></rect>
                <rect x="0" y="0" width="980" height="560" rx="28" fill="url(#glow-plum)"></rect>
                <rect x="0" y="0" width="980" height="560" rx="28" fill="url(#glow-teal)"></rect>
                <g fill="none" stroke="#ffffff" stroke-opacity="0.055">
                    <circle cx="490" cy="284" r="118"></circle>
                    <circle cx="490" cy="284" r="174"></circle>
                    <circle cx="490" cy="284" r="236"></circle>
                    <circle cx="490" cy="284" r="304"></circle>
                </g>
                <g>${blooms.map((bloom) => this.renderBackgroundBloom(bloom)).join("")}</g>
            </svg>`;
    }

    render ()
    {
        return `
        <style>
            :host {
                display: block;
                width: 100%;
                height: 100%;
                overflow: hidden;
                box-sizing: border-box;
                background: #0c1420;
                font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                user-select: none;
                -webkit-user-select: none;
            }

            .root {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                overflow: hidden;
                padding: 10px 12px;
                background: #0b1320;
            }

            .stage {
                position: relative;
                width: 980px;
                height: 560px;
            }

            .bg-art {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                display: block;
                pointer-events: none;
                z-index: 0;
            }

            .stage::after {
                content: "";
                position: absolute;
                inset: 0;
                border-radius: 28px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 26px 56px rgba(0, 0, 0, 0.28);
                pointer-events: none;
                z-index: 2;
            }

            .view-badge {
                position: absolute;
                top: 14px;
                left: 16px;
                z-index: 4;
                padding: 7px 16px 8px;
                border-radius: 999px;
                border: 1px solid rgba(255, 180, 220, 0.4);
                background: rgba(20, 28, 42, 0.72);
                font-size: 14px;
                font-weight: 800;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                line-height: 1;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 24px rgba(0, 0, 0, 0.24);
                pointer-events: none;
            }

            .view-badge span, .dial-label {
                background: linear-gradient(135deg, #ffb3d9, #ff8ec4, #c49fff, #8ecfff, #a3f7bf);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .rack {
                position: relative;
                z-index: 3;
                width: 760px;
                height: 520px;
                margin: 20px auto 0;
            }

            .dial-card {
                --petal-a: #ffd38d;
                --petal-b: #f3a777;
                --petal-c: #fff0c4;
                --petal-glow: rgba(255, 202, 118, 0.42);
                position: absolute;
                transform: translate(-50%, -50%);
                width: 154px;
                display: grid;
                justify-items: center;
                gap: 9px;
                padding: 10px 10px 12px;
                transition: transform 120ms ease;
            }

            .dial-card.top-left { left: 150px; top: 118px; }
            .dial-card.top-center { left: 380px; top: 118px; }
            .dial-card.top-right { left: 610px; top: 118px; }
            .dial-card.center { left: 380px; top: 286px; }
            .dial-card.bottom-left { left: 250px; top: 442px; }
            .dial-card.bottom-right { left: 510px; top: 442px; }

            .dial-card.is-center {
                width: 236px;
                z-index: 6;
            }

            .dial-card.is-dragging {
                transform: translate(-50%, -51%);
            }

            .palette-amber { --petal-a: #ffd693; --petal-b: #eea875; --petal-c: #fff2cb; --petal-glow: rgba(255, 203, 118, 0.42); }
            .palette-mint { --petal-a: #b1f1dc; --petal-b: #88d7ff; --petal-c: #ddfff6; --petal-glow: rgba(129, 233, 214, 0.4); }
            .palette-rose { --petal-a: #ffcca2; --petal-b: #e18ab0; --petal-c: #ffe6d7; --petal-glow: rgba(244, 173, 156, 0.38); }
            .palette-aqua { --petal-a: #9ad9ff; --petal-b: #78e4c8; --petal-c: #daf6ff; --petal-glow: rgba(121, 225, 242, 0.38); }
            .palette-violet { --petal-a: #d3c7ff; --petal-b: #8ebcff; --petal-c: #efeaff; --petal-glow: rgba(192, 186, 255, 0.4); }
            .palette-lime { --petal-a: #d7ff9a; --petal-b: #a3f7bf; --petal-c: #f0ffd0; --petal-glow: rgba(184, 245, 141, 0.42); }

            .dial-label {
                font-size: 18px;
                font-weight: 800;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                line-height: 1;
                white-space: nowrap;
                padding: 6px 14px;
            }

            .dial-card.is-center .dial-label {
                font-size: 28px;
                padding: 8px 22px;
            }

            .dial-knob {
                --norm: 0.0;
                --angle: -140deg;
                --glow: 0.3;
                position: relative;
                width: 88px;
                height: 88px;
                border-radius: 50%;
                touch-action: none;
                cursor: ns-resize;
                background: radial-gradient(circle at 36% 30%, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 28%), radial-gradient(circle at 52% 54%, rgba(27, 38, 57, 0.94) 0%, rgba(12, 20, 31, 0.98) 66%, rgba(5, 10, 17, 1.0) 100%);
                box-shadow: 0 16px 28px rgba(0, 0, 0, 0.46), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -8px 12px rgba(1, 7, 14, 0.86);
                transition: transform 100ms ease, box-shadow 140ms ease;
            }

            .dial-card.is-center .dial-knob {
                width: 142px;
                height: 142px;
            }

            .dial-card.is-dragging .dial-knob {
                transform: translateY(-1px) scale(1.035);
                box-shadow: 0 18px 32px rgba(0, 0, 0, 0.5), 0 0 22px var(--petal-glow), inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -8px 12px rgba(1, 7, 14, 0.86);
            }

            .dial-ornament { position: absolute; inset: 8%; pointer-events: none; }
            .dial-ornament-svg { width: 100%; height: 100%; display: block; overflow: visible; }
            .ring-shadow { fill: none; stroke: rgba(255, 255, 255, 0.04); stroke-width: 6; }
            .petal { stroke: none; }
            .petal.is-a { fill: var(--petal-a); }
            .petal.is-b { fill: var(--petal-b); }
            .petal.is-c { fill: var(--petal-c); }
            .petal-set-outer { opacity: calc(0.14 + var(--glow) * 0.46); }
            .petal-set-inner { opacity: calc(0.12 + var(--glow) * 0.34); }
            .ring { fill: none; }
            .ring-outer { stroke: rgba(255, 255, 255, 0.08); stroke-width: 2.4; }
            .ring-mid { stroke: var(--petal-c); stroke-width: 3.6; opacity: calc(0.18 + var(--glow) * 0.52); }
            .ring-core { stroke: var(--petal-b); stroke-width: 2.8; opacity: calc(0.2 + var(--glow) * 0.42); }

            .dial-pointer {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 4px;
                height: 37%;
                border-radius: 999px;
                transform: translate(-50%, -100%) rotate(var(--angle));
                transform-origin: 50% 100%;
                background: linear-gradient(180deg, rgba(246, 255, 231, 0.98), rgba(161, 213, 129, 0.96) 34%, rgba(79, 136, 62, 0.96) 100%);
                box-shadow: 0 0 0 1px rgba(16, 44, 24, 0.48), 0 0 8px rgba(196, 236, 170, 0.36);
                pointer-events: none;
            }

            .dial-cap {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 24%;
                height: 24%;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                border: 1px solid rgba(110, 77, 18, 0.7);
                background: radial-gradient(circle at 34% 30%, rgba(255, 248, 205, 1), rgba(255, 205, 94, 0.98) 48%, rgba(190, 126, 45, 0.98) 100%);
                box-shadow: 0 0 0 2px rgba(255, 245, 199, 0.2), 0 0 12px rgba(255, 204, 108, 0.34);
                pointer-events: none;
            }

            .dial-value {
                min-width: 96px;
                padding: 7px 14px 9px;
                border-radius: 999px;
                border: 1px solid rgba(163, 198, 236, 0.22);
                background: rgba(9, 17, 27, 0.5);
                color: rgba(240, 245, 252, 0.98);
                text-align: center;
                line-height: 1;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                font-size: 20px;
                font-weight: 780;
                letter-spacing: 0.03em;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 6px 16px rgba(0, 0, 0, 0.18);
            }

            .dial-card.is-center .dial-value {
                min-width: 98px;
                font-size: 38px;
                font-weight: 850;
                padding: 10px 18px 12px;
                font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                text-transform: lowercase;
            }
        </style>

        <div class="root">
            <div class="stage">
                ${this.renderBackgroundArt()}
                <div class="view-badge"><span>Vowel EQ Remix</span></div>
                <div class="rack">
                    ${this.paramDefs.map((def) => this.renderDialCard(def)).join("")}
                </div>
            </div>
        </div>`;
    }
}

export default function createPatchView (patchConnection)
{
    const name = "vowel-eq-soft-clip-remix-v2";

    if (!window.customElements.get(name))
        window.customElements.define(name, VowelFancyDialsView);

    return new (window.customElements.get(name))(patchConnection);
}
