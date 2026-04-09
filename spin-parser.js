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
        hasWin: toNumber(si.tw) > 0 || toNumber(si.aw) > 0 || toNumber(si.ssaw) > 0,
        raw: si
    };
}

if (typeof module !== "undefined") {
    module.exports = {
        parseSpinPayload
    };
}
