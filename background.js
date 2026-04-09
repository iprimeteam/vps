const LOG_PREFIX = "[Slot AI Detector]";
const BOT_TOKEN = "8036418324:AAHkFyvJOsYobaXx66rwrAuV-KZXKQj64JU";
const CHAT_ID = "5220629976";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "SEND_TELEGRAM") return;

    const text = message.text || "";
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    console.log(LOG_PREFIX, "background kirim Telegram:", text, sender?.tab?.url || "no-tab");

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: CHAT_ID,
            text
        })
    })
        .then(async (response) => {
            const body = await response.text();
            sendResponse({
                ok: response.ok,
                status: response.status,
                body
            });
        })
        .catch((error) => {
            console.error(LOG_PREFIX, "background gagal kirim Telegram", error);
            sendResponse({
                ok: false,
                error: String(error)
            });
        });

    return true;
});
