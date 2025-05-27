const PastebinAPI = require('pastebin-js'),
  pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require('pino');
const {
  default: France_King,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

const cooldowns = {}; // track last pairing request time per number
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 minutes in ms

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  if (!num) {
    return res.status(400).send({ error: 'Missing number query parameter' });
  }

  num = num.replace(/[^0-9]/g, '');
  if (!num) {
    return res.status(400).send({ error: 'Invalid phone number format' });
  }

  // Cooldown check
  const now = Date.now();
  if (cooldowns[num] && now - cooldowns[num] < COOLDOWN_TIME) {
    const waitTime = Math.ceil((COOLDOWN_TIME - (now - cooldowns[num])) / 1000);
    return res.status(429).send({ error: `Please wait ${waitTime} seconds before requesting again.` });
  }

  cooldowns[num] = now;

  async function FLASH_MD_PAIR_CODE() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

    try {
      let Pair_Code_By_France_King = France_King({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
        browser: Browsers.macOS('Chrome'),
      });

      // Check if number exists on WhatsApp
      const jid = num + '@s.whatsapp.net';
      const isOnWA = await Pair_Code_By_France_King.onWhatsApp(jid);
      if (!isOnWA || !isOnWA[0]?.exists) {
        console.log(`Number ${num} is not registered on WhatsApp.`);
        if (!res.headersSent) return res.status(400).send({ error: 'Number is not on WhatsApp' });
        return;
      }

      if (!Pair_Code_By_France_King.authState.creds.registered) {
        await delay(1500);

        // Retry logic for requestPairingCode
        let code;
        try {
          code = await Pair_Code_By_France_King.requestPairingCode(num);
        } catch (e) {
          console.warn('First pairing code request failed, retrying in 3 seconds...');
          await delay(3000);
          try {
            code = await Pair_Code_By_France_King.requestPairingCode(num);
          } catch (err) {
            console.error('Failed to request pairing code:', err);
            if (!res.headersSent) return res.status(500).send({ error: 'Could not request pairing code' });
            return;
          }
        }

        if (!res.headersSent) await res.send({ code });
      }

      Pair_Code_By_France_King.ev.on('creds.update', saveCreds);

      // Timeout to avoid hanging
      const pairingTimeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).send({ error: 'Pairing request timed out' });
        }
        removeFile('./temp/' + id);
      }, 20000);

      Pair_Code_By_France_King.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === 'open') {
          clearTimeout(pairingTimeout);

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

          await Pair_Code_By_France_King.sendMessage(Pair_Code_By_France_King.user.id, { text: FLASH_MD_TEXT }, { quoted: session });

          await delay(100);
          await Pair_Code_By_France_King.ws.close();
          removeFile('./temp/' + id);
        } else if (
          connection === 'close' &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode != 401
        ) {
          clearTimeout(pairingTimeout);
          await delay(10000);
          FLASH_MD_PAIR_CODE();
        }
      });
    } catch (err) {
      console.log('Service restarted due to error:', err);
      removeFile('./temp/' + id);
      if (!res.headersSent) {
        res.send({ code: 'Service is Currently Unavailable' });
      }
    }
  }

  return await FLASH_MD_PAIR_CODE();
});

module.exports = router;
