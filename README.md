# Amorph Cmajor Plugins (ADSP)

## Reference (LLM/Codex): Cmajor DSP Rules + Synth Template

Perform the task according to this reference, in Cmajor DSP code.

---

## A) HARD RULES HEADER (read first, follow exactly)

1) **Never use identifiers:** `input`, `output`, `stream` (vars, params, fields).  
2) **Helper functions must be processor-scope** (NOT inside `main()` and NOT inside `event ...`).  
3) **Instrument endpoints required:**  
   - `input event std::midi::Message midiIn;`  
   - `output stream float out;` (or `float<2>` for stereo)  
4) **Types:** `float64` for phase only; everything else `float` unless necessary.  
   - ❌ No `double` in Cmajor  
   - ✅ Use `float64` instead  
5) **No C++-isms:** do not use these tokens/types:  
   `double`, `unsigned`, `uint32_t`, `uint64_t`, `size_t`, `constexpr`, `static`  
6) **Math casting:** `sin/cos/tan/tanh/sqrt/pow/exp/log/...` often return float64 → wrap with `float(...)` when assigning to `float` or writing to `out`.  
7) **Params are 3-step:** endpoint → state var → handler `event paramX (float v) { state = v; }`  
8) **Arrays indexed by int:** prefer `.at(i)`  
9) **Audio loop must:** write `out <- ...;` then `advance();` every iteration.

---

## B) PARAMETER NAMING RULE (CRITICAL – HOST COMPATIBILITY)

In Cmajor the parameter “connection” is bound by the **event endpoint name**.

Different hosts / wrappers behave differently.

### What works reliably across hosts

Use generic names:

    param1, param2, param3, param4, ...

Many wrappers and auto-UI systems:
- Expect these names
- Or hard-bind to `param1..paramN`
- Or enumerate parameters in order but UI code assumes paramN

### What can break

Custom names like:

    cutoffParam
    resonanceParam
    envModParam
    decayParam

In pure Cmajor this is valid.

BUT in some hosts:
- Knobs won’t trigger the event handler
- UI is wired only to `param1..`
- Parameter bridge only binds to paramN naming

### Enforcement Rule

Unless you control the full host + UI layer:

→ **Always use `param1`, `param2`, `param3`, … as endpoint names**  
→ Use annotations (`[[ name: "Cutoff" ]]`) for display labels  
→ Map internally to descriptive state variables

Example (safe):

    input event float param1 [[ name: "Cutoff" ]];
    float cutoffHz = 800.0f;
    event param1 (float v) { cutoffHz = v; }

---

## C) OUTPUT CONTRACT (what the LLM must deliver)

Return exactly:

1) A short **Self-Audit** block  
2) **One** `processor` only  
3) Parameters named `param1..paramN` unless explicitly told otherwise

Do NOT return:
- Any identifier named `input/output/stream`
- Any usage of `double`
- Custom parameter endpoint names (unless explicitly required)

---

## D) SELF-AUDIT (must appear before code)

Self-Audit:
- ✅ No `input/output/stream` identifiers
- ✅ No `double` / C++-only types
- ✅ No function definitions inside `main()` or `event`
- ✅ Parameters use `param1..paramN`
- ✅ `midiIn` + `out` endpoints present (instrument)
- ✅ float(...) casts applied to trig/math
- ✅ All variables initialized
- ✅ `out <-` + `advance()` present in audio loop

---

## E) START FROM THE SYNTH TEMPLATE

```cpp
processor Poly303Bass
{
    output stream float out;
    input event std::midi::Message midiIn;

    // --- Parameters ---
    input event float param1 [[ name: "Sync/Bright", min: 1.0, max: 8.0, init: 2.5 ]];
    input event float param2 [[ name: "Decay",       min: 50.0, max: 2000.0, init: 400.0, unit: "ms" ]];
    input event float param3 [[ name: "Resonance",   min: 0.0, max: 0.95, init: 0.6 ]];
    input event float param4 [[ name: "Drift",       min: 0.0, max: 1.0, init: 0.2 ]];

    // Parameter state
    float syncRatio = 2.5f;
    float decayMs = 400.0f;
    float resonance = 0.6f;
    float driftAmt = 0.2f;

    event param1 (float v) { syncRatio = v; }
    event param2 (float v) { decayMs = v; }
    event param3 (float v) { resonance = v; }
    event param4 (float v) { driftAmt = v; }

    struct Voice
    {
        float noteFreq;
        float64 masterPhase;
        float64 slavePhase;
        float env;
        float driftOffset;
        bool active;
    }

    Voice[12] voices;

    float filterState = 0.0f;

    event midiIn (std::midi::Message msg)
    {
        if (msg.isNoteOn())
        {
            for (int i = 0; i < 12; ++i)
            {
                if (!voices[i].active)
                {
                    voices[i].noteFreq = std::notes::noteToFrequency(msg.getNoteNumber());
                    voices[i].masterPhase = 0.0;
                    voices[i].slavePhase = 0.0;
                    voices[i].env = 1.0f;
                    voices[i].driftOffset = float(msg.getNoteNumber()) * 0.0001f;
                    voices[i].active = true;
                    return;
                }
            }
        }
        if (msg.isNoteOff())
        {
            float freq = std::notes::noteToFrequency(msg.getNoteNumber());
            for (int i = 0; i < 12; ++i)
                if (voices[i].noteFreq == freq) voices[i].active = false;
        }
    }

    void main()
    {
        loop
        {
            float mixedOut = 0.0f;
            let dt = float(processor.period);

            for (int i = 0; i < 12; ++i)
            {
                if (voices[i].active || voices[i].env > 0.001f)
                {
                    let freq = voices[i].noteFreq * (1.0f + voices[i].driftOffset * driftAmt);
                    let slaveFreq = freq * syncRatio;

                    voices[i].masterPhase += freq * processor.period;
                    if (voices[i].masterPhase >= 1.0)
                    {
                        voices[i].masterPhase -= 1.0;
                        voices[i].slavePhase = 0.0;
                    }

                    voices[i].slavePhase += slaveFreq * processor.period;
                    if (voices[i].slavePhase >= 1.0) voices[i].slavePhase -= 1.0;

                    float saw = float(voices[i].slavePhase * 2.0 - 1.0);

                    if (!voices[i].active)
                        voices[i].env *= (1.0f - (dt / (decayMs * 0.001f)));
                    else
                        voices[i].env *= (1.0f - (dt / 5.0f));

                    mixedOut += saw * voices[i].env;
                }
            }

            float cutoff = 2000.0f + (syncRatio * 500.0f);
            float c = clamp(cutoff * float(twoPi) * dt, 0.0f, 1.0f);
            filterState = filterState + c * (mixedOut - filterState);

            out <- filterState * 0.2f;
            advance();
        }
    }
}
