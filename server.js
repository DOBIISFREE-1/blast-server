const express = require("express");
const axios = require("axios");
const cors = require("cors");
const xml2js = require("xml2js");

const app = express();
app.use(cors());
app.use(express.json());

const parser = new xml2js.Parser({ explicitArray: false });

// rate‑limit: 마지막 요청 시간 저장
let lastRequestTime = 0;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.post("/blast", async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastRequestTime < 10_000) {  // 10초보다 짧으면 대기
      const waitMs = 10_000 - (now - lastRequestTime);
      console.log(`Rate‑limit: waiting ${waitMs} ms before BLAST`);
      await wait(waitMs);
    }
    lastRequestTime = Date.now();

    let querySequence = req.body.query;
    if (!querySequence || !querySequence.trim()) {
      return res.status(400).json({ error: "query is required" });
    }

    // FASTA 형식
    const fasta = `>query\n${querySequence.trim()}`;

    const params = new URLSearchParams();
    params.append("CMD", "Put");
    params.append("PROGRAM", "blastn");
    params.append("DATABASE", "nt");  // 또는 다른 DB
    params.append("QUERY", fasta);
    params.append("FORMAT_TYPE", "XML2");
    // optional: params.append("email", "your_email@example.com");
    // optional: params.append("tool", "MyAppName");

    const bodyString = params.toString();

    console.log("Sending BLAST PUT request:", bodyString.substring(0, 200));

    const putResp = await axios.post(
      "https://blast.ncbi.nlm.nih.gov/Blast.cgi",
      bodyString,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const text = putResp.data;
    console.log("BLAST PUT response snippet:", text.substring(0, 300));

    const ridMatch = text.match(/RID = (\\S+)/);
    if (!ridMatch) {
      return res.status(500).send("No RID found in response");
    }
    const rid = ridMatch[1];
    console.log("Received RID:", rid);

    // 폴링 대기
    await wait(60_000);  // 1분 대기

    // 결과 가져오기
    const getResp = await axios.get(
      `https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=XML2`
    );
    const out = getResp.data;
    console.log("BLAST GET response snippet:", out.substring(0, 300));

    if (!out.includes("<BlastOutput")) {
      return res.status(500).send("Non‑XML result");
    }

    res.send(out);
  } catch (err) {
    console.error("BLAST error:", err);
    res.status(500).send("BLAST error: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
