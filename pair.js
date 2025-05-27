const PastebinAPI = require('pastebin-js');
const pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
const pino = require("pino");
const {
    default: France_King,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

let router = express.Router();

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    if (!num || !/^\d+$/.test(num.replace(/[^0-9]/g, ''))) {
        return res.status(400).send({ error: "Invalid or missing phone number" });
    }

    async function FLASH_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);

        try {
            let credsSaved = false;
            const sock = France_King({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS('Chrome')
            });

            sock.ev.on('creds.update', async () => {
                await saveCreds();
                credsSaved = true;
                console.log("Creds saved for session:", id);
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    console.log("Connection open. Sending session...");
                    await delay(5000);

                    const credsPath = __dirname + `/temp/${id}/creds.json`;
                    if (!fs.existsSync(credsPath)) {
                        console.error("Creds file not found:", credsPath);
                        return;
                    }

                    const data = fs.readFileSync(credsPath);
                    const b64data = Buffer.from(data).toString('base64');

                    const session = await sock.sendMessage(sock.user.id, {
                        text: `SESSION ID: ${id}\n\n${b64data}`
                    });

                    const FLASH_MD_TEXT = `
THANK YOU FOR CHOOSING ALONE MD
🔙💚☯️♡𝐃𝐑𝐈𝐏 𝐅𝐀𝐌𝐈𝐋𝐘  .. 🤼 💫
╭━━━━❤━━━━╮
💥 VERY ACTIVE 🙅
🕊️ 𝐂𝐥𝐞𝐚𝐧 𝐚𝐥𝐰𝐚𝐲𝐬 🍏
╰━━━━🥺━━━━╯💚🔙
❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: _https://whatsapp.com/channel/0029VaeRrcnADTOKzivM0S1r_
Follow our channel to learn how to deploy.
Repository available at our channel.`;

                    await sock.sendMessage(sock.user.id, { text: FLASH_MD_TEXT }, { quoted: session });

                    let wait = 0;
                    while (!credsSaved && wait < 10) {
                        await delay(500);
                        wait++;
                    }

                    await delay(1500);
                    await sock.ws.close();
                    console.log("Session closed and file cleaned.");
                    return removeFile(`./temp/${id}`);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.log("Connection closed unexpectedly. Retrying...");
                    await delay(10000);
                    return FLASH_MD_PAIR_CODE();
                }
            });

        } catch (err) {
            console.error("Error during pairing:", err.message);
            removeFile(`./temp/${id}`);
            if (!res.headersSent) {
                res.send({ code: "Service is currently unavailable" });
            }
        }
    }

    return await FLASH_MD_PAIR_CODE();
});

module.exports = router;
