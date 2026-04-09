(function () {
    const LOG_PREFIX = "[Slot AI Detector]";

    console.log(LOG_PREFIX, "page hook aktif");

    if (window.__slotAiDetectorInstalled) return;
    window.__slotAiDetectorInstalled = true;
    window.spinHistory = [];

    function toNumber(value) {
        if (value === null || value === undefined || value === "") return 0;

        const normalized = typeof value === "string"
            ? value.replace(/,/g, ".")
            : value;
        const parsed = Number(normalized);

        return Number.isFinite(parsed) ? parsed : 0;
    }

    function toPositions(value) {
        if (!value || typeof value !== "object") return [];

        return Object.values(value)
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item));
    }

    function parseSpinPayload(payload) {
        const si = payload?.dt?.si || payload?.si || payload;
        if (!si || !Array.isArray(si.orl)) return null;

        const scatterPositions = toPositions(si.ss);
        const bonusPositions = toPositions(si.ssb);
        const scatter = typeof si.sc === "number" ? si.sc : scatterPositions.length;

        return {
            sid: si.sid || "",
            parentSid: si.psid || "",
            state: si.st ?? null,
            nextState: si.nst ?? null,
            reelMode: si.wm ?? null,
            reelSet: Array.isArray(si.rl) ? si.rl : si.orl,
            symbols: si.orl,
            scatter,
            scatterPositions,
            bonusPositions,
            freeSpin: Boolean(si.fs),
            respin: Boolean(si.rs),
            win: toNumber(si.tw),
            lineWin: toNumber(si.aw),
            scatterWin: toNumber(si.ssaw),
            totalWin: toNumber(si.tw) + toNumber(si.aw) + toNumber(si.ssaw),
            bet: toNumber(si.tb || si.tbb),
            net: toNumber(si.np),
            multiplierLevel: toNumber(si.ml),
            coinSize: toNumber(si.cs),
            balanceBefore: toNumber(si.blb),
            balanceAfterBonus: toNumber(si.blab),
            balanceAfter: toNumber(si.bl),
            winType: si.wt || "",
            winKey: si.wk || "",
            hasWin: toNumber(si.tw) > 0 || toNumber(si.aw) > 0 || toNumber(si.ssaw) > 0
        };
    }

    function countScatter(si) {
        if (typeof si?.sc === "number") {
            return si.sc;
        }

        if (si?.ss && typeof si.ss === "object") {
            return Object.keys(si.ss).length;
        }

        if (si?.ssb && typeof si.ssb === "object") {
            return Object.keys(si.ssb).length;
        }

        return 0;
    }

    function last(n) {
        return window.spinHistory.slice(-n);
    }

    function totalWin(list) {
        return list.reduce((a, b) => a + b.win, 0);
    }

    function loseStreak() {
        let streak = 0;
        for (let i = window.spinHistory.length - 1; i >= 0; i--) {
            if (window.spinHistory[i].win === 0) streak++;
            else break;
        }
        return streak;
    }

    function isGoodTiming() {
        return totalWin(last(10)) < 1000 && loseStreak() >= 5;
    }

    function emitSpin(si) {
        const parsed = parseSpinPayload(si);
        if (!parsed) return false;

        const payload = {
            sid: parsed.sid,
            win: parsed.totalWin,
            scatter: parsed.scatter,
            fs: parsed.freeSpin,
            rs: parsed.respin,
            good: isGoodTiming(),
            bet: parsed.bet,
            net: parsed.net,
            balanceBefore: parsed.balanceBefore,
            balanceAfter: parsed.balanceAfter,
            multiplierLevel: parsed.multiplierLevel,
            scatterPositions: parsed.scatterPositions,
            bonusPositions: parsed.bonusPositions,
            hasWin: parsed.hasWin
        };

        window.spinHistory.push({
            win: payload.win,
            scatter: payload.scatter,
            time: Date.now()
        });

        console.warn(LOG_PREFIX, "spin terdeteksi", payload);
        window.postMessage({
            type: "SPIN_DATA",
            data: payload
        }, "*");

        return true;
    }

    function scanPayload(payload) {
        if (!payload) return false;

        if (typeof payload === "string") {
            try {
                return scanPayload(JSON.parse(payload));
            } catch {
                return false;
            }
        }

        if (Array.isArray(payload)) {
            for (const item of payload) {
                if (scanPayload(item)) return true;
            }
            return false;
        }

        if (typeof payload !== "object") return false;

        if (payload?.dt?.si && emitSpin(payload.dt.si)) return true;
        if (payload?.si && emitSpin(payload.si)) return true;
        if (payload?.spin && scanPayload(payload.spin)) return true;
        if (payload?.data && scanPayload(payload.data)) return true;
        if (payload?.dt && scanPayload(payload.dt)) return true;
        if (payload?.result && scanPayload(payload.result)) return true;
        if (payload?.results && scanPayload(payload.results)) return true;

        for (const value of Object.values(payload)) {
            if (scanPayload(value)) return true;
        }

        return false;
    }

    function inspectText(source, text, url) {
        if (!text || !(url || "").toLowerCase().includes("/spin")) return;

        console.log(LOG_PREFIX, source, "spin url:", url);
        const hit = scanPayload(text);

        if (!hit) {
            console.warn(LOG_PREFIX, source, "spin tidak cocok parser");
            console.log(LOG_PREFIX, source, "spin raw:", text.slice(0, 2000));
        }
    }

    const OriginalWS = window.WebSocket;
    if (OriginalWS) {
        function WrappedWebSocket(...args) {
            const ws = new OriginalWS(...args);
            ws.addEventListener("message", (event) => {
                try {
                    inspectText("ws", event.data, args[0]);
                } catch {}
            });
            return ws;
        }

        WrappedWebSocket.prototype = OriginalWS.prototype;
        Object.setPrototypeOf(WrappedWebSocket, OriginalWS);
        window.WebSocket = WrappedWebSocket;
    }

    const originalFetch = window.fetch;
    if (originalFetch) {
        window.fetch = async function (...args) {
            const response = await originalFetch.apply(this, args);

            try {
                const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
                const clone = response.clone();
                const text = await clone.text();
                inspectText("fetch", text, url);
            } catch {}

            return response;
        };
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__slotAiUrl = url;
        return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener("load", function () {
            try {
                inspectText("xhr", this.responseText, this.__slotAiUrl);
            } catch {}
        });

        return originalSend.apply(this, args);
    };
})();
