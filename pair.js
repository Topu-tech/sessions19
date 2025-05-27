const PastebinAPI = require('pastebin-js'),
pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: France_King,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

const codeCooldown = {};        // cooldown tracker: { number: timestamp }
const sentNotifications = {};  // track sent notifications: { number: true }
const COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function FLASH_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let Pair_Code_By_France_King = France_King({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS('Chrome')
            });

            await delay(1500);
            num = num.replace(/[^0-9]/g, '');
            const now = Date.now();

            if (codeCooldown[num] && now - codeCooldown[num] < COOLDOWN_MS) {
                const wait = Math.ceil((COOLDOWN_MS - (now - codeCooldown[num])) / 1000);
                return res.status(429).send({ error: `Wait ${wait}s before requesting a new code.` });
            }

            codeCooldown[num] = now;
            const code = await Pair_Code_By_France_King.requestPairingCode(num);

            if (!res.headersSent) {
                await res.send({ code });
            }

            if (!sentNotifications[num]) {
                await Pair_Code_By_France_King.sendMessage(
                    num + '@s.whatsapp.net',
                    { text: `Enter this code to link your device: *${code}*` }
                );
                sentNotifications[num] = true;

                // Auto-clear notification flag after cooldown
                setTimeout(() => {
                    delete sentNotifications[num];
                }, COOLDOWN_MS);
            }

            Pair_Code_By_France_King.ev.on('creds.update', saveCreds);
            Pair_Code_By_France_King.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(5000);
                    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
                    await delay(800);
                    let b64data = Buffer.from(data).toString('base64');
                    let session = await Pair_Code_By_France_King.sendMessage(Pair_Code_By_France_King.user.id, { text: '' + b64data });

                    let FLASH_MD_TEXT = `
THANKYOU FOR CHOOSING ALONE MD
🔙💚☯️♡𝐃𝐑𝐈𝐏 𝐅𝐀𝐌𝐈𝐋𝐘  .. 🤼 💫
  ╭━━━━❤━━━━╮
  💥VERY ACTIVE 🙅
      🕊️𝐂𝐥𝐞𝐚𝐧 𝐚𝐥𝐰𝐚𝐲𝐬🍏
  ╰━━━━🥺━━━━╯💚🔙
❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: _https://whatsapp.com/channel/0029VaeRrcnADTOKzivM0S1r_
║ 
follow our channel to learn how to deploy..
Repository available at our channel`;

                    await Pair_Code_By_France_King.sendMessage(
                        Pair_Code_By_France_King.user.id,
                        { text: FLASH_MD_TEXT },
                        { quoted: session }
                    );

                    await delay(100);
                    await Pair_Code_By_France_King.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    FLASH_MD_PAIR_CODE();
                }
            });

        } catch (err) {
            console.log("service restarted");
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: "Service is Currently Unavailable" });
            }
        }
    }

    return await FLASH_MD_PAIR_CODE();
});

module.exports = router;
