(function () {
    const LOG_PREFIX = "[Slot AI Detector]";
    const SCAN_INTERVAL = 1200;
    const CHANGE_COOLDOWN = 2500;

    console.log(LOG_PREFIX, "content script aktif");

    let lastSend = 0;
    let lastSignature = "";
    const DELAY = 5000;

    function sendTelegram(text) {
        const now = Date.now();
        if (now - lastSend < DELAY) {
            console.log(LOG_PREFIX, "telegram di-skip karena delay", text);
            return;
        }
        lastSend = now;

        console.log(LOG_PREFIX, "minta background kirim Telegram:", text);

        chrome.runtime.sendMessage(
            {
                type: "SEND_TELEGRAM",
                text
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error(LOG_PREFIX, "gagal hubungi background", chrome.runtime.lastError.message);
                    return;
                }

                console.log(LOG_PREFIX, "hasil Telegram:", response);
            }
        );
    }

    function normalizeText(value) {
        return (value || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function extractVisibleText() {
        return normalizeText(document.body?.innerText || document.documentElement?.innerText || "");
    }

    function extractNumber(text, label) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const patterns = [
            new RegExp(`${escaped}\\s*:?\\s*([0-9]+(?:[.,][0-9]+)?)`, "i"),
            new RegExp(`${escaped}[^0-9]{0,20}([0-9]+(?:[.,][0-9]+)?)`, "i")
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].replace(",", ".");
            }
        }

        return "";
    }

    function detectState(text) {
        const upper = text.toUpperCase();
        const freeSpins = /FREE\s*SPINS?/i.test(text);
        const totalWin = extractNumber(text, "TOTAL WIN");
        const win = extractNumber(text, "WIN");
        const remaining = extractNumber(text, "REMAINING");
        const multiplierMatch = upper.match(/X\s*([0-9]+)/);
        const multiplier = multiplierMatch ? multiplierMatch[1] : "";

        const flags = [];
        if (freeSpins) flags.push("FREE_SPIN");
        if (/PLATED SYMBOLS/i.test(text)) flags.push("PLATED_SYMBOLS");
        if (/MULTIPLIER/i.test(text)) flags.push("MULTIPLIER_TEXT");
        if (/SCATTER/i.test(text)) flags.push("SCATTER_TEXT");

        return {
            freeSpins,
            totalWin,
            win,
            remaining,
            multiplier,
            flags
        };
    }

    function buildSignature(state) {
        return [
            state.freeSpins ? "FS1" : "FS0",
            state.totalWin || "0",
            state.win || "0",
            state.remaining || "0",
            state.multiplier || "0",
            state.flags.join(",")
        ].join("|");
    }

    function buildMessage(state) {
        const parts = [
            `FS: ${state.freeSpins ? "YA" : "TIDAK"}`,
            `TOTAL_WIN: ${state.totalWin || "0"}`,
            `WIN: ${state.win || "0"}`,
            `REMAINING: ${state.remaining || "0"}`,
            `MULTI: ${state.multiplier || "-"}`,
            `FLAG: ${state.flags.length ? state.flags.join(",") : "-"}`
        ];

        return parts.join(" | ");
    }

    function scanPage(reason) {
        const text = extractVisibleText();
        if (!text) return;

        const state = detectState(text);
        const signature = buildSignature(state);

        if (!signature || signature === lastSignature) return;

        lastSignature = signature;
        console.log(LOG_PREFIX, "state berubah", reason, state);
        sendTelegram(buildMessage(state));
    }

    let pending = null;
    function scheduleScan(reason) {
        if (pending) return;

        pending = setTimeout(() => {
            pending = null;
            scanPage(reason);
        }, CHANGE_COOLDOWN);
    }

    function startObserver() {
        const observer = new MutationObserver(() => {
            scheduleScan("mutation");
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function start() {
        startObserver();
        scanPage("initial");
        window.setInterval(() => scanPage("interval"), SCAN_INTERVAL);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
